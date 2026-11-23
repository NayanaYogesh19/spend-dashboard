import { useState, useEffect, useRef, useCallback } from 'react';
import { PurchaseRequest, RequestStatus, PurchaseRecord, SubscriptionRecord, AdSpendRecord, ReconciliationPeriod, BankTransaction, MerchantAlias, CardType, AuditLog, PurchaseCompletionDetails, ImportedSubscriptionInput, ManualResolutionInput, SubscriptionStatus, AdSpendInput } from '../types';
import { parseBankDate, parseISODate, toISODate, addBillingCycle } from '../utils/recurringMatch';
import { COLLECTIONS, NEWEST_FIRST, Collection, SyncPayload, stableStringify } from '../sync/collections';

// Data used to live only in this browser's localStorage. It's now read once,
// to offer a one-time upload to the shared database.
const LEGACY_STORAGE_KEY = 'spendy_data';
const LEGACY_IMPORTED_KEY = 'spendy_data_imported';
const API_URL = '/api/state';
const REFRESH_MS = 20000;

type StoreData = {
  requests: PurchaseRequest[];
  purchases: PurchaseRecord[];
  subscriptions: SubscriptionRecord[];
  adSpends: AdSpendRecord[];
  periods: ReconciliationPeriod[];
  bankTransactions: BankTransaction[];
  merchantAliases: MerchantAlias[];
  auditLogs: AuditLog[];
};

export type SyncStatus = 'loading' | 'ready' | 'saving' | 'error';

const emptyData = (): StoreData => ({ requests: [], purchases: [], subscriptions: [], adSpends: [], periods: [], bankTransactions: [], merchantAliases: [], auditLogs: [] });

const normalize = (raw: any): StoreData => {
  const out = emptyData() as Record<Collection, any[]>;
  for (const c of COLLECTIONS) out[c] = Array.isArray(raw?.[c]) ? raw[c] : [];
  return out as StoreData;
};

// id -> stableStringify(record), per collection: what the server is known to hold.
type Snapshot = Record<Collection, Map<string, string>>;

const snapshotOf = (data: StoreData): Snapshot => {
  const snap = {} as Snapshot;
  for (const c of COLLECTIONS) snap[c] = new Map((data[c] as { id: string }[]).map(r => [r.id, stableStringify(r)]));
  return snap;
};

// Records that differ from the server. New records get a created_at that keeps
// their place in the list once the server sorts by it.
const diff = (data: StoreData, synced: Snapshot) => {
  const payload: SyncPayload = {};
  const changed: [Collection, string, string][] = [];
  let tick = Date.now();
  for (const c of COLLECTIONS) {
    const records = data[c] as unknown as ({ id: string } & Record<string, unknown>)[];
    const oldestFirst = NEWEST_FIRST[c] ? [...records].reverse() : records;
    for (const record of oldestFirst) {
      const json = stableStringify(record);
      const known = synced[c].get(record.id);
      if (known === json) continue;
      (payload[c] ??= []).push(known === undefined ? { record, createdAt: new Date(tick++).toISOString() } : { record });
      changed.push([c, record.id, json]);
    }
  }
  return { payload, changed };
};

const readLegacyData = (): StoreData | null => {
  try {
    const item = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!item) return null;
    const data = normalize(JSON.parse(item));
    return COLLECTIONS.some(c => data[c].length > 0) ? data : null;
  } catch {
    return null;
  }
};

// Legacy records the server doesn't have yet, or null if there are none.
const missingFrom = (legacy: StoreData | null, server: StoreData): StoreData | null => {
  if (!legacy) return null;
  const out = emptyData() as Record<Collection, any[]>;
  for (const c of COLLECTIONS) {
    const known = new Set((server[c] as { id: string }[]).map(r => r.id));
    out[c] = (legacy[c] as { id: string }[]).filter(r => !known.has(r.id));
  }
  return COLLECTIONS.some(c => out[c].length > 0) ? out as StoreData : null;
};

export function useStore() {
  const [data, setData] = useState<StoreData>(emptyData);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [legacyData, setLegacyData] = useState<StoreData | null>(null);

  const loadedRef = useRef(false);
  const syncedRef = useRef<Snapshot>(snapshotOf(emptyData()));
  const dataRef = useRef(data);
  dataRef.current = data;
  const inFlightRef = useRef(0);
  const writeVersionRef = useRef(0);

  const hasLocalChanges = () => Object.keys(diff(dataRef.current, syncedRef.current).payload).length > 0;

  const fetchState = useCallback(async (initial: boolean) => {
    const versionAtStart = writeVersionRef.current;
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Server returned ${res.status}`);
      const server = normalize(body);

      // Don't overwrite edits that are unsaved or were saved after this read began.
      if (!initial && (inFlightRef.current > 0 || writeVersionRef.current !== versionAtStart || hasLocalChanges())) return;

      syncedRef.current = snapshotOf(server);
      if (initial || stableStringify(server) !== stableStringify(dataRef.current)) setData(server);
      loadedRef.current = true;
      setSyncError(null);
      setSyncStatus('ready');

      if (initial) {
        try {
          if (!window.localStorage.getItem(LEGACY_IMPORTED_KEY)) setLegacyData(missingFrom(readLegacyData(), server));
        } catch { /* storage blocked */ }
      }
    } catch (error) {
      console.warn('Error loading data', error);
      setSyncError((error as Error).message);
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchState(true);
    // Retries the first load too, if it failed.
    const refresh = () => { if (document.visibilityState === 'visible') fetchState(!loadedRef.current); };
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [fetchState]);

  // Push every local change to the server.
  useEffect(() => {
    if (!loadedRef.current) return;
    const { payload, changed } = diff(data, syncedRef.current);
    if (changed.length === 0) return;

    // Mark as synced now so the next render doesn't resend; undo on failure.
    const previous = changed.map(([c, id]) => [c, id, syncedRef.current[c].get(id)] as const);
    for (const [c, id, json] of changed) syncedRef.current[c].set(id, json);
    inFlightRef.current++;
    writeVersionRef.current++;
    setSyncStatus('saving');

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server returned ${res.status}`);
        setSyncError(null);
      })
      .catch(error => {
        console.warn('Error saving data', error);
        for (const [c, id, json] of previous) {
          if (json === undefined) syncedRef.current[c].delete(id);
          else syncedRef.current[c].set(id, json);
        }
        setSyncError((error as Error).message);
        // The change is still pending; a re-render re-runs this effect and resends it.
        window.setTimeout(() => setData(d => ({ ...d })), REFRESH_MS);
      })
      .finally(() => {
        inFlightRef.current--;
        if (inFlightRef.current === 0) setSyncStatus(s => (s === 'saving' ? 'ready' : s));
      });
  }, [data]);

  const importLegacyData = () => {
    if (!legacyData) return;
    // Merge, skipping anything another browser uploaded since this page loaded.
    setData(prev => {
      const toAdd = missingFrom(legacyData, prev);
      if (!toAdd) return prev;
      const next = { ...prev } as Record<Collection, any[]>;
      for (const c of COLLECTIONS) next[c] = [...(prev as Record<Collection, any[]>)[c], ...toAdd[c]];
      return next as StoreData;
    });
    try { window.localStorage.setItem(LEGACY_IMPORTED_KEY, new Date().toISOString()); } catch { /* storage blocked */ }
    setLegacyData(null);
  };

  const dismissLegacyData = () => {
    try { window.localStorage.setItem(LEGACY_IMPORTED_KEY, 'dismissed'); } catch { /* storage blocked */ }
    setLegacyData(null);
  };

  const addRequest = (req: Omit<PurchaseRequest, 'id' | 'createdAt'>) => {
    const newRequest: PurchaseRequest = {
      ...req,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, requests: [newRequest, ...prev.requests] }));
  };

  const updateRequestStatus = (id: string, status: RequestStatus, managerName?: string) => {
    setData(prev => ({
      ...prev,
      requests: prev.requests.map((req) => {
        if (req.id === id) {
          const updates: Partial<PurchaseRequest> = { status };
          
          if (status === 'Approved') {
            const year = new Date().getFullYear();
            const randomNum = Math.floor(Math.random() * 9999) + 1;
            const paddedNum = String(randomNum).padStart(4, '0');
            updates.purchaseId = `PUR-${year}-${paddedNum}`;
            updates.managerName = managerName || 'System Admin';
            updates.approvalTimestamp = new Date().toISOString();
          } else if (status === 'Rejected') {
            updates.managerName = managerName || 'System Admin';
            updates.approvalTimestamp = new Date().toISOString();
          } else if ((status === 'Awaiting Purchase Completion' || status === 'OTP Verified') && !req.otpProvidedAt) {
            // Finance has provided the OTP: record the moment (kept if set already).
            updates.otpProvidedAt = new Date().toISOString();
          }

          return { ...req, ...updates };
        }
        return req;
      })
    }));
  };

  const processPurchase = (req: PurchaseRequest, details: Partial<PurchaseRecord>) => {
    const record: PurchaseRecord = {
      id: crypto.randomUUID(),
      purchaseId: req.purchaseId!,
      vendor: req.toolVendor,
      employee: req.requesterName,
      pod: req.pod,
      client: req.clientName,
      billable: req.expenseType === 'Client',
      approvedAmount: req.amount,
      actualAmount: details.actualAmount || req.amount,
      currency: req.currency,
      purchaseDate: details.purchaseDate || new Date().toISOString().split('T')[0],
      invoiceDate: details.invoiceDate,
      card: req.cardRequired,
      evidenceUrl: details.evidenceUrl,
      status: details.evidenceUrl ? 'Completed' : 'Pending Evidence'
    };

    setData(prev => ({
      ...prev,
      purchases: [record, ...prev.purchases],
      requests: prev.requests.map(r => r.id === req.id ? { ...r, status: 'Processed' } : r)
    }));
  };

  const processSubscription = (req: PurchaseRequest, details: Partial<SubscriptionRecord>) => {
    const year = new Date().getFullYear();
    const subId = `SUB-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

    const record: SubscriptionRecord = {
      id: crypto.randomUUID(),
      subscriptionId: subId,
      originalPurchaseId: req.purchaseId!,
      vendor: req.toolVendor,
      tool: req.toolVendor,
      employeeOwner: req.requesterName,
      pod: req.pod,
      client: req.clientName,
      billable: req.expenseType === 'Client',
      card: req.cardRequired,
      expectedRecurringAmount: req.amount,
      currency: req.currency,
      billingFrequency: req.subscriptionFrequency || 'Monthly',
      startDate: details.startDate || new Date().toISOString().split('T')[0],
      expectedRenewalDate: details.expectedRenewalDate,
      nextExpectedCharge: details.nextExpectedCharge,
      status: 'Active',
      evidenceUrl: details.evidenceUrl
    };

    setData(prev => ({
      ...prev,
      subscriptions: [record, ...prev.subscriptions],
      requests: prev.requests.map(r => r.id === req.id ? { ...r, status: 'Processed' } : r)
    }));
  };

  const completePurchase = (id: string, details: PurchaseCompletionDetails) => {
    setData(prev => {
      const req = prev.requests.find(r => r.id === id);
      if (!req) return prev;

      const status: RequestStatus =
        details.purchaseStatus === 'Failed' ? 'Purchase Failed' :
        details.purchaseStatus === 'Cancelled' ? 'Cancelled' :
        'Purchase Completed';
      const updatedRequests = prev.requests.map(r => r.id === id ? { ...r, status, completionDetails: details } : r);

      let purchases = [...prev.purchases];
      let subscriptions = [...prev.subscriptions];
      let adSpends = [...prev.adSpends];

      if (details.purchaseStatus === 'Completed') {
        if (req.purchaseType === 'One-time Purchase') {
          purchases.unshift({
            id: crypto.randomUUID(),
            purchaseId: req.purchaseId!,
            vendor: req.toolVendor,
            employee: req.requesterName,
            pod: req.pod,
            client: req.clientName,
            billable: req.expenseType === 'Client',
            approvedAmount: req.amount,
            actualAmount: details.actualVendorAmount,
            currency: details.actualCurrency,
            purchaseDate: details.actualPurchaseDate,
            invoiceDate: details.invoiceDate,
            card: req.cardRequired,
            evidenceUrl: details.invoiceUploaded ? 'uploaded' : undefined,
            status: details.invoiceUploaded ? 'Completed' : 'Pending Evidence',
            actualBankInrAmount: details.actualBankInrAmount,
            bankVerificationStatus: details.bankVerificationStatus
          });
        } else if (req.purchaseType === 'Recurring Subscription') {
          const year = new Date().getFullYear();
          const subId = `SUB-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
          const billingFrequency = details.billingFrequency as SubscriptionRecord['billingFrequency'] || req.subscriptionFrequency || 'Monthly';
          const firstCharge = parseISODate(details.actualPurchaseDate);
          subscriptions.unshift({
            id: crypto.randomUUID(),
            subscriptionId: subId,
            originalPurchaseId: req.purchaseId!,
            vendor: req.toolVendor,
            tool: req.toolVendor,
            employeeOwner: req.requesterName,
            pod: req.pod,
            client: req.clientName,
            billable: req.expenseType === 'Client',
            card: req.cardRequired,
            expectedRecurringAmount: details.actualVendorAmount, // Baseline from actual
            currency: details.actualCurrency,
            billingFrequency,
            startDate: details.actualPurchaseDate,
            lastChargedDate: details.actualPurchaseDate,
            nextExpectedCharge: firstCharge ? toISODate(addBillingCycle(firstCharge, billingFrequency)) : undefined,
            status: 'Active',
            evidenceUrl: details.invoiceUploaded ? 'uploaded' : undefined,
            actualBankInrAmount: details.actualBankInrAmount,
            bankVerificationStatus: details.bankVerificationStatus
          });
        } else if (req.purchaseType === 'Ad Spend') {
          adSpends.unshift({
            id: crypto.randomUUID(),
            originalPurchaseId: req.purchaseId!,
            client: req.clientName || 'Internal',
            platform: req.toolVendor,
            adAccountName: '',
            adAccountId: '',
            pod: req.pod,
            employeeOwner: req.requesterName,
            billingPeriod: details.actualPurchaseDate,
            approvedMonthlyBudget: req.amount,
            platformSpend: details.actualVendorAmount,
            cardAmountCharged: details.actualBankInrAmount || 0,
            currency: details.actualCurrency,
            evidenceType: details.invoiceUploaded ? 'Invoice' : 'None',
            actualBankInrAmount: details.actualBankInrAmount,
            bankVerificationStatus: details.bankVerificationStatus
          });
        }
      }

      return {
        ...prev,
        requests: updatedRequests,
        purchases,
        subscriptions,
        adSpends
      };
    });
  };

  const updateBankAmount = (id: string, bankAmount: number) => {
    setData(prev => {
      const req = prev.requests.find(r => r.id === id);
      if (!req || !req.completionDetails) return prev;

      const updatedRequests = prev.requests.map(r => r.id === id ? {
        ...r,
        completionDetails: {
          ...r.completionDetails!,
          actualBankInrAmount: bankAmount,
          bankAmountSource: 'Finance Entered' as const,
          bankVerificationStatus: 'Finance Confirmed' as const
        },
        status: 'Pending Bank Amount Confirmation' as RequestStatus
      } : r);

      return {
        ...prev,
        requests: updatedRequests,
        purchases: prev.purchases.map(p => p.purchaseId === req.purchaseId ? { ...p, actualBankInrAmount: bankAmount, bankVerificationStatus: 'Finance Confirmed' } : p),
        subscriptions: prev.subscriptions.map(s => s.originalPurchaseId === req.purchaseId ? { ...s, actualBankInrAmount: bankAmount, bankVerificationStatus: 'Finance Confirmed' } : s),
        adSpends: prev.adSpends.map(a => a.originalPurchaseId === req.purchaseId ? { ...a, actualBankInrAmount: bankAmount, bankVerificationStatus: 'Finance Confirmed' } : a),
      };
    });
  };

  const processAdSpend = (req: PurchaseRequest, details: Partial<AdSpendRecord>) => {
    const record: AdSpendRecord = {
      id: crypto.randomUUID(),
      originalPurchaseId: req.purchaseId!,
      client: req.clientName || 'Internal',
      platform: req.toolVendor,
      adAccountName: details.adAccountName || '',
      adAccountId: details.adAccountId || '',
      pod: req.pod,
      employeeOwner: req.requesterName,
      billingPeriod: details.billingPeriod || '',
      approvedMonthlyBudget: req.amount,
      platformSpend: details.platformSpend || 0,
      cardAmountCharged: details.cardAmountCharged || 0,
      currency: req.currency,
      evidenceType: details.evidenceType || 'None',
      evidenceUrl: details.evidenceUrl,
      notes: details.notes
    };

    setData(prev => ({
      ...prev,
      adSpends: [record, ...prev.adSpends],
      requests: prev.requests.map(r => r.id === req.id ? { ...r, status: 'Processed' } : r)
    }));
  };

  const addReconciliationPeriod = (name: string, card: CardType) => {
    const id = crypto.randomUUID();
    const period: ReconciliationPeriod = {
      id,
      name,
      card,
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    setData(prev => ({ ...prev, periods: [period, ...prev.periods] }));
    return id;
  };

  const importBankTransactions = (periodId: string, transactions: Omit<BankTransaction, 'id' | 'periodId'>[]) => {
    const newTransactions: BankTransaction[] = transactions.map(t => ({
      ...t,
      id: crypto.randomUUID(),
      periodId
    }));
    setData(prev => ({ ...prev, bankTransactions: [...prev.bankTransactions, ...newTransactions] }));
  };

  const updateBankTransaction = (id: string, updates: Partial<BankTransaction>) => {
    setData(prev => ({
      ...prev,
      bankTransactions: prev.bankTransactions.map(t => (t.id === id ? { ...t, ...updates } : t))
    }));
  };

  const confirmTransactionMatch = (transactionId: string) => {
    setData(prev => {
      const txn = prev.bankTransactions.find(t => t.id === transactionId);
      // Nothing to confirm without a suggested record; use resolveUnidentifiedTransaction instead.
      if (!txn || !(txn.suggestedPurchaseId || txn.suggestedSubscriptionId || txn.suggestedAdSpendId)) return prev;

      let subscriptions = prev.subscriptions;

      // If this transaction is a recurring subscription match, roll the subscription's
      // billing dates forward so future reconciliations can compute the next window.
      if (txn.suggestedSubscriptionId) {
        const chargeDate = parseBankDate(txn.originalDate);
        subscriptions = prev.subscriptions.map(s => {
          if (s.subscriptionId !== txn.suggestedSubscriptionId) return s;
          if (!chargeDate) return s;
          return {
            ...s,
            lastChargedDate: toISODate(chargeDate),
            nextExpectedCharge: toISODate(addBillingCycle(chargeDate, s.billingFrequency))
          };
        });
      }

      return {
        ...prev,
        bankTransactions: prev.bankTransactions.map(t => t.id === transactionId ? { ...t, status: 'Matched', confidenceLevel: 'High', confidence: 100 } : t),
        subscriptions
      };
    });
  };

  // A card charge nobody raised in the tracker: Finance fills in the details, which
  // creates the register record and links the transaction to it.
  const resolveUnidentifiedTransaction = (transactionId: string, input: ManualResolutionInput, user: string) => {
    setData(prev => {
      const txn = prev.bankTransactions.find(t => t.id === transactionId);
      if (!txn) return prev;

      const chargeDate = parseBankDate(txn.originalDate);
      const isoDate = chargeDate ? toISODate(chargeDate) : new Date().toISOString().split('T')[0];
      const isIntl = txn.intlAmount > 0;
      const amount = isIntl ? txn.intlAmount : txn.inrAmount;
      const currency = isIntl ? (txn.originalCurrency || 'USD') : 'INR';
      const billable = input.expenseType === 'Client';
      const card: CardType = billable ? 'Client Card' : 'Internal Card';
      const year = (chargeDate ?? new Date()).getFullYear();

      let purchases = prev.purchases;
      let subscriptions = prev.subscriptions;
      let link: Partial<BankTransaction>;

      if (input.purchaseType === 'Recurring Subscription') {
        const billingFrequency = input.billingFrequency || 'Monthly';
        const subscriptionId = `SUB-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
        subscriptions = [{
          id: crypto.randomUUID(),
          subscriptionId,
          vendor: input.vendor,
          tool: input.vendor,
          employeeOwner: input.purchasedBy,
          pod: input.pod,
          client: input.account || undefined,
          billable,
          card,
          expectedRecurringAmount: amount,
          currency,
          billingFrequency,
          startDate: isoDate,
          lastChargedDate: isoDate,
          nextExpectedCharge: chargeDate ? toISODate(addBillingCycle(chargeDate, billingFrequency)) : undefined,
          status: 'Active',
          actualBankInrAmount: txn.inrAmount,
          bankVerificationStatus: 'Statement Confirmed',
          notes: input.notes || undefined,
          source: 'Bank Statement'
        }, ...prev.subscriptions];
        link = { suggestedSubscriptionId: subscriptionId, suggestedPurchaseId: undefined, matchType: 'Recurring Subscription' };
      } else {
        const purchaseId = `STMT-${year}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
        purchases = [{
          id: crypto.randomUUID(),
          purchaseId,
          vendor: input.vendor,
          employee: input.purchasedBy,
          pod: input.pod,
          client: input.account || undefined,
          billable,
          approvedAmount: amount,
          actualAmount: amount,
          currency,
          purchaseDate: isoDate,
          card,
          status: 'Pending Evidence',
          actualBankInrAmount: txn.inrAmount,
          bankVerificationStatus: 'Statement Confirmed',
          notes: input.notes || undefined,
          source: 'Bank Statement'
        }, ...prev.purchases];
        link = { suggestedPurchaseId: purchaseId, suggestedSubscriptionId: undefined, matchType: 'One-time Purchase' };
      }

      return {
        ...prev,
        purchases,
        subscriptions,
        bankTransactions: prev.bankTransactions.map(t => t.id === transactionId ? {
          ...t,
          ...link,
          normalizedVendor: input.vendor,
          suggestedVendor: input.vendor,
          suggestedClient: input.account || undefined,
          suggestedEmployee: input.purchasedBy,
          suggestedPod: input.pod,
          confidence: 100,
          confidenceLevel: 'High',
          confidenceReasons: [`Entered manually by ${user}: not raised in the tracker`],
          status: 'Matched'
        } : t),
        auditLogs: [{
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          user,
          action: 'Resolve Unidentified Transaction',
          entityId: transactionId,
          newValue: `${input.vendor} • ${input.pod} • ${input.purchasedBy} • ${input.purchaseType}`,
          comment: input.notes || undefined
        }, ...prev.auditLogs]
      };
    });
  };

  const addImportedSubscription = (input: ImportedSubscriptionInput) => {
    const year = new Date().getFullYear();
    const subId = `SUB-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

    const record: SubscriptionRecord = {
      id: crypto.randomUUID(),
      subscriptionId: subId,
      vendor: input.vendor,
      tool: input.vendor,
      employeeOwner: 'Finance (Imported)',
      pod: 'Finance',
      client: input.client || undefined,
      billable: input.billable,
      card: input.card,
      expectedRecurringAmount: input.amount,
      currency: input.currency,
      billingFrequency: input.billingFrequency,
      category: input.category || undefined,
      startDate: input.startDate || input.nextExpectedCharge,
      lastChargedDate: input.lastChargedDate || undefined,
      nextExpectedCharge: input.nextExpectedCharge,
      status: input.status,
      notes: input.notes || undefined,
      source: 'Imported',
      ...statusTime(input.status, new Date().toISOString())
    };

    setData(prev => ({ ...prev, subscriptions: [record, ...prev.subscriptions] }));
  };

  // Records when a subscription is set Active / Paused / Cancelled.
  const statusTime = (status: SubscriptionStatus, at: string): Partial<SubscriptionRecord> =>
    status === 'Paused' ? { pausedAt: at } : status === 'Cancelled' ? { cancelledAt: at } : { activatedAt: at };

  const updateSubscription = (id: string, updates: Partial<SubscriptionRecord>) => {
    setData(prev => {
      const current = prev.subscriptions.find(s => s.id === id);
      if (!current) return prev;
      const now = new Date().toISOString();
      const statusChanged = updates.status !== undefined && updates.status !== current.status;
      return {
        ...prev,
        subscriptions: prev.subscriptions.map(s => (s.id === id
          ? { ...s, ...updates, ...(statusChanged ? statusTime(updates.status!, now) : {}) }
          : s)),
        auditLogs: statusChanged ? [{
          id: crypto.randomUUID(),
          timestamp: now,
          user: 'Finance Admin',
          action: 'Subscription Status Changed',
          entityId: current.subscriptionId,
          previousValue: current.status,
          newValue: updates.status
        }, ...prev.auditLogs] : prev.auditLogs
      };
    });
  };

  // Records an ad spend by hand (no originating purchase request).
  const addAdSpend = (input: AdSpendInput) => {
    const record: AdSpendRecord = {
      id: crypto.randomUUID(),
      originalPurchaseId: '',
      client: input.client,
      platform: input.platform,
      adAccountName: input.adAccountName || '',
      adAccountId: input.adAccountId || '',
      pod: input.pod,
      employeeOwner: input.employeeOwner,
      billingPeriod: input.billingPeriod,
      approvedMonthlyBudget: input.approvedMonthlyBudget,
      platformSpend: input.platformSpend,
      cardAmountCharged: input.cardAmountCharged,
      currency: input.currency,
      evidenceType: input.evidenceType,
      notes: input.notes || undefined
    };
    setData(prev => ({ ...prev, adSpends: [record, ...prev.adSpends] }));
  };

  const addMerchantAlias = (alias: Omit<MerchantAlias, 'id'>) => {
    const newAlias: MerchantAlias = { ...alias, id: crypto.randomUUID() };
    setData(prev => ({ ...prev, merchantAliases: [...prev.merchantAliases, newAlias] }));
  };

  // Permanently deletes a reconciliation period and its bank lines on the server, then locally.
  // Throws if the server refuses, so the caller can tell the user nothing was deleted.
  const deletePeriod = async (periodId: string, user: string) => {
    const period = dataRef.current.periods.find(p => p.id === periodId);
    if (!period) return;
    const lineIds = dataRef.current.bankTransactions.filter(t => t.periodId === periodId).map(t => t.id);

    inFlightRef.current++;
    writeVersionRef.current++;
    try {
      const res = await fetch(API_URL, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periods: [periodId] }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server returned ${res.status}`);
    } finally {
      inFlightRef.current--;
    }

    syncedRef.current.periods.delete(periodId);
    for (const id of lineIds) syncedRef.current.bankTransactions.delete(id);
    setData(prev => ({
      ...prev,
      periods: prev.periods.filter(p => p.id !== periodId),
      bankTransactions: prev.bankTransactions.filter(t => t.periodId !== periodId),
      auditLogs: [{
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user,
        action: 'Delete Reconciliation Period',
        entityId: periodId,
        previousValue: `${period.name} (${period.card}), ${lineIds.length} bank lines`
      }, ...prev.auditLogs]
    }));
  };

  const closePeriod = (periodId: string, reason: string, user: string) => {
    setData(prev => ({
      ...prev,
      periods: prev.periods.map(p => p.id === periodId ? {
        ...p,
        status: 'Closed',
        closedAt: new Date().toISOString(),
        closedBy: user,
        closureReason: reason
      } : p),
      auditLogs: [{
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user,
        action: 'Close Reconciliation Month',
        entityId: periodId,
        comment: reason
      }, ...prev.auditLogs]
    }));
  };

  const toggleFeeBillable = (txnId: string, billable: boolean) => {
    setData(prev => ({
      ...prev,
      bankTransactions: prev.bankTransactions.map(t => (t.id === txnId ? { ...t, isFeeBillableToClient: billable } : t))
    }));
  };

  return {
    syncStatus,
    syncError,
    legacyData,
    importLegacyData,
    dismissLegacyData,
    requests: data.requests,
    purchases: data.purchases,
    subscriptions: data.subscriptions,
    adSpends: data.adSpends,
    periods: data.periods,
    bankTransactions: data.bankTransactions,
    merchantAliases: data.merchantAliases,
    auditLogs: data.auditLogs,
    addRequest, 
    updateRequestStatus,
    processPurchase,
    processSubscription,
    processAdSpend,
    completePurchase,
    updateBankAmount,
    addReconciliationPeriod,
    importBankTransactions,
    updateBankTransaction,
    confirmTransactionMatch,
    resolveUnidentifiedTransaction,
    addImportedSubscription,
    addAdSpend,
    updateSubscription,
    addMerchantAlias,
    deletePeriod,
    closePeriod,
    toggleFeeBillable
  };
}

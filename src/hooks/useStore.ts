import { useState, useEffect } from 'react';
import { PurchaseRequest, RequestStatus, PurchaseRecord, SubscriptionRecord, AdSpendRecord, ReconciliationPeriod, BankTransaction, MerchantAlias, CardType, AuditLog, PurchaseCompletionDetails, ImportedSubscriptionInput } from '../types';
import { parseBankDate, toISODate, addBillingCycle } from '../utils/recurringMatch';

const STORAGE_KEY = 'spendy_data';

export function useStore() {
    const [data, setData] = useState<{
    requests: PurchaseRequest[];
    purchases: PurchaseRecord[];
    subscriptions: SubscriptionRecord[];
    adSpends: AdSpendRecord[];
    periods: ReconciliationPeriod[];
    bankTransactions: BankTransaction[];
    merchantAliases: MerchantAlias[];
    auditLogs: AuditLog[];
  }>(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        return {
          requests: parsed.requests || [],
          purchases: parsed.purchases || [],
          subscriptions: parsed.subscriptions || [],
          adSpends: parsed.adSpends || [],
          periods: parsed.periods || [],
          bankTransactions: parsed.bankTransactions || [],
          merchantAliases: parsed.merchantAliases || [],
          auditLogs: parsed.auditLogs || []
        };
      }
    } catch (error) {
      console.warn('Error reading localStorage', error);
    }
    return { requests: [], purchases: [], subscriptions: [], adSpends: [], periods: [], bankTransactions: [], merchantAliases: [], auditLogs: [] };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Error saving to localStorage', error);
    }
  }, [data]);

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

      const updatedRequests = prev.requests.map(r => r.id === id ? { ...r, status: 'Purchase Completed' as RequestStatus, completionDetails: details } : r);

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
            actualBankInrAmount: details.actualBankInrAmount,
            bankVerificationStatus: details.bankVerificationStatus
          });
        } else if (req.purchaseType === 'Recurring Subscription') {
          const year = new Date().getFullYear();
          const subId = `SUB-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
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
            billingFrequency: details.billingFrequency || req.subscriptionFrequency || 'Monthly',
            startDate: details.actualPurchaseDate,
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
      if (!txn) return prev;

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
      source: 'Imported'
    };

    setData(prev => ({ ...prev, subscriptions: [record, ...prev.subscriptions] }));
  };

  const updateSubscription = (id: string, updates: Partial<SubscriptionRecord>) => {
    setData(prev => ({
      ...prev,
      subscriptions: prev.subscriptions.map(s => (s.id === id ? { ...s, ...updates } : s))
    }));
  };

  const addMerchantAlias = (alias: Omit<MerchantAlias, 'id'>) => {
    const newAlias: MerchantAlias = { ...alias, id: crypto.randomUUID() };
    setData(prev => ({ ...prev, merchantAliases: [...prev.merchantAliases, newAlias] }));
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
    addImportedSubscription,
    updateSubscription,
    addMerchantAlias,
    closePeriod,
    toggleFeeBillable
  };
}

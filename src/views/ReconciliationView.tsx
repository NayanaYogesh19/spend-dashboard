import React, { useState } from 'react';
import { ReconciliationPeriod, BankTransaction, SubscriptionRecord, PurchaseRecord, AdSpendRecord, MerchantAlias, CardType, BankTransactionType, ManualResolutionInput, ExpenseType, SubscriptionFrequency } from '../types';
import { FileSpreadsheet, Plus, Upload, Search, CheckCircle2, AlertCircle, Clock, Link as LinkIcon, Pencil, Trash2 } from 'lucide-react';
import { vendorsLooselyMatch, isAmountWithinTolerance, parseBankDate, parseISODate, isWithinBillingWindow, daysFromBillingDate } from '../utils/recurringMatch';
import { PODS } from '../config/org';

// Reconciliation actions are recorded under this name until there's a login.
const FINANCE_USER = 'Finance Admin';

const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';
const labelClass = 'block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1';

// Leading plain words of the bank text, e.g. "GOOGLE WORKSPACE CYBS SI MUMBAI IN" -> "Google Workspace",
// "IND*LINKEDIN (PGSI) WWW.LINKEDIN. IN" -> "Linkedin". Finance can correct it in the form.
function guessVendor(txn: BankTransaction): string {
  if (txn.normalizedVendor) return txn.normalizedVendor;
  const words = txn.originalDescription.replace(/^[A-Z]{2,4}\*/, '').split(/[\s*]+/);
  const leading: string[] = [];
  for (const w of words) {
    if (!/^[A-Za-z]+$/.test(w) || leading.length === 2) break;
    leading.push(w);
  }
  return leading.map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

function EditTransactionForm({ txn, onCancel, onSave }: { txn: BankTransaction; onCancel: () => void; onSave: (input: ManualResolutionInput) => void }) {
  const [vendor, setVendor] = useState(guessVendor(txn));
  const [pod, setPod] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>('Internal');
  const [account, setAccount] = useState('');
  const [purchasedBy, setPurchasedBy] = useState('');
  const [purchaseType, setPurchaseType] = useState<ManualResolutionInput['purchaseType']>('One-time Purchase');
  const [billingFrequency, setBillingFrequency] = useState<SubscriptionFrequency>('Monthly');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      vendor: vendor.trim(),
      pod,
      expenseType,
      account: account.trim() || undefined,
      purchasedBy: purchasedBy.trim(),
      purchaseType,
      billingFrequency: purchaseType === 'Recurring Subscription' ? billingFrequency : undefined,
      notes: notes.trim() || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-500">
        For a charge that was never raised in the tracker. Saving adds it to Financial Registers and marks this line as matched.
      </p>
      <div>
        <label className={labelClass}>Vendor *</label>
        <input required value={vendor} onChange={e => setVendor(e.target.value)} className={inputClass} placeholder="e.g. Google Workspace" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Pod *</label>
          <select required value={pod} onChange={e => setPod(e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            {PODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Purchased By *</label>
          <input required value={purchasedBy} onChange={e => setPurchasedBy(e.target.value)} className={inputClass} placeholder="Employee name" />
        </div>
      </div>
      <div>
        <div className="flex gap-4 mb-2">
          {(['Internal', 'Client'] as ExpenseType[]).map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
              <input type="radio" name="editExpenseType" checked={expenseType === t} onChange={() => setExpenseType(t)} />
              {t} Expense
            </label>
          ))}
        </div>
        <label className={labelClass}>{expenseType === 'Client' ? 'Client Name *' : 'Account Name'}</label>
        <input required={expenseType === 'Client'} value={account} onChange={e => setAccount(e.target.value)} className={inputClass} placeholder={expenseType === 'Client' ? 'Client account to bill' : 'e.g. Internal Ops'} />
      </div>
      <div>
        <label className={labelClass}>Purchase Type *</label>
        <div className="flex flex-wrap gap-2">
          {(['One-time Purchase', 'Recurring Subscription'] as const).map(t => (
            <label key={t} className={`px-3 py-1.5 border rounded-lg cursor-pointer text-xs font-semibold ${purchaseType === t ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
              <input type="radio" name="editPurchaseType" className="sr-only" checked={purchaseType === t} onChange={() => setPurchaseType(t)} />
              {t}
            </label>
          ))}
        </div>
      </div>
      {purchaseType === 'Recurring Subscription' && (
        <div>
          <label className={labelClass}>Billing Frequency</label>
          <select value={billingFrequency} onChange={e => setBillingFrequency(e.target.value as SubscriptionFrequency)} className={inputClass}>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Annual">Yearly</option>
          </select>
        </div>
      )}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="Why it wasn't raised in the tracker, etc." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Save &amp; Match</button>
      </div>
    </form>
  );
}

interface Props {
  periods: ReconciliationPeriod[];
  bankTransactions: BankTransaction[];
  subscriptions: SubscriptionRecord[];
  purchases: PurchaseRecord[];
  adSpends: AdSpendRecord[];
  merchantAliases: MerchantAlias[];
  onAddPeriod: (name: string, card: CardType) => string;
  onDeletePeriod: (periodId: string, user: string) => Promise<void>;
  onImport: (periodId: string, txns: Omit<BankTransaction, 'id' | 'periodId'>[]) => void;
  onUpdateTransaction: (id: string, updates: Partial<BankTransaction>) => void;
  onConfirmMatch: (transactionId: string) => void;
  onResolveUnidentified: (transactionId: string, input: ManualResolutionInput, user: string) => void;
  onAddAlias: (alias: Omit<MerchantAlias, 'id'>) => void;
}

export default function ReconciliationView({
  periods, bankTransactions, subscriptions, purchases, adSpends, merchantAliases,
  onAddPeriod, onDeletePeriod, onImport, onUpdateTransaction, onConfirmMatch, onResolveUnidentified, onAddAlias
}: Props) {
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periods[0]?.id || null);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodCard, setNewPeriodCard] = useState<CardType>('Internal Card');
  
  const [rawImportData, setRawImportData] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
  const currentTransactions = bankTransactions.filter(t => t.periodId === selectedPeriodId);
  const selectedTxn = currentTransactions.find(t => t.id === selectedTxnId);

  const handleDeletePeriod = async () => {
    if (!selectedPeriod) return;
    const lines = currentTransactions.length;
    if (!window.confirm(
      `Delete "${selectedPeriod.name} (${selectedPeriod.card})" and its ${lines} bank line${lines === 1 ? '' : 's'}?\n\n` +
      `This can't be undone. Subscriptions, purchases and requests are not affected.`
    )) return;
    setDeleting(true);
    try {
      await onDeletePeriod(selectedPeriod.id, FINANCE_USER);
      setSelectedPeriodId(periods.find(p => p.id !== selectedPeriod.id)?.id ?? null);
      setSelectedTxnId(null);
    } catch (error) {
      window.alert(`Could not delete the period. Nothing was deleted.\n\n${(error as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleCreatePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPeriodName) {
      const id = onAddPeriod(newPeriodName, newPeriodCard);
      setSelectedPeriodId(id);
      setShowAddPeriod(false);
      setNewPeriodName('');
    }
  };

  // 1. Parsing Logic
  const handleImport = () => {
    if (!rawImportData.trim() || !selectedPeriodId) return;

    const lines = rawImportData.trim().split('\n');
    const newTxns: Omit<BankTransaction, 'id' | 'periodId'>[] = [];
    
    // Header pattern mapping (Date, Sr.No., Transaction Details, Reward Point Header, Intl.Amount, Amount(in Rs))
    lines.forEach(line => {
      const cols = line.split('\t');
      if (cols.length >= 6) {
        const [date, srNo, desc, reward, intlStr, inrStr] = cols;
        
        // Skip header row
        if (date.toLowerCase().includes('date') && desc.toLowerCase().includes('transaction')) return;

        // Check if it's a card header row (masked card)
        const isHeaderRow = /XXXX.*XXXX/.test(desc) || /4102[X\*]+0007/.test(desc);
        
        let type: BankTransactionType = 'Merchant';
        if (isHeaderRow) {
          type = 'Header';
        } else if (desc.toLowerCase().includes('dcc fee')) {
          type = 'Fee';
        } else if (desc.toLowerCase().includes('igst')) {
          type = 'Tax';
        }

        const intlAmount = parseFloat(intlStr.replace(/[^0-9.-]+/g, '')) || 0;
        const inrAmount = parseFloat(inrStr.replace(/[^0-9.-]+/g, '')) || 0;

        // Try Merchant Normalization
        let normalizedVendor = undefined;
        let matchedAlias = merchantAliases.find(a => desc.toUpperCase().includes(a.pattern.toUpperCase()));
        
        // Simple built-in aliases for demo
        if (!matchedAlias) {
           if (desc.includes('DIGITALOCEAN')) normalizedVendor = 'DigitalOcean';
           else if (desc.includes('OPENAI') || desc.includes('CHATGPT')) normalizedVendor = 'OpenAI';
           else if (desc.includes('ADOBE')) normalizedVendor = 'Adobe';
           else if (desc.includes('WAALAXY')) normalizedVendor = 'Waalaxy';
           else if (desc.toUpperCase().includes('CLAUDE') || desc.toUpperCase().includes('ANTHROPIC')) normalizedVendor = 'Anthropic (Claude)';
        } else {
           normalizedVendor = matchedAlias.normalizedVendor;
        }

        newTxns.push({
          originalDate: date.trim(),
          serialNumber: srNo.trim(),
          originalDescription: desc.trim(),
          rewardPoints: reward.trim(),
          intlAmount,
          inrAmount,
          type,
          normalizedVendor,
          status: 'Unidentified' // We will run matching below
        });
      }
    });

    // 2. Matching Engine
    // Subscriptions already matched in this period can't be matched again.
    const usedSubIds = new Set(
      bankTransactions.filter(t => t.periodId === selectedPeriodId && t.suggestedSubscriptionId && t.status === 'Matched').map(t => t.suggestedSubscriptionId!)
    );
    const processedTxns = newTxns.map((txn, index, arr) => {
      if (txn.type === 'Header') return { ...txn, status: 'Associated' as const };
      
      // Attempt to associate Fees and Taxes with previous Merchant transaction
      if (txn.type === 'Fee' || txn.type === 'Tax') {
        const prevMerchant = arr.slice(0, index).reverse().find(t => t.type === 'Merchant');
        if (prevMerchant) {
           return { ...txn, status: 'Associated' as const, parentTransactionId: 'pending' }; // will fix parent in real db
        }
      }

      if (txn.type !== 'Merchant') return txn;

      // Priority 1: Recurring Subscription Match — checked before one-time purchase
      // matching so an active subscription's next billing cycle is recognized even
      // when the transaction date doesn't line up with the original request date.
      // A vendor can have several subscriptions (e.g. one ChatGPT seat per pod), so
      // candidates are ranked by amount and billing date, and each subscription is
      // used for at most one line per period.
      const txnDate = parseBankDate(txn.originalDate);
      const candidates = subscriptions
        .filter(s => s.status === 'Active' && !usedSubIds.has(s.subscriptionId) && vendorsLooselyMatch(s.vendor, txn.originalDescription))
        .map(sub => {
          const intlAmountMatch = txn.intlAmount > 0 && isAmountWithinTolerance(txn.intlAmount, sub.expectedRecurringAmount, 0.05);
          const inrAmountMatch = !!sub.actualBankInrAmount && txn.inrAmount > 0 && isAmountWithinTolerance(txn.inrAmount, sub.actualBankInrAmount, 0.05);
          const amountGap = sub.actualBankInrAmount && txn.inrAmount > 0
            ? Math.abs(txn.inrAmount - sub.actualBankInrAmount) / sub.actualBankInrAmount
            : txn.intlAmount > 0 ? Math.abs(txn.intlAmount - sub.expectedRecurringAmount) / sub.expectedRecurringAmount : 1;
          const referenceDate = parseISODate(sub.lastChargedDate || sub.startDate);
          const dateMatch = !!referenceDate && !!txnDate && isWithinBillingWindow(txnDate, referenceDate, sub.billingFrequency, 7);
          const dayGap = referenceDate && txnDate ? daysFromBillingDate(txnDate, referenceDate, sub.billingFrequency) : Infinity;
          return { sub, amountMatch: intlAmountMatch || inrAmountMatch, dateMatch, amountGap, dayGap };
        });

      const suggest = (sub: SubscriptionRecord, confidence: number, confidenceLevel: 'High' | 'Medium' | 'Low', confidenceReasons: string[], status: 'Matched' | 'Review') => {
        usedSubIds.add(sub.subscriptionId);
        return {
          ...txn,
          normalizedVendor: txn.normalizedVendor || sub.vendor,
          suggestedSubscriptionId: sub.subscriptionId,
          suggestedVendor: sub.vendor,
          suggestedClient: sub.client,
          suggestedEmployee: sub.employeeOwner,
          suggestedPod: sub.pod,
          matchType: 'Recurring Subscription' as const,
          confidence,
          confidenceLevel,
          confidenceReasons,
          status
        };
      };
      // Ties go to the more specific vendor name ("Illustrator" beats "Adobe" for "Illustrator ADOBE.LY").
      const byCloseness = (a: typeof candidates[number], b: typeof candidates[number]) =>
        a.dayGap - b.dayGap || a.amountGap - b.amountGap || b.sub.vendor.length - a.sub.vendor.length;

      const full = candidates.filter(c => c.amountMatch && c.dateMatch).sort(byCloseness);
      if (full.length > 0) {
        const best = full[0];
        const reasons = ['Recurring payment detected', 'Vendor matched active subscription', 'Amount within 5% tolerance', 'Within expected billing cycle window'];
        if (candidates.length === 1) return suggest(best.sub, 97, 'High', reasons, 'Matched');
        // Tied candidates that are interchangeable (same pod and amount, e.g. two identical seats) are still a safe match.
        const tied = full.filter(c => c.dayGap === best.dayGap && c.amountGap === best.amountGap && c.sub.vendor.length === best.sub.vendor.length);
        const interchangeable = tied.every(c => c.sub.pod === best.sub.pod && c.sub.actualBankInrAmount === best.sub.actualBankInrAmount);
        if (tied.length === 1 || interchangeable) {
          return suggest(best.sub, 90, 'High', [...reasons, `Closest by date and amount of ${candidates.length} ${best.sub.vendor} subscriptions`], 'Matched');
        }
        return suggest(best.sub, 70, 'Medium', [...reasons, `${tied.length} ${best.sub.vendor} subscriptions fit equally well: check the pod`], 'Review');
      }

      const amountOnly = candidates.filter(c => c.amountMatch).sort(byCloseness);
      if (amountOnly.length > 0) {
        return suggest(amountOnly[0].sub, 75, 'Medium', ['Vendor and amount matched active subscription', 'Transaction date is outside the expected +/-7 day billing window'], 'Review');
      }

      if (candidates.length === 1) {
        return suggest(candidates[0].sub, 60, 'Low', ['Vendor matched active subscription', 'Amount variance beyond 5% tolerance'], 'Review');
      } else if (candidates.length > 1) {
        return {
          ...txn,
          confidence: 50,
          confidenceLevel: 'Low' as const,
          confidenceReasons: ['Vendor matched', `${candidates.length} active subscriptions found, none within 5% of this amount`],
          status: 'Possible Multiple Matches' as const
        };
      }

      // Priority 2: Exact INR Amount + Vendor Match (one-time purchases)
      const exactInrPurchase = purchases.find(p =>
        (p.actualBankInrAmount === txn.inrAmount) &&
        ((p.vendor && p.vendor.toLowerCase() === txn.normalizedVendor?.toLowerCase()) || (p.vendor && txn.originalDescription.toLowerCase().includes(p.vendor.toLowerCase())))
      );

      if (exactInrPurchase) {
        return {
          ...txn,
          suggestedPurchaseId: exactInrPurchase.purchaseId,
          suggestedVendor: exactInrPurchase.vendor,
          suggestedClient: exactInrPurchase.client,
          suggestedEmployee: exactInrPurchase.employee,
          suggestedPod: exactInrPurchase.pod,
          matchType: 'One-time Purchase' as const,
          confidence: 99,
          confidenceLevel: 'High' as const,
          confidenceReasons: ['Exact Actual Bank INR Amount matched', 'Vendor matched'],
          status: 'Matched' as const
        };
      }

      // Priority 3: Exact Vendor Amount + Vendor Match (one-time purchases)
      const exactVendorAmtPurchase = purchases.find(p =>
        (p.actualAmount === txn.intlAmount || p.actualAmount === txn.inrAmount) &&
        ((p.vendor && p.vendor.toLowerCase() === txn.normalizedVendor?.toLowerCase()) || (p.vendor && txn.originalDescription.toLowerCase().includes(p.vendor.toLowerCase())))
      );

      if (exactVendorAmtPurchase) {
         return {
          ...txn,
          suggestedPurchaseId: exactVendorAmtPurchase.purchaseId,
          suggestedVendor: exactVendorAmtPurchase.vendor,
          suggestedClient: exactVendorAmtPurchase.client,
          suggestedEmployee: exactVendorAmtPurchase.employee,
          suggestedPod: exactVendorAmtPurchase.pod,
          matchType: 'One-time Purchase' as const,
          confidence: 90,
          confidenceLevel: 'High' as const,
          confidenceReasons: ['Actual Vendor Amount matched', 'Vendor matched'],
          status: 'Matched' as const
        };
      }

      // Priority 4: Manual — Unidentified
      return txn;
    });

    if (processedTxns.length === 0) {
      alert("No valid transactions found. Please ensure you are pasting directly from the Excel/CSV statement with at least 6 columns per row (Date, SrNo, Description, Reward, IntlAmount, INRAmount).");
      return;
    }

    onImport(selectedPeriodId, processedTxns);
    setShowImport(false);
    setRawImportData('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reconciliation</h2>
          <p className="text-slate-500">Import and reconcile monthly credit card statements.</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <select 
            value={selectedPeriodId || ''} 
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            {periods.length === 0 && <option value="">No periods found</option>}
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.card})</option>
            ))}
          </select>
          <button 
            onClick={() => setShowAddPeriod(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Period
          </button>
        </div>
      </div>

      {showAddPeriod && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Create Reconciliation Period</h3>
          <form onSubmit={handleCreatePeriod} className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period Name</label>
              <input 
                type="text" 
                placeholder="e.g. May 2026"
                value={newPeriodName}
                onChange={e => setNewPeriodName(e.target.value)}
                className="w-64 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Card</label>
              <select 
                value={newPeriodCard}
                onChange={e => setNewPeriodCard(e.target.value as CardType)}
                className="w-48 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Internal Card">Internal Card</option>
                <option value="Client Card">Client Card</option>
              </select>
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Create
            </button>
            <button type="button" onClick={() => setShowAddPeriod(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">
              Cancel
            </button>
          </form>
        </div>
      )}

      {selectedPeriod && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{selectedPeriod.name}</h3>
              <p className="text-sm text-slate-500">{selectedPeriod.card} • {currentTransactions.length} Transactions</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeletePeriod}
                disabled={deleting || selectedPeriod.status === 'Closed'}
                title={selectedPeriod.status === 'Closed' ? 'Closed months are kept for the audit trail' : 'Delete this period and its bank lines'}
                className="flex items-center gap-2 px-4 py-2 bg-white text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Delete Period'}
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Statement
              </button>
            </div>
          </div>

          {showImport && (
            <div className="p-6 border-b border-slate-200 bg-blue-50/30">
              <h4 className="font-medium text-slate-900 mb-2">Paste Bank Statement Data</h4>
              <p className="text-sm text-slate-500 mb-4">Copy and paste rows from Excel/CSV (Date, Sr.No., Details, Reward, Intl.Amount, Amount(in Rs))</p>
              <textarea
                value={rawImportData}
                onChange={e => setRawImportData(e.target.value)}
                className="w-full h-48 p-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="01/05/2026	13339439344	DIGITALOCEAN.COM AMSTERDAM NL*	29	31.36	3113.46..."
              />
              <div className="mt-4 flex gap-3">
                <button onClick={handleImport} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Process Data
                </button>
                <button onClick={() => setShowImport(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {currentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="p-4 border-b font-medium">Date</th>
                    <th className="p-4 border-b font-medium w-1/4">Bank Description</th>
                    <th className="p-4 border-b font-medium text-right">Amount</th>
                    <th className="p-4 border-b font-medium">Vendor</th>
                    <th className="p-4 border-b font-medium">Suggested Match</th>
                    <th className="p-4 border-b font-medium">Type</th>
                    <th className="p-4 border-b font-medium">Confidence</th>
                    <th className="p-4 border-b font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTransactions.map(txn => (
                    <tr key={txn.id} onClick={() => setSelectedTxnId(txn.id)} className={`hover:bg-slate-50 group cursor-pointer transition-colors ${selectedTxnId === txn.id ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-4 text-sm text-slate-700 whitespace-nowrap">{txn.originalDate}</td>
                      <td className="p-4 text-sm">
                        <div className="text-slate-900 font-medium truncate max-w-xs" title={txn.originalDescription}>
                          {txn.originalDescription}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{txn.serialNumber}</div>
                      </td>
                      <td className="p-4 text-sm text-right font-medium text-slate-900">
                        {txn.inrAmount > 0 ? `₹${txn.inrAmount.toLocaleString()}` : '-'}
                        {txn.intlAmount > 0 && <div className="text-xs text-slate-400 font-normal mt-0.5">USD {txn.intlAmount}</div>}
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        {txn.normalizedVendor || <span className="text-slate-400 italic">Unknown</span>}
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        {txn.suggestedSubscriptionId || txn.suggestedPurchaseId ? (
                          <div>
                            <div className="font-medium text-slate-900">{txn.suggestedSubscriptionId || txn.suggestedPurchaseId}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                              {txn.suggestedPod || txn.suggestedClient || 'Internal'} • {txn.suggestedEmployee}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                          ${txn.type === 'Merchant' ? 'bg-blue-50 text-blue-700' :
                            txn.type === 'Fee' ? 'bg-orange-50 text-orange-700' :
                            txn.type === 'Tax' ? 'bg-purple-50 text-purple-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className="p-4">
                        {txn.confidenceLevel ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${
                              txn.confidenceLevel === 'High' ? 'bg-emerald-500' :
                              txn.confidenceLevel === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-sm font-medium text-slate-700">{txn.confidence}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                            ${txn.status === 'Matched' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              txn.status === 'Review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              txn.status === 'Associated' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                            {txn.status === 'Matched' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {txn.status === 'Review' && <Clock className="w-3.5 h-3.5" />}
                            {txn.status === 'Associated' && <LinkIcon className="w-3.5 h-3.5" />}
                            {txn.status === 'Unidentified' && <AlertCircle className="w-3.5 h-3.5" />}
                            {txn.status}
                          </span>
                          {(txn.suggestedPurchaseId || txn.suggestedSubscriptionId) && txn.status !== 'Associated' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onConfirmMatch(txn.id);
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                              title="Confirm this match"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-lg font-medium text-slate-900 mb-1">No Transactions</h4>
              <p className="text-slate-500 max-w-sm mx-auto">
                Import a bank statement to begin the reconciliation process for this period.
              </p>
            </div>
          )}
        </div>
      )}

      {selectedTxn && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-end z-50">
          <div className="w-[500px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-slate-200 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Transaction Details</h3>
                <p className="text-sm text-slate-500">Ref: {selectedTxn.serialNumber}</p>
              </div>
              <button onClick={() => { setSelectedTxnId(null); setEditingTxnId(null); }} className="text-slate-400 hover:text-slate-600">
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Bank Info */}
              <section>
                <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Bank Information</h4>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">Date</div>
                      <div className="text-sm font-medium text-slate-900">{selectedTxn.originalDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Card Cost (INR)</div>
                      <div className="text-sm font-medium text-slate-900">₹{selectedTxn.inrAmount.toLocaleString()}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Original Description</div>
                    <div className="text-sm font-medium text-slate-900 font-mono mt-1">{selectedTxn.originalDescription}</div>
                  </div>
                  {selectedTxn.intlAmount > 0 && (
                    <div>
                      <div className="text-xs text-slate-500">International Amount</div>
                      <div className="text-sm font-medium text-slate-900">USD {selectedTxn.intlAmount}</div>
                    </div>
                  )}
                  {selectedTxn.type === 'Fee' || selectedTxn.type === 'Tax' ? (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                        {selectedTxn.type}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Match Info */}
              {selectedTxn.type === 'Merchant' && (
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Suggested Business Match</h4>
                  
                  {selectedTxn.status === 'Matched' || selectedTxn.status === 'Review' ? (
                    <div className={`rounded-lg p-4 border ${selectedTxn.status === 'Matched' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-yellow-50/50 border-yellow-200'} space-y-4`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {selectedTxn.suggestedSubscriptionId || selectedTxn.suggestedPurchaseId || selectedTxn.normalizedVendor}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Account/Pod: {selectedTxn.suggestedPod || selectedTxn.suggestedClient || 'Internal'} • Purchaser: {selectedTxn.suggestedEmployee}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${selectedTxn.confidenceLevel === 'High' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {selectedTxn.confidence}% Match
                          </span>
                        </div>
                      </div>
                      
                      {selectedTxn.confidenceReasons && (
                        <div className="pt-3 border-t border-slate-200/60">
                          <div className="text-xs font-medium text-slate-700 mb-2">Confidence Reasons:</div>
                          <ul className="space-y-1">
                            {selectedTxn.confidenceReasons.map((r, i) => (
                              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg p-6 text-center">
                      <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <div className="text-sm font-medium text-slate-900">No Match Found</div>
                      <div className="text-xs text-slate-500 mt-1">Manual resolution required</div>
                    </div>
                  )}
                </section>
              )}

              {/* Actions */}
              <section>
                <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">{editingTxnId === selectedTxn.id ? 'Edit Details' : 'Action'}</h4>
                {editingTxnId === selectedTxn.id ? (
                  <EditTransactionForm
                    txn={selectedTxn}
                    onCancel={() => setEditingTxnId(null)}
                    onSave={input => {
                      onResolveUnidentified(selectedTxn.id, input, FINANCE_USER);
                      setEditingTxnId(null);
                      setSelectedTxnId(null);
                    }}
                  />
                ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      onConfirmMatch(selectedTxn.id);
                      setSelectedTxnId(null);
                    }}
                    disabled={!(selectedTxn.suggestedPurchaseId || selectedTxn.suggestedSubscriptionId)}
                    title={selectedTxn.suggestedPurchaseId || selectedTxn.suggestedSubscriptionId ? 'Confirm this match' : 'No suggested match to confirm. Use Edit Details.'}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirm Match
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Change Match
                  </button>
                  {!(selectedTxn.suggestedPurchaseId || selectedTxn.suggestedSubscriptionId) && selectedTxn.type === 'Merchant' && (
                    <button
                      onClick={() => setEditingTxnId(selectedTxn.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" /> Edit Details
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      onUpdateTransaction(selectedTxn.id, { status: 'Unidentified', confidenceLevel: 'Low', confidence: 0, suggestedSubscriptionId: undefined, suggestedPurchaseId: undefined });
                      setSelectedTxnId(null);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Mark Unidentified
                  </button>
                </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { PurchaseRecord, SubscriptionRecord, AdSpendRecord, ImportedSubscriptionInput, SubscriptionFrequency, CardType, SubscriptionStatus } from '../types';
import { Database, RotateCw, Megaphone, FileText, Download, PlusCircle, Eye, Pencil, Ban } from 'lucide-react';

interface RegistersViewProps {
  purchases: PurchaseRecord[];
  subscriptions: SubscriptionRecord[];
  adSpends: AdSpendRecord[];
  onAddImportedSubscription: (input: ImportedSubscriptionInput) => void;
  onUpdateSubscription: (id: string, updates: Partial<SubscriptionRecord>) => void;
}

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
// UI shows "Yearly" per finance convention; stored as 'Annual' to stay compatible with
// the existing SubscriptionFrequency type used by the recurring matching engine.
const FREQUENCIES: { label: string; value: SubscriptionFrequency }[] = [
  { label: 'Monthly', value: 'Monthly' },
  { label: 'Quarterly', value: 'Quarterly' },
  { label: 'Yearly', value: 'Annual' },
];
const STATUSES: SubscriptionStatus[] = ['Active', 'Paused', 'Cancelled'];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface SubscriptionModalProps {
  mode: 'add' | 'edit' | 'view';
  initial?: SubscriptionRecord;
  onClose: () => void;
  onSave: (data: ImportedSubscriptionInput) => void;
}

function SubscriptionModal({ mode, initial, onClose, onSave }: SubscriptionModalProps) {
  const readOnly = mode === 'view';
  const [vendor, setVendor] = useState(initial?.vendor || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [amount, setAmount] = useState(initial ? String(initial.expectedRecurringAmount) : '');
  const [currency, setCurrency] = useState(initial?.currency || 'INR');
  const [billingFrequency, setBillingFrequency] = useState<SubscriptionFrequency>(initial?.billingFrequency || 'Monthly');
  const [card, setCard] = useState<CardType>(initial?.card || 'Internal Card');
  const [accountName, setAccountName] = useState(initial?.client || '');
  const [startDate, setStartDate] = useState(initial?.startDate || '');
  const [lastChargedDate, setLastChargedDate] = useState(initial?.lastChargedDate || '');
  const [nextExpectedCharge, setNextExpectedCharge] = useState(initial?.nextExpectedCharge || '');
  const [status, setStatus] = useState<SubscriptionStatus>(initial?.status || 'Active');
  const [notes, setNotes] = useState(initial?.notes || '');

  const title = mode === 'add' ? 'Add Existing Subscription' : mode === 'edit' ? 'Edit Subscription' : 'Subscription Details';
  const subtitle = mode === 'add'
    ? 'Onboard a recurring subscription that was already running before Spendy, so reconciliation can match it going forward.'
    : mode === 'edit'
      ? 'Update the details Spendy uses to match this subscription during reconciliation.'
      : 'Read-only view of this subscription record.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    onSave({
      vendor,
      category: category || undefined,
      amount: parseFloat(amount) || 0,
      currency,
      billingFrequency,
      card,
      client: accountName || undefined,
      billable: card === 'Client Card',
      startDate: startDate || undefined,
      lastChargedDate: lastChargedDate || undefined,
      nextExpectedCharge,
      status,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-lg">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Vendor Name *</label>
              <input required disabled={readOnly} type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. APOLLO.IO" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Category</label>
              <input disabled={readOnly} type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. SaaS / Marketing Tool / AI Tool" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Payment Method</label>
              <select disabled={readOnly} value={card} onChange={e => setCard(e.target.value as CardType)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70">
                <option value="Internal Card">Internal Card</option>
                <option value="Client Card">Client Card</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Amount *</label>
              <input required disabled={readOnly} type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Currency *</label>
              <select required disabled={readOnly} value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Billing Frequency *</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {FREQUENCIES.map(f => (
                  <label key={f.value} className={`px-4 py-2 border rounded-lg text-sm font-semibold transition-colors shadow-sm ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${billingFrequency === f.value ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <input type="radio" name="billingFrequency" className="sr-only" disabled={readOnly} checked={billingFrequency === f.value} onChange={() => setBillingFrequency(f.value)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Account / Client Name</label>
              <input disabled={readOnly} type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder={card === 'Client Card' ? 'Client account to bill' : 'e.g. Internal Ops, Marketing Team'} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Start Date</label>
              <input disabled={readOnly} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Last Payment Date</label>
              <input disabled={readOnly} type="date" value={lastChargedDate} onChange={e => setLastChargedDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Next Expected Payment Date *</label>
              <input required disabled={readOnly} type="date" value={nextExpectedCharge} onChange={e => setNextExpectedCharge(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Status</label>
              <select disabled={readOnly} value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Notes</label>
              <textarea disabled={readOnly} value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any context finance should know about this subscription." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 disabled:opacity-70" />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
                {mode === 'add' ? 'Add Subscription' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RegistersView({ purchases, subscriptions, adSpends, onAddImportedSubscription, onUpdateSubscription }: RegistersViewProps) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'subscriptions' | 'adSpends'>('purchases');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit' | 'view'; sub?: SubscriptionRecord } | null>(null);

  const handleSaveSubscription = (data: ImportedSubscriptionInput) => {
    if (modal?.mode === 'edit' && modal.sub) {
      onUpdateSubscription(modal.sub.id, {
        vendor: data.vendor,
        tool: data.vendor,
        category: data.category,
        expectedRecurringAmount: data.amount,
        currency: data.currency,
        billingFrequency: data.billingFrequency,
        card: data.card,
        client: data.client,
        billable: data.billable,
        startDate: data.startDate || modal.sub.startDate,
        lastChargedDate: data.lastChargedDate,
        nextExpectedCharge: data.nextExpectedCharge,
        status: data.status,
        notes: data.notes,
      });
    } else {
      onAddImportedSubscription(data);
    }
    setModal(null);
  };

  const handleDeactivate = (sub: SubscriptionRecord) => {
    if (window.confirm(`Deactivate ${sub.vendor} (${sub.subscriptionId})? Its status will be set to Cancelled.`)) {
      onUpdateSubscription(sub.id, { status: 'Cancelled' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Financial Registers</h2>
        <p className="text-sm text-slate-500">Master logs for all processed transactions, subscriptions, and client ad spend.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'purchases' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Database className="w-4 h-4" />
          One-time Purchases ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'subscriptions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <RotateCw className="w-4 h-4" />
          Subscription Master ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('adSpends')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'adSpends' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Ad Spend Register ({adSpends.length})
        </button>
      </div>

      {/* Subscription Specific Warning + Import Action */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4 mb-6">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1">Important Rule: Renewals</p>
            <p className="text-sm text-indigo-900 font-medium">
              Recurring subscriptions do NOT require new management approval every month while Active.
              <span className="block mt-1 font-normal opacity-80">
                Require new approval IF: Amount significantly changes, Plan is upgraded, Client changes, Card changes, or Subscription is reactivated after cancellation.
              </span>
            </p>
          </div>

          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-slate-900">Existing Subscription Import</p>
              <p className="text-xs text-slate-500 mt-0.5">Onboard a recurring subscription that was already running before Spendy, so reconciliation can match it automatically.</p>
            </div>
            <button
              onClick={() => setModal({ mode: 'add' })}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Add Existing Subscription
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

        {activeTab === 'purchases' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor / Detail</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Card</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidence</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {purchases.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">No purchase records found.</td></tr>
                )}
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-700">{p.purchaseId}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">{p.vendor}</div>
                      <div className="text-[10px] text-slate-500">{p.employee} • {p.pod} {p.client ? `(${p.client})` : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">{p.actualAmount.toLocaleString()} {p.currency}</div>
                      {p.actualAmount !== p.approvedAmount && (
                        <div className="text-[9px] text-amber-600 font-bold uppercase tracking-widest mt-0.5">Approved: {p.approvedAmount}</div>
                      )}
                      {p.actualBankInrAmount != null && (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Deducted: ₹{p.actualBankInrAmount.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700">{p.card}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {p.evidenceUrl ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"><FileText className="w-3 h-3"/> View</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sub ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor / Detail</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequency</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next Payment</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {subscriptions.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">No subscription records found.</td></tr>
                )}
                {subscriptions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-mono font-bold text-indigo-700">{s.subscriptionId}</div>
                      {s.originalPurchaseId && <div className="text-[10px] font-mono text-slate-400 mt-0.5">{s.originalPurchaseId}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">{s.vendor}</div>
                      <div className="text-[10px] text-slate-500">{s.employeeOwner} • {s.pod} {s.client ? `(${s.client})` : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">{s.expectedRecurringAmount.toLocaleString()} {s.currency}</div>
                      {s.actualBankInrAmount != null && (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Deducted: ₹{s.actualBankInrAmount.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700">
                      {s.billingFrequency === 'Annual' ? 'Yearly' : s.billingFrequency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700">
                      {formatDate(s.nextExpectedCharge)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${(s.source ?? 'Approved Request') === 'Imported' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                        {s.source ?? 'Approved Request'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${s.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{s.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3 text-slate-400">
                        <button onClick={() => setModal({ mode: 'view', sub: s })} title="View" className="hover:text-blue-600 transition-colors"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ mode: 'edit', sub: s })} title="Edit" className="hover:text-blue-600 transition-colors"><Pencil className="w-4 h-4" /></button>
                        {s.status !== 'Cancelled' && (
                          <button onClick={() => handleDeactivate(s)} title="Deactivate" className="hover:text-red-600 transition-colors"><Ban className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'adSpends' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client / Platform</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Info</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing Period</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spend / Charged</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidence Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {adSpends.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">No ad spend records found.</td></tr>
                )}
                {adSpends.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">{a.client}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{a.platform}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-700">{a.adAccountName || 'N/A'}</div>
                      <div className="text-[10px] font-mono text-slate-400">{a.adAccountId || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700">
                      {a.billingPeriod || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">Spend: {a.platformSpend.toLocaleString()} {a.currency}</div>
                      <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">Charged: {a.cardAmountCharged.toLocaleString()} {a.currency}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700">
                      {a.evidenceType}
                      {a.evidenceUrl && <Download className="inline w-3 h-3 ml-2 text-blue-600 cursor-pointer" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {modal && (
        <SubscriptionModal
          mode={modal.mode}
          initial={modal.sub}
          onClose={() => setModal(null)}
          onSave={handleSaveSubscription}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { PurchaseRequest, ExpenseType, CardType, PurchaseType, SubscriptionFrequency, PurchaseCompletionDetails } from '../types';
import { PlusCircle, Send, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface EmployeeViewProps {
  requests: PurchaseRequest[];
  onAddRequest: (req: Omit<PurchaseRequest, 'id' | 'createdAt'>) => void;
  onCompletePurchase?: (id: string, details: PurchaseCompletionDetails) => void;
}

const PODS = ['Beacon', 'Nexus', 'Elite', 'Dyotha', 'Ajna', 'SEO', 'SMM', 'Agentic AI', 'Business Development', 'TD Internal', 'HR'];

// OTP is shared by Finance outside the app, so the requester can confirm as soon as the request is approved.
const CONFIRMABLE_STATUSES = ['Approved', 'Awaiting Purchase Completion'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD'];
const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };

export default function EmployeeView({ requests, onAddRequest, onCompletePurchase }: EmployeeViewProps) {
  const [view, setView] = useState<'list' | 'new'>('list');

  // Form State
  const [requesterName, setRequesterName] = useState('');
  const [pod, setPod] = useState('');
  const [toolVendor, setToolVendor] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>('Internal');
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [cardRequired, setCardRequired] = useState<CardType>('Internal Card');
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('One-time Purchase');
  const [subscriptionFrequency, setSubscriptionFrequency] = useState<SubscriptionFrequency>('Monthly');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Completion Form State
  const [completionReqId, setCompletionReqId] = useState<string | null>(null);
  const [actualVendorAmount, setActualVendorAmount] = useState('');
  const [actualCurrency, setActualCurrency] = useState('INR');
  const [actualPurchaseDate, setActualPurchaseDate] = useState('');
  const [invoiceUploaded, setInvoiceUploaded] = useState(false);
  const [actualBankInrAmount, setActualBankInrAmount] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState<'Completed' | 'Failed' | 'Cancelled'>('Completed');
  const [failureReason, setFailureReason] = useState('');

  const openCompletionForm = (req: PurchaseRequest) => {
    setCompletionReqId(req.id);
    setActualVendorAmount(req.amount.toString());
    setActualCurrency(req.currency);
    setActualPurchaseDate(new Date().toISOString().split('T')[0]);
    setInvoiceUploaded(false);
    setActualBankInrAmount('');
    setPurchaseStatus('Completed');
    setFailureReason('');
  };

  const submitCompletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionReqId || !onCompletePurchase) return;
    onCompletePurchase(completionReqId, {
      actualVendorAmount: parseFloat(actualVendorAmount) || 0,
      actualCurrency,
      actualPurchaseDate,
      actualBankInrAmount: actualBankInrAmount ? parseFloat(actualBankInrAmount) : undefined,
      bankAmountSource: actualBankInrAmount ? 'Employee Entered' : undefined,
      bankVerificationStatus: actualBankInrAmount ? 'Pending' : undefined,
      invoiceUploaded,
      purchaseStatus,
      failureReason: purchaseStatus !== 'Completed' ? failureReason : undefined
    });
    setCompletionReqId(null);
  };

  const handleSubmit = (e: React.FormEvent, isDraft: boolean) => {
    e.preventDefault();
    onAddRequest({
      requesterName,
      pod,
      toolVendor,
      expenseCategory,
      expenseType,
      clientName: clientName || undefined,
      amount: parseFloat(amount) || 0,
      currency,
      cardRequired,
      purchaseType,
      subscriptionFrequency: purchaseType === 'Recurring Subscription' ? subscriptionFrequency : undefined,
      expectedDate,
      notes,
      status: isDraft ? 'Draft' : 'Pending Approval',
    });
    
    // Reset and switch to list
    setView('list');
    resetForm();
  };

  const resetForm = () => {
    setRequesterName('');
    setPod('');
    setToolVendor('');
    setExpenseCategory('');
    setExpenseType('Internal');
    setClientName('');
    setAmount('');
    setCurrency('INR');
    setCardRequired('Internal Card');
    setPurchaseType('One-time Purchase');
    setSubscriptionFrequency('Monthly');
    setExpectedDate('');
    setNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Reconciled':
      case 'Processed':
      case 'Ready for Reconciliation':
        return <span className="px-2 py-0.5 bg-slate-800 text-white rounded text-[9px] font-bold uppercase tracking-widest">{status}</span>;
      case 'Approved':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-widest">Approved</span>;
      case 'Rejected':
      case 'Cancelled':
      case 'Purchase Failed':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold uppercase tracking-widest">{status}</span>;
      case 'Pending Approval':
      case 'Manager Review':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-bold uppercase tracking-widest">Review</span>;
      case 'Submitted':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold uppercase tracking-widest">Submitted</span>;
      case 'OTP Requested':
      case 'OTP Verified':
      case 'Awaiting Purchase Completion':
        return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-widest">{status}</span>;
      case 'Purchase Completed':
      case 'Pending Bank Amount Confirmation':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold uppercase tracking-widest">{status}</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase tracking-widest">Draft</span>;
    }
  };

  if (view === 'new') {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-700">New Purchase Request</h2>
          <p className="text-sm text-slate-500 mt-1">Submit a new software, ad spend, or expense request.</p>
        </div>
        <form className="p-6 space-y-6" onSubmit={(e) => handleSubmit(e, false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Requester Name *</label>
              <input required type="text" value={requesterName} onChange={e => setRequesterName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800" placeholder="e.g. Jane Doe" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Pod *</label>
              <select required value={pod} onChange={e => setPod(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800">
                <option value="">Select a Pod...</option>
                {PODS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Tool / Vendor *</label>
              <input required type="text" value={toolVendor} onChange={e => setToolVendor(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800" placeholder="e.g. Google Ads, Notion, Asana" />
            </div>
            {/* Expense Type Toggle */}
            <div className="md:col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-sm">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="expenseType" checked={expenseType === 'Internal'} onChange={() => { setExpenseType('Internal'); setCardRequired('Internal Card'); }} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">Internal Expense</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="expenseType" checked={expenseType === 'Client'} onChange={() => { setExpenseType('Client'); setCardRequired('Client Card'); }} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">Client Expense</span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                  {expenseType === 'Client' ? 'Client Name *' : 'Account Name *'}
                </label>
                <input required type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800" placeholder={expenseType === 'Client' ? 'Client account to bill' : 'e.g. Internal Ops, Marketing Team'} />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Expense Category *</label>
              <input required type="text" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800" placeholder="e.g. Software, Media Spend, Travel" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Expected Amount *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-500 sm:text-sm">{CURRENCY_SYMBOLS[currency] || currency}</span>
                </div>
                <input required type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Purchase Type *</label>
              <div className="flex flex-wrap gap-3 mt-2">
                {(['One-time Purchase', 'Recurring Subscription', 'Ad Spend'] as PurchaseType[]).map(type => (
                  <label key={type} className={`px-4 py-2 border rounded-lg cursor-pointer text-sm font-semibold transition-colors shadow-sm ${purchaseType === type ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <input type="radio" name="purchaseType" className="sr-only" checked={purchaseType === type} onChange={() => setPurchaseType(type)} />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            {purchaseType === 'Recurring Subscription' && (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Subscription Frequency</label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {(['Monthly', 'Quarterly', 'Annual'] as SubscriptionFrequency[]).map(freq => (
                    <label key={freq} className={`px-4 py-2 border rounded-lg cursor-pointer text-sm font-semibold transition-colors shadow-sm ${subscriptionFrequency === freq ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input type="radio" name="subscriptionFrequency" className="sr-only" checked={subscriptionFrequency === freq} onChange={() => setSubscriptionFrequency(freq)} />
                      {freq}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Expected Purchase Date *</label>
              <input required type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Supporting Notes (Optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800" placeholder="Links to pricing, specific tier needed, etc." />
            </div>
          </div>
          
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={() => setView('list')} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
              Cancel
            </button>
            <button type="button" onClick={(e) => handleSubmit(e, true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 border border-transparent rounded-lg hover:bg-slate-200 transition-colors">
              <Save className="w-4 h-4" /> Save as Draft
            </button>
            <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
              <Send className="w-4 h-4" /> Submit for Review
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Requests</h2>
          <p className="text-sm text-slate-500">Manage and track your purchase requests.</p>
        </div>
        <button onClick={() => setView('new')} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <PlusCircle className="w-4 h-4" /> New Request
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4 border border-slate-100">
            <PlusCircle className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No requests yet</h3>
          <p className="mt-1 text-sm text-slate-500">Get started by creating a new purchase request.</p>
          <div className="mt-6">
            <button onClick={() => setView('new')} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <PlusCircle className="w-4 h-4" /> New Request
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tool / Vendor</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-[10px] font-mono text-slate-500">
                      {req.purchaseId || <span className="font-sans font-medium">Pending</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-800">{req.toolVendor}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5"><span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase tracking-widest mr-1">{req.expenseType}</span> {req.clientName ? `${req.clientName}` : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">
                      {req.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {req.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {req.purchaseType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {CONFIRMABLE_STATUSES.includes(req.status) && (
                        <button onClick={() => openCompletionForm(req)} className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded hover:bg-emerald-700 transition-colors shadow-sm">
                          Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {completionReqId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Confirm Purchase</h3>
                <p className="text-xs text-slate-500">Enter the exact amount deducted from the card. It can differ from the request (e.g. USD → INR conversion).</p>
              </div>
              <button onClick={() => setCompletionReqId(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={submitCompletion} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Purchase Status</label>
                <select value={purchaseStatus} onChange={e => setPurchaseStatus(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <option value="Completed">Purchase Completed Successfully</option>
                  <option value="Failed">Payment Failed</option>
                  <option value="Cancelled">Cancelled / Did not proceed</option>
                </select>
              </div>

              {purchaseStatus === 'Completed' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Actual Vendor Amount</label>
                      <input required type="number" step="0.01" min="0" value={actualVendorAmount} onChange={e => setActualVendorAmount(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Currency</label>
                      <select value={actualCurrency} onChange={e => setActualCurrency(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Actual Purchase Date *</label>
                      <input required type="date" value={actualPurchaseDate} onChange={e => setActualPurchaseDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Exact Amount Deducted (INR) *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 text-sm">₹</span>
                        </div>
                        <input required type="number" step="0.01" min="0" value={actualBankInrAmount} onChange={e => setActualBankInrAmount(e.target.value)} placeholder="As shown on card / bank SMS" className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer mt-4">
                    <input type="checkbox" checked={invoiceUploaded} onChange={e => setInvoiceUploaded(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-700 font-medium">Invoice / Receipt Uploaded</span>
                  </label>
                </>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Reason (Optional)</label>
                  <input type="text" value={failureReason} onChange={e => setFailureReason(e.target.value)} placeholder="Why was it not completed?" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setCompletionReqId(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Confirm Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

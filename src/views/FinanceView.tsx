import React, { useState } from 'react';
import { PurchaseRequest } from '../types';
import { Search, AlertTriangle, CheckCircle, ShieldAlert, CreditCard, Building2, User, FileText, Upload, Filter, Clock } from 'lucide-react';

interface FinanceViewProps {
  requests: PurchaseRequest[];
  onUpdateStatus: (id: string, status: any) => void;
  onUpdateBankAmount?: (id: string, bankAmount: number) => void; // We can add this if needed, or implement it
}

export default function FinanceView({ requests, onUpdateStatus, onUpdateBankAmount }: FinanceViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedRequest, setSearchedRequest] = useState<PurchaseRequest | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Form states for processing
  const [actualAmount, setActualAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [evidenceFile, setEvidenceFile] = useState('');

  // Subscription specific
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedRenewalDate, setExpectedRenewalDate] = useState('');
  const [nextExpectedCharge, setNextExpectedCharge] = useState('');

  // Ad Spend specific
  const [adAccountName, setAdAccountName] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [platformSpend, setPlatformSpend] = useState('');
  const [cardAmountCharged, setCardAmountCharged] = useState('');
  const [evidenceType, setEvidenceType] = useState('Screenshot');
  const [notes, setNotes] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    const found = requests.find(r => r.purchaseId?.toUpperCase() === query);
    setSearchedRequest(found || null);
    setHasSearched(true);
    
    if (found) {
      setActualAmount(found.amount.toString());
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchedRequest(null);
    setHasSearched(false);
  };

  const [editingInrReqId, setEditingInrReqId] = useState<string | null>(null);
  const [financeInrAmount, setFinanceInrAmount] = useState('');

  const handleProvideOTP = () => {
    if (!searchedRequest) return;
    onUpdateStatus(searchedRequest.id, 'Awaiting Purchase Completion');
    clearSearch();
  };

  const submitFinanceInr = (id: string) => {
    const val = parseFloat(financeInrAmount);
    if (!isNaN(val) && onUpdateBankAmount) {
      onUpdateBankAmount(id, val);
    }
    setEditingInrReqId(null);
    setFinanceInrAmount('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Purchase Completed':
      case 'Pending Bank Amount Confirmation':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold uppercase tracking-widest">{status}</span>;
      case 'Awaiting Purchase Completion':
      case 'OTP Verified':
        return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-widest">{status}</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase tracking-widest">{status}</span>;
    }
  };

  const pendingCompletions = requests.filter(r => 
    r.status === 'Awaiting Purchase Completion' || 
    r.status === 'Purchase Completed' || 
    r.status === 'Pending Bank Amount Confirmation'
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* OTP Policy Warning */}
      <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <span className="text-slate-300 text-xs font-medium">System Module: <span className="font-mono">OTP-VERIFY</span></span>
        <div className="flex gap-4">
          <span className="text-white text-xs font-bold animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span> DO NOT PROVIDE OTP UNLESS APPROVED
          </span>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-xl border-2 border-blue-100 shadow-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-100 bg-blue-50/30 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-blue-900">Finance OTP Verification Portal</h3>
            <p className="text-xs text-slate-500">Verify Purchase ID before providing one-time passwords</p>
          </div>
          <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            ⚠️ MANDATORY CHECK
          </div>
        </div>

        <div className="p-8 flex flex-col items-center justify-center text-center">
          <div className="mb-6 p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl w-full max-w-md">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-4">Enter Purchase ID to Unlock Details</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                className="flex-1 p-4 bg-white border border-blue-400 rounded-lg text-xl font-mono text-center shadow-inner focus:ring-2 focus:ring-blue-500 outline-none uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400"
                placeholder="e.g. PUR-2026-0001"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="bg-slate-900 text-white px-6 rounded-lg font-bold shadow-sm hover:bg-slate-800 transition-colors">
                VERIFY
              </button>
            </form>
            {hasSearched && (
              <button type="button" onClick={clearSearch} className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-700 underline uppercase tracking-wider">
                Clear Search
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          {!searchedRequest ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4 border border-red-100">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Purchase ID Not Found</h3>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">We could not find any record of <span className="font-mono font-medium text-slate-900">{searchQuery}</span>. Do not provide OTP.</p>
            </div>
          ) : (
            <>
              <div className={`bg-white border-2 rounded-xl overflow-hidden shadow-sm ${searchedRequest.status === 'Approved' || ['Awaiting Purchase Completion', 'OTP Verified', 'Purchase Completed', 'Pending Bank Amount Confirmation'].includes(searchedRequest.status) ? 'border-emerald-200' : 'border-red-200'}`}>
                {/* Status Header */}
                <div className={`p-6 border-b flex justify-between items-center ${searchedRequest.status === 'Approved' || ['Awaiting Purchase Completion', 'OTP Verified', 'Purchase Completed', 'Pending Bank Amount Confirmation'].includes(searchedRequest.status) ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                  <div>
                    <h3 className={`text-base font-bold ${searchedRequest.status === 'Approved' || ['Awaiting Purchase Completion', 'OTP Verified', 'Purchase Completed', 'Pending Bank Amount Confirmation'].includes(searchedRequest.status) ? 'text-emerald-900' : 'text-red-900'}`}>
                      {searchedRequest.status === 'Approved' ? 'VERIFIED & APPROVED' : ['Awaiting Purchase Completion', 'OTP Verified'].includes(searchedRequest.status) ? 'OTP ALREADY PROVIDED' : `STATUS: ${searchedRequest.status.toUpperCase()}`}
                    </h3>
                    {!['Approved', 'Awaiting Purchase Completion', 'OTP Verified', 'Purchase Completed', 'Pending Bank Amount Confirmation'].includes(searchedRequest.status) && (
                      <p className="text-xs text-red-700 font-medium">Do not provide OTP for this transaction.</p>
                    )}
                    {['Awaiting Purchase Completion', 'OTP Verified'].includes(searchedRequest.status) && (
                      <p className="text-xs text-emerald-700 font-medium">Employee is yet to complete the purchase details.</p>
                    )}
                  </div>
                  {['Approved', 'Awaiting Purchase Completion', 'OTP Verified', 'Purchase Completed', 'Pending Bank Amount Confirmation'].includes(searchedRequest.status) ? (
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" /> SAFE TO PROCEED
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" /> REJECTED / PENDING
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-8">
                  <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                    {/* Col 1 */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Status</p>
                        <p className={`text-sm font-bold ${searchedRequest.status === 'Approved' ? 'text-emerald-600' : 'text-red-600'}`}>● {searchedRequest.status.toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Requester / Pod</p>
                        <p className="text-sm font-semibold text-slate-700">{searchedRequest.requesterName} / {searchedRequest.pod}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Tool / Vendor</p>
                        <p className="text-sm font-semibold text-slate-700">{searchedRequest.toolVendor}</p>
                      </div>
                    </div>

                    {/* Col 2 */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Client</p>
                        <p className="text-sm font-semibold text-slate-700">{searchedRequest.clientName || 'N/A (Internal)'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Expense Type</p>
                        <p className="text-sm font-semibold text-blue-600">{searchedRequest.expenseType}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Manager Approval</p>
                        <p className="text-sm font-semibold text-slate-700">{searchedRequest.managerName || 'Pending'} {searchedRequest.approvalTimestamp ? `(${new Date(searchedRequest.approvalTimestamp).toLocaleDateString()})` : ''}</p>
                      </div>
                    </div>

                    {/* Col 3 */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Amount</p>
                        <p className="text-lg font-bold text-slate-900">{searchedRequest.amount.toLocaleString()} {searchedRequest.currency}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Card Required</p>
                        <p className="text-sm font-bold text-slate-700 flex items-center gap-2">💳 {searchedRequest.cardRequired}</p>
                      </div>
                      {searchedRequest.status === 'Approved' && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mt-2">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase leading-tight">Safe to Provide OTP</p>
                          <p className="text-[9px] text-emerald-600 mt-0.5 leading-tight italic">Reference: {searchedRequest.purchaseId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              {searchedRequest.status === 'Approved' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 delay-150">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-base font-bold text-slate-900">Provide OTP to Employee</h3>
                    <p className="text-xs text-slate-500">Provide the OTP and transition this request to wait for the employee to complete the purchase details.</p>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex justify-end">
                      <button onClick={handleProvideOTP} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700 transition-colors">
                        Provide OTP & Verify
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Pending Completions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Purchase Completions</h3>
            <p className="text-xs text-slate-500">Track requests waiting for post-purchase details from employees.</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Filters</span>
          </div>
        </div>
        
        {pendingCompletions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">No requests currently awaiting purchase completion.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actual Vendor</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank INR</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {pendingCompletions.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-slate-600">
                      {req.purchaseId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-800">{req.requesterName}</div>
                      <div className="text-[10px] text-slate-500">{req.toolVendor}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {req.amount} {req.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-800">
                      {req.completionDetails ? `${req.completionDetails.actualVendorAmount} ${req.completionDetails.actualCurrency}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-800">
                      {editingInrReqId === req.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" value={financeInrAmount} onChange={e => setFinanceInrAmount(e.target.value)} className="w-20 px-2 py-1 border rounded" />
                          <button onClick={() => submitFinanceInr(req.id)} className="text-green-600 hover:text-green-700 font-bold">✓</button>
                          <button onClick={() => setEditingInrReqId(null)} className="text-slate-400">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {req.completionDetails?.actualBankInrAmount ? `₹${req.completionDetails.actualBankInrAmount}` : 'Pending'}
                          {req.completionDetails && req.status === 'Purchase Completed' && (
                             <button onClick={() => { setEditingInrReqId(req.id); setFinanceInrAmount(req.completionDetails?.actualBankInrAmount?.toString() || ''); }} className="text-slate-400 hover:text-blue-600 ml-2" title="Finance Confirm INR Amount">✎</button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {getStatusBadge(req.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

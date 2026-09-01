import React from 'react';
import { PurchaseRequest, RequestStatus } from '../types';
import { Check, X, Clock, ExternalLink, ShieldCheck } from 'lucide-react';

interface ManagerViewProps {
  requests: PurchaseRequest[];
  onUpdateStatus: (id: string, status: RequestStatus, managerName: string) => void;
}

export default function ManagerView({ requests, onUpdateStatus }: ManagerViewProps) {
  const pendingRequests = requests.filter(r => r.status === 'Pending Approval' || r.status === 'Submitted');
  const pastRequests = requests.filter(r => !['Draft', 'Pending Approval', 'Submitted'].includes(r.status));

  const handleAction = (id: string, action: 'Approve' | 'Reject') => {
    // In a real app, you might capture the logged-in manager's name
    const managerName = "Sarah Chen (Director)";
    onUpdateStatus(id, action === 'Approve' ? 'Approved' : 'Rejected', managerName);
  };

  const markAsReviewing = (id: string) => {
    onUpdateStatus(id, 'Pending Approval', "Sarah Chen (Director)");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      
      {/* Pending Approvals */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Pending Approvals</h2>
          <p className="text-sm text-slate-500">Review and action purchase requests from your pod.</p>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 border border-slate-100 mb-4">
              <Check className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">All caught up!</h3>
            <p className="text-sm text-slate-500 mt-1">There are no pending purchase requests to review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingRequests.map(req => (
              <div key={req.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${req.status === 'Pending Approval' ? 'border-amber-300 ring-2 ring-amber-100 shadow-md' : 'border-slate-200'}`}>
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{req.toolVendor}</h3>
                    <p className="text-xs text-slate-500 mt-1">Requested by <span className="font-semibold text-slate-700">{req.requesterName}</span> • {req.pod}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-xl">{req.amount.toLocaleString()} {req.currency}</div>
                    <div className="text-[9px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md mt-1 inline-block uppercase tracking-widest">{req.cardRequired}</div>
                  </div>
                </div>
                
                <div className="px-6 py-5 space-y-5">
                  <div className="grid grid-cols-2 gap-5 text-sm">
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">Expense Type</span>
                      <span className="font-semibold text-slate-800">{req.expenseType}</span>
                      {req.clientName && <span className="text-slate-500 ml-1 font-medium">({req.clientName})</span>}
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">Purchase Type</span>
                      <span className="font-semibold text-slate-800">{req.purchaseType}</span>
                      {req.subscriptionFrequency && <span className="text-slate-500 ml-1 font-medium">({req.subscriptionFrequency})</span>}
                    </div>
                    <div className="col-span-2">
                      <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">Purpose</span>
                      <span className="text-slate-700">{req.purpose}</span>
                    </div>
                    {req.notes && (
                      <div className="col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-600 text-sm">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Notes</span>
                        {req.notes}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Expected: {new Date(req.expectedDate).toLocaleDateString()}
                  </div>
                  <div className="flex gap-3">
                    {(req.status === 'Submitted' || req.status === 'Pending Approval') && (
                      <button onClick={() => markAsReviewing(req.id)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shadow-sm">
                        Reviewing
                      </button>
                    )}
                    <button onClick={() => handleAction(req.id, 'Reject')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button onClick={() => handleAction(req.id, 'Approve')} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Decisions */}
      {pastRequests.length > 0 && (
        <div className="pt-8 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Past Decisions</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Request</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Result</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {pastRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-800">{req.toolVendor}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Req: {req.requesterName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">
                      {req.amount.toLocaleString()} {req.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {req.status === 'Approved' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {req.status}
                      </span>
                      {req.purchaseId && <div className="text-[10px] font-mono text-slate-400 mt-1">{req.purchaseId}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {req.approvalTimestamp ? new Date(req.approvalTimestamp).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

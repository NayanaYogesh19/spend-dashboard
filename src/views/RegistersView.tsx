import React, { useState } from 'react';
import { PurchaseRecord, SubscriptionRecord, AdSpendRecord } from '../types';
import { Database, RotateCw, Megaphone, FileText, Download } from 'lucide-react';

interface RegistersViewProps {
  purchases: PurchaseRecord[];
  subscriptions: SubscriptionRecord[];
  adSpends: AdSpendRecord[];
}

export default function RegistersView({ purchases, subscriptions, adSpends }: RegistersViewProps) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'subscriptions' | 'adSpends'>('purchases');

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

      {/* Subscription Specific Warning */}
      {activeTab === 'subscriptions' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
          <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1">Important Rule: Renewals</p>
          <p className="text-sm text-indigo-900 font-medium">
            Recurring subscriptions do NOT require new management approval every month while Active. 
            <span className="block mt-1 font-normal opacity-80">
              Require new approval IF: Amount significantly changes, Plan is upgraded, Client changes, Card changes, or Subscription is reactivated after cancellation.
            </span>
          </p>
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
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sub ID / Orig PUR</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor / Detail</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recurring Amt</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequency</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {subscriptions.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">No subscription records found.</td></tr>
                )}
                {subscriptions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-mono font-bold text-indigo-700">{s.subscriptionId}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{s.originalPurchaseId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">{s.vendor}</div>
                      <div className="text-[10px] text-slate-500">{s.employeeOwner} • {s.pod} {s.client ? `(${s.client})` : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900">
                      {s.expectedRecurringAmount.toLocaleString()} {s.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700">
                      {s.billingFrequency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${s.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{s.status}</span>
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
    </div>
  );
}

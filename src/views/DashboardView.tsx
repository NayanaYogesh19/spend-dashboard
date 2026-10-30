import React, { useState } from 'react';
import { ReconciliationPeriod, BankTransaction, SubscriptionRecord, PurchaseRecord, AdSpendRecord, AuditLog } from '../types';
import { BarChart3, AlertCircle, FileSpreadsheet, Lock, Search, Filter } from 'lucide-react';
import PodSpendChart, { PodSpendRow } from './PodSpendChart';

interface Props {
  periods: ReconciliationPeriod[];
  bankTransactions: BankTransaction[];
  subscriptions: SubscriptionRecord[];
  purchases: PurchaseRecord[];
  adSpends: AdSpendRecord[];
  auditLogs: AuditLog[];
  onClosePeriod: (periodId: string, reason: string, user: string) => void;
  onToggleFeeBillable: (txnId: string, billable: boolean) => void;
}

type Tab = 'Reconciliation' | 'Subscriptions' | 'ClientBilling';

export default function DashboardView({
  periods, bankTransactions, subscriptions, purchases, adSpends, auditLogs, onClosePeriod, onToggleFeeBillable
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Reconciliation');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periods[0]?.id || null);
  const [closureReason, setClosureReason] = useState('');

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
  const periodTxns = bankTransactions.filter(t => t.periodId === selectedPeriodId);

  // --- Reconciliation Summary Stats ---
  const totalSpend = periodTxns.filter(t => t.type === 'Merchant').reduce((sum, t) => sum + t.inrAmount, 0);
  const totalFees = periodTxns.filter(t => t.type === 'Fee').reduce((sum, t) => sum + t.inrAmount, 0);
  const totalTaxes = periodTxns.filter(t => t.type === 'Tax').reduce((sum, t) => sum + t.inrAmount, 0);
  const intlTxns = periodTxns.filter(t => t.intlAmount > 0).length;

  const totalCount = periodTxns.length;
  const matchedCount = periodTxns.filter(t => t.status === 'Matched').length;
  const associatedCount = periodTxns.filter(t => t.status === 'Associated').length;
  const reconciledCount = matchedCount + associatedCount;
  const unidentifiedCount = periodTxns.filter(t => t.status === 'Unidentified').length;
  const pendingCount = periodTxns.filter(t => t.status === 'Review' || t.status === 'Possible Multiple Matches').length;

  const reconciliationPct = totalCount > 0 ? ((reconciledCount / totalCount) * 100).toFixed(1) : 0;

  // --- Subscriptions Dashboard Stats ---
  const activeSubs = subscriptions.filter(s => s.status === 'Active');
  const internalSubs = activeSubs.filter(s => !s.billable);
  const clientSubs = activeSubs.filter(s => s.billable);
  
  const mrc = activeSubs.filter(s => s.billingFrequency === 'Monthly').reduce((sum, s) => sum + s.expectedRecurringAmount, 0);
  const arc = mrc * 12 + activeSubs.filter(s => s.billingFrequency === 'Annual').reduce((sum, s) => sum + s.expectedRecurringAmount, 0);

  // --- Spend by Pod ---
  const NOT_MATCHED = 'Not yet matched';
  const addTo = (map: Map<string, PodSpendRow>, label: string, amount: number, muted = false) => {
    const row = map.get(label) ?? { label, amount: 0, count: 0, muted };
    row.amount += amount;
    row.count += 1;
    map.set(label, row);
  };

  // Card charges in the selected period, by the pod of the record each line is matched to.
  const periodPodMap = new Map<string, PodSpendRow>();
  for (const t of periodTxns.filter(t => t.type === 'Merchant')) {
    const pod = (t.status === 'Matched' || t.status === 'Review') ? t.suggestedPod : undefined;
    addTo(periodPodMap, pod || NOT_MATCHED, t.inrAmount, !pod);
  }
  const periodPodRows = [...periodPodMap.values()];

  // Active subscriptions as a monthly INR cost (quarterly ÷ 3, yearly ÷ 12).
  const MONTHS_PER_CYCLE = { Monthly: 1, Quarterly: 3, Annual: 12 } as const;
  const subPodMap = new Map<string, PodSpendRow>();
  let subsWithoutInr = 0;
  for (const s of activeSubs) {
    const inr = s.actualBankInrAmount ?? (s.currency === 'INR' ? s.expectedRecurringAmount : undefined);
    if (inr == null) { subsWithoutInr++; continue; }
    addTo(subPodMap, s.pod || 'Unassigned', inr / MONTHS_PER_CYCLE[s.billingFrequency]);
  }
  const subPodRows = [...subPodMap.values()];

  // --- Client Billing View Logic ---
  const [selectedClient, setSelectedClient] = useState<string>('');
  
  // Collect unique clients
  const uniqueClients = Array.from(new Set([
    ...clientSubs.map(s => s.client).filter(Boolean),
    ...purchases.filter(p => p.billable).map(p => p.client).filter(Boolean),
    ...adSpends.map(a => a.client).filter(Boolean)
  ])) as string[];

  const handleCloseMonth = () => {
    if (!selectedPeriodId || !closureReason.trim()) return;
    onClosePeriod(selectedPeriodId, closureReason, 'Finance Admin');
    setClosureReason('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Finance Dashboard</h2>
          <p className="text-slate-500">Monitor reconciliation status, subscriptions, and client billing.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('Reconciliation')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'Reconciliation' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Reconciliation Summary
        </button>
        <button
          onClick={() => setActiveTab('Subscriptions')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'Subscriptions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Subscription Intelligence
        </button>
        <button
          onClick={() => setActiveTab('ClientBilling')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ClientBilling' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Client Billing View
        </button>
      </div>

      {activeTab === 'Reconciliation' && (
        <div className="space-y-6">
          <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <span className="text-sm font-medium text-slate-700">Select Period:</span>
            <select
              value={selectedPeriodId || ''}
              onChange={e => setSelectedPeriodId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {periods.length === 0 && <option value="">No periods available</option>}
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.card}) {p.status === 'Closed' ? ' - CLOSED' : ''}</option>
              ))}
            </select>
          </div>

          {selectedPeriod && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-sm text-slate-500 font-medium mb-1">Total Spend (INR)</div>
                  <div className="text-2xl font-bold text-slate-900">₹{totalSpend.toLocaleString()}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-sm text-slate-500 font-medium mb-1">Bank Fees & Taxes</div>
                  <div className="text-2xl font-bold text-slate-900">₹{(totalFees + totalTaxes).toLocaleString()}</div>
                  <div className="text-xs text-slate-400 mt-1">Fees: ₹{totalFees} • Taxes: ₹{totalTaxes}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-sm text-slate-500 font-medium mb-1">International Txns</div>
                  <div className="text-2xl font-bold text-slate-900">{intlTxns}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-sm text-slate-500 font-medium mb-1">Reconciliation Rate</div>
                  <div className="text-2xl font-bold text-blue-600">{reconciliationPct}%</div>
                  <div className="text-xs text-slate-400 mt-1">{reconciledCount} of {totalCount} completed</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-semibold text-slate-900">Status Breakdown</h3>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-center space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        Reconciled (Matched/Associated)
                      </span>
                      <span className="font-medium text-slate-900">{reconciledCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        Pending Review
                      </span>
                      <span className="font-medium text-slate-900">{pendingCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Unidentified / Missing Context
                      </span>
                      <span className="font-medium text-slate-900">{unidentifiedCount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900">Month Closure</h3>
                    {selectedPeriod.status === 'Closed' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        <Lock className="w-3.5 h-3.5" /> Closed
                      </span>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    {selectedPeriod.status === 'Closed' ? (
                      <div className="text-center">
                        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-600 mb-2">This period was closed by {selectedPeriod.closedBy}</p>
                        <p className="text-xs text-slate-400 italic">"{selectedPeriod.closureReason}"</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 mb-4">
                          Ensure all transactions are accurately reconciled before closing the month. 
                          Closing preserves evidence and locks standard modifications.
                        </p>
                        
                        {(pendingCount > 0 || unidentifiedCount > 0) && (
                          <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4 border border-amber-200 flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <strong>Exceptions Remain:</strong> You are closing the month with {pendingCount + unidentifiedCount} unresolved items. A valid reason must be provided for the audit log.
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-3">
                          <input 
                            type="text" 
                            placeholder="Reason for closure (required)..."
                            value={closureReason}
                            onChange={e => setClosureReason(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <button 
                            onClick={handleCloseMonth}
                            disabled={!closureReason.trim()}
                            className="w-full py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                          >
                            <Lock className="w-4 h-4" />
                            Close Reconciliation Month
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <PodSpendChart
                title="Spend by Pod"
                subtitle={`Card charges in ${selectedPeriod.name}, by the pod of the matched record. Fees & taxes excluded.`}
                rows={periodPodRows}
                countLabel="transactions"
                emptyText="No card charges imported for this period yet."
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'Subscriptions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 font-medium mb-1">Active Subscriptions</div>
              <div className="text-2xl font-bold text-slate-900">{activeSubs.length}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 font-medium mb-1">Total MRC (Estimated)</div>
              <div className="text-2xl font-bold text-slate-900">{mrc.toLocaleString()}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 font-medium mb-1">Total ARC (Estimated)</div>
              <div className="text-2xl font-bold text-slate-900">{arc.toLocaleString()}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 font-medium mb-1">Billable to Clients</div>
              <div className="text-2xl font-bold text-blue-600">{clientSubs.length}</div>
            </div>
          </div>

          <PodSpendChart
            title="Monthly Subscription Cost by Pod"
            subtitle={`Active subscriptions in INR per month (quarterly ÷ 3, yearly ÷ 12).${subsWithoutInr ? ` ${subsWithoutInr} without an INR amount not included.` : ''}`}
            rows={subPodRows}
            countLabel="subscriptions"
            emptyText="No active subscriptions yet."
          />

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Subscription Alerts & Anomalies</h3>
            </div>
            <div className="p-0">
              {/* Mocking alerts based on logical checks */}
              <div className="divide-y divide-slate-100">
                {activeSubs.filter(s => s.billable && !s.client).map(s => (
                  <div key={`alert-${s.subscriptionId}`} className="p-4 flex gap-3 items-start bg-red-50/30">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">Client Subscription missing Client mapping</div>
                      <div className="text-xs text-slate-500 mt-1">{s.subscriptionId} ({s.vendor}) is marked billable but has no assigned client.</div>
                    </div>
                  </div>
                ))}
                {activeSubs.filter(s => !s.employeeOwner).map(s => (
                  <div key={`alert-owner-${s.subscriptionId}`} className="p-4 flex gap-3 items-start bg-yellow-50/30">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">Orphaned Subscription</div>
                      <div className="text-xs text-slate-500 mt-1">{s.subscriptionId} ({s.vendor}) has no assigned employee owner.</div>
                    </div>
                  </div>
                ))}
                <div className="p-6 text-center text-slate-500 text-sm italic">
                  No further anomalies detected.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ClientBilling' && (
        <div className="space-y-6">
          <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <span className="text-sm font-medium text-slate-700">Client:</span>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[200px] focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a Client...</option>
              {uniqueClients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {selectedClient ? (() => {
            const clientAds = adSpends.filter(a => a.client === selectedClient);
            const cSubs = clientSubs.filter(s => s.client === selectedClient);
            const cPurchases = purchases.filter(p => p.billable && p.client === selectedClient);
            
            // Find fees linked to these transactions
            // For a robust implementation we'd link BankTransactions back to Purchases/Subs
            // Mocking for UI demonstration based on periodTxns:
            const clientRelatedFees = periodTxns.filter(t => (t.type === 'Fee' || t.type === 'Tax') && t.status === 'Associated');
            const totalFeesBillable = clientRelatedFees.filter(f => f.isFeeBillableToClient).reduce((sum, f) => sum + f.inrAmount, 0);

            const adTotal = clientAds.reduce((sum, a) => sum + a.platformSpend, 0);
            const subTotal = cSubs.reduce((sum, s) => sum + s.expectedRecurringAmount, 0);
            const purchaseTotal = cPurchases.reduce((sum, p) => sum + p.actualAmount, 0);
            
            const finalBillable = adTotal + subTotal + purchaseTotal + totalFeesBillable;

            return (
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-6">
                  {/* Tools / Subscriptions */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <h3 className="font-semibold text-slate-900 text-sm">Client-Specific Subscriptions</h3>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                          <th className="px-5 py-3 font-medium">Tool</th>
                          <th className="px-5 py-3 font-medium">Owner</th>
                          <th className="px-5 py-3 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {cSubs.map(s => (
                          <tr key={s.subscriptionId}>
                            <td className="px-5 py-3 text-slate-900">{s.tool} <span className="text-xs text-slate-400">({s.vendor})</span></td>
                            <td className="px-5 py-3 text-slate-600">{s.employeeOwner}</td>
                            <td className="px-5 py-3 text-slate-900 text-right font-medium">{s.expectedRecurringAmount.toLocaleString()}</td>
                          </tr>
                        ))}
                        {cSubs.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-400 text-sm">No subscriptions</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* Associated Bank Fees */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-900 text-sm">Related Taxes & Fees (Current Period)</h3>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                          <th className="px-5 py-3 font-medium">Type / Desc</th>
                          <th className="px-5 py-3 font-medium text-right">Amount (INR)</th>
                          <th className="px-5 py-3 font-medium text-center">Billable to Client</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {clientRelatedFees.map(f => (
                          <tr key={f.id} className={f.isFeeBillableToClient ? 'bg-blue-50/30' : ''}>
                            <td className="px-5 py-3">
                              <span className="font-medium text-slate-900">{f.type}</span>
                              <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{f.originalDescription}</div>
                            </td>
                            <td className="px-5 py-3 text-slate-900 text-right font-medium">₹{f.inrAmount.toLocaleString()}</td>
                            <td className="px-5 py-3 text-center">
                              <label className="inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={!!f.isFeeBillableToClient}
                                  onChange={(e) => onToggleFeeBillable(f.id, e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </td>
                          </tr>
                        ))}
                        {clientRelatedFees.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-400 text-sm">No associated fees found in current period</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Totals */}
                <div className="col-span-1">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Billing Summary</h3>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Ad Spend</span>
                        <span>{adTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Subscriptions</span>
                        <span>{subTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>One-time Purchases</span>
                        <span>{purchaseTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 pt-3 border-t border-slate-100">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-900">{(adTotal + subTotal + purchaseTotal).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Billable Fees/Taxes</span>
                        <span>₹{totalFeesBillable.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg font-bold text-slate-900 pt-3 border-t border-slate-200 mt-2">
                        <span>Final Billable</span>
                        <span>₹{finalBillable.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Select a client to view their billing aggregation.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

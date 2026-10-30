import React, { useState } from 'react';
import { useStore } from './hooks/useStore';
import EmployeeView from './views/EmployeeView';
import ManagerView from './views/ManagerView';
import FinanceView from './views/FinanceView';
import RegistersView from './views/RegistersView';
import ReconciliationView from './views/ReconciliationView';
import DashboardView from './views/DashboardView';
import { CreditCard, Users, ShieldCheck, Wallet, Database, FileSpreadsheet, BarChart3, AlertTriangle, Upload, Loader2 } from 'lucide-react';

type Role = 'Employee' | 'Manager' | 'Finance' | 'Registers' | 'Reconciliation' | 'Dashboard';

export default function App() {
  const { syncStatus, syncError, legacyData, importLegacyData, dismissLegacyData, requests, purchases, subscriptions, adSpends, periods, bankTransactions, merchantAliases, auditLogs, addRequest, updateRequestStatus, processPurchase, processSubscription, processAdSpend, completePurchase, updateBankAmount, addReconciliationPeriod, importBankTransactions, updateBankTransaction, confirmTransactionMatch, addImportedSubscription, updateSubscription, addMerchantAlias, closePeriod, toggleFeeBillable } = useStore();
  const [activeRole, setActiveRole] = useState<Role>('Dashboard');

  const navItems: { role: Role; icon: React.ReactNode; label: string; desc: string }[] = [
    { role: 'Dashboard', icon: <BarChart3 className="w-5 h-5" />, label: 'Dashboard', desc: 'Insights & Billing' },
    { role: 'Employee', icon: <Users className="w-5 h-5" />, label: 'Requester', desc: 'Submit & Track' },
    { role: 'Manager', icon: <ShieldCheck className="w-5 h-5" />, label: 'Approvals', desc: 'Review Requests' },
    { role: 'Finance', icon: <Wallet className="w-5 h-5" />, label: 'Finance', desc: 'OTP & Process' },
    { role: 'Registers', icon: <Database className="w-5 h-5" />, label: 'Registers', desc: 'Master Logs' },
    { role: 'Reconciliation', icon: <FileSpreadsheet className="w-5 h-5" />, label: 'Reconciliation', desc: 'Bank Import' },
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-[#0F172A] text-white border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-lg italic text-white">
                S
              </div>
              <span className="text-xl font-bold tracking-tight">SpendControl</span>
            </div>
            
            <div className="text-sm font-medium text-slate-400">
              Finance Operations Hub
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Role Switcher (Simulated Navigation) */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
          {navItems.map((item) => (
            <button
              key={item.role}
              onClick={() => setActiveRole(item.role)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-200 ${
                activeRole === item.role
                  ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-transparent border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600'
              }`}
            >
              <div className={`${activeRole === item.role ? 'text-blue-600' : 'text-slate-400'}`}>
                {item.icon}
              </div>
              <div className="text-left">
                <div className={`font-semibold text-sm ${activeRole === item.role ? 'text-blue-900' : 'text-slate-700'}`}>
                  {item.label}
                </div>
                <div className="text-xs text-slate-500">{item.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {syncError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-semibold">Can't reach the database. Recent changes may not be saved yet.</div>
              <div className="text-red-700">Retrying automatically. Details: {syncError}</div>
            </div>
          </div>
        )}

        {legacyData && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 shrink-0 text-blue-600" />
              <div>
                <div className="font-semibold">This browser has data saved from before the shared database.</div>
                <div className="text-blue-800">
                  {legacyData.requests.length} requests, {legacyData.purchases.length} purchases, {legacyData.subscriptions.length} subscriptions, {legacyData.bankTransactions.length} bank transactions. Upload it so everyone can see it?
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={dismissLegacyData} className="px-3 py-2 rounded-lg border border-blue-200 bg-white text-blue-800 hover:bg-blue-100">Not now</button>
              <button onClick={importLegacyData} className="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">Upload</button>
            </div>
          </div>
        )}

        {/* View Routing */}
        {syncStatus === 'loading' ? (
          <div className="min-h-[500px] flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            {syncError ? 'Waiting for the database…' : 'Loading data…'}
          </div>
        ) : (
        <div className="min-h-[500px]">
          {activeRole === 'Employee' && <EmployeeView requests={requests} onAddRequest={addRequest} onCompletePurchase={completePurchase} />}
          {activeRole === 'Manager' && <ManagerView requests={requests} onUpdateStatus={updateRequestStatus} />}
          {activeRole === 'Finance' && <FinanceView requests={requests} onUpdateStatus={updateRequestStatus} onUpdateBankAmount={updateBankAmount} />}
          {activeRole === 'Registers' && <RegistersView
            purchases={purchases}
            subscriptions={subscriptions}
            adSpends={adSpends}
            onAddImportedSubscription={addImportedSubscription}
            onUpdateSubscription={updateSubscription}
          />}
          {activeRole === 'Dashboard' && <DashboardView 
            periods={periods}
            bankTransactions={bankTransactions}
            subscriptions={subscriptions}
            purchases={purchases}
            adSpends={adSpends}
            auditLogs={auditLogs}
            onClosePeriod={closePeriod}
            onToggleFeeBillable={toggleFeeBillable}
          />}
          {activeRole === 'Reconciliation' && <ReconciliationView 
            periods={periods} 
            bankTransactions={bankTransactions} 
            subscriptions={subscriptions}
            purchases={purchases}
            adSpends={adSpends}
            merchantAliases={merchantAliases}
            onAddPeriod={addReconciliationPeriod}
            onImport={importBankTransactions}
            onUpdateTransaction={updateBankTransaction}
            onConfirmMatch={confirmTransactionMatch}
            onAddAlias={addMerchantAlias}
          />}
        </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-[#0F172A] border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center text-sm text-slate-400">
          <p>© {new Date().getFullYear()} SpendControl. Demo environment.</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${syncError ? 'bg-red-500' : syncStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
            {syncError ? 'Offline' : syncStatus === 'saving' ? 'Saving…' : syncStatus === 'loading' ? 'Connecting…' : 'All changes saved'}
          </div>
        </div>
      </footer>
    </div>
  );
}


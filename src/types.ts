export type ExpenseType = 'Internal' | 'Client';
export type CardType = 'Internal Card' | 'Client Card';
export type PurchaseType = 'One-time Purchase' | 'Recurring Subscription' | 'Ad Spend';
export type SubscriptionFrequency = 'Monthly' | 'Quarterly' | 'Annual';
export type RequestStatus = 
  | 'Draft' 
  | 'Submitted' 
  | 'Pending Approval' 
  | 'Approved' 
  | 'OTP Requested' 
  | 'OTP Verified' 
  | 'Awaiting Purchase Completion' 
  | 'Purchase Completed' 
  | 'Pending Bank Amount Confirmation' 
  | 'Ready for Reconciliation' 
  | 'Reconciled' 
  | 'Rejected' 
  | 'Cancelled' 
  | 'Purchase Failed';

export type SubscriptionStatus = 'Active' | 'Paused' | 'Cancelled';
export type EvidenceType = 'CSV' | 'Invoice' | 'Screenshot' | 'None';
export type SubscriptionSource = 'Approved Request' | 'Imported' | 'Bank Statement';

export interface PurchaseCompletionDetails {
  actualVendorAmount: number;
  actualCurrency: string;
  actualPurchaseDate: string;
  actualBankInrAmount?: number;
  bankAmountSource?: 'Employee Entered' | 'Finance Entered' | 'Bank Statement Matched';
  bankVerificationStatus?: 'Pending' | 'Finance Confirmed' | 'Statement Confirmed';
  invoiceUploaded: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  orderReference?: string;
  billingFrequency?: string;
  notes?: string;
  purchaseStatus: 'Completed' | 'Failed' | 'Cancelled';
  failureReason?: string;
}

export type BankTransactionType = 'Merchant' | 'Fee' | 'Tax' | 'Refund' | 'Reversal' | 'Payment' | 'Adjustment' | 'Header';
export type MatchStatus = 'Matched' | 'Review' | 'Unidentified' | 'Associated' | 'Possible Multiple Matches';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type BankMatchType = 'Recurring Subscription' | 'One-time Purchase';

export interface PurchaseRequest {
  id: string; // Internal UUID
  purchaseId?: string; // Generated on approval e.g. PUR-2026-0001
  requesterName: string;
  pod: string;
  toolVendor: string;
  purpose?: string;
  expenseCategory: string;
  expenseType: ExpenseType;
  clientName?: string;
  amount: number;
  currency: string;
  cardRequired: CardType;
  purchaseType: PurchaseType;
  subscriptionFrequency?: SubscriptionFrequency;
  expectedDate: string;
  notes?: string;
  status: RequestStatus;
  managerName?: string;
  approvalTimestamp?: string;
  createdAt: string;
  completionDetails?: PurchaseCompletionDetails;
}

export interface PurchaseRecord {
  id: string;
  purchaseId: string;
  vendor: string;
  employee: string;
  pod: string;
  client?: string;
  billable: boolean;
  approvedAmount: number;
  actualAmount: number;
  currency: string;
  purchaseDate: string;
  invoiceDate?: string;
  card: CardType;
  evidenceUrl?: string;
  status?: 'Completed' | 'Pending Evidence';
  actualBankInrAmount?: number;
  bankVerificationStatus?: 'Pending' | 'Finance Confirmed' | 'Statement Confirmed';
  notes?: string;
  source?: 'Approved Request' | 'Bank Statement'; // 'Approved Request' when absent
}

// Details Finance enters for a card charge that was never raised in the tracker.
export interface ManualResolutionInput {
  vendor: string;
  pod: string;
  expenseType: ExpenseType;
  account?: string;
  purchasedBy: string;
  purchaseType: 'One-time Purchase' | 'Recurring Subscription';
  billingFrequency?: SubscriptionFrequency;
  notes?: string;
}

export interface SubscriptionRecord {
  id: string;
  subscriptionId: string; // SUB-2026-001
  originalPurchaseId?: string; // Absent for subscriptions onboarded directly via Registers
  vendor: string;
  tool: string;
  employeeOwner: string;
  pod: string;
  client?: string;
  billable: boolean;
  card: CardType;
  expectedRecurringAmount: number;
  currency: string;
  billingFrequency: SubscriptionFrequency;
  category?: string;
  startDate: string;
  expectedRenewalDate?: string;
  lastChargedDate?: string;
  nextExpectedCharge?: string;
  status: SubscriptionStatus;
  evidenceUrl?: string;
  actualBankInrAmount?: number;
  bankVerificationStatus?: 'Pending' | 'Finance Confirmed' | 'Statement Confirmed';
  notes?: string;
  source?: SubscriptionSource; // 'Approved Request' (default when absent) or 'Imported'
}

// Input for onboarding a subscription that was already running before Spendy existed.
export interface ImportedSubscriptionInput {
  vendor: string;
  category?: string;
  amount: number;
  currency: string;
  billingFrequency: SubscriptionFrequency;
  card: CardType;
  client?: string;
  billable: boolean;
  startDate?: string;
  lastChargedDate?: string;
  nextExpectedCharge: string;
  status: SubscriptionStatus;
  notes?: string;
}

export interface AdSpendRecord {
  id: string;
  originalPurchaseId: string;
  client: string;
  platform: string;
  adAccountName: string;
  adAccountId: string;
  pod: string;
  employeeOwner: string;
  billingPeriod: string;
  approvedMonthlyBudget: number;
  platformSpend: number;
  cardAmountCharged: number;
  currency: string;
  evidenceType: EvidenceType;
  evidenceUrl?: string;
  notes?: string;
  actualBankInrAmount?: number;
  bankVerificationStatus?: 'Pending' | 'Finance Confirmed' | 'Statement Confirmed';
}

export interface MerchantAlias {
  id: string;
  pattern: string;
  normalizedVendor: string;
  tool: string;
}

export interface BankTransaction {
  id: string;
  periodId: string;
  
  // Original Fields
  originalDate: string;
  serialNumber: string;
  originalDescription: string;
  rewardPoints: string;
  intlAmount: number;
  inrAmount: number;
  originalCurrency?: string;
  
  // System Fields
  type: BankTransactionType;
  normalizedVendor?: string;
  suggestedVendor?: string;
  
  // Matching
  suggestedPurchaseId?: string;
  suggestedSubscriptionId?: string;
  suggestedAdSpendId?: string;
  suggestedClient?: string;
  suggestedEmployee?: string;
  suggestedPod?: string;
  parentTransactionId?: string; // For fees/taxes
  
  confidence?: number; // 0-100
  confidenceReasons?: string[];
  confidenceLevel?: ConfidenceLevel;
  matchType?: BankMatchType;
  status: MatchStatus;
  assignedTo?: string; // Employee name if unidentified
  isFeeBillableToClient?: boolean; // For tax/fee toggling in Client Billing
}

export interface ReconciliationPeriod {
  id: string;
  name: string; // e.g. May 2026
  card: CardType;
  status: 'Open' | 'Closed'; // Changed to Closed per standard terminology
  createdAt: string;
  closedAt?: string;
  closedBy?: string;
  closureReason?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entityId?: string;
  previousValue?: string;
  newValue?: string;
  comment?: string;
}

export interface AppState {
  requests: PurchaseRequest[];
  purchases: PurchaseRecord[];
  subscriptions: SubscriptionRecord[];
  adSpends: AdSpendRecord[];
  periods: ReconciliationPeriod[];
  bankTransactions: BankTransaction[];
  merchantAliases: MerchantAlias[];
  auditLogs: AuditLog[];
  
  addRequest: (req: Omit<PurchaseRequest, 'id' | 'createdAt'>) => void;
  updateRequestStatus: (id: string, status: RequestStatus, managerName?: string) => void;
  processPurchase: (req: PurchaseRequest, details: Partial<PurchaseRecord>) => void;
  processSubscription: (req: PurchaseRequest, details: Partial<SubscriptionRecord>) => void;
  processAdSpend: (req: PurchaseRequest, details: Partial<AdSpendRecord>) => void;
  completePurchase: (id: string, details: PurchaseCompletionDetails) => void;
  updateBankAmount: (id: string, bankAmount: number) => void;
  
  addReconciliationPeriod: (name: string, card: CardType) => string;
  importBankTransactions: (periodId: string, transactions: Omit<BankTransaction, 'id' | 'periodId'>[]) => void;
  updateBankTransaction: (id: string, updates: Partial<BankTransaction>) => void;
  confirmTransactionMatch: (transactionId: string) => void;
  addImportedSubscription: (input: ImportedSubscriptionInput) => void;
  updateSubscription: (id: string, updates: Partial<SubscriptionRecord>) => void;
  addMerchantAlias: (alias: Omit<MerchantAlias, 'id'>) => void;
  closePeriod: (periodId: string, reason: string, user: string) => void;
  toggleFeeBillable: (txnId: string, billable: boolean) => void;
}

export interface LedgerPermissions {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export interface UserPermissions {
  requisitions: LedgerPermissions;
  acknowledgements: LedgerPermissions;
  returnChallans: LedgerPermissions;
  quotations: LedgerPermissions;
  purchaseBills: LedgerPermissions;
  moneyReceipts?: LedgerPermissions;
  monitorTargets?: LedgerPermissions;
  remoteCredentials?: LedgerPermissions;
  hotspotLedger?: LedgerPermissions;
  notebookLedger?: LedgerPermissions;
  notesLedger?: LedgerPermissions;
  damagedStockProposals?: LedgerPermissions;
  userManagement?: LedgerPermissions;
  presetSigners?: LedgerPermissions;
  servers?: LedgerPermissions;
  simManagement?: LedgerPermissions;
  ispInformation?: LedgerPermissions;
  ipPhoneLedger?: LedgerPermissions;
}

export interface IspConnection {
  id: string;
  // 1. আইএসপি ও গ্রাহক পরিচিতি / ISP & CLIENT INFORMATION
  userName: string;
  locationName: string;
  ispName: string;
  contactPersonName: string;
  contactNumber: string;
  isActive: boolean;

  // 2. পিপিপিও ইউজার ও পেমেন্ট তথ্য / PPPOE & PAYMENT AUTHENTICATION
  pppoeUser: string;
  pppoePassword: string;
  paymentId: string;

  // 3. স্ট্যাটিক আইপি সাবসেট / STATIC IP CONFIGURATION
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dns1: string;
  dns2: string;
  port: string;
  routerUser: string;
  routerPassword: string;

  // 4. প্যাকেজ এবং বিলিং / PACKAGE & BILLING
  packageName: string;
  bandwidth: string;
  billAmount: number | string;

  // Metadata
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  userId?: string;
  username?: string;
  displayName?: string;
  email: string;
  password?: string;
  role: 'admin' | 'viewer' | 'editor';
  status?: 'approved' | 'pending' | 'rejected';
  createdAt?: any;
  permissions?: UserPermissions;
}

export interface SignatureState {
  signed: boolean;
  name?: string;
  date?: string;
}

export interface RequisitionItem {
  sl: number;
  equipmentName: string;
  description: string;
  qty: number;
  condition: string;
  approximatePrice: number;
}

export interface Requisition {
  id: string;
  date: string;
  applicantName: string;
  applicantDepartment: string;
  employeeId: string;
  branchName: string;
  address: string;
  contact: string;
  types: string[];
  items: RequisitionItem[];
  totalAmount: number;
  reason: string;
  status: 'Draft' | 'Submitted' | 'Manager_Approved' | 'Recommended' | 'Fully_Approved' | 'Rejected';
  applicantSignature: SignatureState;
  managerSignature: SignatureState;
  recommenderSignature: SignatureState;
  authoritySignature: SignatureState;
  createdBy: string;
  createdByEmail: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface PresetSigner {
  id: string;
  name: string;
  role: 'Applicant' | 'Manager' | 'Recommender' | 'Authority';
  createdAt?: string;
}

export interface AcknowledgementItem {
  sl: number;
  productName: string;
  brand: string;
  productModel: string;
  qty: number;
  serialNumber: string;
  type: string;
  sourceOfProduct: string;
  distributionDate: string;
}

export interface Acknowledgement {
  id: string;
  date: string;
  userName: string;
  department: string;
  employeeId: string;
  branch: string;
  address: string;
  items: AcknowledgementItem[];
  recipientSignature: SignatureState;
  createdBy: string;
  createdByEmail: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ReturnChallanItem {
  sl: number;
  productName: string;
  brand: string;
  productModel: string;
  qty: number;
  serialNumber: string;
  type: string;
  reasonForReturn: string;
  returnDate: string;
}

export interface ReturnChallan {
  id: string;
  date: string;
  userName: string;
  department: string;
  employeeId: string;
  branch: string;
  address: string;
  items: ReturnChallanItem[];
  returnedBySignature: SignatureState;
  receivedBySignature: SignatureState;
  createdBy: string;
  createdByEmail: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface QuotationItem {
  sl: number;
  productName: string;
  description: string;
  price: number;
  qty: number;
  total: number;
}

export interface ProductQuotation {
  id: string;
  quotationNumber: string;
  date: string;
  validityDate: string;
  // Client Details
  clientCompany: string;
  clientAddress: string;
  clientEmail: string;
  clientContact: string;
  // Company Details
  companyName: string;
  companyAddress: string;
  companyContact: string;
  companyEmail: string;
  companyWebsite: string;
  //
  searchCustomer?: string; // Add searchCustomer property
  items: QuotationItem[];
  totalAmount: number;
  amountInWords: string;
  termsAndConditions: string[];
  //
  status: 'Pending' | 'Approved' | 'Rejected';
  createdBy: string;
  createdByEmail: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CompanyProfile {
  id: string;
  name: string;
  address: string;
  contact: string;
  email: string;
  website: string;
  updatedAt?: any;
}

export interface PurchaseBillEntry {
  sl: number;
  purchaseDate: string;
  vendorName: string;
  invBillNo: string;
  productName: string;
  serialNumber: string;
  qty: number;
  price: number;
  amount: number;
  branchCode: string;
  applicantName: string;
  distributionDate: string;
  remarks: string;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  date: string;
  companyName: string;
  payerName: string;
  subject: string;
  amount: number;
  amountInWords: string;
  receivedBy: string;
  authorizedBy: string;
  paymentMethod: 'Cash' | 'Mobile Banking' | 'Bank Transfer' | 'Check' | 'Other';
  notes?: string;
  status: 'Paid' | 'Due' | 'Pending' | 'Cancelled';
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MoneyReceipt {
  id: string;
  no: string;
  date: string;
  receivedFrom: string;
  amount: number;
  amountInWords: string;
  for: string;
  branch: string;
  acct: string;
  paid: number;
  due: number;
  receivedBy: string;
  authorizedSignature: SignatureState;
  createdBy: string;
  createdByEmail: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface PingHistoryItem {
  timestamp: string;
  latency: number;
  success: boolean;
}

export interface MonitorTarget {
  id: string;
  name: string;
  type: 'ip' | 'web';
  address: string;
  active: boolean;
  latency: number;
  history: number[];
  lossCount: number;
  totalPings: number;
  error?: string;
}

export interface UserTargets {
  targets: MonitorTarget[];
}

export interface PurchaseBill {
  id: string;
  date: string;
  entries: PurchaseBillEntry[];
  totalAmount: number;
  advancePurchase: number;
  grandTotal: number;
  status?: 'draft' | 'confirmed';
  moneyReceiptId?: string;
  createdBy: string;
  createdByEmail: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DamagedStockItem {
  id: string;
  sl: number;
  productName: string;
  category?: string;
  quantity: number;
  unit: string;
  originalUnitCost: number;
  originalTotalValue: number;
  usageTime?: string;
  proposedUnitSalePrice: number;
  proposedTotalSaleValue: number;
  damageCondition: string;
}

export interface DamagedStockProposal {
  id: string;
  proposalNumber: string;
  date: string;
  subject: string;
  companyName?: string;
  companyAddress?: string;
  submittedBy?: string;
  submittedByDesignation?: string;
  approvedBy?: string;
  approvedByDesignation?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Disposed' | 'Rejected';
  remarks?: string;
  items: DamagedStockItem[];
  totalOriginalValue: number;
  totalProposedSaleValue: number;
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Ledger {
  id: string;
  userId: string;
  name: string;
  createdAt?: any;
}

export interface Credential {
  id: string;
  userId: string;
  ledgerId: string;
  websiteName: string;
  userNameOrMobile: string;
  email?: string;
  password: string;
  remarks?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Server {
  id: string;
  name: string;
  address: string;
  monitoringType: 'web' | 'server' | 'ping';
  port?: number;
  packetSize?: number;
  status: 'online' | 'offline';
  lastChecked?: string;
  avgResponseTime?: number;
  lastLatency?: number;
  ttl?: number;
  packetLoss?: number;
  method?: string;
  recentLatencies?: number[];
  createdAt?: string;
}

export interface PingRecord {
  id?: string;
  serverId: string;
  timestamp: string;
  status: 'online' | 'offline';
  responseTime: number;
}

export interface SimRecord {
  id: string;
  sl: number;
  branchCode: string;
  userName: string;
  identyNumber: string;
  designation: string;
  department: string;
  distributionDate: string;
  simOwner: string;
  operatorName: string;
  simGroup: string;
  simType: 'Postpaid' | 'Prepaid';
  simNumber: string;
  creditLimit: number;
  monthlyApproved: number;
  paymentBill: number;
  advancePayment: number;
  remarks: string;
  status: 'Active' | 'Inactive';
  updatedAt?: string;
}

export type SortField = keyof Omit<SimRecord, 'id' | 'updatedAt'>;

export interface SortConfig {
  field: SortField;
  order: 'asc' | 'desc';
}

export interface FilterOptions {
  search: string;
  branchCode: string;
  operatorName: string;
  simType: string;
  department: string;
  simOwner?: string;
  simGroup: string;
  status?: string;
}

export interface ColumnDefinition {
  field: SortField;
  label: string;
  bnLabel?: string;
  minWidth?: string;
  align?: 'left' | 'right' | 'center';
}

export interface DownloadedReportRecord {
  id: string;
  title: string;
  monthYear: string;
  generatedAt: string;
  totalRecords: number;
  activeCount: number;
  inactiveCount: number;
  totalBill: number;
  totalApproved: number;
  recordsSnapshot?: SimRecord[];
  selectedColumns?: SortField[];
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  { field: 'sl', label: 'SL', bnLabel: 'ক্রমিক', minWidth: 'w-14', align: 'center' },
  { field: 'branchCode', label: 'Branch Code', bnLabel: 'শাখা কোড', minWidth: 'w-24', align: 'center' },
  { field: 'userName', label: 'User Name', bnLabel: 'ব্যবহারকারীর নাম', minWidth: 'w-48', align: 'left' },
  { field: 'identyNumber', label: 'Identy Number', bnLabel: 'আইডি নম্বর', minWidth: 'w-32', align: 'left' },
  { field: 'designation', label: 'Designation', bnLabel: 'পদবী', minWidth: 'w-40', align: 'left' },
  { field: 'department', label: 'Department', bnLabel: 'বিভাগ', minWidth: 'w-44', align: 'left' },
  { field: 'distributionDate', label: 'Distribution date', bnLabel: 'বিতরণের তারিখ', minWidth: 'w-32', align: 'center' },
  { field: 'simOwner', label: 'Sim Owner', bnLabel: 'সিম মালিক', minWidth: 'w-28', align: 'center' },
  { field: 'operatorName', label: 'Operator Name', bnLabel: 'অপারেটর', minWidth: 'w-24', align: 'center' },
  { field: 'simGroup', label: 'SIM Group', bnLabel: 'গ্রুপ', minWidth: 'w-28', align: 'center' },
  { field: 'simType', label: 'Sim Type', bnLabel: 'সিমের ধরন', minWidth: 'w-24', align: 'center' },
  { field: 'simNumber', label: 'Sim Number', bnLabel: 'সিম নম্বর', minWidth: 'w-32', align: 'left' },
  { field: 'creditLimit', label: 'Credit Limit', bnLabel: 'ক্রেডিট লিমিট', minWidth: 'w-28', align: 'right' },
  { field: 'monthlyApproved', label: 'Monthly Approved', bnLabel: 'অনুমোদিত বরাদ্দ', minWidth: 'w-32', align: 'right' },
  { field: 'paymentBill', label: 'Payment Bill', bnLabel: 'চলতি বিল', minWidth: 'w-28', align: 'right' },
  { field: 'advancePayment', label: 'Advance Payment', bnLabel: 'অগ্রিম পেমেন্ট', minWidth: 'w-28', align: 'right' },
  { field: 'remarks', label: 'Remarks', bnLabel: 'মন্তব্য', minWidth: 'w-40', align: 'left' },
  { field: 'status', label: 'Status', bnLabel: 'স্ট্যাটাস', minWidth: 'w-28', align: 'center' },
];

export interface NotesLedgerEntry {
  id: string;
  category: string;
  subject: string;
  notebook: string;
  createdBy: string;
  createdByEmail: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface IpPhoneRecord {
  id: string;
  sl?: number;
  branchCode: string;
  locationName?: string;
  userName: string;
  identyNumber?: string;
  designation: string;
  department: string;
  extensionNumber: string;
  ipAddress: string;
  macAddress: string;
  brandModel: string;
  serialNumber?: string;
  sipUser: string;
  sipPassword?: string;
  pbxServer?: string;
  subnetMask?: string;
  gateway?: string;
  port?: string;
  status: 'Active' | 'Inactive' | 'Damage' | 'Spare';
  distributionDate?: string;
  remarks?: string;
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

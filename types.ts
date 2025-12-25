// types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  organization: string;
  lastLogin: string;
  is2FAEnabled: boolean;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  previousUnitPrice?: number;
  priceChange?: number;
  percentChange?: number;
}

export interface Invoice {
  id: string;
  docType: 'invoice' | 'credit_note' | 'debit_note' | 'quote';
  supplierName: string;
  date: string;
  dueDate: string;
  invoiceNumber: string;
  bankAccount?: string;
  creditTerm?: string;
  totalAmount: number;
  gstAmount?: number;
  abn?: string;
  tel?: string;
  email?: string;
  address?: string;
  items: InvoiceItem[];
  status: 'matched' | 'price_increase' | 'price_decrease' | 'mixed';
  isPaid: boolean;
  isHold: boolean;
  fileName?: string;
}

// For the AI response from geminiService
export interface GeminiResponse {
  docType: 'invoice' | 'credit_note' | 'debit_note' | 'quote';
  supplierName: string;
  date: string;
  dueDate: string;
  invoiceNumber: string;
  bankAccount?: string;
  creditTerm?: string;
  totalAmount: number;
  gstAmount?: number;
  abn?: string;
  tel?: string;
  email?: string;
  address?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

// For price baseline tracking
export interface PriceBaseline {
  [supplierName: string]: {
    [itemName: string]: number;
  };
}

// Dashboard statistics
export interface DashboardStats {
  totalPayable: number;
  variances: number;
  totalCount: number;
}

// Toast notification
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// Modal props
export interface InvoiceDetailModalProps {
  invoice: Invoice;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdateBaseline: (supplier: string, item: string, newPrice: number) => void;
}

// Upload view props
export interface UploadViewProps {
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  progress: string;
}

// Stat card props
export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size: number }>;
  color: 'blue' | 'amber' | 'slate';
}

// Audit badge props
export interface AuditBadgeProps {
  status: Invoice['status'];
}

// Navigation item props
export interface NavItemProps {
  id: 'dashboard' | 'upload' | 'history' | 'suppliers' | 'items' | 'gst' | 'profile';
  icon: React.ComponentType<{ size: number }>;
  label: string;
  alertCount?: number;
}

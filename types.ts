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

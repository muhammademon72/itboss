import * as XLSX from 'xlsx';
import { SimRecord } from '../types';

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';
  return Number(amount).toLocaleString('en-IN');
}

export function formatSimNumber(simNumber: string | null | undefined): string {
  if (!simNumber) return '—';
  const clean = String(simNumber).trim();
  // Formats Bangladeshi 11 digit numbers nicely like 01714-141000
  if (/^01[3-9]\d{8}$/.test(clean)) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

export function normalizeSimNumber(num: string | null | undefined): string {
  if (!num) return '';
  let cleaned = String(num).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('88') && cleaned.length > 11) {
    cleaned = '0' + cleaned.slice(2);
  } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

export function exportRecordsToCSV(records: SimRecord[], filename?: string): void {
  const data = records.map((r) => ({
    'SL': r.sl,
    'Branch Code': r.branchCode,
    'User Name': r.userName,
    'Identy Number': r.identyNumber,
    'Designation': r.designation,
    'Department': r.department,
    'Distribution date': r.distributionDate,
    'Sim Owner': r.simOwner,
    'Operator Name': r.operatorName,
    'SIM Group': r.simGroup,
    'Sim Type': r.simType,
    'Sim Number': r.simNumber,
    'Credit Limit': r.creditLimit,
    'Monthly Approved': r.monthlyApproved,
    'Payment Bill': r.paymentBill,
    'Advance Payment': r.advancePayment,
    'Remarks': r.remarks,
    'Status': r.status || 'Active',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SIM_Ledger');
  
  const finalFileName = filename || `SIM_Management_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
  XLSX.writeFile(workbook, finalFileName);
}

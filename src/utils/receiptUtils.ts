import { Receipt } from '../types';

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '৳ 0';
  return `৳ ${amount.toLocaleString('en-IN')}`;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

export function numberToWords(amount: number): string {
  if (!amount || amount === 0) return 'Zero only.';
  let n = Math.floor(Math.abs(amount));

  // Indian/South Asian numbering: Crores, Lakhs, Thousands, Hundreds
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remaining = n;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(`${convertBelowThousand(crore)} crore`);
  }
  if (lakh > 0) {
    parts.push(`${convertBelowThousand(lakh)} lakh`);
  }
  if (thousand > 0) {
    parts.push(`${convertBelowThousand(thousand)} thousand`);
  }
  if (remaining > 0) {
    parts.push(convertBelowThousand(remaining));
  }

  const result = parts.join(' ').trim();
  if (!result) return 'Zero only.';
  
  // Capitalize first letter and append "only."
  const capitalized = result.charAt(0).toUpperCase() + result.slice(1);
  return `${capitalized} only.`;
}

export function getNextReceiptNo(existingReceipts: Receipt[] = []): string {
  const currentYear = new Date().getFullYear();
  const prefix = `GMR-${currentYear}-`;

  let maxSeq = 100;

  if (Array.isArray(existingReceipts)) {
    existingReceipts.forEach((r) => {
      if (!r?.receiptNo) return;
      const trimmed = String(r.receiptNo).trim();
      // Match GMR-2026-101 or GMR-101
      const match = trimmed.match(/^GMR-(?:\d{4}-)?(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else {
        const anyNumberMatch = trimmed.match(/(\d+)$/);
        if (anyNumberMatch && anyNumberMatch[1]) {
          const num = parseInt(anyNumberMatch[1], 10);
          if (!isNaN(num) && num > maxSeq && num < 100000) {
            maxSeq = num;
          }
        }
      }
    });
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${nextSeq}`;
}

export const INITIAL_RECEIPTS: Receipt[] = [
  {
    id: 'rcpt-init-01',
    receiptNo: 'GMR-2026-101',
    date: '2026-09-15',
    companyName: 'General Money Receipt',
    payerName: 'Corporate IT Dept',
    subject: 'Monthly Mobile Recharge Balance Top-up',
    amount: 5000,
    amountInWords: 'Five thousand only.',
    receivedBy: 'Md Emon Hossain',
    authorizedBy: 'Md Shafiqur Rahman',
    paymentMethod: 'Cash',
    notes: '',
    status: 'Paid'
  },
  {
    id: 'rcpt-init-02',
    receiptNo: 'GMR-2026-102',
    date: '2026-09-12',
    companyName: 'General Money Receipt',
    payerName: 'Logistics Division',
    subject: 'Emergency Network SIM Card Recharges',
    amount: 3200,
    amountInWords: 'Three thousand two hundred only.',
    receivedBy: 'Md Emon Hossain',
    authorizedBy: 'Md Shafiqur Rahman',
    paymentMethod: 'Mobile Banking',
    notes: '',
    status: 'Paid'
  },
  {
    id: 'rcpt-init-03',
    receiptNo: 'GMR-2026-103',
    date: '2026-09-08',
    companyName: 'General Money Receipt',
    payerName: 'Security Ops Control',
    subject: 'Dedicated Hotline Talktime & Data Pack',
    amount: 1850,
    amountInWords: 'One thousand eight hundred fifty only.',
    receivedBy: 'Md Emon Hossain',
    authorizedBy: 'Md Shafiqur Rahman',
    paymentMethod: 'Cash',
    notes: '',
    status: 'Paid'
  }
];

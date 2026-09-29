import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SimRecord, SortField, ALL_COLUMNS } from '../types';
import { formatCurrency, formatSimNumber } from './simFormatters';

export interface GenerateSimPdfOptions {
  title: string;
  subtitle?: string;
  selectedColumns: SortField[];
  orientation?: 'auto' | 'portrait' | 'landscape';
  includeSummary?: boolean;
  filterSummaryText?: string;
  records: SimRecord[];
}

const CANONICAL_COLUMNS_ORDER: SortField[] = [
  'sl',
  'branchCode',
  'userName',
  'identyNumber',
  'designation',
  'department',
  'distributionDate',
  'simOwner',
  'operatorName',
  'simGroup',
  'simType',
  'simNumber',
  'creditLimit',
  'monthlyApproved',
  'paymentBill',
  'advancePayment',
  'remarks',
  'status',
];

export function generateSimReportPdf({
  title,
  subtitle = 'ASRG Corporate SIM Management System',
  selectedColumns,
  orientation = 'auto',
  includeSummary = false,
  filterSummaryText,
  records,
}: GenerateSimPdfOptions): void {
  // Ensure 'sl' is ALWAYS placed first on the left if included, followed by canonical order
  const orderedColumns = [...selectedColumns].sort((a, b) => {
    if (a === 'sl') return -1;
    if (b === 'sl') return 1;
    const indexA = CANONICAL_COLUMNS_ORDER.indexOf(a);
    const indexB = CANONICAL_COLUMNS_ORDER.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  // Determine page orientation
  const pageOrientation =
    orientation === 'auto'
      ? orderedColumns.length > 7
        ? 'landscape'
        : 'portrait'
      : orientation;

  const doc = new jsPDF({
    orientation: pageOrientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Active records metrics
  const activeRecords = records.filter((r) => (r.status || 'Active') === 'Active');
  const inactiveCount = records.length - activeRecords.length;
  const totalApproved = activeRecords.reduce((sum, r) => sum + (r.monthlyApproved || 0), 0);
  const totalBill = activeRecords.reduce((sum, r) => sum + (r.paymentBill || 0), 0);
  const netBalance = totalApproved - totalBill;

  // Header Box / Branding
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 12);

  // Subtitle
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  const sub = `${subtitle} • Generated on: ${new Date().toLocaleString()}`;
  doc.text(sub, margin, 18);

  if (filterSummaryText) {
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Scope: ${filterSummaryText}`, margin, 23);
  }

  // Right-side badge
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageWidth - margin - 48, 6, 48, 16, 2, 2, 'F');
  doc.setTextColor(56, 189, 248); // sky-400
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CORPORATE SIM LEDGER', pageWidth - margin - 44, 11);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`${activeRecords.length} Active SIM Lines`, pageWidth - margin - 44, 18);

  let currentY = 33;

  // Optional Financial Summary Badges
  if (includeSummary) {
    const cardWidth = (pageWidth - margin * 2 - 9) / 4;
    const cardHeight = 13;

    // 1. Total Active Lines
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(187, 247, 208); // emerald-200
    doc.roundedRect(margin, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('ACTIVE SIM LINES', margin + 3, currentY + 4.5);
    doc.setFontSize(9.5);
    doc.text(`${activeRecords.length} lines`, margin + 3, currentY + 10.5);

    // 2. Approved Budget
    const c2X = margin + cardWidth + 3;
    doc.setFillColor(239, 246, 255); // blue-50
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(c2X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 64, 175);
    doc.text('MONTHLY APPROVED', c2X + 3, currentY + 4.5);
    doc.setFontSize(9.5);
    doc.text(`BDT ${formatCurrency(totalApproved)}`, c2X + 3, currentY + 10.5);

    // 3. Payment Bill
    const c3X = c2X + cardWidth + 3;
    doc.setFillColor(254, 242, 242); // rose-50
    doc.setDrawColor(254, 205, 205);
    doc.roundedRect(c3X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(153, 27, 27);
    doc.text('CURRENT BILL (ACTIVE)', c3X + 3, currentY + 4.5);
    doc.setFontSize(9.5);
    doc.text(`BDT ${formatCurrency(totalBill)}`, c3X + 3, currentY + 10.5);

    // 4. Net Balance
    const c4X = c3X + cardWidth + 3;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(c4X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('NET BUDGET SURPLUS', c4X + 3, currentY + 4.5);
    doc.setFontSize(9.5);
    doc.setTextColor(netBalance >= 0 ? 22 : 185, netBalance >= 0 ? 101 : 28, netBalance >= 0 ? 52 : 28);
    doc.text(`BDT ${formatCurrency(Math.abs(netBalance))}`, c4X + 3, currentY + 10.5);

    currentY += cardHeight + 4;
  }

  // Active column headers mapping (SL strictly on the left)
  const colDefs = orderedColumns.map((colField) => {
    return ALL_COLUMNS.find((c) => c.field === colField) || {
      field: colField,
      label: String(colField),
      align: 'left',
    };
  });

  const headers = [colDefs.map((c) => c.label)];

  const rows = activeRecords.map((rec, idx) => {
    return colDefs.map((c) => {
      switch (c.field) {
        case 'sl':
          return String(idx + 1);
        case 'simNumber':
          return formatSimNumber(rec.simNumber);
        case 'creditLimit':
          return formatCurrency(rec.creditLimit);
        case 'monthlyApproved':
          return formatCurrency(rec.monthlyApproved);
        case 'paymentBill':
          return formatCurrency(rec.paymentBill);
        case 'advancePayment':
          return rec.advancePayment ? formatCurrency(rec.advancePayment) : '0';
        case 'status':
          return rec.status || 'Active';
        default:
          return String(rec[c.field] ?? '');
      }
    });
  });

  const totalPaymentBill = activeRecords.reduce((sum, r) => sum + (Number(r.paymentBill) || 0), 0);
  const totalAdvancePayment = activeRecords.reduce((sum, r) => sum + (Number(r.advancePayment) || 0), 0);
  const totalMonthlyApproved = activeRecords.reduce((sum, r) => sum + (Number(r.monthlyApproved) || 0), 0);
  const totalCreditLimit = activeRecords.reduce((sum, r) => sum + (Number(r.creditLimit) || 0), 0);

  // Table summary footer row (placed right under Payment Bill and numeric columns)
  const footRow = colDefs.map((col, idx) => {
    if (col.field === 'paymentBill') {
      return `BDT ${formatCurrency(totalPaymentBill)}`;
    }
    if (col.field === 'advancePayment') {
      return formatCurrency(totalAdvancePayment);
    }
    if (col.field === 'monthlyApproved') {
      return formatCurrency(totalMonthlyApproved);
    }
    if (col.field === 'creditLimit') {
      return formatCurrency(totalCreditLimit);
    }
    // Column immediately to the left of paymentBill
    const nextCol = colDefs[idx + 1];
    if (nextCol && nextCol.field === 'paymentBill') {
      return 'Total Bill:';
    }
    if (idx === 0) {
      return `Total: ${activeRecords.length}`;
    }
    return '';
  });

  // Calculate alignment and styles for columns
  const columnStyles: { [key: number]: any } = {};
  colDefs.forEach((col, i) => {
    columnStyles[i] = {
      halign:
        col.field === 'sl'
          ? 'center'
          : col.align ||
            (['creditLimit', 'monthlyApproved', 'paymentBill', 'advancePayment'].includes(col.field)
              ? 'right'
              : 'left'),
      ...(col.field === 'sl' ? { cellWidth: 14 } : {}),
    };
  });

  // AutoTable Render
  autoTable(doc, {
    startY: currentY,
    head: headers,
    body: rows,
    foot: [footRow],
    showFoot: 'lastPage',
    margin: { left: margin, right: margin, bottom: 16 },
    theme: 'grid',
    styles: {
      fontSize: orderedColumns.length > 10 ? 6.5 : 8,
      cellPadding: orderedColumns.length > 10 ? 1.5 : 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: selectedColumns.length > 10 ? 7 : 8.5,
      halign: 'center',
    },
    footStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [15, 23, 42], // slate-900
      fontStyle: 'bold',
      fontSize: orderedColumns.length > 10 ? 6.5 : 8,
      lineWidth: 0.3,
      lineColor: [203, 213, 225],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: columnStyles,
    didDrawPage: (data) => {
      // Footer page number
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      const pageStr = `Page ${data.pageNumber} of ${(doc as any).internal.getNumberOfPages()}`;
      doc.text(pageStr, pageWidth / 2, pageHeight - 6, { align: 'center' });
      doc.text('ASRG SIM Management & Corporate Billing Ledger', margin, pageHeight - 6);
    },
  });

  const cleanFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(cleanFilename);
}

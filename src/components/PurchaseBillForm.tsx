import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { saveLocalCacheItem } from '../utils/localCache';
import { PurchaseBill, PurchaseBillEntry, CompanyProfile } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Plus, Trash2, FileText, ArrowLeft, Download, CheckCircle, FileSpreadsheet, Upload, Copy, Calendar, Lock, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

export const formatDisplayDate = (dateVal: string | undefined): string => {
  if (!dateVal) return '';
  const trimmed = String(dateVal).trim();
  if (!trimmed) return '';

  // 1. If it's in YYYY-MM-DD or YYYY/MM/DD format (e.g. "2026-08-02")
  const yyyymmddRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  const matchYmd = trimmed.match(yyyymmddRegex);
  if (matchYmd) {
    const [_, y, m, d] = matchYmd;
    const formattedDay = d.padStart(2, '0');
    const formattedMonth = m.padStart(2, '0');
    return `${formattedDay}/${formattedMonth}/${y}`;
  }

  // 2. If it's in DD/MM/YYYY or DD-MM-YYYY format
  const ddMmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const matchDmy = trimmed.match(ddMmyyyyRegex);
  if (matchDmy) {
    const [_, d, m, y] = matchDmy;
    const formattedDay = d.padStart(2, '0');
    const formattedMonth = m.padStart(2, '0');
    return `${formattedDay}/${formattedMonth}/${y}`;
  }

  // 3. Try parsing with native Date
  try {
    const dObj = new Date(trimmed);
    if (!isNaN(dObj.getTime())) {
      const day = String(dObj.getDate()).padStart(2, '0');
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const year = dObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // ignore
  }

  return trimmed;
};

const DateInput = ({
  value,
  onChange,
  disabled,
  className,
  placeholder = "DD/MM/YYYY"
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) => {
  // Convert current DD/MM/YYYY or YYYY-MM-DD value to YYYY-MM-DD for native HTML5 <input type="date">
  const getIsoDate = (val: string) => {
    if (!val) return '';
    const trimmed = String(val).trim();
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const [_, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
      const [_, y, m, d] = ymdMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  };

  const isoValue = getIsoDate(value);
  const displayValue = formatDisplayDate(value);

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      />
      {!disabled && (
        <div className="relative shrink-0 pr-1.5 flex items-center justify-center">
          <input
            type="date"
            value={isoValue}
            onChange={(e) => {
              if (e.target.value) {
                onChange(formatDisplayDate(e.target.value));
              }
            }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
          <Calendar className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600 cursor-pointer pointer-events-none" />
        </div>
      )}
    </div>
  );
};


export default function PurchaseBillForm({ 
  onBack, 
  currentUserUid, 
  currentUserEmail,
  initialBill,
  readOnly,
  isCopy = false,
  isAdmin = false
}: { 
  onBack: () => void; 
  currentUserUid: string; 
  currentUserEmail: string;
  initialBill?: PurchaseBill;
  readOnly?: boolean;
  isCopy?: boolean;
  isAdmin?: boolean;
}) {
  const isConfirmedBill = initialBill?.status === 'confirmed' && !isCopy;
  const effectiveReadOnly = readOnly || (isConfirmedBill && !isAdmin);

  const [entries, setEntries] = useState<PurchaseBillEntry[]>(initialBill?.entries || []);
  const [date, setDate] = useState(() => formatDisplayDate(initialBill?.date || new Date().toISOString().split('T')[0]));
  const [advancePurchase, setAdvancePurchase] = useState(initialBill?.advancePurchase || 0);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Sync state if initialBill updates
  useEffect(() => {
    if (initialBill) {
      setEntries(initialBill.entries || []);
      setDate(formatDisplayDate(initialBill.date || ''));
      setAdvancePurchase(initialBill.advancePurchase || 0);
    }
  }, [initialBill]);

  // Fetch Company Profile Settings
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'settings', 'companyProfile');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCompanyProfile(docSnap.data() as CompanyProfile);
        }
      } catch (err) {
        console.error("Error fetching company profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  // Pre-populate with one empty entry if empty and not in readOnly mode
  useEffect(() => {
    if (entries.length === 0 && !initialBill) {
      addEntry();
    }
  }, []);

  const addEntry = () => {
    setEntries([...entries, { 
      sl: entries.length + 1, 
      purchaseDate: formatDisplayDate(new Date().toISOString().split('T')[0]), 
      vendorName: '', 
      invBillNo: '', 
      productName: '', 
      serialNumber: '', 
      qty: 1, 
      price: 0, 
      amount: 0, 
      branchCode: '', 
      applicantName: '', 
      distributionDate: '', 
      remarks: '' 
    }]);
  };

  const updateEntry = (index: number, field: keyof PurchaseBillEntry, value: any) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    if (field === 'qty' || field === 'price') {
      newEntries[index].amount = Number(newEntries[index].qty || 0) * Number(newEntries[index].price || 0);
    }
    setEntries(newEntries);
  };

  const deleteEntry = (index: number) => {
    if (entries.length <= 1) {
      alert("At least one entry is required.");
      return;
    }
    const filtered = entries.filter((_, i) => i !== index);
    const reordered = filtered.map((e, i) => ({ ...e, sl: i + 1 }));
    setEntries(reordered);
  };

  const totalAmount = entries.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const grandTotal = totalAmount - advancePurchase;

  const handleSaveWithStatus = async (statusChoice: 'draft' | 'confirmed') => {
    const isNewDoc = !initialBill || isCopy;
    const docId = isNewDoc ? `bill_${Date.now()}` : initialBill.id;
    const payload: PurchaseBill = {
      id: docId,
      date,
      entries,
      totalAmount,
      advancePurchase,
      grandTotal,
      status: statusChoice,
      createdBy: isNewDoc ? currentUserUid : (initialBill.createdBy || currentUserUid),
      createdByEmail: isNewDoc ? currentUserEmail : (initialBill.createdByEmail || currentUserEmail),
      createdAt: isNewDoc ? new Date().toISOString() : (initialBill.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString()
    } as PurchaseBill;

    try {
      await setDoc(doc(db, 'purchaseBills', docId), payload);
      saveLocalCacheItem('purchaseBills', payload);
      const msg = statusChoice === 'confirmed' 
        ? 'Purchase Bill CONFIRMED and saved! (Locked from editing)' 
        : 'Purchase Bill saved as DRAFT!';
      alert(isCopy ? `Copied as new purchase bill (${statusChoice.toUpperCase()})!` : msg);
    } catch (err) {
      console.error("Error saving bill:", err);
      saveLocalCacheItem('purchaseBills', payload);
      handleFirestoreError(err, OperationType.WRITE, 'purchaseBills/' + docId);
      alert('Bill saved locally in offline storage!');
    }
    setIsSaveModalOpen(false);
    onBack();
  };

  const exportToExcel = () => {
    try {
      const dataToExport = entries.map(entry => ({
        "SL": entry.sl,
        "Purchase Date": formatDisplayDate(entry.purchaseDate),
        "Vendor Name": entry.vendorName,
        "Inv/Bill No": entry.invBillNo,
        "Product Name": entry.productName,
        "Serial Number": entry.serialNumber,
        "Qty": entry.qty,
        "Price": entry.price,
        "Amount": entry.amount,
        "Branch Code": entry.branchCode,
        "Applicant Name": entry.applicantName,
        "Dist. Date": formatDisplayDate(entry.distributionDate),
        "Remarks": entry.remarks
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Bill Entries");
      XLSX.writeFile(workbook, `purchase_bill_entries_${date}.xlsx`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Failed to export to Excel.");
    }
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        if (json.length === 0) {
          alert("The Excel file seems to be empty.");
          return;
        }

        const importedEntries: PurchaseBillEntry[] = json.map((row, index) => {
          const getValue = (keys: string[]) => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(
                rk => rk.toLowerCase().trim() === k.toLowerCase().trim()
              );
              if (matchedKey) return row[matchedKey];
            }
            return '';
          };

          const qty = Number(getValue(['Qty', 'Quantity', 'QTY'])) || 1;
          const price = Number(getValue(['Price', 'Rate', 'PRICE', 'Unit Price'])) || 0;

          return {
            sl: index + 1,
            purchaseDate: formatDisplayDate(String(getValue(['Purchase Date', 'Date', 'PurchaseDate']) || new Date().toISOString().split('T')[0])),
            vendorName: String(getValue(['Vendor Name', 'Vendor', 'VendorName']) || ''),
            invBillNo: String(getValue(['Inv/Bill No', 'Inv Bill No', 'Invoice No', 'Bill No', 'InvBillNo', 'Invoice']) || ''),
            productName: String(getValue(['Product Name', 'Product', 'ProductName']) || ''),
            serialNumber: String(getValue(['Serial Number', 'Serial No', 'Serial', 'SerialNumber', 'SerialNo']) || ''),
            qty,
            price,
            amount: qty * price,
            branchCode: String(getValue(['Branch Code', 'Branch', 'BranchCode']) || ''),
            applicantName: String(getValue(['Applicant Name', 'Applicant', 'ApplicantName']) || ''),
            distributionDate: formatDisplayDate(String(getValue(['Dist. Date', 'Distribution Date', 'Dist Date', 'DistributionDate', 'Dist.Date']) || '')),
            remarks: String(getValue(['Remarks', 'Remark', 'Note', 'Notes']) || '')
          };
        });

        setEntries(importedEntries);
        alert(`Successfully imported ${importedEntries.length} entries from Excel!`);
      } catch (err) {
        console.error("Error parsing excel:", err);
        alert("Error parsing excel file. Please make sure columns match standard layout.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape to fit all columns nicely
    
    const companyName = companyProfile?.name || 'ASR GROUP';
    const companyAddress = companyProfile?.address || 'INFORMATION & TECHNOLOGY';
    const companyContact = companyProfile?.contact || '';
    const companyWebsite = companyProfile?.website || '';

    // Header Design
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // deep slate
    doc.text(companyName.toUpperCase(), 148, 12, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // cool slate
    doc.text(companyAddress, 148, 17, { align: 'center' });
    if (companyContact || companyWebsite) {
      doc.text(`${companyContact} | ${companyWebsite}`, 148, 21, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(79, 70, 229); // indigo
    doc.text('PURCHASE BILL SUMMARY', 148, 26, { align: 'center' });

    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`DATE: ${formatDisplayDate(date)}`, 14, 31);

    // Table Columns & Body
    const headers = [
      ['SL', 'Purchase Date', 'Vendor Name', 'Inv / Bill No', 'Product Name', 'Serial Number', 'QTY', 'Price', 'Amount', 'Branch Code', 'Applicant Name', 'Distribution Date', 'Remarks']
    ];

    const body = entries.map(e => [
      e.sl,
      formatDisplayDate(e.purchaseDate),
      e.vendorName,
      e.invBillNo,
      e.productName,
      e.serialNumber,
      e.qty,
      e.price.toLocaleString(),
      e.amount.toLocaleString(),
      e.branchCode,
      e.applicantName,
      formatDisplayDate(e.distributionDate),
      e.remarks
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 34,
      margin: { bottom: 18 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 20 },
        2: { cellWidth: 40 },
        3: { cellWidth: 22 },
        4: { cellWidth: 25 },
        5: { cellWidth: 22 },
        6: { halign: 'center', cellWidth: 10 },
        7: { halign: 'right', cellWidth: 15 },
        8: { halign: 'right', cellWidth: 20 },
        9: { cellWidth: 15 },
        10: { cellWidth: 30 },
        11: { cellWidth: 20 },
        12: { cellWidth: 20 },
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    const pageHeight = doc.internal.pageSize.height;

    // Check if both totals and signatures fit on the current page
    // Grand Total is at finalY + 12
    // Signature line is at finalY + 12 + 25.4 = finalY + 37.4
    // Signature text is at finalY + 37.4 + 5 = finalY + 42.4
    // Make sure it fits before the page footer boundary
    if (finalY + 42.4 > pageHeight - 15) {
      doc.addPage();
      finalY = 40; // reset starting position for Totals Box on new page
    }

    // Totals Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    const rightX = 283;
    doc.text(`Total Amount:  ${totalAmount.toLocaleString()} TK`, rightX, finalY, { align: 'right' });
    doc.text(`Advance Purchase:  ${advancePurchase.toLocaleString()} TK`, rightX, finalY + 6, { align: 'right' });
    
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229);
    doc.text(`Grand Total:  ${grandTotal.toLocaleString()} TK`, rightX, finalY + 12, { align: 'right' });

    // Signatures exactly 1 inch (25.4 mm) below Grand Total (which is at finalY + 12)
    const signatureY = finalY + 12 + 25.4;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    
    // Prepared By
    doc.line(10, signatureY, 60, signatureY);
    doc.text('Prepared By', 35, signatureY + 5, { align: 'center' });

    // Checked By
    doc.line(80, signatureY, 130, signatureY);
    doc.text('Checked By', 105, signatureY + 5, { align: 'center' });

    // Received By
    doc.line(150, signatureY, 200, signatureY);
    doc.text('Received By', 175, signatureY + 5, { align: 'center' });

    // Authorized Signature
    doc.line(220, signatureY, 270, signatureY);
    doc.text('Authorized Signature', 245, signatureY + 5, { align: 'center' });

    // Add auto-page numbers at the footer of all pages
    const pageCount = (doc as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Draw Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // light gray slate
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Draw a thin horizontal separator line above the footer
      doc.setDrawColor(241, 245, 249); 
      doc.setLineWidth(0.2);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
      
      // Right-aligned page number
      const footerText = `Page ${i} of ${pageCount}`;
      doc.text(footerText, pageWidth - 14, pageHeight - 8, { align: 'right' });
      
      // Left-aligned company branding
      doc.text(`${companyName.toUpperCase()} • PURCHASE BILL SUMMARY`, 14, pageHeight - 8, { align: 'left' });
    }

    doc.save(`purchase_bill_${date}.pdf`);
  };

  return (
    <div className="p-6 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200">
      {/* Confirmed Lock Warning / Admin Override Banner */}
      {isConfirmedBill && (
        isAdmin ? (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 text-indigo-900 text-xs font-semibold shadow-xs">
            <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0" />
            <span>This Purchase Bill is <strong>CONFIRMED</strong>. As <strong>Super Admin</strong>, you have permission to edit and save changes to this bill.</span>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold">
            <Lock className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>This Purchase Bill is <strong>CONFIRMED & LOCKED</strong>. Standard users cannot edit this bill. To make changes, click Back and select "Copy to New Purchase Bill".</span>
          </div>
        )
      )}

      {/* Top action buttons */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="flex gap-2">
          {!effectiveReadOnly && (
            <>
              <input 
                type="file" 
                id="excel-import-input" 
                accept=".xlsx, .xls" 
                onChange={importFromExcel} 
                className="hidden" 
              />
              <label 
                htmlFor="excel-import-input"
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Import Excel
              </label>
            </>
          )}
          <button 
            onClick={exportToExcel} 
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-teal-600/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          {!effectiveReadOnly && (
            <button 
              onClick={() => setIsSaveModalOpen(true)} 
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" /> Save Bill
            </button>
          )}
          <button 
            onClick={exportPDF} 
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Dynamic Company Branding Header */}
      <div className="text-center py-6 border-b border-slate-200 mb-8 bg-slate-50 rounded-xl px-4">
        {loadingProfile ? (
          <div className="text-xs text-slate-400 animate-pulse">Loading company profile details...</div>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">{companyProfile?.name || 'ASR GROUP'}</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase font-semibold tracking-wider">{companyProfile?.address || 'INFORMATION & TECHNOLOGY'}</p>
            {companyProfile?.contact && <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{companyProfile.contact}</span>}
          </>
        )}
        <div className={`mt-4 inline-block px-3.5 py-1 border rounded-full ${
          isCopy
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : initialBill?.status === 'confirmed'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-indigo-50 border-indigo-100 text-indigo-600'
        }`}>
          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            {isCopy ? 'Copy to New Purchase Bill' : initialBill?.status === 'confirmed' ? (
              <>
                <Lock className="w-3.5 h-3.5 text-emerald-600" /> Confirmed Purchase Bill
              </>
            ) : 'Purchase Bill Summary'}
          </span>
        </div>
      </div>

      {/* Meta configuration form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Bill Submit Date</label>
          <DateInput 
            value={date} 
            onChange={val => setDate(val)} 
            disabled={effectiveReadOnly}
            className="w-full bg-white border border-slate-200 text-slate-800 p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-60" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Advance Purchase Amount</label>
          <input 
            type="number" 
            placeholder="0" 
            value={advancePurchase} 
            onChange={e => setAdvancePurchase(Number(e.target.value))} 
            disabled={effectiveReadOnly}
            className="w-full bg-white border border-slate-200 text-slate-800 p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-60" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Prepared By</label>
          <input 
            type="text" 
            readOnly 
            value={currentUserEmail} 
            className="w-full bg-slate-100 border border-slate-200 text-slate-500 p-2.5 rounded-lg text-xs cursor-not-allowed" 
          />
        </div>
      </div>

      {/* Spreadsheet grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs whitespace-nowrap min-w-[1200px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="p-3 font-semibold tracking-wider text-center w-12 border-r border-slate-200">SL</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Purchase Date</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Vendor Name</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Inv / Bill No</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Product Name</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Serial Number</th>
              <th className="p-3 font-semibold tracking-wider text-center w-16 border-r border-slate-200">QTY</th>
              <th className="p-3 font-semibold tracking-wider text-right w-24 border-r border-slate-200">Price</th>
              <th className="p-3 font-semibold tracking-wider text-right w-28 border-r border-slate-200">Amount</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Branch Code</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Applicant Name</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Dist. Date</th>
              <th className="p-3 font-semibold tracking-wider border-r border-slate-200">Remarks</th>
              {!effectiveReadOnly && <th className="p-3 font-semibold tracking-wider text-center w-12">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {entries.map((entry, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2 text-center font-bold text-slate-400 border-r border-slate-200 bg-slate-50/50">{entry.sl}</td>
                <td className="p-1 border-r border-slate-200">
                  <DateInput 
                    value={entry.purchaseDate} 
                    onChange={val => updateEntry(i, 'purchaseDate', val)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="text" 
                    placeholder="e.g. Master Technology" 
                    value={entry.vendorName} 
                    onChange={e => updateEntry(i, 'vendorName', e.target.value)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none font-medium disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="text" 
                    placeholder="A001INV26..." 
                    value={entry.invBillNo} 
                    onChange={e => updateEntry(i, 'invBillNo', e.target.value)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="text" 
                    placeholder="e.g. Copy Toner" 
                    value={entry.productName} 
                    onChange={e => updateEntry(i, 'productName', e.target.value)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="text" 
                    placeholder="Serial Number" 
                    value={entry.serialNumber} 
                    onChange={e => updateEntry(i, 'serialNumber', e.target.value)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none font-mono disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="number" 
                    min="1" 
                    value={entry.qty} 
                    onChange={e => updateEntry(i, 'qty', Number(e.target.value))} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-center text-slate-800 focus:ring-0 focus:outline-none font-semibold disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={entry.price} 
                    onChange={e => updateEntry(i, 'price', Number(e.target.value))} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-right text-slate-800 focus:ring-0 focus:outline-none font-semibold disabled:opacity-70" 
                  />
                </td>
                <td className="p-3 text-right font-bold text-indigo-600 border-r border-slate-200 bg-indigo-50/20">
                  {entry.amount.toLocaleString()}
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="text" 
                    placeholder="e.g. WC" 
                    value={entry.branchCode} 
                    onChange={e => updateEntry(i, 'branchCode', e.target.value)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="text" 
                    placeholder="Applicant Name" 
                    value={entry.applicantName} 
                    onChange={e => updateEntry(i, 'applicantName', e.target.value)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <DateInput 
                    value={entry.distributionDate} 
                    onChange={val => updateEntry(i, 'distributionDate', val)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none disabled:opacity-70" 
                  />
                </td>
                <td className="p-1 border-r border-slate-200">
                  <input 
                    type="text" 
                    placeholder="Remarks" 
                    value={entry.remarks} 
                    onChange={e => updateEntry(i, 'remarks', e.target.value)} 
                    disabled={effectiveReadOnly}
                    className="w-full bg-transparent border-0 focus:bg-slate-50 p-1.5 text-xs text-slate-800 focus:ring-0 focus:outline-none disabled:opacity-70" 
                  />
                </td>
                {!effectiveReadOnly && (
                  <td className="p-2 text-center">
                    <button 
                      onClick={() => deleteEntry(i)} 
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-all cursor-pointer"
                      title="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Entry Button */}
      {!effectiveReadOnly && (
        <div className="mt-4">
          <button 
            onClick={addEntry} 
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Row
          </button>
        </div>
      )}

      {/* Calculations & Summary Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-200 pt-6">
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks & Summary notes</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Please double check all serial numbers and vendor bill invoice references prior to exporting the PDF or saving to the database. All amounts are calculated dynamically based on input quantities and pricing.
          </p>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Total Amount:</span>
            <span className="text-sm font-semibold text-slate-900">{totalAmount.toLocaleString()} TK</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase tracking-wider border-t border-slate-200 pt-2">
            <span>Advance Purchase:</span>
            <span className="text-sm font-semibold text-slate-700">(-) {advancePurchase.toLocaleString()} TK</span>
          </div>
          <div className="flex justify-between items-center text-xs text-indigo-600 font-bold uppercase tracking-widest border-t-2 border-dashed border-indigo-200 pt-3">
            <span className="text-sm text-indigo-600">Grand Total:</span>
            <span className="text-lg font-extrabold text-indigo-700">{grandTotal.toLocaleString()} TK</span>
          </div>
        </div>
      </div>

      {/* Save Modal with Draft and Confirm Options */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-indigo-600" />
                Save Purchase Bill
              </h3>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Choose how you want to save this purchase bill:
            </p>

            <div className="space-y-3 mb-6">
              {/* Option 1: Draft */}
              <button
                onClick={() => handleSaveWithStatus('draft')}
                className="w-full text-left p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 transition-all cursor-pointer group flex items-start gap-3"
              >
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-950">Save as Draft</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-amber-200 text-amber-800 rounded-md">Draft</span>
                  </div>
                  <p className="text-xs text-amber-800/80 mt-1">
                    Save as draft to edit, modify items, or add entries later.
                  </p>
                </div>
              </button>

              {/* Option 2: Confirm */}
              <button
                onClick={() => handleSaveWithStatus('confirmed')}
                className="w-full text-left p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 transition-all cursor-pointer group flex items-start gap-3"
              >
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-950">Confirm & Save</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-md">Confirmed</span>
                  </div>
                  <p className="text-xs text-emerald-800/80 mt-1">
                    Finalize & lock this bill. <strong>Cannot be edited after confirmation!</strong>
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


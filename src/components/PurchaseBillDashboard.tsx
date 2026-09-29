import React, { useState, useEffect } from 'react';
import { PurchaseBill, CompanyProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { getLocalCache, setLocalCache, deleteLocalCacheItem } from '../utils/localCache';
import { Plus, Search, FileText, Calendar, Trash2, AlertTriangle, Download, ArrowLeft, Eye, Pencil, FileSpreadsheet, Copy, Lock, CheckCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDisplayDate } from './PurchaseBillForm';

interface PurchaseBillDashboardProps {
  onNewForm: () => void;
  onSelectBill: (bill: PurchaseBill) => void;
  onEditBill: (bill: PurchaseBill) => void;
  onCopyBill?: (bill: PurchaseBill) => void;
  currentUserUid: string;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export default function PurchaseBillDashboard({
  onNewForm,
  onSelectBill,
  onEditBill,
  onCopyBill,
  currentUserUid,
  isAdmin = false,
  permissions
}: PurchaseBillDashboardProps) {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  useEffect(() => {
    // Fetch Company Profile Settings
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'settings', 'companyProfile');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCompanyProfile(docSnap.data() as CompanyProfile);
        }
      } catch (err) {
        console.error("Error fetching company profile:", err);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const listPath = 'purchaseBills';
    try {
      const q = query(collection(db, listPath));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: PurchaseBill[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({
            id: docSnap.id,
            ...docSnap.data()
          } as PurchaseBill);
        });

        // Sort by date desc
        fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setBills(fetched);
        setLocalCache(listPath, fetched);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, listPath);
        const cached = getLocalCache<PurchaseBill>(listPath);
        if (cached && cached.length > 0) {
          setBills(cached);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error(err);
      const cached = getLocalCache<PurchaseBill>(listPath);
      if (cached && cached.length > 0) {
        setBills(cached);
      }
      setLoading(false);
    }
  }, []);

  const handleDeleteButtonClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const docId = deleteConfirmId;
    setDeleteConfirmId(null);
    const deletePath = `purchaseBills/${docId}`;
    try {
      await deleteDoc(doc(db, 'purchaseBills', docId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, deletePath);
    }
    deleteLocalCacheItem('purchaseBills', docId);
    setBills(prev => prev.filter(b => b.id !== docId));
  };

  const handleDownloadPdf = (e: React.MouseEvent, bill: PurchaseBill) => {
    e.stopPropagation();
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      
      const companyName = companyProfile?.name || 'ASR GROUP';
      const companyAddress = companyProfile?.address || 'INFORMATION & TECHNOLOGY';
      const companyContact = companyProfile?.contact || '';
      const companyWebsite = companyProfile?.website || '';

      // Header Design
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text(companyName.toUpperCase(), 148, 12, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(companyAddress, 148, 17, { align: 'center' });
      if (companyContact || companyWebsite) {
        doc.text(`${companyContact} | ${companyWebsite}`, 148, 21, { align: 'center' });
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      doc.text('PURCHASE BILL SUMMARY', 148, 26, { align: 'center' });

      doc.setFont('helvetica', 'semibold');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`DATE: ${formatDisplayDate(bill.date)}`, 14, 31);

      const headers = [
        ['SL', 'Purchase Date', 'Vendor Name', 'Inv / Bill No', 'Product Name', 'Serial Number', 'QTY', 'Price', 'Amount', 'Branch Code', 'Applicant Name', 'Distribution Date', 'Remarks']
      ];

      const body = bill.entries.map(e => [
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
      doc.text(`Total Amount:  ${bill.totalAmount.toLocaleString()} TK`, rightX, finalY, { align: 'right' });
      doc.text(`Advance Purchase:  ${bill.advancePurchase.toLocaleString()} TK`, rightX, finalY + 6, { align: 'right' });
      
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text(`Grand Total:  ${bill.grandTotal.toLocaleString()} TK`, rightX, finalY + 12, { align: 'right' });

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

      doc.save(`purchase_bill_${bill.date}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF.");
    }
  };

  const exportAllToExcel = () => {
    try {
      // Sheet 1: Bills Overview
      const billsOverview = bills.map(bill => ({
        "Bill ID": bill.id,
        "Date": formatDisplayDate(bill.date),
        "Total Amount": bill.totalAmount,
        "Advance Purchase": bill.advancePurchase,
        "Grand Total": bill.grandTotal,
        "Created By": bill.createdByEmail || 'Guest'
      }));

      // Sheet 2: All Individual Entries combined
      const allEntries: any[] = [];
      bills.forEach(bill => {
        bill.entries.forEach(entry => {
          allEntries.push({
            "Bill ID": bill.id,
            "Bill Date": formatDisplayDate(bill.date),
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
          });
        });
      });

      const workbook = XLSX.utils.book_new();
      
      const wsOverview = XLSX.utils.json_to_sheet(billsOverview);
      XLSX.utils.book_append_sheet(workbook, wsOverview, "Bills Summary");

      const wsEntries = XLSX.utils.json_to_sheet(allEntries);
      XLSX.utils.book_append_sheet(workbook, wsEntries, "Detailed Entries");

      XLSX.writeFile(workbook, "purchase_bills_ledger.xlsx");
    } catch (err) {
      console.error("Error exporting all bills:", err);
      alert("Failed to export bills to Excel.");
    }
  };

  const filtered = bills.filter((b) => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch =
      (b.date || '').includes(queryLower) ||
      (b.createdByEmail || '').toLowerCase().includes(queryLower) ||
      b.entries.some(e => 
        (e.vendorName || '').toLowerCase().includes(queryLower) ||
        (e.productName || '').toLowerCase().includes(queryLower) ||
        (e.invBillNo || '').toLowerCase().includes(queryLower)
      );

    return matchesSearch;
  });

  return (
    <div className="py-8 px-8 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
              Purchase Ledger
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Purchase Bills Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse, search, audit and download saved purchase bills from Firestore.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportAllToExcel}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition duration-150 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export All to Excel
          </button>
          {canEdit && (
            <button
              onClick={onNewForm}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition duration-150 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create Purchase Bill
            </button>
          )}
        </div>
      </div>

      {errorText && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
        <div className="relative flex-1 w-full">
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Search by Date, Vendor, Product or Bill No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 pl-10 pr-4 py-2 text-xs border border-slate-200 focus:border-indigo-400 text-slate-800 rounded-lg outline-none transition"
          />
        </div>
      </div>

      {/* Grid List of Bills */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-200 rounded-3xl shadow-xs">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 mt-4 font-semibold">Synchronizing Purchase Bills...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-800">No purchase bills found</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
            Create your first purchase bill form sheet by tapping the Indigo button above.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">ID & Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Bill Submit Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Total Rows</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Prepared By</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Grand Total</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((bill) => {
                  const isConfirmed = bill.status === 'confirmed';

                  return (
                    <tr 
                      key={bill.id}
                      onClick={() => onSelectBill(bill)}
                      className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-bold text-slate-400">#{bill.id.substring(4, 11)}</span>
                          <span className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {formatDisplayDate(bill.date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-semibold text-slate-700">
                          {formatDisplayDate(bill.date)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Lock className="w-3 h-3 text-emerald-600" /> Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            <FileText className="w-3 h-3 text-amber-600" /> Draft
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-slate-600">
                          {bill.entries.length} rows
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500 font-medium">
                          {bill.createdByEmail || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-indigo-600 font-mono">
                          ৳{bill.grandTotal.toLocaleString()} BDT
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectBill(bill)}
                          className="p-2 text-slate-400 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="View Bill"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => onEditBill(bill)}
                            className={`p-2 rounded-lg transition cursor-pointer ${
                              isConfirmed && !isAdmin 
                                ? 'text-slate-300 hover:text-slate-500 hover:bg-slate-100' 
                                : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                            }`}
                            title={isConfirmed ? (isAdmin ? "Edit Confirmed Bill (Super Admin)" : "Confirmed (Locked for Standard Users)") : "Edit Bill"}
                          >
                            {isConfirmed && !isAdmin ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                          </button>
                        )}
                        {canEdit && onCopyBill && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyBill(bill);
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Copy to New Purchase Bill"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { handleDownloadPdf(e, bill); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => handleDeleteButtonClick(e, bill.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Delete Bill"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-slate-850 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Delete Purchase Bill?
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              Are you sure you want to permanently delete this purchase bill ledger from Firestore database? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 border-t border-slate-100 pt-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

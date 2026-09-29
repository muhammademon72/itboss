import React, { useState, useEffect, useRef } from 'react';
import { Requisition } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, getDocs, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { Plus, Search, FileText, Calendar, Trash2, Copy, Tag, CheckCircle2, AlertTriangle, Printer, Sparkles, Building, UserCheck, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface DashboardProps {
  onNewForm: () => void;
  onSelectRequisition: (req: Requisition) => void;
  onCopyRequisition: (req: Requisition) => void;
  currentUserUid: string;
  isAdmin: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

const formatDisplayDate = (dateVal: string | undefined): string => {
  if (!dateVal) return '';
  
  // 1. If it's in YYYY-MM-DD or YYYY/MM/DD format (e.g. "2026-06-05")
  const yyyymmddRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  const matchYmd = dateVal.match(yyyymmddRegex);
  if (matchYmd) {
    const [_, y, m, d] = matchYmd;
    const formattedDay = d.padStart(2, '0');
    const formattedMonth = m.padStart(2, '0');
    return `${formattedDay}/${formattedMonth}/${y}`;
  }

  // 2. If it's in DD/MM/YYYY or DD-MM-YYYY format, it's already correct. Let's make sure it has padded zeros.
  const ddMmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const matchDmy = dateVal.match(ddMmyyyyRegex);
  if (matchDmy) {
    const [_, d, m, y] = matchDmy;
    const formattedDay = d.padStart(2, '0');
    const formattedMonth = m.padStart(2, '0');
    return `${formattedDay}/${formattedMonth}/${y}`;
  }

  // 3. Try parsing with native Date
  try {
    const dObj = new Date(dateVal);
    if (!isNaN(dObj.getTime())) {
      const day = String(dObj.getDate()).padStart(2, '0');
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const year = dObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // ignore
  }

  return dateVal;
};

export default function Dashboard({
  onNewForm,
  onSelectRequisition,
  onCopyRequisition,
  currentUserUid,
  isAdmin,
  permissions
}: DashboardProps) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  // Load database requisitions live via onSnapshot (Skill requirement)
  useEffect(() => {
    const listPath = 'requisitions';
    try {
      let q = query(collection(db, listPath));
      if (!isAdmin) {
        q = query(collection(db, listPath), where('createdBy', '==', currentUserUid));
      }
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: Requisition[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({
            id: docSnap.id,
            ...docSnap.data()
          } as Requisition);
        });
        
        const deletedItems = getLocalCache<{id: string}>('deleted_requisitions_ids') || [];
        const deletedSet = new Set(deletedItems.map(d => d.id));

        const cached = getLocalCache<Requisition>(listPath) || [];
        const combinedMap = new Map<string, Requisition>();

        cached.forEach(r => { if (r && r.id && !deletedSet.has(r.id)) combinedMap.set(r.id, r); });
        fetched.forEach(r => { if (r && r.id && !deletedSet.has(r.id)) combinedMap.set(r.id, r); });

        const finalData = Array.from(combinedMap.values());
        finalData.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

        setRequisitions(finalData);
        setLocalCache(listPath, finalData);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, listPath);
        const deletedItems = getLocalCache<{id: string}>('deleted_requisitions_ids') || [];
        const deletedSet = new Set(deletedItems.map(d => d.id));
        const cached = getLocalCache<Requisition>(listPath) || [];
        setRequisitions(cached.filter(r => r && r.id && !deletedSet.has(r.id)));
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error(err);
      const deletedItems = getLocalCache<{id: string}>('deleted_requisitions_ids') || [];
      const deletedSet = new Set(deletedItems.map(d => d.id));
      const cached = getLocalCache<Requisition>(listPath) || [];
      setRequisitions(cached.filter(r => r && r.id && !deletedSet.has(r.id)));
      setLoading(false);
    }
  }, [currentUserUid, isAdmin]);

  const handleDeleteButtonClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid triggering card view selection
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const docId = deleteConfirmId;
    
    // Double-check status to prevent deleting fully approved records
    const targetReq = requisitions.find(r => r.id === docId);
    if (targetReq && targetReq.status === 'Fully_Approved' && !isAdmin) {
      setErrorText('Fully Approved requisitions cannot be deleted.');
      setDeleteConfirmId(null);
      return;
    }

    setDeleteConfirmId(null);
    saveLocalCacheItem('deleted_requisitions_ids', { id: docId });
    deleteLocalCacheItem('requisitions', docId);
    setRequisitions(prev => prev.filter(r => r.id !== docId));

    deleteDoc(doc(db, 'requisitions', docId)).catch((err) => {
      console.warn('Firestore delete error:', err);
    });
  };

  const handleExportPdf = () => {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageHeight = 297;
      const pageWidth = 210;
      const marginBottom = 15;
      let pageCount = 1;
      let y = 50;

      const drawHeaders = (docPdf: jsPDF) => {
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(8.5);
        docPdf.setFillColor(243, 244, 246); // slate-100 fallback background for headers
        docPdf.rect(10, y, 190, 8, 'F');
        docPdf.setDrawColor(30, 41, 59); // dark slate/black lines for precise corporate design
        docPdf.line(10, y, 200, y);
        docPdf.line(10, y + 8, 200, y + 8);
        
        docPdf.setTextColor(30, 41, 59); // Slate-800
        docPdf.text('DATE', 12, y + 5.5);
        docPdf.text('APPLICANT & DEPT', 32, y + 5.5);
        docPdf.text('EMPLOYEE ID & BRANCH', 85, y + 5.5);
        docPdf.text('EQUIPMENT TYPES', 130, y + 5.5);
        docPdf.text('VALUATION', 165, y + 5.5);
        docPdf.text('STATUS', 184, y + 5.5);
        
        y += 8;
      };

      // Header Page 1
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.text('ASR GENERAL SECTOR GATEWAY', 10, 18);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(79, 70, 229); // indigo-600
      pdf.text('IT EQUIPMENT REQUISITIONS AUDIT LOG', 10, 24);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(`GENERATED ON: ${new Date().toLocaleString()} (UTC)`, 10, 29);
      pdf.text(`TOTAL ENTRIES: ${filteredRequisitions.length}`, 10, 33);
      pdf.text(`CUMULATIVE VALUATION: BDT ${totalProposedValue.toLocaleString()}`, 10, 37);
      pdf.text(`CURRENT FILTER: STATUS [${statusFilter.replace('_', ' ').toUpperCase()}]`, 10, 41);

      pdf.setDrawColor(203, 213, 225); // slate-300
      pdf.line(10, 45, 200, 45);

      y = 48;
      drawHeaders(pdf);

      filteredRequisitions.forEach((req, index) => {
        if (y + 11 > pageHeight - marginBottom) {
          // Add page number before adding new page
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184); // slate-400
          pdf.text(`Page ${pageCount}`, 180, pageHeight - 8);
          pdf.text('ASR GROUP Ltd. • IT Department Requisitions Audit', 10, pageHeight - 8);
          
          pdf.addPage();
          pageCount++;
          y = 15;
          drawHeaders(pdf);
        }
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(15, 23, 42); // slate-900
        
        // Zebra striping
        if (index % 2 === 1) {
          pdf.setFillColor(248, 250, 252); // slate-50
          pdf.rect(10, y, 190, 10, 'F');
        }
        
        // Date
        pdf.text(formatDisplayDate(req.date), 12, y + 6);
        
        // Applicant & Dept
        pdf.setFont('helvetica', 'bold');
        pdf.text((req.applicantName || '').toUpperCase(), 32, y + 4.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105); // slate-600
        pdf.text(req.applicantDepartment || '', 32, y + 8);
        
        // ID & Branch
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.text(req.employeeId || '', 85, y + 4.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        pdf.text(req.branchName || '', 85, y + 8);
        
        // Equipment Types
        pdf.setTextColor(15, 23, 42);
        let typesStr = (req.types || []).join(', ');
        if (typesStr.length > 20) {
          typesStr = typesStr.substring(0, 18) + '...';
        }
        pdf.text(typesStr || 'NONE', 130, y + 6);
        
        // Valuation
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Tk ${req.totalAmount ? req.totalAmount.toLocaleString() : '0'}`, 165, y + 6);
        
        // Status
        let statusText = (req.status || '').replace('_', ' ').toUpperCase();
        pdf.setFontSize(7);
        if (req.status === 'Fully_Approved') {
          pdf.setTextColor(16, 185, 129); // emerald-500
        } else if (req.status === 'Rejected') {
          pdf.setTextColor(239, 68, 68); // rose-500
        } else {
          pdf.setTextColor(245, 158, 11); // amber-500
        }
        pdf.text(statusText, 184, y + 6);
        
        // Draw separator line
        pdf.setDrawColor(241, 245, 249); // slate-100
        pdf.line(10, y + 10, 200, y + 10);
        
        y += 10;
      });

      // Add last page footer
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184); // slate-400
      pdf.text(`Page ${pageCount}`, 180, pageHeight - 8);
      pdf.text('ASR GROUP Ltd. • IT Department Requisitions Audit', 10, pageHeight - 8);

      pdf.save(`Requisitions_Log_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      setErrorText('Failed to generate PDF audit log. Please try compiling again.');
    }
  };

  // Metrics
  const totalSubmissions = requisitions.length;
  const approvedCount = requisitions.filter(r => r.status === 'Fully_Approved').length;
  const pendingCount = requisitions.filter(r => r.status !== 'Fully_Approved' && r.status !== 'Rejected').length;
  const totalProposedValue = requisitions.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  // Filtering list
  const filteredRequisitions = requisitions.filter((req) => {
    const matchesSearch =
      req.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.branchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.date.includes(searchQuery);

    const matchesStatus = statusFilter === 'All' || req.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: Requisition['status']) => {
    switch (status) {
      case 'Fully_Approved':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Manager_Approved':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Recommended':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Rejected':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const getStatusLabelText = (status: Requisition['status']) => {
    return status.replace('_', ' ').toUpperCase();
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Excel Export
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredRequisitions.map((req, idx) => ({
        'SL': idx + 1,
        'Requisition ID': req.id,
        'Date': formatDisplayDate(req.date),
        'Applicant Name': req.applicantName || '',
        'Department': req.applicantDepartment || '',
        'Employee ID': req.employeeId || '',
        'Branch Name': req.branchName || '',
        'Contact': req.contact || '',
        'Address': req.address || '',
        'Equipment Types': (req.types || []).join(', '),
        'Items Count': (req.items || []).length,
        'Items Detail': (req.items || []).map(i => `${i.equipmentName} (Qty: ${i.qty}, Cond: ${i.condition}, Price: BDT ${i.approximatePrice})`).join('; '),
        'Total Valuation (BDT)': req.totalAmount || 0,
        'Reason for Requisition': req.reason || '',
        'Status': req.status || 'Submitted',
        'Created By Email': req.createdByEmail || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'IT Requisitions Log');

      const fileName = `IT_Requisitions_Log_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err: any) {
      console.error('Export Excel error:', err);
      setErrorText(`Export Excel failed: ${err?.message || 'Unknown error'}`);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    try {
      const dataToExport = filteredRequisitions.map((req, idx) => ({
        'SL': idx + 1,
        'Requisition ID': req.id,
        'Date': formatDisplayDate(req.date),
        'Applicant Name': req.applicantName || '',
        'Department': req.applicantDepartment || '',
        'Employee ID': req.employeeId || '',
        'Branch Name': req.branchName || '',
        'Contact': req.contact || '',
        'Address': req.address || '',
        'Equipment Types': (req.types || []).join(', '),
        'Items Count': (req.items || []).length,
        'Items Detail': (req.items || []).map(i => `${i.equipmentName} (Qty: ${i.qty}, Cond: ${i.condition}, Price: BDT ${i.approximatePrice})`).join('; '),
        'Total Valuation (BDT)': req.totalAmount || 0,
        'Reason for Requisition': req.reason || '',
        'Status': req.status || 'Submitted',
        'Created By Email': req.createdByEmail || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob(['\ufeff' + csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IT_Requisitions_Log_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Export CSV error:', err);
      setErrorText(`Export CSV failed: ${err?.message || 'Unknown error'}`);
    }
  };

  // JSON Export
  const handleExportJson = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredRequisitions, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `IT_Requisitions_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      console.error('Export JSON error:', err);
      setErrorText(`Export JSON failed: ${err?.message || 'Unknown error'}`);
    }
  };

  // Import Excel / CSV / JSON
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetInput = e.target;
    setLoading(true);
    setErrorText(null);

    try {
      const fileName = file.name.toLowerCase();
      let importedRecords: Partial<Requisition>[] = [];

      if (fileName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          importedRecords = parsed;
        } else if (parsed && typeof parsed === 'object') {
          importedRecords = [parsed];
        }
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        importedRecords = rows.map((row) => {
          const typesStr = row['Equipment Types'] || row['types'] || '';
          const typesArr = typeof typesStr === 'string'
            ? typesStr.split(',').map((s: string) => s.trim()).filter(Boolean)
            : Array.isArray(typesStr) ? typesStr : [];

          const itemsDetail = row['Items Detail'] || row['items'] || '';
          let parsedItems = [];
          if (Array.isArray(itemsDetail)) {
            parsedItems = itemsDetail;
          } else if (typeof itemsDetail === 'string' && itemsDetail.trim()) {
            const itemParts = itemsDetail.split(';');
            parsedItems = itemParts.map((part, idx) => ({
              sl: idx + 1,
              equipmentName: part.trim(),
              description: part.trim(),
              qty: 1,
              condition: 'New',
              approximatePrice: 0
            }));
          } else {
            parsedItems = [{
              sl: 1,
              equipmentName: typesArr[0] || 'IT Equipment',
              description: 'Imported record',
              qty: 1,
              condition: 'New',
              approximatePrice: Number(row['Total Valuation (BDT)'] || row['Total Amount'] || row['totalAmount']) || 0
            }];
          }

          return {
            date: row['Date'] || row['date'] || new Date().toISOString().slice(0, 10),
            applicantName: row['Applicant Name'] || row['applicantName'] || 'Imported User',
            applicantDepartment: row['Department'] || row['applicantDepartment'] || 'IT Department',
            employeeId: row['Employee ID'] || row['employeeId'] || '',
            branchName: row['Branch Name'] || row['branchName'] || 'Head Office',
            contact: row['Contact'] || row['contact'] || '',
            address: row['Address'] || row['address'] || '',
            types: typesArr.length > 0 ? typesArr : ['Desktop PC'],
            items: parsedItems,
            totalAmount: Number(row['Total Valuation (BDT)'] || row['Total Amount'] || row['totalAmount']) || 0,
            reason: row['Reason for Requisition'] || row['reason'] || 'Imported batch record',
            status: row['Status'] || row['status'] || 'Submitted',
            applicantSignature: row['applicantSignature'] || { signed: true, name: row['Applicant Name'] || 'Imported', date: new Date().toISOString().slice(0, 10) },
            managerSignature: row['managerSignature'] || { signed: false },
            recommenderSignature: row['recommenderSignature'] || { signed: false },
            authoritySignature: row['authoritySignature'] || { signed: false },
            createdBy: currentUserUid,
            createdByEmail: row['Created By Email'] || 'imported@asrgroup.com',
            createdAt: new Date().toISOString()
          };
        });
      }

      if (importedRecords.length === 0) {
        alert('No valid requisition records found in file.');
        setLoading(false);
        return;
      }

      let successCount = 0;
      for (const rec of importedRecords) {
        const payload: Omit<Requisition, 'id'> = {
          date: rec.date || new Date().toISOString().slice(0, 10),
          applicantName: rec.applicantName || 'Imported User',
          applicantDepartment: rec.applicantDepartment || 'IT Department',
          employeeId: rec.employeeId || '',
          branchName: rec.branchName || 'Head Office',
          contact: rec.contact || '',
          address: rec.address || '',
          types: rec.types || ['Desktop PC'],
          items: rec.items || [{ sl: 1, equipmentName: 'IT Equipment', description: 'Imported', qty: 1, condition: 'New', approximatePrice: rec.totalAmount || 0 }],
          totalAmount: rec.totalAmount || 0,
          reason: rec.reason || 'Imported record',
          status: (rec.status as any) || 'Submitted',
          applicantSignature: rec.applicantSignature || { signed: true, name: rec.applicantName || 'Imported', date: new Date().toISOString().slice(0, 10) },
          managerSignature: rec.managerSignature || { signed: false },
          recommenderSignature: rec.recommenderSignature || { signed: false },
          authoritySignature: rec.authoritySignature || { signed: false },
          createdBy: currentUserUid,
          createdByEmail: rec.createdByEmail || 'imported@asrgroup.com',
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'requisitions'), payload);
        successCount++;
      }

      alert(`Successfully imported ${successCount} IT Requisition(s) into database!`);
    } catch (err: any) {
      console.error('Import error:', err);
      alert(`Import failed: ${err?.message || 'Error parsing file'}`);
    } finally {
      setLoading(false);
      targetInput.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            IT Equipment Requisitions Log
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Store, authorize, print and securely audit Department Equipment Requisition submissions.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer"
            title="Export IT Requisitions Log to Excel sheet (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            Export Excel
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center justify-center px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-lg border border-teal-200 shadow-2xs transition-all cursor-pointer"
            title="Export IT Requisitions Log to CSV file (.csv)"
          >
            <FileText className="h-4 w-4 mr-1.5 text-teal-600" />
            Export CSV
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center justify-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs transition-all cursor-pointer"
            title="Download JSON backup file"
          >
            <Download className="h-4 w-4 mr-1.5 text-slate-600" />
            Export JSON
          </button>

          {canEdit && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".xlsx,.xls,.csv,.json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 shadow-2xs transition-all cursor-pointer"
                title="Import IT Requisitions from Excel, CSV or JSON"
              >
                <Upload className="h-4 w-4 mr-1.5 text-amber-600" />
                Import Data
              </button>
            </>
          )}

          {isAdmin && (
            <button
              onClick={handleExportPdf}
              className="flex items-center justify-center px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs transition-all focus:outline-none cursor-pointer"
            >
              <Printer className="h-4 w-4 mr-1.5 text-slate-500 hover:text-indigo-600 transition-colors" />
              Download Log PDF
            </button>
          )}

          {canEdit && (
            <button
              onClick={onNewForm}
              className="flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg border border-indigo-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create New Entry
            </button>
          )}
        </div>
      </div>

      {errorText && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 text-rose-800 border-rose-200 border text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{errorText}</span>
          </div>
          <button
            onClick={() => setErrorText(null)}
            className="text-[10px] uppercase font-bold tracking-wider hover:opacity-85 underline cursor-pointer text-rose-600 hover:text-rose-800 ml-4 shrink-0 bg-transparent border-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Analytics Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Filed</p>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-bold text-slate-900">{totalSubmissions}</span>
            <span className="text-[10px] font-semibold text-slate-400 font-mono">OBJECTS</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fully Approved</p>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-bold text-emerald-600">{approvedCount}</span>
            <span className="text-[10px] font-semibold text-emerald-500 font-mono">AUTHORIZED</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Under Review</p>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-bold text-amber-500">{pendingCount}</span>
            <span className="text-[10px] font-semibold text-amber-500 font-mono">PENDING</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cumulative Valuation</p>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-bold text-indigo-600">৳{totalProposedValue.toLocaleString()}</span>
            <span className="text-[10px] font-semibold text-indigo-400 font-mono">VALUATION</span>
          </div>
        </div>
      </div>

      {/* Filter and Engine segment (toolbar matching professional table toolbars) */}
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-xs">
          {['All', 'Submitted', 'Manager_Approved', 'Recommended', 'Fully_Approved', 'Rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-80 bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-4 text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
      </div>

      {/* Requisitions List / Table Log */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-3 font-mono animate-pulse">
            Connecting to secure Firestore instance...
          </p>
        </div>
      ) : filteredRequisitions.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm px-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 font-sans">No matching entries found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchQuery || statusFilter !== 'All'
              ? "Modify your search parameters or select a different filter tab above."
              : "Let's log physical copies to your persistent Firestore instance. Tap the button below to get started!"}
          </p>
          {!searchQuery && statusFilter === 'All' && canEdit && (
            <button
              onClick={onNewForm}
              className="mt-4 inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3.5 py-2 rounded-lg border border-indigo-100 transition"
            >
              <Plus className="h-4 w-4 mr-1" />
              File first request
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredRequisitions.map((req) => (
            <div
              key={req.id}
              onClick={() => onSelectRequisition(req)}
              className="group bg-white border border-slate-200 hover:border-indigo-400/60 rounded-xl p-4 hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Side: Date, Status and Applicant */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                <div className="flex flex-row md:flex-col items-center md:items-start gap-2 md:gap-1 shrink-0 w-32">
                  <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-150">
                    {formatDisplayDate(req.date)}
                  </span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider text-center ${getStatusBadgeClass(req.status)}`}>
                    {getStatusLabelText(req.status)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-slate-900 text-sm font-sans line-clamp-1 group-hover:text-indigo-600 transition truncate uppercase">
                    {req.applicantName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500 font-semibold">
                    <div className="flex items-center">
                      <Building className="h-3 w-3 text-slate-400 mr-1 shrink-0" />
                      <span className="truncate">{req.applicantDepartment}</span>
                    </div>
                    <div className="flex items-center">
                      <UserCheck className="h-3 w-3 text-slate-400 mr-1 shrink-0" />
                      <span className="font-mono text-[9px] uppercase tracking-tighter">ID: {req.employeeId}</span>
                    </div>
                    <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded uppercase border border-slate-200">
                      {req.branchName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Side: Tags (Equipment Types) */}
              <div className="hidden lg:flex flex-wrap items-center gap-1.5 max-w-xs justify-center flex-1">
                {req.types && req.types.slice(0, 2).map((t, idx) => (
                  <span key={idx} className="bg-slate-50 text-slate-500 text-[9px] px-2 py-0.5 rounded border border-slate-200 font-bold uppercase tracking-wider whitespace-nowrap">
                    {t}
                  </span>
                ))}
                {req.types && req.types.length > 2 && (
                  <span className="text-[9px] text-slate-400 font-bold ml-1">
                    +{req.types.length - 2}
                  </span>
                )}
              </div>

              {/* Right Side: Price and Actions */}
              <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-widest leading-none mb-1">Valuation</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">৳{req.totalAmount.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                    {req.items?.filter(i => i.qty > 0).length || 0} ITEMS
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyRequisition(req);
                    }}
                    title="Copy Requisition"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer shadow-sm"
                  >
                    <Copy className="h-4 w-4" />
                  </button>

                  {!!currentUserUid && (req.status !== 'Fully_Approved' || isAdmin) && canDelete && (
                    <button
                      onClick={(e) => handleDeleteButtonClick(e, req.id)}
                      title="Retract filing"
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer shadow-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sleek, Non-Blocking Custom Confirmation Modal to bypass iframe window.confirm limitations */}
      {deleteConfirmId && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4 animate-in fade-in duration-200"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-250 text-center animate-in scale-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 font-sans">Retract Requisition?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">
              Are you sure you want to permanently delete this requisition record? This action cannot be undone and will retract the filing.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg border border-rose-750 shadow-sm transition cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

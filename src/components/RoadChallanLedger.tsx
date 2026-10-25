import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceeded, subscribeQuotaState } from '../firebase';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { LedgerPermissions } from '../types';
import { generateCanvasWithOklchFallback } from '../utils/pdfExport';
import {
  Truck, Plus, Search, Trash2, Edit2, Eye, Copy, Check, X,
  Building2, MapPin, Printer, Download, CopyPlus,
  RefreshCw, FileSpreadsheet, Layers, Filter, Sparkles, Camera, ShieldCheck,
  Calendar, User, FileText, CheckCircle2, Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface RoadChallanItem {
  id: string;
  productName: string;
  description: string;
  quantity: string;
  remarks: string;
}

export interface RoadChallanRecord {
  id: string;
  challanNo: string;
  date: string;
  fromName: string;
  fromCompanyName: string;
  fromAddress: string;
  fromMobile: string;
  toName: string;
  toCompanyName: string;
  toAddress: string;
  toMobile: string;
  note: string;
  items: RoadChallanItem[];
  status: 'Transit' | 'Delivered' | 'Cancelled' | 'Returned';
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface RoadChallanLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: LedgerPermissions;
}

const LOCAL_STORAGE_KEY = 'road_challan_ledger_records';

export const RoadChallanLedger: React.FC<RoadChallanLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  // Records state with LocalStorage caching
  const [records, setRecords] = useState<RoadChallanRecord[]>(() => {
    const cached = getLocalCache<RoadChallanRecord>(LOCAL_STORAGE_KEY);
    if (cached && cached.length > 0) {
      return cached;
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RoadChallanRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<RoadChallanRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields matching PDF template (Vehicle & Driver removed)
  const [challanNo, setChallanNo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // From details
  const [fromName, setFromName] = useState('Md Emon Hossain');
  const [fromCompanyName, setFromCompanyName] = useState('Dynasty Furnishing Centre Limited');
  const [fromAddress, setFromAddress] = useState('House # 272/B, 3rd Floor, Elephant Road, Dhaka-1205.');
  const [fromMobile, setFromMobile] = useState('01714 142078, 01783 906072');

  // To details
  const [toName, setToName] = useState('');
  const [toCompanyName, setToCompanyName] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [toMobile, setToMobile] = useState('');

  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'Transit' | 'Delivered' | 'Cancelled' | 'Returned'>('Transit');

  // Items list (Starts empty so only user created items show)
  const [items, setItems] = useState<RoadChallanItem[]>([
    { id: '1', productName: '', description: '', quantity: '', remarks: '' }
  ]);

  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded);
  const reportPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeQuotaState(setQuotaExceeded);
  }, []);

  // Sync with Firestore collection: 'road_challans'
  useEffect(() => {
    try {
      const q = query(collection(db, 'road_challans'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: RoadChallanRecord[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                challanNo: data.challanNo || '',
                date: data.date || new Date().toISOString().split('T')[0],
                fromName: data.fromName || 'Md Emon Hossain',
                fromCompanyName: data.fromCompanyName || 'Dynasty Furnishing Centre Limited',
                fromAddress: data.fromAddress || '',
                fromMobile: data.fromMobile || '',
                toName: data.toName || '',
                toCompanyName: data.toCompanyName || '',
                toAddress: data.toAddress || '',
                toMobile: data.toMobile || '',
                note: data.note || '',
                items: data.items || [],
                status: data.status || 'Transit',
                createdBy: data.createdBy || '',
                createdByEmail: data.createdByEmail || '',
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
              });
            });
            setRecords(list);
            setLocalCache(LOCAL_STORAGE_KEY, list);
          } else {
            setRecords([]);
            setLocalCache(LOCAL_STORAGE_KEY, []);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'road_challans');
          const cached = getLocalCache<RoadChallanRecord>(LOCAL_STORAGE_KEY);
          if (cached) setRecords(cached);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.error("Firestore sync error:", e);
    }
  }, []);

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setChallanNo(`CH-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(new Date().toISOString().split('T')[0]);
    setFromName('Md Emon Hossain');
    setFromCompanyName('Dynasty Furnishing Centre Limited');
    setFromAddress('House # 272/B, 3rd Floor, Elephant Road, Dhaka-1205.');
    setFromMobile('01714 142078, 01783 906072');
    setToName('');
    setToCompanyName('');
    setToAddress('');
    setToMobile('');
    setNote('');
    setStatus('Transit');
    setItems([
      { id: '1', productName: '', description: '', quantity: '', remarks: '' }
    ]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (record: RoadChallanRecord) => {
    setViewingRecord(null);
    setEditingRecord(record);
    setChallanNo(record.challanNo || '');
    setDate(record.date || new Date().toISOString().split('T')[0]);
    setFromName(record.fromName || 'Md Emon Hossain');
    setFromCompanyName(record.fromCompanyName || 'Dynasty Furnishing Centre Limited');
    setFromAddress(record.fromAddress || '');
    setFromMobile(record.fromMobile || '');
    setToName(record.toName || '');
    setToCompanyName(record.toCompanyName || '');
    setToAddress(record.toAddress || '');
    setToMobile(record.toMobile || '');
    setNote(record.note || '');
    setStatus(record.status || 'Transit');
    setItems(record.items && record.items.length > 0 ? record.items : [
      { id: '1', productName: '', description: '', quantity: '', remarks: '' }
    ]);
    setIsFormOpen(true);
  };

  const handleCopyAsNew = (record: RoadChallanRecord) => {
    setViewingRecord(null);
    setEditingRecord(null);
    setChallanNo(`CH-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(new Date().toISOString().split('T')[0]);
    setFromName(record.fromName || 'Md Emon Hossain');
    setFromCompanyName(record.fromCompanyName || 'Dynasty Furnishing Centre Limited');
    setFromAddress(record.fromAddress || '');
    setFromMobile(record.fromMobile || '');
    setToName(record.toName || '');
    setToCompanyName(record.toCompanyName || '');
    setToAddress(record.toAddress || '');
    setToMobile(record.toMobile || '');
    setNote(record.note || '');
    setStatus('Transit');
    setItems(record.items ? record.items.map(i => ({ ...i, id: `${Date.now()}-${Math.random()}` })) : [
      { id: '1', productName: '', description: '', quantity: '', remarks: '' }
    ]);
    setIsFormOpen(true);
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(), productName: '', description: '', quantity: '', remarks: '' }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof RoadChallanItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      challanNo: challanNo.trim(),
      date,
      fromName: fromName.trim(),
      fromCompanyName: fromCompanyName.trim(),
      fromAddress: fromAddress.trim(),
      fromMobile: fromMobile.trim(),
      toName: toName.trim(),
      toCompanyName: toCompanyName.trim(),
      toAddress: toAddress.trim(),
      toMobile: toMobile.trim(),
      note: note.trim(),
      items,
      status,
      updatedAt: new Date().toISOString()
    };

    if (editingRecord) {
      const updatedRecord: RoadChallanRecord = {
        ...editingRecord,
        ...payload,
        id: editingRecord.id
      };

      saveLocalCacheItem(LOCAL_STORAGE_KEY, updatedRecord);
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? updatedRecord : r));

      try {
        const docRef = doc(db, 'road_challans', editingRecord.id);
        await updateDoc(docRef, {
          ...payload,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `road_challans/${editingRecord.id}`);
      }

      if (viewingRecord && viewingRecord.id === editingRecord.id) {
        setViewingRecord(updatedRecord);
      }
    } else {
      const newId = `challan-${Date.now()}`;
      const newRecord: RoadChallanRecord = {
        id: newId,
        ...payload,
        createdBy: currentUser?.displayName || currentUser?.email || 'Admin',
        createdByEmail: currentUser?.email || '',
        createdAt: new Date().toISOString()
      };

      saveLocalCacheItem(LOCAL_STORAGE_KEY, newRecord);
      setRecords(prev => [newRecord, ...prev]);

      try {
        const docRef = await addDoc(collection(db, 'road_challans'), {
          ...payload,
          createdBy: currentUser?.displayName || currentUser?.email || 'Admin',
          createdByEmail: currentUser?.email || '',
          createdAt: serverTimestamp()
        });
        const finalRecord = { ...newRecord, id: docRef.id };
        saveLocalCacheItem(LOCAL_STORAGE_KEY, finalRecord);
        setRecords(prev => prev.map(r => r.id === newId ? finalRecord : r));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'road_challans');
      }
    }

    setIsFormOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;

    deleteLocalCacheItem(LOCAL_STORAGE_KEY, targetId);
    setRecords(prev => prev.filter(r => r.id !== targetId));
    setDeleteConfirmId(null);

    if (viewingRecord && viewingRecord.id === targetId) {
      setViewingRecord(null);
    }

    try {
      await deleteDoc(doc(db, 'road_challans', targetId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `road_challans/${targetId}`);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch =
        searchQuery === '' ||
        (r.challanNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.toName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.toAddress || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = selectedStatusFilter === 'All' || r.status === selectedStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [records, searchQuery, selectedStatusFilter]);

  const totalCount = records.length;
  const transitCount = records.filter(r => r.status === 'Transit').length;
  const deliveredCount = records.filter(r => r.status === 'Delivered').length;

  const handleExportExcel = () => {
    const data = filteredRecords.map((r, idx) => ({
      'SL': idx + 1,
      'Challan No': r.challanNo || '-',
      'Date': r.date || '-',
      'From Name': r.fromName || '-',
      'To Name': r.toName || '-',
      'To Address': r.toAddress || '-',
      'Status': r.status || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Road Challans');
    XLSX.writeFile(wb, `Road_Challan_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleDownloadPdf = async (record?: RoadChallanRecord) => {
    const targetRecord = record || viewingRecord;
    if (!targetRecord) return;

    if (record && !viewingRecord) {
      setViewingRecord(record);
    }

    setTimeout(async () => {
      if (!reportPrintRef.current) return;
      try {
        const canvas = await generateCanvasWithOklchFallback(reportPrintRef.current, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
        pdf.save(`Road_Challan_${targetRecord.challanNo || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (err) {
        console.error("PDF generation error:", err);
        window.print();
      }
    }, 250);
  };

  const handleCopyScreenshot = async () => {
    if (!reportPrintRef.current) return;
    try {
      const canvas = await generateCanvasWithOklchFallback(reportPrintRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert("Failed to create image blob.");
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          alert("Screenshot copied to clipboard successfully!");
        } catch (clipErr) {
          console.error("Clipboard API error:", clipErr);
          const image = canvas.toDataURL('image/png');
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute('href', image);
          downloadAnchorNode.setAttribute('download', `Road_Challan_${viewingRecord?.challanNo || 'Report'}_${new Date().toISOString().split('T')[0]}.png`);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
          alert("Clipboard copy not supported or blocked. Downloaded as PNG instead.");
        }
      }, 'image/png');
    } catch (err) {
      console.error("Error generating screenshot:", err);
      alert("Failed to generate screenshot.");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Road Challan Ledger</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Dynasty Furnishing Logistics
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Professional transport and delivery challans matching corporate layout specifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="text"
            placeholder="Search challans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Returned">Returned</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Road Challan</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Total Challans</div>
            <div className="text-lg font-bold text-slate-800">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">In Transit</div>
            <div className="text-lg font-bold text-amber-600">{transitCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Delivered</div>
            <div className="text-lg font-bold text-emerald-600">{deliveredCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">SL</th>
                <th className="py-3 px-4">Challan No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">From (Sender)</th>
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4">To (Receiver)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No road challans found. Click "Create Road Challan" to start.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-semibold text-slate-500">{index + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">{record.challanNo || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{record.date || '-'}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{record.fromName}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{record.toCompanyName || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{record.toName || 'N/A'}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{record.toAddress}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        record.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        record.status === 'Transit' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        record.status === 'Returned' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {record.status || 'Transit'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(record)}
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition cursor-pointer inline-flex items-center"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyAsNew(record)}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition cursor-pointer inline-flex items-center"
                        title="Copy to New"
                      >
                        <CopyPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingRecord(record)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer inline-flex items-center"
                        title="View PDF Challan"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(record)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer inline-flex items-center"
                          title="Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(record.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer inline-flex items-center"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL (Compact & Scrollable) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl p-5 sm:p-6 my-6 relative max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingRecord ? 'Edit Road Challan Form' : 'Create Road Challan Form'}
                  </h2>
                  <p className="text-[11px] text-slate-500">Dynasty Furnishing Centre Limited</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Top Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Challan No</label>
                  <input
                    type="text"
                    required
                    value={challanNo}
                    onChange={(e) => setChallanNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Returned">Returned</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* From & To Box Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From Box */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">From (Sender)</div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Name</label>
                    <input
                      type="text"
                      required
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      required
                      value={fromCompanyName}
                      onChange={(e) => setFromCompanyName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Address</label>
                    <textarea
                      rows={2}
                      required
                      value={fromAddress}
                      onChange={(e) => setFromAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile No</label>
                    <input
                      type="text"
                      required
                      value={fromMobile}
                      onChange={(e) => setFromMobile(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                </div>

                {/* To Box */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">To (Receiver)</div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Receiver Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. Alamgir Hossain"
                      value={toName}
                      onChange={(e) => setToName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. Company Name"
                      value={toCompanyName}
                      onChange={(e) => setToCompanyName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Receiver Address</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Ex. Blossom Garden (1st Floor)..."
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile No</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. 01714141037"
                      value={toMobile}
                      onChange={(e) => setToMobile(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="Ex. Handle with care..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                />
              </div>

              {/* Items Table Form */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">Challan Items</div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                        <th className="py-2.5 px-3 w-12 text-center">SL</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 w-28 text-center">QTY</th>
                        <th className="py-2.5 px-3 w-32">Remarks</th>
                        <th className="py-2.5 px-3 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {items.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">{index + 1}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              required
                              placeholder="Product name"
                              value={item.productName}
                              onChange={(e) => handleItemChange(item.id, 'productName', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              required
                              placeholder="Description / Model"
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              required
                              placeholder="1 Box / Pcs"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center font-mono outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="Remarks"
                              value={item.remarks}
                              onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer"
                >
                  {editingRecord ? 'Update Challan Form' : 'Save Challan Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW REPORT MODAL (Exact PDF Replica matching Dynasty Challan Image - Only created items shown) */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-4xl w-full flex flex-col items-center space-y-3">
            {/* Action Bar */}
            <div className="no-print w-full flex items-center justify-between bg-slate-900/90 text-white px-5 py-3 rounded-2xl shadow-xl">
              <div className="text-xs font-bold tracking-wide">DYNASTY ROAD CHALLAN PREVIEW</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyScreenshot}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Screenshot</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(viewingRecord)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingRecord(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable PDF Sheet (Exact Replica) */}
            <div
              ref={reportPrintRef}
              className="bg-white text-slate-900 rounded-3xl w-full border border-slate-300 shadow-2xl p-8 sm:p-12 relative overflow-hidden font-sans space-y-6"
            >
              {/* Header with Dynasty Logo and Website */}
              <div className="flex flex-col items-center border-b-2 border-slate-900 pb-4">
                <div className="text-center">
                  <div className="bg-[#1e3a8a] text-white px-8 py-3 font-black tracking-widest text-3xl rounded shadow-sm inline-block mb-2 mt-2">
                    DYNASTY
                  </div>
                  <div className="text-sm font-black text-slate-950" style={{ fontWeight: 900 }}>
                    Dynasty Furnishing Centre Limited.
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    House # 272/B, 3rd Floor, Shahid Janani Jahanara Imam Sharani, Elephant Road, Dhaka-1205.
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">
                    Contact Number: 01714142078
                  </div>
                  <div className="text-[10px] text-blue-600 font-semibold mt-1">www.dynasty.com.bd</div>
                </div>
              </div>

              {/* Title & Date */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black underline tracking-wide uppercase text-slate-900">Road Challan</h2>
                <div className="text-xs font-bold text-slate-700 text-right pr-2">
                  {viewingRecord.date.split('-').reverse().join('-')}
                </div>
              </div>

              {/* From & To Grid Boxes */}
              <div className="grid grid-cols-2 border-2 border-slate-900 text-xs">
                {/* From */}
                <div className="p-3.5 border-r-2 border-slate-900 space-y-1">
                  <div className="font-bold underline text-slate-900 text-sm mb-1">From,</div>
                  <div className="font-bold text-slate-900">{viewingRecord.fromName}</div>
                  <div className="font-bold text-slate-900">{viewingRecord.fromCompanyName}</div>
                  <div className="text-slate-700 leading-relaxed">{viewingRecord.fromAddress}</div>
                  <div className="text-slate-800 font-semibold pt-1">Mobile# {viewingRecord.fromMobile}</div>
                </div>

                {/* To */}
                <div className="p-3.5 space-y-1">
                  <div className="font-bold underline text-slate-900 text-sm mb-1">To,</div>
                  <div className="font-bold text-slate-900">{viewingRecord.toName || 'N/A'}</div>
                  <div className="font-bold text-slate-900">{viewingRecord.toCompanyName || 'N/A'}</div>
                  <div className="text-slate-700 leading-relaxed">{viewingRecord.toAddress || 'N/A'}</div>
                  <div className="text-slate-800 font-semibold pt-1">Mobile # {viewingRecord.toMobile || 'N/A'}</div>
                </div>
              </div>

              {/* Note */}
              <div className="text-xs font-bold text-slate-900 space-y-1">
                {viewingRecord.note && <div>Note: {viewingRecord.note}</div>}
              </div>

              {/* Items Table */}
              <div className="border-2 border-slate-900 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900 bg-slate-100 font-black uppercase text-[11px] text-slate-900">
                      <th className="py-2 px-3 border-r border-slate-900 w-12 text-center">SL</th>
                      <th className="py-2 px-3 border-r border-slate-900 w-44">PRODUCT</th>
                      <th className="py-2 px-3 border-r border-slate-900">DESCRIPTION</th>
                      <th className="py-2 px-3 border-r border-slate-900 w-28 text-center">QTY</th>
                      <th className="py-2 px-3 w-32">REMARKS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400">
                    {viewingRecord.items && viewingRecord.items.map((item, idx) => (
                      <tr key={item.id || idx} className="h-8">
                        <td className="py-2 px-3 border-r border-slate-400 text-center font-bold">{idx + 1}</td>
                        <td className="py-2 px-3 border-r border-slate-400 font-semibold text-slate-900">{item.productName || '-'}</td>
                        <td className="py-2 px-3 border-r border-slate-400 text-slate-800">{item.description || '-'}</td>
                        <td className="py-2 px-3 border-r border-slate-400 text-center font-bold text-slate-900">{item.quantity || '-'}</td>
                        <td className="py-2 px-3 text-slate-700">{item.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Road Challan?</h3>
              <p className="text-xs text-slate-500 mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

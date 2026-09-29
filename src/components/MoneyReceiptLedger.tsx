import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getLocalCache, setLocalCache } from '../utils/localCache';
import { Receipt } from '../types';
import { INITIAL_RECEIPTS, formatCurrency, getNextReceiptNo } from '../utils/receiptUtils';
import { ReceiptCard } from './ReceiptCard';
import { ReceiptForm } from './ReceiptForm';
import { ReceiptTable } from './ReceiptTable';
import { 
  Plus, Search, ReceiptText, Download, Upload, RefreshCw, 
  Table as TableIcon, LayoutGrid, CheckCircle2, DollarSign, Wallet, FileSpreadsheet, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MoneyReceiptLedgerProps {
  currentUser?: any;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export const MoneyReceiptLedger: React.FC<MoneyReceiptLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  // Receipts State initialized with local cache / INITIAL_RECEIPTS
  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    const cached = getLocalCache<Receipt>('money_receipts');
    if (cached && cached.length > 0) return cached;
    const local = localStorage.getItem('general_money_receipts');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Local storage parse error:', e);
      }
    }
    return INITIAL_RECEIPTS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firestore Real-time Sync
  useEffect(() => {
    const receiptsRef = collection(db, 'moneyReceipts');
    const unsubscribe = onSnapshot(
      receiptsRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Receipt[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              ...data,
            } as Receipt);
          });
          // Sort descending by date / receiptNo
          list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.receiptNo.localeCompare(a.receiptNo));
          setReceipts(list);
          setLocalCache('money_receipts', list);
          localStorage.setItem('general_money_receipts', JSON.stringify(list));
        } else if (receipts.length === 0) {
          // Initialize with default seeds if collection is empty
          INITIAL_RECEIPTS.forEach(async (initItem) => {
            try {
              await setDoc(doc(db, 'moneyReceipts', initItem.id), {
                ...initItem,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (e) {
              console.warn('Seed error:', e);
            }
          });
        }
        setSyncStatus('synced');
      },
      (error) => {
        console.warn('Firestore subscription fallback:', error);
        setSyncStatus('offline');
      }
    );

    return () => unsubscribe();
  }, []);

  // Save or Update Receipt
  const handleSaveReceipt = async (receipt: Receipt) => {
    setSyncStatus('saving');
    const updatedList = receipts.some((r) => r.id === receipt.id)
      ? receipts.map((r) => (r.id === receipt.id ? receipt : r))
      : [receipt, ...receipts];

    setReceipts(updatedList);
    setLocalCache('money_receipts', updatedList);
    localStorage.setItem('general_money_receipts', JSON.stringify(updatedList));

    try {
      await setDoc(
        doc(db, 'moneyReceipts', receipt.id),
        {
          ...receipt,
          updatedAt: serverTimestamp(),
          createdBy: receipt.createdBy || currentUser?.uid || 'system',
          createdByEmail: receipt.createdByEmail || currentUser?.email || 'muhammademon72@gmail.com',
        },
        { merge: true }
      );
      setSyncStatus('synced');
    } catch (e) {
      console.warn('Error saving to Firestore, retained locally:', e);
      setSyncStatus('offline');
    }

    setIsFormOpen(false);
    setEditingReceipt(null);
  };

  // Delete Receipt
  const handleDeleteReceipt = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this money receipt?')) return;
    const updatedList = receipts.filter((r) => r.id !== id);
    setReceipts(updatedList);
    setLocalCache('money_receipts', updatedList);
    localStorage.setItem('general_money_receipts', JSON.stringify(updatedList));

    if (previewReceipt?.id === id) {
      setPreviewReceipt(null);
    }

    try {
      await deleteDoc(doc(db, 'moneyReceipts', id));
      setSyncStatus('synced');
    } catch (e) {
      console.warn('Error deleting in Firestore, removed locally:', e);
    }
  };

  // Duplicate Receipt
  const handleDuplicateReceipt = (receipt: Receipt) => {
    const duplicated: Receipt = {
      ...receipt,
      id: `rcpt-${Date.now()}`,
      receiptNo: getNextReceiptNo(receipts),
      date: new Date().toISOString().split('T')[0],
      status: 'Paid',
    };
    handleSaveReceipt(duplicated);
  };

  // Edit Receipt
  const handleOpenEdit = (receipt: Receipt) => {
    setEditingReceipt(receipt);
    setIsFormOpen(true);
    if (previewReceipt) {
      setPreviewReceipt(null);
    }
  };

  // View Receipt Preview
  const handleViewReceipt = (receipt: Receipt) => {
    setPreviewReceipt(receipt);
  };

  // Filtered Receipts
  const filteredReceipts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return receipts.filter((r) => {
      const matchesSearch =
        !query ||
        r.receiptNo.toLowerCase().includes(query) ||
        r.payerName.toLowerCase().includes(query) ||
        r.subject.toLowerCase().includes(query) ||
        r.receivedBy.toLowerCase().includes(query) ||
        r.authorizedBy.toLowerCase().includes(query) ||
        (r.notes && r.notes.toLowerCase().includes(query));

      const matchesMethod = methodFilter === 'ALL' || r.paymentMethod === methodFilter;
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [receipts, searchQuery, methodFilter, statusFilter]);

  // Financial Stats
  const totalVolume = useMemo(() => {
    return receipts.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [receipts]);

  const cashVolume = useMemo(() => {
    return receipts
      .filter((r) => r.paymentMethod === 'Cash')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [receipts]);

  const digitalVolume = useMemo(() => {
    return receipts
      .filter((r) => r.paymentMethod !== 'Cash')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [receipts]);

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredReceipts.map((r, index) => ({
      'SL': index + 1,
      'Receipt No': r.receiptNo,
      'Date': r.date,
      'Company / Issuer': r.companyName,
      'Payer Name': r.payerName,
      'Subject / Particulars': r.subject,
      'Payment Method': r.paymentMethod,
      'Amount (BDT)': r.amount,
      'Amount in Words': r.amountInWords,
      'Received By': r.receivedBy,
      'Authorized By': r.authorizedBy,
      'Status': r.status,
      'Notes': r.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Money Receipts');
    XLSX.writeFile(wb, `Money_Receipts_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Import from Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (!data || data.length === 0) {
          alert('No data found in Excel sheet.');
          return;
        }

        const currentYear = new Date().getFullYear();
        let maxExisting = 100;
        receipts.forEach((r) => {
          const m = r.receiptNo?.match(/^GMR-(?:\d{4}-)?(\d+)$/i);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (num > maxExisting) maxExisting = num;
          }
        });

        const imported: Receipt[] = data.map((row, idx) => {
          maxExisting++;
          return {
            id: `rcpt-import-${Date.now()}-${idx}`,
            receiptNo: row['Receipt No'] || `GMR-${currentYear}-${maxExisting}`,
            date: row['Date'] || new Date().toISOString().split('T')[0],
            companyName: row['Company / Issuer'] || 'General Money Receipt',
            payerName: row['Payer Name'] || 'Client',
            subject: row['Subject / Particulars'] || 'Transaction',
            paymentMethod: row['Payment Method'] || 'Cash',
            amount: Number(row['Amount (BDT)']) || 0,
            amountInWords: row['Amount in Words'] || '',
            receivedBy: row['Received By'] || 'Md Emon Hossain',
            authorizedBy: row['Authorized By'] || 'Md Shafiqur Rahman',
            status: row['Status'] || 'Paid',
            notes: row['Notes'] || '',
          };
        });

        for (const item of imported) {
          await handleSaveReceipt(item);
        }

        alert(`Successfully imported ${imported.length} money receipts.`);
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import Excel. Please ensure columns match standard format.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ReceiptText className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">Money Receipt Generator</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                  Official Ledger
                </span>
                {syncStatus === 'saving' && (
                  <span className="text-[10px] text-amber-300 font-mono animate-pulse">Saving...</span>
                )}
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Generate, track, and print instant official money receipts with automatic words converter and clean PDF export.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import Excel"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Import</span>
            </button>

            <button
              onClick={handleExportExcel}
              title="Export to Excel (.xlsx)"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export</span>
            </button>

            {canEdit && (
              <button
                onClick={() => {
                  setEditingReceipt(null);
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Money Receipt</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Receipts</span>
              <span className="text-xl font-bold font-mono text-white mt-0.5 block">{receipts.length}</span>
            </div>
            <div className="p-2 bg-slate-700/50 text-slate-300 rounded-lg">
              <ReceiptText className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Amount Received</span>
              <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">{formatCurrency(totalVolume)}</span>
            </div>
            <div className="p-2 bg-emerald-950/40 text-emerald-400 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Cash vs Digital</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-bold text-slate-200">Cash: {formatCurrency(cashVolume)}</span>
                <span className="text-slate-500">•</span>
                <span className="text-xs font-mono font-bold text-cyan-300">Digital: {formatCurrency(digitalVolume)}</span>
              </div>
            </div>
            <div className="p-2 bg-cyan-950/40 text-cyan-400 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and View Mode Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by receipt no, payer name, subject, or staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Methods</option>
            <option value="Cash">Cash</option>
            <option value="Mobile Banking">Mobile Banking</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Check">Check</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Status (Paid / Due)</option>
            <option value="Paid">Paid</option>
            <option value="Due">Due</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              title="Receipt Cards Grid View"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-emerald-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        <ReceiptTable
          receipts={filteredReceipts}
          onView={handleViewReceipt}
          onEdit={handleOpenEdit}
          onDuplicate={handleDuplicateReceipt}
          onDelete={handleDeleteReceipt}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReceipts.length === 0 ? (
            <div className="col-span-2 py-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              No money receipts found matching your criteria.
            </div>
          ) : (
            filteredReceipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                onEdit={handleOpenEdit}
                onDuplicate={handleDuplicateReceipt}
                onDelete={handleDeleteReceipt}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))
          )}
        </div>
      )}

      {/* View / Print / Download Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200">
            <ReceiptCard
              receipt={previewReceipt}
              onEdit={handleOpenEdit}
              onDuplicate={handleDuplicateReceipt}
              onDelete={handleDeleteReceipt}
              onClose={() => setPreviewReceipt(null)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {isFormOpen && (
        <ReceiptForm
          receipt={editingReceipt}
          onSave={handleSaveReceipt}
          onClose={() => {
            setIsFormOpen(false);
            setEditingReceipt(null);
          }}
          currentUserDisplayName={currentUser?.displayName || currentUser?.userId || 'Md Emon Hossain'}
          existingReceipts={receipts}
        />
      )}
    </div>
  );
};

export default MoneyReceiptLedger;

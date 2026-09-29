import React, { useState, useEffect } from 'react';
import { ReturnChallan } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';
import { getLocalCache, setLocalCache, deleteLocalCacheItem } from '../utils/localCache';
import { Plus, Search, FileText, Calendar, Trash2, CheckCircle2, AlertTriangle, Compass, Edit } from 'lucide-react';

interface ReturnChallanDashboardProps {
  onNewForm: () => void;
  onSelectReturnChallan: (rc: ReturnChallan) => void;
  onEditReturnChallan: (rc: ReturnChallan) => void;
  currentUserUid: string;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export default function ReturnChallanDashboard({
  onNewForm,
  onSelectReturnChallan,
  onEditReturnChallan,
  currentUserUid,
  isAdmin = false,
  permissions
}: ReturnChallanDashboardProps) {
  const [challans, setChallans] = useState<ReturnChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('All');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  useEffect(() => {
    const listPath = 'returnChallans';
    try {
      const q = query(collection(db, listPath));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: ReturnChallan[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({
            id: docSnap.id,
            ...docSnap.data()
          } as ReturnChallan);
        });

        // Sort by date desc
        fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setChallans(fetched);
        setLocalCache(listPath, fetched);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, listPath);
        const cached = getLocalCache<ReturnChallan>(listPath);
        if (cached && cached.length > 0) {
          setChallans(cached);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error(err);
      const cached = getLocalCache<ReturnChallan>(listPath);
      if (cached && cached.length > 0) {
        setChallans(cached);
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
    const deletePath = `returnChallans/${docId}`;
    try {
      await deleteDoc(doc(db, 'returnChallans', docId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, deletePath);
    }
    deleteLocalCacheItem('returnChallans', docId);
    setChallans(prev => prev.filter(c => c.id !== docId));
  };

  // Get unique branches for filtering
  const branches = ['All', ...Array.from(new Set(challans.map(c => c.branch).filter(Boolean)))];

  const filtered = challans.filter((rc) => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch =
      (rc.userName || '').toLowerCase().includes(queryLower) ||
      (rc.employeeId || '').toLowerCase().includes(queryLower) ||
      (rc.department || '').toLowerCase().includes(queryLower) ||
      rc.items.some(item => 
        (item.productName || '').toLowerCase().includes(queryLower) ||
        (item.serialNumber || '').toLowerCase().includes(queryLower)
      );

    const matchesBranch = branchFilter === 'All' || rc.branch === branchFilter;

    return matchesSearch && matchesBranch;
  });

  return (
    <div className="py-8 px-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-amber-50 text-amber-600 rounded-full">
              Asset Returns
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Return Challans Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse, inspect, and verify signed IT physical equipment return challans.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={onNewForm}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition duration-150 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Return Challan
          </button>
        )}
      </div>

      {errorText && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Employee Name, Employee ID, Product or Serial Number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 pl-10 pr-4 py-2 text-xs border border-slate-200 focus:border-slate-300 focus:bg-white rounded-lg outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <span className="text-xs font-semibold text-slate-500 hidden md:inline">Branch:</span>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-3 py-2 text-xs rounded-lg outline-none cursor-pointer focus:bg-white focus:border-slate-300 w-full sm:w-40"
          >
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Table View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-amber-600 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 mt-4 font-semibold">Synchronizing Return Documents...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-white border border-slate-200 rounded-3xl p-6">
          <Compass className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-900">No records found</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
            Try adjusting your words inside the search input or branch dropdown list filters, or construct a new return verification sheet.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID & Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Returned By</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department & Branch</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items Summary</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signature Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((rc) => {
                  const itemsCount = rc.items.filter(i => i.productName.trim() !== '').length;
                  return (
                    <tr 
                      key={rc.id}
                      onClick={() => onSelectReturnChallan(rc)}
                      className="group hover:bg-amber-50/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-bold text-slate-400">#{rc.id.substring(4, 11)}</span>
                          <span className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {rc.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-extrabold text-slate-900 group-hover:text-amber-600 transition truncate uppercase">
                            {rc.userName || 'Unknown Employee'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider uppercase">
                            ID: {rc.employeeId || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase">
                          <div className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-slate-500 whitespace-nowrap">
                            {rc.branch}
                          </div>
                          <span className="truncate max-w-[120px]">{rc.department}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {rc.items.filter(i => i.productName.trim() !== '').slice(0, 3).map((item, idx) => (
                              <div 
                                key={idx} 
                                title={item.productName}
                                className="w-6 h-6 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-amber-600"
                              >
                                {item.productName.charAt(0)}
                              </div>
                            ))}
                          </div>
                          <span className="text-[11px] font-bold text-slate-500">
                            {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {rc.returnedBySignature?.signed ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 w-fit">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              RET. SIGNED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 w-fit">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              RET. PENDING
                            </span>
                          )}
                          {rc.receivedBySignature?.signed ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 w-fit">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              REC. SIGNED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-700 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 w-fit">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              REC. PENDING
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditReturnChallan(rc); }}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-55 border border-transparent hover:border-amber-100 rounded-lg transition"
                            title="Edit return challan record"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => handleDeleteButtonClick(e, rc.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition"
                            title="Remove return challan record"
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

      {/* --- DELETE CONFIRM MODAL --- */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Delete Return Challan Record?
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              Are you confident you want to delete this Return Challan record from the main database directories? This action cannot be revoked.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 border-t border-slate-100 pt-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                No, Keep Card
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
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

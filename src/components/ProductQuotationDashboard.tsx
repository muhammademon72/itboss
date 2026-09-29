import React, { useState, useEffect } from 'react';
import { ProductQuotation } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { Plus, Search, FileText, Calendar, Trash2, Copy, Eye, Edit2 } from 'lucide-react';

interface ProductQuotationDashboardProps {
  onNewForm: () => void;
  onEditQuotation: (quo: ProductQuotation) => void;
  onViewQuotation: (quo: ProductQuotation) => void;
  onCopyQuotation: (quo: ProductQuotation) => void;
  currentUserUid: string;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export default function ProductQuotationDashboard({
  onNewForm,
  onEditQuotation,
  onViewQuotation,
  onCopyQuotation,
  currentUserUid,
  isAdmin = false,
  permissions
}: ProductQuotationDashboardProps) {
  const [quotations, setQuotations] = useState<ProductQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  useEffect(() => {
    const listPath = 'quotations';
    const q = query(collection(db, listPath), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: ProductQuotation[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as ProductQuotation);
      });

      const deletedItems = getLocalCache<{id: string}>('deleted_quotations_ids') || [];
      const deletedSet = new Set(deletedItems.map(d => d.id));

      const cached = getLocalCache<ProductQuotation>(listPath) || [];
      const combinedMap = new Map<string, ProductQuotation>();

      cached.forEach(q => { if (q && q.id && !deletedSet.has(q.id)) combinedMap.set(q.id, q); });
      fetched.forEach(q => { if (q && q.id && !deletedSet.has(q.id)) combinedMap.set(q.id, q); });

      const finalData = Array.from(combinedMap.values());
      finalData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setQuotations(finalData);
      setLocalCache(listPath, finalData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, listPath);
      const deletedItems = getLocalCache<{id: string}>('deleted_quotations_ids') || [];
      const deletedSet = new Set(deletedItems.map(d => d.id));
      const cached = getLocalCache<ProductQuotation>(listPath) || [];
      setQuotations(cached.filter(q => q && q.id && !deletedSet.has(q.id)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteButtonClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const docId = deleteConfirmId;
    setDeleteConfirmId(null);

    // 1. Mark deleted in cache & update local state immediately
    saveLocalCacheItem('deleted_quotations_ids', { id: docId });
    deleteLocalCacheItem('quotations', docId);
    setQuotations(prev => prev.filter(q => q.id !== docId));

    // 2. Non-blocking Firestore delete
    deleteDoc(doc(db, 'quotations', docId)).catch((err) => {
      console.warn('Firestore quotation delete failed/skipped:', err);
    });
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Product Quotations</h1>
        {canEdit && (
          <button onClick={onNewForm} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">
            <Plus className="h-4 w-4" /> New Quotation
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-2">Quotation No</th>
                <th className="px-4 py-2">Client Company</th>
                <th className="px-4 py-2">Total Amount</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotations.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-indigo-600 font-semibold">{q.quotationNumber}</td>
                  <td className="px-4 py-2">{q.clientCompany}</td>
                  <td className="px-4 py-2">{q.totalAmount?.toLocaleString()} Taka</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-center items-center gap-1">
                      {canEdit && (
                        <button 
                          type="button"
                          onClick={() => onCopyQuotation(q)} 
                          title="Copy Quotation"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={() => onViewQuotation(q)} 
                        title="View Quotation"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button 
                          type="button"
                          onClick={() => onEditQuotation(q)} 
                          title="Edit Quotation"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          type="button"
                          onClick={(e) => handleDeleteButtonClick(e, q.id)} 
                          title="Delete Quotation"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Delete Quotation?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">
              Are you sure you want to permanently delete this quotation record? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-250 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg border border-rose-700 shadow-sm transition cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

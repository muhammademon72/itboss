import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { getLocalCache, saveLocalCacheItem, deleteLocalCacheItem, setLocalCache } from '../utils/localCache';
import { Trash2, Pencil, Eye, X } from 'lucide-react';

export default function CustomerInfo() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [formData, setFormData] = useState({ company: '', address: '', contact: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(docs);
      setLocalCache('customers', docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
      const cached = getLocalCache<any>('customers');
      if (cached && cached.length > 0) {
        setCustomers(cached);
      }
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const id = editingId || `cust_${Date.now()}`;
    const payload = { id, ...formData };

    try {
      await setDoc(doc(db, 'customers', id), formData);
      saveLocalCacheItem('customers', payload);
      alert(editingId ? 'Customer updated successfully!' : 'Customer saved successfully!');
    } catch (error: any) {
      saveLocalCacheItem('customers', payload);
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'customers');
      alert('Customer saved locally!');
    } finally {
      setCustomers(getLocalCache<any>('customers'));
      setFormData({ company: '', address: '', contact: '', email: '' });
      setEditingId(null);
      setIsSaving(false);
    }
  };

  const handleEdit = (customer: any) => {
    setFormData({
      company: customer.company || '',
      address: customer.address || '',
      contact: customer.contact || '',
      email: customer.email || ''
    });
    setEditingId(customer.id);
    setViewingCustomer(null);
  };

  const handleCancelEdit = () => {
    setFormData({ company: '', address: '', contact: '', email: '' });
    setEditingId(null);
  };

  const handleDeleteButtonClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const docId = deleteConfirmId;
    setDeleteConfirmId(null);
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'customers', docId));
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'customers');
    } finally {
      deleteLocalCacheItem('customers', docId);
      setCustomers(getLocalCache<any>('customers'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto text-slate-800">
      <h2 className="text-2xl font-bold mb-6">Customer Info</h2>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h3 className="font-semibold mb-4">{editingId ? 'Edit Customer' : 'Add New Customer'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <input className="border p-2 text-sm w-full rounded" placeholder="Company Name" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required />
          </div>
          <div className="col-span-2">
            <input className="border p-2 text-sm w-full rounded" placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
          </div>
          <input className="border p-2 text-sm rounded" placeholder="Contact" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} required />
          <input className="border p-2 text-sm rounded" placeholder="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <div className="col-span-2 flex justify-end gap-2">
            {editingId && (
              <button disabled={isSaving} type="button" onClick={handleCancelEdit} className="px-4 py-2 rounded text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            )}
            <button disabled={isSaving} type="submit" className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${isSaving ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
              {isSaving ? "Saving..." : (editingId ? "Update Customer Info" : "Save Customer Info")}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 border-b">Company</th>
              <th className="p-3 border-b">Contact</th>
              <th className="p-3 border-b text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map(c => (
              <tr key={c.id}>
                <td className="p-3">{c.company}</td>
                <td className="p-3">
                  <div>{c.contact}</div>
                  <div className="text-xs text-slate-500">{c.email}</div>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => setViewingCustomer(c)} className="text-indigo-500 hover:text-indigo-700" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEdit(c)} className="text-slate-500 hover:text-slate-700" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteButtonClick(c.id)} className="text-red-500 hover:text-red-700" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-slate-500">No customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewingCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="border-b px-6 py-4 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Customer Details</h3>
              <button onClick={() => setViewingCustomer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Name</label>
                <div className="text-slate-800 font-medium">{viewingCustomer.company}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</label>
                <div className="text-slate-800">{viewingCustomer.address || '-'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</label>
                  <div className="text-slate-800">{viewingCustomer.contact || '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
                  <div className="text-slate-800">{viewingCustomer.email || '-'}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t flex justify-end">
              <button 
                onClick={() => setViewingCustomer(null)}
                className="px-4 py-2 bg-white border rounded text-sm font-semibold hover:bg-slate-50 transition-colors"
               >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Delete Customer?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to permanently delete this customer info? This action cannot be undone.
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

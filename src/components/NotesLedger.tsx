import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { NotesLedgerEntry } from '../types';
import { Plus, Search, Trash2, Edit2, BookOpen, X, Check, Save, Eye } from 'lucide-react';

interface NotesLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export const NotesLedger: React.FC<NotesLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  const [entries, setEntries] = useState<NotesLedgerEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NotesLedgerEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<NotesLedgerEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('notes_categories');
    return saved ? JSON.parse(saved) : ['Meetings', 'Ideas', 'Reference'];
  });
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    localStorage.setItem('notes_categories', JSON.stringify(categories));
  }, [categories]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories([...categories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };
  
  const handleDeleteCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
  };
  
  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    notebook: ''
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'notes_ledger'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: NotesLedgerEntry[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as NotesLedgerEntry);
      });
      setEntries(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notes ledger:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (entry?: NotesLedgerEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        category: entry.category,
        subject: entry.subject,
        notebook: entry.notebook
      });
    } else {
      setEditingEntry(null);
      setFormData({ category: '', subject: '', notebook: '' });
    }
    setViewingEntry(null);
    setIsModalOpen(true);
  };

  const handleViewModal = (entry: NotesLedgerEntry) => {
    setViewingEntry(entry);
    setEditingEntry(null);
    setFormData({
      category: entry.category,
      subject: entry.subject,
      notebook: entry.notebook
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setViewingEntry(null);
    setFormData({ category: '', subject: '', notebook: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        const docRef = doc(db, 'notes_ledger', editingEntry.id);
        await updateDoc(docRef, {
          category: formData.category,
          subject: formData.subject,
          notebook: formData.notebook,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'notes_ledger'), {
          category: formData.category,
          subject: formData.subject,
          notebook: formData.notebook,
          createdBy: currentUser.uid,
          createdByEmail: currentUser.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      handleCloseModal();
    } catch (error) {
      handleFirestoreError(error, editingEntry ? 'update' as any : 'create' as any, 'notes_ledger');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes_ledger', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, 'delete' as any, `notes_ledger/${id}`);
    }
  };

  const filteredEntries = entries.filter(entry => 
    entry.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.notebook.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="p-6 text-center text-slate-500 flex items-center justify-center h-full">Loading notes...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Note Book Ledger</h1>
              <p className="text-sm text-slate-500">Manage your categories, subjects and notebooks</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 w-64"
              />
            </div>
            {canEdit && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3 font-semibold w-[20%]">Ledger Category</th>
                  <th className="px-6 py-3 font-semibold w-[25%]">Subject</th>
                  <th className="px-6 py-3 font-semibold w-[40%]">Notebook</th>
                  <th className="px-6 py-3 font-semibold w-[15%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No notes found. Create a new entry to get started.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 align-top">
                        <span className="font-medium text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md text-xs border border-slate-200 inline-block max-w-full truncate">
                          {entry.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top font-medium text-slate-700 break-words whitespace-pre-wrap">
                        {entry.subject}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="whitespace-pre-wrap break-words text-slate-600 text-sm max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {entry.notebook}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleViewModal(entry)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenModal(entry)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmId(entry.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {viewingEntry ? 'View Note' : editingEntry ? 'Edit Note' : 'Add New Note'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Ledger Category
                  </label>
                  {!viewingEntry && (
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Manage Categories
                    </button>
                  )}
                </div>
                {viewingEntry ? (
                  <input
                    type="text"
                    readOnly
                    value={formData.category}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden bg-slate-50 text-slate-600"
                  />
                ) : (
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden bg-white"
                  >
                    <option value="" disabled>Select a Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  readOnly={!!viewingEntry}
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Subject of the note"
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden ${viewingEntry ? 'bg-slate-50 text-slate-600' : ''}`}
                />
              </div>
              
              <div className="flex-1 flex flex-col h-full min-h-[250px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notebook (Content)
                </label>
                <textarea
                  required
                  readOnly={!!viewingEntry}
                  value={formData.notebook}
                  onChange={(e) => setFormData({ ...formData, notebook: e.target.value })}
                  placeholder="Write your notes here..."
                  className={`w-full flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden resize-none min-h-[200px] break-words whitespace-pre-wrap custom-scrollbar ${viewingEntry ? 'bg-slate-50 text-slate-600' : ''}`}
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 mt-auto">
                {viewingEntry ? (
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors"
                  >
                    Close
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingEntry ? 'Update Note' : 'Save Note'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Manage Categories</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Add
                </button>
              </form>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No categories added yet.</p>
              ) : (
                <ul className="space-y-2">
                  {categories.map((cat) => (
                    <li key={cat} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-sm font-medium text-slate-700">{cat}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Note</h3>
              <p className="text-sm text-slate-600">Are you sure you want to delete this note? This action cannot be undone.</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
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

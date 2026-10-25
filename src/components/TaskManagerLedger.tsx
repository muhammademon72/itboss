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
import { db, handleFirestoreError } from '../firebase';
import { getLocalCache, setLocalCache } from '../utils/localCache';
import { LedgerPermissions, TaskRecord } from '../types';
import {
  Plus, Search, Trash2, Edit2, ClipboardList
} from 'lucide-react';

interface TaskManagerLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: LedgerPermissions;
}

const LOCAL_STORAGE_KEY = 'task_manager_ledger_records';

export const TaskManagerLedger: React.FC<TaskManagerLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  const [records, setRecords] = useState<TaskRecord[]>(() => {
    const cached = getLocalCache<TaskRecord>(LOCAL_STORAGE_KEY);
    return cached || [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TaskRecord | null>(null);
  
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Pending' | 'In Progress' | 'Completed' | 'Cancelled'>('Pending');

  useEffect(() => {
    const q = query(collection(db, 'task_manager_records'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskRecord));
      setRecords(data);
      setLocalCache(LOCAL_STORAGE_KEY, data);
    }, (error) => handleFirestoreError(error));
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        await updateDoc(doc(db, 'task_manager_records', editingRecord.id), {
          subject, description, status, updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'task_manager_records'), {
          subject, description, status, createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error);
    }
  };

  const deleteRecord = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteDoc(doc(db, 'task_manager_records', id));
      } catch (error) {
        handleFirestoreError(error);
      }
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
    setSubject('');
    setDescription('');
    setStatus('Pending');
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="text-indigo-600" /> Task Manager
        </h1>
        {canEdit && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> New Task
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRecords.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{r.subject}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{r.description}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    r.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    r.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                    r.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {canEdit && (
                    <button onClick={() => { setEditingRecord(r); setSubject(r.subject); setDescription(r.description); setStatus(r.status); setIsFormOpen(true); }} className="text-indigo-600 hover:text-indigo-900 mr-3">
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => deleteRecord(r.id)} className="text-red-600 hover:text-red-900">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">{editingRecord ? 'Edit Task' : 'New Task'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input required value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full p-2 border border-slate-300 rounded-lg">
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:text-slate-900">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

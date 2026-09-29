import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, Plus, Save, X, Settings } from 'lucide-react';

interface ManageSystemProps {
  onClose: () => void;
  category: 'ISP' | 'Location' | 'Package' | 'Bandwidth';
  onUpdate: () => void;
}

interface ManageOption {
  id: string;
  category: string;
  value: string;
}

export const ManageSystemModal: React.FC<ManageSystemProps> = ({ onClose, category, onUpdate }) => {
  const [options, setOptions] = useState<ManageOption[]>([]);
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'manage_system_options'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ManageOption[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ManageOption);
      });
      setOptions(list);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    await addDoc(collection(db, 'manage_system_options'), {
      category: category,
      value: newValue.trim(),
      createdAt: serverTimestamp()
    });
    setNewValue('');
    onUpdate();
  };

  const handleUpdate = async (id: string) => {
    if (!editValue.trim()) return;
    await updateDoc(doc(db, 'manage_system_options', id), { value: editValue });
    setEditingId(null);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'manage_system_options', id));
    onUpdate();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Manage {category}s</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex gap-2 mb-4">
          <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg" placeholder={`Add new ${category}...`} />
          <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg"><Plus className="w-4 h-4"/></button>
        </div>

        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {options.filter(o => o.category === category).map(opt => (
            <li key={opt.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
              {editingId === opt.id ? (
                <input value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 px-2 border rounded" />
              ) : <span>{opt.value}</span>}
              <div className="flex gap-1">
                {editingId === opt.id ? (
                  <button onClick={() => handleUpdate(opt.id)} className="text-green-600"><Save className="w-4 h-4"/></button>
                ) : (
                  <button onClick={() => { setEditingId(opt.id); setEditValue(opt.value); }} className="text-blue-600"><Settings className="w-4 h-4"/></button>
                )}
                <button onClick={() => handleDelete(opt.id)} className="text-rose-600"><Trash2 className="w-4 h-4"/></button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

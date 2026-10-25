import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, Save, X, Settings } from 'lucide-react';

interface ManageSystemProps {
  collectionName: string;
  title: string;
}

export const ManageSystem: React.FC<ManageSystemProps> = ({ collectionName, title }) => {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: { id: string; name: string }[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as { id: string; name: string });
      });
      setItems(fetched.sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => unsubscribe();
  }, [collectionName]);

  const handleSave = async () => {
    if (!inputValue.trim()) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, collectionName, editingId), { name: inputValue });
      } else {
        await addDoc(collection(db, collectionName), { name: inputValue });
      }
      setInputValue('');
      setEditingId(null);
    } catch (err) {
      console.error('Error saving:', err);
    }
  };

  const handleDelete = async (id: string) => {
    console.log("Delete clicked for id:", id, "in collection:", collectionName);
    try {
      await deleteDoc(doc(db, collectionName, id));
      console.log("Successfully deleted id:", id);
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete.');
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800">
        <Settings size={16} /> {title}
      </h3>
      <div className="flex gap-2 mb-3">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Add new ${title.toLowerCase()}`}
          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
        />
        <button onClick={handleSave} className="bg-indigo-600 text-white p-1.5 rounded-lg">
          {editingId ? <Save size={16} /> : <Plus size={16} />}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-md text-xs">
            <span>{item.name}</span>
            <button type="button" onClick={() => { setEditingId(item.id); setInputValue(item.name); }}><Edit2 size={12} /></button>
            <button type="button" onClick={() => handleDelete(item.id)} className="text-red-500"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

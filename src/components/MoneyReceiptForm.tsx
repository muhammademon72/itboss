import React, { useState, useEffect } from 'react';
import { Save, Printer, ArrowLeft } from 'lucide-react';
import { MoneyReceipt } from '../types';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface MoneyReceiptFormProps {
  onClose: () => void;
  initialData?: MoneyReceipt;
  onSave?: (data: MoneyReceipt) => void;
}

export const MoneyReceiptForm: React.FC<MoneyReceiptFormProps> = ({ onClose, initialData, onSave }) => {
  const [formData, setFormData] = useState<MoneyReceipt>(initialData || {
    id: crypto.randomUUID(),
    no: '',
    date: new Date().toISOString().split('T')[0],
    receivedFrom: '',
    amount: 0,
    amountInWords: '',
    for: '',
    branch: '',
    acct: '',
    paid: 0,
    due: 0,
    receivedBy: '',
    authorizedSignature: { signed: false },
    createdBy: '',
    createdByEmail: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'amount' || name === 'paid' || name === 'due' ? Number(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'moneyReceipts', formData.id), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      if (onSave) onSave(formData);
      onClose();
    } catch (error) {
      console.error("Error saving money receipt:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Money Receipt</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input name="no" placeholder="No" value={formData.no} onChange={handleChange} className="p-2 border rounded" />
            <input name="date" type="date" value={formData.date} onChange={handleChange} className="p-2 border rounded" />
          </div>
          <input name="receivedFrom" placeholder="Received with thanks from" value={formData.receivedFrom} onChange={handleChange} className="w-full p-2 border rounded" />
          <div className="grid grid-cols-2 gap-4">
            <input name="amount" type="number" placeholder="Amount" value={formData.amount} onChange={handleChange} className="p-2 border rounded" />
            <input name="amountInWords" placeholder="In word" value={formData.amountInWords} onChange={handleChange} className="p-2 border rounded" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input name="for" placeholder="For" value={formData.for} onChange={handleChange} className="p-2 border rounded" />
            <input name="branch" placeholder="Branch" value={formData.branch} onChange={handleChange} className="p-2 border rounded" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <input name="acct" placeholder="ACCT." value={formData.acct} onChange={handleChange} className="p-2 border rounded" />
            <input name="paid" type="number" placeholder="PAID" value={formData.paid} onChange={handleChange} className="p-2 border rounded" />
            <input name="due" type="number" placeholder="DUE" value={formData.due} onChange={handleChange} className="p-2 border rounded" />
          </div>
          <input name="receivedBy" placeholder="Received by" value={formData.receivedBy} onChange={handleChange} className="w-full p-2 border rounded" />
          <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
            <Save className="w-5 h-5" /> Save Money Receipt
          </button>
        </form>
      </div>
    </div>
  );
};

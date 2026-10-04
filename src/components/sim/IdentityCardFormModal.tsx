import React, { useState } from 'react';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { IdentityCardInfo } from '../../types';
import { X } from 'lucide-react';

interface IdentityCardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextSl: number;
  initialData?: Partial<IdentityCardInfo>;
}

export const IdentityCardFormModal: React.FC<IdentityCardFormModalProps> = ({ isOpen, onClose, nextSl, initialData }) => {
  const [formData, setFormData] = useState<Partial<IdentityCardInfo>>(
    initialData || {
      sl: nextSl,
      status: 'Active'
    }
  );

  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData?.id) {
        await updateDoc(doc(db, 'identityCardInfo', initialData.id), formData);
      } else {
        await addDoc(collection(db, 'identityCardInfo'), formData);
      }
      onClose();
    } catch (err) {
      console.error('Error saving record:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Identity Card Info</h2>
          <button onClick={onClose}><X /></button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <input type="text" placeholder="Branch Code" className="border p-2 rounded" onChange={(e) => setFormData({...formData, branchCode: e.target.value})} required />
          <input type="text" placeholder="Employee ID" className="border p-2 rounded" onChange={(e) => setFormData({...formData, employeeId: e.target.value})} required />
          <input type="text" placeholder="Employee Name" className="col-span-2 border p-2 rounded" onChange={(e) => setFormData({...formData, employeeName: e.target.value})} required />
          <input type="text" placeholder="Designation" className="border p-2 rounded" onChange={(e) => setFormData({...formData, designation: e.target.value})} required />
          <input type="text" placeholder="Department" className="border p-2 rounded" onChange={(e) => setFormData({...formData, department: e.target.value})} required />
          <input type="date" placeholder="Joining Date" className="border p-2 rounded" onChange={(e) => setFormData({...formData, joiningDate: e.target.value})} required />
          <input type="date" placeholder="DOB" className="border p-2 rounded" onChange={(e) => setFormData({...formData, dob: e.target.value})} required />
          <input type="text" placeholder="Blood Group" className="border p-2 rounded" onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})} required />
          <input type="text" placeholder="Proximity Card" className="border p-2 rounded" onChange={(e) => setFormData({...formData, proximityCardNumber: e.target.value})} />
          <select className="col-span-2 border p-2 rounded" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button type="submit" className="col-span-2 bg-indigo-600 text-white p-2 rounded font-bold hover:bg-indigo-700">Save</button>
        </form>
      </div>
    </div>
  );
};

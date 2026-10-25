import React, { useState, useEffect } from 'react';
import { addDoc, collection, updateDoc, doc, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { IdentityCardInfo } from '../../types';
import { X } from 'lucide-react';

interface IdentityCardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextSl: number;
  initialData?: Partial<IdentityCardInfo>;
  existingRecords: IdentityCardInfo[];
}

export const IdentityCardFormModal: React.FC<IdentityCardFormModalProps> = ({ isOpen, onClose, nextSl, initialData, existingRecords }) => {
  const [formData, setFormData] = useState<Partial<IdentityCardInfo>>(
    initialData || {
      sl: nextSl,
      status: 'Active'
    }
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setFormData(
      initialData || {
        sl: nextSl,
        status: 'Active'
      }
    );
    setErrorMsg('');
  }, [initialData, isOpen, nextSl]);

  const [options, setOptions] = useState<{
    branchCodes: string[];
    designations: string[];
    departments: string[];
    bloodGroups: string[];
    statuses: string[];
  }>({
    branchCodes: [],
    designations: [],
    departments: [],
    bloodGroups: [],
    statuses: []
  });

  useEffect(() => {
    const fetchOptions = (coll: string, key: keyof typeof options) => {
      const q = query(collection(db, coll));
      return onSnapshot(q, (snapshot) => {
        setOptions(prev => ({
          ...prev,
          [key]: snapshot.docs.map(doc => doc.data().name).sort()
        }));
      });
    };
    const unsub1 = fetchOptions('branchCodes', 'branchCodes');
    const unsub2 = fetchOptions('designations', 'designations');
    const unsub3 = fetchOptions('departments', 'departments');
    const unsub4 = fetchOptions('bloodGroups', 'bloodGroups');
    const unsub5 = fetchOptions('employeeStatuses', 'statuses');
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const duplicate = existingRecords.find(r => 
      r.employeeId?.trim().toLowerCase() === formData.employeeId?.trim().toLowerCase() &&
      r.id !== initialData?.id
    );

    if (duplicate) {
      setErrorMsg(`Employee ID "${formData.employeeId}" already exists! Please use a unique ID.`);
      return;
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-slate-800">{initialData?.id ? 'Edit Identity Card Info' : 'Add Identity Card Info'}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><X /></button>
        </div>
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm font-medium rounded-lg">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Code</label>
            <select value={formData.branchCode || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, branchCode: e.target.value})} required>
              <option value="">Select Branch</option>
              {options.branchCodes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Employee ID</label>
            <input type="text" value={formData.employeeId || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, employeeId: e.target.value})} required />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Employee Name</label>
            <input type="text" value={formData.employeeName || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, employeeName: e.target.value})} required />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
            <select value={formData.designation || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, designation: e.target.value})} required>
              <option value="">Select Designation</option>
              {options.designations.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
            <select value={formData.department || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, department: e.target.value})} required>
              <option value="">Select Department</option>
              {options.departments.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Joining Date</label>
            <input type="date" value={formData.joiningDate || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, joiningDate: e.target.value})} required />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Blood Group</label>
            <select value={formData.bloodGroup || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})} required>
              <option value="">Select Blood Group</option>
              {options.bloodGroups.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Proximity Card</label>
            <input type="text" value={formData.proximityCardNumber || ''} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setFormData({...formData, proximityCardNumber: e.target.value})} />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Photo Attach</label>
            <input type="file" className="w-full border border-slate-300 p-2 rounded-lg text-xs" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => setFormData({...formData, photoUrl: reader.result as string});
                reader.readAsDataURL(file);
              }
            }} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}>
              {options.statuses.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <button type="submit" className="col-span-2 bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition duration-200 mt-2">Save Record</button>
        </form>
      </div>
    </div>
  );
};

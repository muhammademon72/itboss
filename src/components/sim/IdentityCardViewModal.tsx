import React from 'react';
import { IdentityCardInfo } from '../../types';
import { X } from 'lucide-react';

interface IdentityCardViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: IdentityCardInfo | null;
}

export const IdentityCardViewModal: React.FC<IdentityCardViewModalProps> = ({ isOpen, onClose, record }) => {
  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Identity Card Details</h2>
          <button onClick={onClose}><X /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="border p-2 rounded bg-slate-50"><strong>Branch Code:</strong> {record.branchCode}</div>
          <div className="border p-2 rounded bg-slate-50"><strong>Employee ID:</strong> {record.employeeId}</div>
          <div className="col-span-2 border p-2 rounded bg-slate-50"><strong>Name:</strong> {record.employeeName}</div>
          <div className="border p-2 rounded bg-slate-50"><strong>Designation:</strong> {record.designation}</div>
          <div className="border p-2 rounded bg-slate-50"><strong>Department:</strong> {record.department}</div>
          <div className="border p-2 rounded bg-slate-50"><strong>Joining:</strong> {record.joiningDate}</div>
          <div className="border p-2 rounded bg-slate-50"><strong>DOB:</strong> {record.dob}</div>
          <div className="border p-2 rounded bg-slate-50"><strong>Blood Group:</strong> {record.bloodGroup}</div>
          <div className="border p-2 rounded bg-slate-50"><strong>Proximity Card:</strong> {record.proximityCardNumber}</div>
          <div className="col-span-2 border p-2 rounded bg-slate-50"><strong>Status:</strong> {record.status}</div>
        </div>
        <button onClick={onClose} className="w-full mt-6 bg-slate-600 text-white p-2 rounded font-bold hover:bg-slate-700">Close</button>
      </div>
    </div>
  );
};

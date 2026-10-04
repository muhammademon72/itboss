import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { IdentityCardInfo } from '../types';
import { Plus, User, Eye, Edit2, Trash2 } from 'lucide-react';
import { IdentityCardFormModal } from './sim/IdentityCardFormModal';

interface IdentityCardInfoLedgerProps {
  currentUserUid: string;
  isAdmin: boolean;
}

export default function IdentityCardInfoLedger({ currentUserUid, isAdmin }: IdentityCardInfoLedgerProps) {
  const [records, setRecords] = useState<IdentityCardInfo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IdentityCardInfo | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'identityCardInfo'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: IdentityCardInfo[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as IdentityCardInfo);
      });
      setRecords(fetched.sort((a, b) => a.sl - b.sl));
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (record: IdentityCardInfo) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleView = (record: IdentityCardInfo) => {
    alert(`Name: ${record.employeeName}\nID: ${record.employeeId}\nDept: ${record.department}\nStatus: ${record.status}`);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await deleteDoc(doc(db, 'identityCardInfo', id));
      } catch (err) {
        console.error('Error deleting record:', err);
        alert('Failed to delete record.');
      }
    }
  };

  const nextSl = records.length > 0 ? Math.max(...records.map(r => r.sl)) + 1 : 1;

  return (
    <div className="p-8 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <User className="w-8 h-8 text-indigo-600" />
          Identity Card Info Ledger
        </h1>
        <button
          onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
            <tr>
              <th className="px-3 py-4 whitespace-nowrap">SN</th>
              <th className="px-3 py-4 whitespace-nowrap">Branch Code</th>
              <th className="px-3 py-4 whitespace-nowrap">Employee Name</th>
              <th className="px-3 py-4 whitespace-nowrap">Designation</th>
              <th className="px-3 py-4 whitespace-nowrap">Department</th>
              <th className="px-3 py-4 whitespace-nowrap">Employee ID</th>
              <th className="px-3 py-4 whitespace-nowrap">Joining Date</th>
              <th className="px-3 py-4 whitespace-nowrap">Blood Group</th>
              <th className="px-3 py-4 whitespace-nowrap">Date of Birth</th>
              <th className="px-3 py-4 whitespace-nowrap">Proximity Card</th>
              <th className="px-3 py-4 whitespace-nowrap">Status</th>
              <th className="px-3 py-4 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-4 whitespace-nowrap">{r.sl}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.branchCode}</td>
                <td className="px-3 py-4 font-medium whitespace-nowrap">{r.employeeName}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.designation}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.department}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.employeeId}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.joiningDate}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.bloodGroup}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.dob}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.proximityCardNumber}</td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button 
                      className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50" 
                      title="View"
                      onClick={() => handleView(r)}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      className="text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50" 
                      title="Edit"
                      onClick={() => handleEdit(r)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" 
                      title="Delete"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <IdentityCardFormModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedRecord(null); }} 
        nextSl={nextSl} 
        initialData={selectedRecord || undefined} 
      />
    </div>
  );
}

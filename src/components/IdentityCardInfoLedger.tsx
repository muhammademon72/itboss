import React, { useState, useEffect, useRef } from 'react';
import { Plus, User, Eye, Edit2, Trash2, Settings, X, Camera, FileSpreadsheet, Upload, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { addDoc, collection, onSnapshot, deleteDoc, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '../firebase';
import { IdentityCardFormModal } from './sim/IdentityCardFormModal';
import { IdentityCardViewModal } from './sim/IdentityCardViewModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ManageSystem } from './ManageSystem';

interface IdentityCardInfoLedgerProps {
  currentUserUid: string;
  isAdmin: boolean;
}

export default function IdentityCardInfoLedger({ currentUserUid, isAdmin }: IdentityCardInfoLedgerProps) {
  const [records, setRecords] = useState<IdentityCardInfo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IdentityCardInfo | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const filteredRecords = records.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      (r.employeeName || '').toLowerCase().includes(term) ||
      (r.employeeId || '').toLowerCase().includes(term) ||
      (r.branchCode || '').toLowerCase().includes(term) ||
      (r.designation || '').toLowerCase().includes(term) ||
      (r.department || '').toLowerCase().includes(term)
    );
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRecordId) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, 'identityCardInfo', selectedRecordId), { photoUrl: base64String });
      } catch (err) {
        console.error('Error uploading photo:', err);
        alert('Failed to upload photo.');
      }
    };
    reader.readAsDataURL(file);
  };

  const formatDateForExport = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const formatDateForImport = (dateStr?: string) => {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return str;
  };

  const handleExport = () => {
    const dataToExport = selectedRowIds.length > 0 
      ? records.filter(r => selectedRowIds.includes(r.id))
      : records;

    const exportData = dataToExport.map((r, index) => ({
      'SL': index + 1,
      'Branch Code': r.branchCode || '',
      'Employee ID': r.employeeId || '',
      'Employee Name': r.employeeName || '',
      'Designation': r.designation || '',
      'Department': r.department || '',
      'Joining Date': formatDateForExport(r.joiningDate),
      'Blood Group': r.bloodGroup || '',
      'Proximity Card': r.proximityCardNumber || '',
      'Status': r.status || 'Active'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Identity Cards');
    XLSX.writeFile(wb, `Identity_Card_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        let count = 0;
        for (const item of json) {
          const rawDate = item['Joining Date'] || item['joiningDate'] || '';
          const newRecord = {
            sl: records.length + count + 1,
            branchCode: item['Branch Code'] || item['branchCode'] || '',
            employeeId: item['Employee ID'] || item['employeeId'] || '',
            employeeName: item['Employee Name'] || item['employeeName'] || '',
            designation: item['Designation'] || item['designation'] || '',
            department: item['Department'] || item['department'] || '',
            joiningDate: formatDateForImport(rawDate),
            bloodGroup: item['Blood Group'] || item['bloodGroup'] || '',
            proximityCardNumber: item['Proximity Card'] || item['proximityCardNumber'] || '',
            status: item['Status'] || item['status'] || 'Active'
          };
          if (newRecord.employeeName) {
            await addDoc(collection(db, 'identityCardInfo'), newRecord);
            count++;
          }
        }
        alert(`Successfully imported ${count} records!`);
      } catch (err) {
        console.error('Import error:', err);
        alert('Failed to import file. Please check format.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

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
    setSelectedRecord(record);
    setIsViewModalOpen(true);
  };

  const handleDelete = (record: IdentityCardInfo) => {
    setSelectedRecord(record);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedRecord) {
      try {
        await deleteDoc(doc(db, 'identityCardInfo', selectedRecord.id));
        setIsDeleteModalOpen(false);
        setSelectedRecord(null);
      } catch (err) {
        console.error('Error deleting record:', err);
        alert('Failed to delete record.');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedRowIds.length} selected records?`)) {
      try {
        for (const id of selectedRowIds) {
          await deleteDoc(doc(db, 'identityCardInfo', id));
        }
        setSelectedRowIds([]);
      } catch (err) {
        console.error('Error bulk deleting:', err);
        alert('Failed to delete selected records.');
      }
    }
  };

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);


  const nextSl = records.length > 0 ? Math.max(...records.map(r => r.sl)) + 1 : 1;

  return (
    <div className="p-8 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <User className="w-8 h-8 text-indigo-600" />
          Identity Card Info Ledger
        </h1>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64 shadow-xs"
            />
          </div>
          {selectedRowIds.length > 0 && (
            <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-rose-200">
              <Trash2 className="w-4 h-4" /> Delete ({selectedRowIds.length})
            </button>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-200">
            <FileSpreadsheet className="w-4 h-4" /> Export
          </button>
          <input type="file" ref={importInputRef} onChange={handleImport} className="hidden" accept=".xlsx, .xls" />
          <button onClick={() => importInputRef.current?.click()} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-200">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
            onClick={() => setIsManageModalOpen(true)}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-200"
          >
            <Settings className="w-4 h-4" />
            Manage System
          </button>
          <button
            onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
            <tr>
              <th className="px-3 py-4 whitespace-nowrap">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRowIds(filteredRecords.map(r => r.id));
                    } else {
                      setSelectedRowIds([]);
                    }
                  }}
                  checked={filteredRecords.length > 0 && selectedRowIds.length === filteredRecords.length}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-3 py-4 whitespace-nowrap">SN</th>
              <th className="px-3 py-4 whitespace-nowrap">Branch Code</th>
              <th className="px-3 py-4 whitespace-nowrap">Employee Name</th>
              <th className="px-3 py-4 whitespace-nowrap">Designation</th>
              <th className="px-3 py-4 whitespace-nowrap">Department</th>
              <th className="px-3 py-4 whitespace-nowrap">Employee ID</th>
              <th className="px-3 py-4 whitespace-nowrap">Joining Date</th>
              <th className="px-3 py-4 whitespace-nowrap">Blood Group</th>
              <th className="px-3 py-4 whitespace-nowrap">Proximity Card</th>
              <th className="px-3 py-4 whitespace-nowrap">Photo Attach</th>
              <th className="px-3 py-4 whitespace-nowrap">Status</th>
              <th className="px-3 py-4 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-slate-400">No records found</td>
              </tr>
            ) : (
              filteredRecords.map((r, index) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-4 whitespace-nowrap">
                  <input 
                    type="checkbox" 
                    checked={selectedRowIds.includes(r.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRowIds(prev => [...prev, r.id]);
                      } else {
                        setSelectedRowIds(prev => prev.filter(id => id !== r.id));
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-3 py-4 whitespace-nowrap">{index + 1}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.branchCode}</td>
                <td className="px-3 py-4 font-medium whitespace-nowrap">{r.employeeName}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.designation}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.department}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.employeeId}</td>
                <td className="px-3 py-4 whitespace-nowrap">{formatDateForExport(r.joiningDate)}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.bloodGroup}</td>
                <td className="px-3 py-4 whitespace-nowrap">{r.proximityCardNumber}</td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <button onClick={() => { setSelectedRecordId(r.id); fileInputRef.current?.click(); }} className="text-slate-400 hover:text-indigo-600"><Camera size={16}/></button>
                </td>
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
                      onClick={() => handleDelete(r)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
      </div>
      <IdentityCardViewModal
        isOpen={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setSelectedRecord(null); }}
        record={selectedRecord}
      />
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedRecord(null); }}
        onConfirm={confirmDelete}
        title="Delete Record"
        message={`Are you sure you want to delete ${selectedRecord?.employeeName}'s information?`}
      />
      <IdentityCardFormModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedRecord(null); }} 
        nextSl={nextSl} 
        initialData={selectedRecord || undefined} 
        existingRecords={records}
      />

      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Manage System</h2>
              <button onClick={() => setIsManageModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ManageSystem collectionName="branchCodes" title="Branch Code" />
              <ManageSystem collectionName="designations" title="Designation" />
              <ManageSystem collectionName="departments" title="Department" />
              <ManageSystem collectionName="bloodGroups" title="Blood Group" />
              <ManageSystem collectionName="employeeStatuses" title="Status" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceeded, subscribeQuotaState } from '../firebase';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { IspConnection, LedgerPermissions } from '../types';
import { ManageSystemModal } from './ManageSystemModal';
import {
  Sliders, Wifi, Server, Network, Plus, Search, Trash2, Edit2, Eye,
  Copy, Check, X, Building2, Phone, User, Lock, CreditCard,
  CheckCircle2, Printer, Download, RefreshCw, FileSpreadsheet, Layers,
  GitBranch, HelpCircle, CheckSquare, Square, ChevronDown, ChevronRight,
  Filter, Sparkles, Key, Radio, MapPin, Settings, CopyPlus, Camera
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateCanvasWithOklchFallback } from '../utils/pdfExport';

interface IspInformationLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: LedgerPermissions;
}

// Preset option lists for dropdowns
const INITIAL_LOCATIONS = [
  'Dhaka Elephant Road',
  'Cumilla Branch',
  'BWH-1 (Central Warehouse)',
  'BWH-2 (Secondary Store)',
  'Dhanmondi Branch',
  'Gulshan Executive Office',
  'Uttara Distribution Hub',
  'Banani Technical Office',
  'Motijheel Financial Center',
  'Chittagong Regional Hub',
  'Gazipur Factory Complex'
];

const INITIAL_ISPS = [
  'KS Network Ltd',
  'Link3 Technologies Ltd',
  'Carnival Internet',
  'Amber IT Limited',
  'Dot Internet',
  'Circle Network',
  'Exord Online',
  'Earth Telecommunication',
  'Fiber@Home Ltd',
  'Summit Communications'
];

const INITIAL_PACKAGES = [
  'Home Starter Booster',
  'Corporate Dedicated Premium',
  'Standard SME Fiber',
  'Executive Ultra Pro',
  'Enterprise Symmetrical',
  'High-Speed Corporate Fiber',
  'Retail Unlimited Plus'
];

const INITIAL_BANDWIDTHS = [
  '5 Mbps',
  '10 Mbps',
  '15 Mbps',
  '20 Mbps',
  '25 Mbps',
  '30 Mbps',
  '50 Mbps',
  '100 Mbps',
  '200 Mbps',
  '500 Mbps',
  '1 Gbps'
];

export const IspInformationLedger: React.FC<IspInformationLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  // Records state with LocalStorage caching (without default demo records)
  const [records, setRecords] = useState<IspConnection[]>(() => {
    const cached = getLocalCache<IspConnection>('isp_connections');
    if (cached && cached.length > 0) {
      return cached.filter(r => r.id !== 'isp-demo-cg-001' && r.userName !== 'CG');
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIspFilter, setSelectedIspFilter] = useState('All');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<'ISP' | 'Location' | 'Package' | 'Bandwidth'>('ISP');
  const [editingRecord, setEditingRecord] = useState<IspConnection | null>(null);
  const [viewingRecord, setViewingRecord] = useState<IspConnection | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Field States
  const [userName, setUserName] = useState('');
  const [locationName, setLocationName] = useState('');
  
  const [ispName, setIspName] = useState('');

  const [contactPersonName, setContactPersonName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [pppoeUser, setPppoeUser] = useState('');
  const [pppoePassword, setPppoePassword] = useState('');
  const [paymentId, setPaymentId] = useState('');

  const [ipAddress, setIpAddress] = useState('');
  const [subnetMask, setSubnetMask] = useState('');
  const [gateway, setGateway] = useState('');
  const [dns1, setDns1] = useState('');
  const [dns2, setDns2] = useState('');
  const [port, setPort] = useState('');
  const [routerUser, setRouterUser] = useState('');
  const [routerPassword, setRouterPassword] = useState('');

  const [packageName, setPackageName] = useState('');
  const [isManualPackage, setIsManualPackage] = useState(false);

  const [bandwidth, setBandwidth] = useState('');
  const [isManualBandwidth, setIsManualBandwidth] = useState(false);

  const [billAmount, setBillAmount] = useState<string>('');

  // Dropdown options lists
  const [locationOptions, setLocationOptions] = useState<string[]>(INITIAL_LOCATIONS);
  const [ispOptions, setIspOptions] = useState<string[]>(INITIAL_ISPS);
  const [packageOptions, setPackageOptions] = useState<string[]>(INITIAL_PACKAGES);
  const [bandwidthOptions, setBandwidthOptions] = useState<string[]>(INITIAL_BANDWIDTHS);

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded);

  const reportPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeQuotaState(setQuotaExceeded);
  }, []);

  // Sync with Firestore collection: 'isp_connections'
  useEffect(() => {
    try {
      const q = query(collection(db, 'isp_connections'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: IspConnection[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                userName: data.userName || '',
                locationName: data.locationName || '',
                ispName: data.ispName || '',
                contactPersonName: data.contactPersonName || '',
                contactNumber: data.contactNumber || '',
                isActive: data.isActive !== false,
                pppoeUser: data.pppoeUser || '',
                pppoePassword: data.pppoePassword || '',
                paymentId: data.paymentId || '',
                ipAddress: data.ipAddress || '',
                subnetMask: data.subnetMask || '',
                gateway: data.gateway || '',
                dns1: data.dns1 || '',
                dns2: data.dns2 || '',
                port: data.port || '',
                routerUser: data.routerUser || '',
                routerPassword: data.routerPassword || '',
                packageName: data.packageName || '',
                bandwidth: data.bandwidth || '',
                billAmount: data.billAmount !== undefined ? data.billAmount : '',
                createdBy: data.createdBy || '',
                createdByEmail: data.createdByEmail || '',
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
              });
            });
            setRecords(list);
            setLocalCache('isp_connections', list);
          } else {
            setRecords([]);
            setLocalCache('isp_connections', []);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'isp_connections');
          const cached = getLocalCache<IspConnection>('isp_connections');
          if (cached && cached.length > 0) {
            setRecords(cached);
          }
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore subscription note:", e);
    }
  }, []);

  // Update dynamic dropdown options based on managed system options
  useEffect(() => {
    const q = query(collection(db, 'manage_system_options'));
    
    // Seed initial data if DB is empty
    const seedInitialOptions = async () => {
        const snapshot = await getDoc(doc(db, 'system_initialized', 'v2'));
        if (!snapshot.exists()) {
            for (const loc of INITIAL_LOCATIONS) await addDoc(collection(db, 'manage_system_options'), { category: 'Location', value: loc, createdAt: serverTimestamp() });
            for (const isp of INITIAL_ISPS) await addDoc(collection(db, 'manage_system_options'), { category: 'ISP', value: isp, createdAt: serverTimestamp() });
            for (const pkg of INITIAL_PACKAGES) await addDoc(collection(db, 'manage_system_options'), { category: 'Package', value: pkg, createdAt: serverTimestamp() });
            for (const bw of INITIAL_BANDWIDTHS) await addDoc(collection(db, 'manage_system_options'), { category: 'Bandwidth', value: bw, createdAt: serverTimestamp() });
            await setDoc(doc(db, 'system_initialized', 'v2'), { initialized: true });
        }
    };
    seedInitialOptions();

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const locSet = new Set<string>();
        const ispSet = new Set<string>();
        const pkgSet = new Set<string>();
        const bwSet = new Set<string>();

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.category === 'Location' && data.value) locSet.add(data.value);
            if (data.category === 'ISP') ispSet.add(data.value);
            if (data.category === 'Package') pkgSet.add(data.value);
            if (data.category === 'Bandwidth') bwSet.add(data.value);
        });

        // Still merge with existing records to ensure data integrity
        records.forEach(r => {
            if (r.locationName) locSet.add(r.locationName);
            if (r.ispName) ispSet.add(r.ispName);
            if (r.packageName) pkgSet.add(r.packageName);
            if (r.bandwidth) bwSet.add(r.bandwidth);
        });

        setLocationOptions(Array.from(locSet));
        setIspOptions(Array.from(ispSet));
        setPackageOptions(Array.from(pkgSet));
        setBandwidthOptions(Array.from(bwSet));
    });
    return () => unsubscribe();
  }, [records]);

  const handleCopyToNew = (record: IspConnection) => {
    handleOpenEdit(record);
    setEditingRecord(null);
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setUserName('');
    setLocationName('');
    setIspName('');
    setContactPersonName('');
    setContactNumber('');
    setIsActive(true);
    setPppoeUser('');
    setPppoePassword('');
    setPaymentId('');
    setIpAddress('');
    setSubnetMask('');
    setGateway('');
    setDns1('8.8.8.8');
    setDns2('1.1.1.1');
    setPort('');
    setRouterUser('');
    setRouterPassword('');
    setPackageName('');
    setBandwidth('');
    setBillAmount('');
    setIsFormOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (record: IspConnection) => {
    setViewingRecord(null);
    setEditingRecord(record);
    setUserName(record.userName || '');
    setLocationName(record.locationName || '');
    setIspName(record.ispName || '');
    setContactPersonName(record.contactPersonName || '');
    setContactNumber(record.contactNumber || '');
    setIsActive(record.isActive !== false);
    setPppoeUser(record.pppoeUser || '');
    setPppoePassword(record.pppoePassword || '');
    setPaymentId(record.paymentId || '');
    setIpAddress(record.ipAddress || '');
    setSubnetMask(record.subnetMask || '');
    setGateway(record.gateway || '');
    setDns1(record.dns1 || '');
    setDns2(record.dns2 || '');
    setPort(record.port || '');
    setRouterUser(record.routerUser || '');
    setRouterPassword(record.routerPassword || '');
    setPackageName(record.packageName || '');
    setBandwidth(record.bandwidth || '');
    setBillAmount(record.billAmount !== undefined ? String(record.billAmount) : '');
    setIsFormOpen(true);
  };

  // Save Connection Form (Create / Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Omit<IspConnection, 'id'> = {
      userName: userName.trim(),
      locationName: locationName.trim(),
      ispName: ispName.trim(),
      contactPersonName: contactPersonName.trim(),
      contactNumber: contactNumber.trim(),
      isActive,
      pppoeUser: pppoeUser.trim(),
      pppoePassword: pppoePassword.trim(),
      paymentId: paymentId.trim(),
      ipAddress: ipAddress.trim(),
      subnetMask: subnetMask.trim(),
      gateway: gateway.trim(),
      dns1: dns1.trim(),
      dns2: dns2.trim(),
      port: port.trim(),
      routerUser: routerUser.trim(),
      routerPassword: routerPassword.trim(),
      packageName: packageName.trim(),
      bandwidth: bandwidth.trim(),
      billAmount: billAmount === '' ? '' : Number(billAmount) || billAmount,
      updatedAt: new Date().toISOString()
    };

    if (editingRecord) {
      // Update
      const updatedRecord: IspConnection = {
        ...editingRecord,
        ...payload,
        id: editingRecord.id
      };

      // Optimistic update
      saveLocalCacheItem('isp_connections', updatedRecord);
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? updatedRecord : r));

      try {
        const docRef = doc(db, 'isp_connections', editingRecord.id);
        await updateDoc(docRef, {
          ...payload,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `isp_connections/${editingRecord.id}`);
      }

      // If viewing the same record in modal, update it too
      if (viewingRecord && viewingRecord.id === editingRecord.id) {
        setViewingRecord(updatedRecord);
      }
    } else {
      // Create
      const newId = `isp-${Date.now()}`;
      const newRecord: IspConnection = {
        id: newId,
        ...payload,
        createdBy: currentUser?.displayName || currentUser?.email || 'Admin',
        createdByEmail: currentUser?.email || '',
        createdAt: new Date().toISOString()
      };

      // Optimistic local update
      saveLocalCacheItem('isp_connections', newRecord);
      setRecords(prev => [newRecord, ...prev]);

      try {
        const docRef = await addDoc(collection(db, 'isp_connections'), {
          ...payload,
          createdBy: currentUser?.displayName || currentUser?.email || 'Admin',
          createdByEmail: currentUser?.email || '',
          createdAt: serverTimestamp()
        });
        // Sync generated ID
        const finalRecord = { ...newRecord, id: docRef.id };
        saveLocalCacheItem('isp_connections', finalRecord);
        setRecords(prev => prev.map(r => r.id === newId ? finalRecord : r));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'isp_connections');
      }
    }

    setIsFormOpen(false);
  };

  // Delete Connection
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;

    // Optimistic delete
    deleteLocalCacheItem('isp_connections', targetId);
    setRecords(prev => prev.filter(r => r.id !== targetId));
    setDeleteConfirmId(null);

    if (viewingRecord && viewingRecord.id === targetId) {
      setViewingRecord(null);
    }

    try {
      await deleteDoc(doc(db, 'isp_connections', targetId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `isp_connections/${targetId}`);
    }
  };

  // Copy helper
  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filtered List
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch =
        searchQuery === '' ||
        (r.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.locationName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.ispName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.pppoeUser || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.ipAddress || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.contactPersonName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.contactNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.paymentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.packageName || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchIsp = selectedIspFilter === 'All' || r.ispName === selectedIspFilter;
      const matchLocation = selectedLocationFilter === 'All' || r.locationName === selectedLocationFilter;
      const matchStatus =
        selectedStatusFilter === 'All' ||
        (selectedStatusFilter === 'Active' && r.isActive !== false) ||
        (selectedStatusFilter === 'Inactive' && r.isActive === false);

      return matchSearch && matchIsp && matchLocation && matchStatus;
    });
  }, [records, searchQuery, selectedIspFilter, selectedLocationFilter, selectedStatusFilter]);

  // Statistics
  const totalCount = records.length;
  const activeCount = records.filter(r => r.isActive !== false).length;
  const totalMonthlyBill = records.reduce((sum, r) => {
    const num = Number(r.billAmount) || 0;
    return sum + (r.isActive !== false ? num : 0);
  }, 0);
  const distinctIsps = new Set(records.map(r => r.ispName).filter(Boolean)).size;

  // Export to Excel
  const handleExportExcel = () => {
    const data = filteredRecords.map((r, idx) => ({
      'SL': idx + 1,
      'User Name / Client': r.userName || '-',
      'Location': r.locationName || '-',
      'ISP Name': r.ispName || '-',
      'Contact Person': r.contactPersonName || '-',
      'Contact Number': r.contactNumber || '-',
      'Status': r.isActive !== false ? 'Active' : 'Inactive',
      'PPPOE User': r.pppoeUser || '-',
      'PPPOE Password': r.pppoePassword || '-',
      'Payment ID': r.paymentId || '-',
      'IP Address': r.ipAddress || '-',
      'Subnet Mask': r.subnetMask || '-',
      'Gateway Route': r.gateway || '-',
      'DNS 1': r.dns1 || '-',
      'DNS 2': r.dns2 || '-',
      'Port': r.port || '-',
      'Router User': r.routerUser || '-',
      'Router Password': r.routerPassword || '-',
      'Package Name': r.packageName || '-',
      'Bandwidth Speed': r.bandwidth || '-',
      'Monthly Bill (BDT)': r.billAmount || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ISP Connections');
    XLSX.writeFile(wb, `ISP_Connections_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Print Report View directly
  const handlePrintReport = () => {
    window.print();
  };

  // Copy Screenshot to Clipboard
  const handleCopyScreenshot = async () => {
    if (!reportPrintRef.current) return;
    try {
      const canvas = await generateCanvasWithOklchFallback(reportPrintRef.current, {
        scale: 2,
        backgroundColor: '#0b1120',
        logging: false,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert("Failed to create image blob.");
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          alert("Screenshot copied to clipboard successfully!");
        } catch (clipErr) {
          console.error("Clipboard API error:", clipErr);
          const image = canvas.toDataURL('image/png');
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute('href', image);
          downloadAnchorNode.setAttribute('download', `ISP_Connection_${viewingRecord?.userName || 'Report'}_${new Date().toISOString().split('T')[0]}.png`);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
          alert("Clipboard copy not supported or blocked. Downloaded as PNG instead.");
        }
      }, 'image/png');
    } catch (err) {
      console.error("Error generating screenshot:", err);
      alert("Failed to generate screenshot.");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">ISP Information</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Network Module
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ISP & Client connection parameters, PPPOE authentication, static IP routing & billing ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="text"
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Export filtered table to Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", "ISP_Connections_Export.json");
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Export all data to JSON"
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Export JSON</span>
          </button>
          <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                  const bstr = evt.target?.result;
                  const wb = XLSX.read(bstr, { type: 'binary' });
                  const wsname = wb.SheetNames[0];
                  const ws = wb.Sheets[wsname];
                  const data: any[] = XLSX.utils.sheet_to_json(ws);
                  
                  console.log("Imported Excel Data:", data);
                  
                  try {
                    for (const row of data) {
                      const newRecord = {
                        userName: row['User Name / Client'] || '',
                        locationName: row['Location'] || '',
                        ispName: row['ISP Name'] || '',
                        contactPersonName: row['Contact Person'] || '',
                        contactNumber: row['Contact Number'] || '',
                        isActive: row['Status'] !== 'Inactive',
                        pppoeUser: row['PPPOE User'] || '',
                        pppoePassword: row['PPPOE Password'] || '',
                        paymentId: row['Payment ID'] || '',
                        ipAddress: row['IP Address'] || '',
                        subnetMask: row['Subnet Mask'] || '',
                        gateway: row['Gateway Route'] || '',
                        dns1: row['DNS 1'] || '',
                        dns2: row['DNS 2'] || '',
                        port: row['Port'] || '',
                        routerUser: row['Router User'] || '',
                        routerPassword: row['Router Password'] || '',
                        packageName: row['Package Name'] || '',
                        bandwidth: row['Bandwidth Speed'] || '',
                        billAmount: row['Monthly Bill (BDT)'] || 0,
                        createdBy: currentUser?.displayName || currentUser?.email || 'Admin',
                        createdByEmail: currentUser?.email || '',
                        createdAt: serverTimestamp()
                      };
                      
                      await addDoc(collection(db, 'isp_connections'), newRecord);
                    }
                    alert("Successfully imported " + data.length + " records!");
                  } catch (error) {
                    console.error("Error importing data:", error);
                    alert("Error importing data. Please check the console.");
                  }
                };
                reader.readAsBinaryString(file);
              }
            }} />
          </label>
          <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Import JSON</span>
            <input type="file" className="hidden" accept=".json" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const data = JSON.parse(evt.target?.result as string);
                  console.log("Imported JSON Data:", data);
                  // TODO: Implement logic to process and add to Firebase
                  alert("JSON import feature needs backend implementation to save data.");
                };
                reader.readAsText(file);
              }
            }} />
          </label>

          {canEdit && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Connection</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Connections</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">All registered client lines</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Active Links</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{totalCount - activeCount} links disabled/inactive</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Active Monthly Bill</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">৳ {totalMonthlyBill.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Monthly recurring cost</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Active ISPs</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{distinctIsps}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Distinct service providers</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by User Name, Location, ISP, PPPOE User, IP, Phone or Payment ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* ISP Filter */}
            <select
              value={selectedIspFilter}
              onChange={(e) => setSelectedIspFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="All">All ISPs ({ispOptions.length})</option>
              {ispOptions.map(isp => (
                <option key={isp} value={isp}>{isp}</option>
              ))}
            </select>

            {/* Location Filter */}
            <select
              value={selectedLocationFilter}
              onChange={(e) => setSelectedLocationFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Locations ({locationOptions.length})</option>
              {locationOptions.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            {(searchQuery || selectedIspFilter !== 'All' || selectedLocationFilter !== 'All' || selectedStatusFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedIspFilter('All');
                  setSelectedLocationFilter('All');
                  setSelectedStatusFilter('All');
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold tracking-wider uppercase text-[10px]">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">User Name / Client</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">ISP Name</th>
                <th className="py-3 px-4">PPPOE User</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Package & Speed</th>
                <th className="py-3 px-4 text-right">Monthly Bill</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Sliders className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-xs font-semibold text-slate-600">No ISP connection records found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "Add New Connection" to create a connection</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    onClick={() => setViewingRecord(r)}
                  >
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    
                    {/* User Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {(r.userName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {r.userName || '-'}
                          </div>
                          {r.contactPersonName && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              {r.contactPersonName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{r.locationName || '-'}</span>
                      </div>
                    </td>

                    {/* ISP Name */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                        {r.ispName || '-'}
                      </span>
                    </td>

                    {/* PPPOE User */}
                    <td className="py-3 px-4 font-mono text-emerald-600 font-semibold">
                      {r.pppoeUser || '-'}
                    </td>

                    {/* IP Address */}
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {r.ipAddress || '-'}
                    </td>

                    {/* Package & Speed */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{r.packageName || '-'}</div>
                      {r.bandwidth && (
                        <div className="text-[10px] text-indigo-600 font-semibold">{r.bandwidth}</div>
                      )}
                    </td>

                    {/* Monthly Bill */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      {r.billAmount ? `৳ ${Number(r.billAmount).toLocaleString()}` : '-'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {r.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* View Report Button (Opens Photo 2 modal) */}
                        <button
                          onClick={() => setViewingRecord(r)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View 14-Parameter Report (View Report)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Copy to New Button */}
                        {canEdit && (
                          <button
                            onClick={() => handleCopyToNew(r)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="Copy to New Connection"
                          >
                            <CopyPlus className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Button (Opens Photo 1 modal) */}
                        {canEdit && (
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Edit Connection (Edit)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Button */}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirmId(r.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete Connection"
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

      {isManageModalOpen && (
        <ManageSystemModal 
          category={editingCategory} 
          onClose={() => setIsManageModalOpen(false)} 
          onUpdate={() => {
            // Re-fetch logic would go here if needed, 
            // but the options state depends on records state
          }}
        />
      )}
      
      {/* ========================================================= */}
      {/* 1. FORM MODAL (MATCHING USER PHOTO 1 EXACTLY)             */}
      {/* ========================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-5 sm:px-6 py-4 flex items-center justify-between text-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                    {editingRecord ? 'সংযোগ তথ্য সম্পাদনা / Edit Connection' : 'নতুন সংযোগ যোগ করুন / Add New Connection'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-blue-100/90 font-medium">
                    ISP Module Configuration Center
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-medium text-white/90">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>All fields are optional</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitForm} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* SECTION 1: আইএসপি ও গ্রাহক পরিচিতি / ISP & CLIENT INFORMATION */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide uppercase">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                  <span>ISP & CLIENT INFORMATION</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* User Name */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>User Name</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. Amit Hasan"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Location Name with Manual Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>Location Name</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory('Location');
                          setIsManageModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Manage Options</span>
                      </button>
                    </div>

                    <select
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- Select Location --</option>
                        {locationOptions.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                  </div>

                  {/* ISP Name with Manual Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>ISP Name</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory('ISP');
                          setIsManageModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Manage Options</span>
                      </button>
                    </div>

                    <select
                        value={ispName}
                        onChange={(e) => setIspName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- Select ISP Name --</option>
                        {ispOptions.map((isp) => (
                          <option key={isp} value={isp}>
                            {isp}
                          </option>
                        ))}
                      </select>
                  </div>

                  {/* Contact Person Name */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Contact Person Name</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. Amit Hasan (Project Lead)"
                      value={contactPersonName}
                      onChange={(e) => setContactPersonName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Contact Number</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. +88017XXXXXXXX"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Active / সচল Checkbox */}
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <CheckCircle2 className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                        Active
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION 2: পিপিপিও ইউজার ও পেমেন্ট তথ্য / PPPOE & PAYMENT AUTHENTICATION */}
              <div className="space-y-3.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide uppercase">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                  <span>PPPOE & PAYMENT AUTHENTICATION</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* PPPEO USER */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Key className="w-3.5 h-3.5 text-indigo-500" />
                      <span>PPPEO USER</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. amit_pppoe_90"
                      value={pppoeUser}
                      onChange={(e) => setPppoeUser(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* PPPEO PASSWORD */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>PPPEO PASSWORD</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. pass123456"
                      value={pppoePassword}
                      onChange={(e) => setPppoePassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* PAYMENT ID */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                      <span>PAYMENT ID</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. PAY-2026-908"
                      value={paymentId}
                      onChange={(e) => setPaymentId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: স্ট্যাটিক আইপি সাবসেট / STATIC IP CONFIGURATION */}
              <div className="space-y-3.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                  <span>STATIC IP CONFIGURATION</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* IP Address */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Server className="w-3.5 h-3.5 text-emerald-600" />
                      <span>IP Address</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. 192.168.10.15"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Subnet Mask */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Subnet Mask</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. 255.255.255.0"
                      value={subnetMask}
                      onChange={(e) => setSubnetMask(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Gateway */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Gateway</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. 192.168.10.1"
                      value={gateway}
                      onChange={(e) => setGateway(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* DNS-1 */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Server className="w-3.5 h-3.5 text-emerald-600" />
                      <span>DNS-1</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. 8.8.8.8"
                      value={dns1}
                      onChange={(e) => setDns1(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* DNS-2 */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Server className="w-3.5 h-3.5 text-emerald-600" />
                      <span>DNS-2</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. 1.1.1.1"
                      value={dns2}
                      onChange={(e) => setDns2(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Port */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Port</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. 80 / 8291"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Router User */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Router User</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. admin"
                      value={routerUser}
                      onChange={(e) => setRouterUser(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Router Password */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Router Password</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. admin123"
                      value={routerPassword}
                      onChange={(e) => setRouterPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: প্যাকেজ এবং বিলিং / PACKAGE & BILLING */}
              <div className="space-y-3.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide uppercase">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                  <span>PACKAGE & BILLING</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Package Name with Manual Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Layers className="w-3.5 h-3.5 text-amber-500" />
                        <span>Package Name</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory('Package');
                          setIsManageModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Manage Options</span>
                      </button>
                    </div>

                    <select
                        value={packageName}
                        onChange={(e) => setPackageName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">-- Select Package --</option>
                        {packageOptions.map((pkg) => (
                          <option key={pkg} value={pkg}>
                            {pkg}
                          </option>
                        ))}
                      </select>
                  </div>

                  {/* Bandwidth with Manual Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Wifi className="w-3.5 h-3.5 text-amber-500" />
                        <span>Bandwidth</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory('Bandwidth');
                          setIsManageModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Manage Options</span>
                      </button>
                    </div>

                    <select
                        value={bandwidth}
                        onChange={(e) => setBandwidth(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">-- Select Speed --</option>
                        {bandwidthOptions.map((bw) => (
                          <option key={bw} value={bw}>
                            {bw}
                          </option>
                        ))}
                      </select>
                  </div>

                  {/* Bill Amount */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <span className="font-bold text-amber-600 text-xs">৳</span>
                      <span>Bill Amount (৳)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ex. 500, 1200"
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Form Bottom Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  ✕ Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingRecord ? 'Update Subscription' : 'Add Subscription'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. REPORT VIEW MODAL (MATCHING USER PHOTO 2 EXACTLY)      */}
      {/* ========================================================= */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div
            ref={reportPrintRef}
            className="bg-[#0b1120] text-slate-200 rounded-3xl max-w-4xl w-full border border-slate-800 shadow-2xl p-5 sm:p-7 my-6 relative overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Header: Matches Photo 2 */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-lg shadow-blue-600/10 shrink-0">
                  <Network className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">
                    {viewingRecord.userName || 'Connection Details'}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Complete Connection Parameter Report (All 14 Parameters)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyScreenshot}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Copy Screenshot to Clipboard"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Screenshot</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Print Report"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEdit(viewingRecord);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Edit Record"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setViewingRecord(null)}
                  className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer ml-1"
                  title="Close Report"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bento Grid: Exactly 5 Cards matching Photo 2 */}
            <div className="space-y-4">
              {/* Row 1: 3 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1 (Top Left): Client & ISP Details */}
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-cyan-400 font-bold text-sm tracking-wide border-b border-cyan-500/20 pb-2.5 mb-3.5">
                      Client & ISP Details
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">User Name:</span>
                        <span className="font-semibold text-white text-right">{viewingRecord.userName || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">Location Name:</span>
                        <span className="font-medium text-slate-200 text-right">{viewingRecord.locationName || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">ISP Name:</span>
                        <span className="font-semibold text-white text-right">{viewingRecord.ispName || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">Contact Person:</span>
                        <span className="font-medium text-emerald-400 text-right">{viewingRecord.contactPersonName || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">Contact Number:</span>
                        <span className="font-mono text-slate-200 text-right">{viewingRecord.contactNumber || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2 (Top Middle): PPPOE Account & Payment */}
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-indigo-400 font-bold text-sm tracking-wide border-b border-indigo-500/20 pb-2.5 mb-3.5">
                      PPPOE Account & Payment
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">PPPEO USER:</span>
                        <span className="font-mono font-bold text-emerald-400 text-right">{viewingRecord.pppoeUser || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">PPPEO Password:</span>
                        <span className="font-mono text-slate-200 text-right">{viewingRecord.pppoePassword || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400">PAYMENT ID:</span>
                        <span className="font-mono font-bold text-cyan-400 text-right">{viewingRecord.paymentId || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3 (Top Right): IP Address & DNS Routing */}
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-emerald-400 font-bold text-sm tracking-wide border-b border-emerald-500/20 pb-2.5 mb-3.5">
                      IP Address & DNS Routing
                    </h3>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 font-sans">IP Address:</span>
                        <span className="text-slate-200 text-right">{viewingRecord.ipAddress || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 font-sans">Subnet Mask:</span>
                        <span className="text-slate-200 text-right">{viewingRecord.subnetMask || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 font-sans">Gateway Route:</span>
                        <span className="text-slate-200 text-right">{viewingRecord.gateway || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 font-sans">DNS-1 Server:</span>
                        <span className="text-cyan-400 text-right">{viewingRecord.dns1 || '-'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 font-sans">DNS-2 Server:</span>
                        <span className="text-cyan-400 text-right">{viewingRecord.dns2 || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: 2 Columns (Router Access + Package & Monthly bill) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Card 4 (Bottom Left): Router Access - 4 cols */}
                <div className="md:col-span-4 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-emerald-400 font-bold text-sm tracking-wide border-b border-emerald-500/20 pb-2.5 mb-3.5">
                      Router Access
                    </h3>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-400 font-sans">Port:</span>
                        <span className="font-bold text-emerald-400">{viewingRecord.port || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-400 font-sans">Router User:</span>
                        <span className="text-slate-200">{viewingRecord.routerUser || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-400 font-sans">Router Password:</span>
                        <span className="text-slate-200">{viewingRecord.routerPassword || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 5 (Bottom Right): Package & Monthly Bill Details */}
                <div className="md:col-span-8 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-amber-400 font-bold text-sm tracking-wide border-b border-amber-500/30 pb-2.5 mb-3.5">
                      Package & Monthly Bill Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                      {/* Package Name */}
                      <div className="sm:col-span-6">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          PACKAGE NAME
                        </div>
                        <div className="font-bold text-white text-sm sm:text-base mt-1 break-words">
                          {viewingRecord.packageName || '-'}
                        </div>
                      </div>

                      {/* Bandwidth Speed */}
                      <div className="sm:col-span-3">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          BANDWIDTH SPEED
                        </div>
                        <div className="font-bold text-white text-sm sm:text-base mt-1 font-mono break-words">
                          {viewingRecord.bandwidth || '-'}
                        </div>
                      </div>

                      {/* Monthly Bill */}
                      <div className="sm:col-span-3">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          MONTHLY BILL
                        </div>
                        <div className="font-bold text-emerald-400 text-sm sm:text-base mt-1 font-mono">
                          ৳ {viewingRecord.billAmount ? Number(viewingRecord.billAmount).toLocaleString() : '0'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Delete Connection?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete this ISP connection parameter record? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-md transition cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

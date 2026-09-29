import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceeded, subscribeQuotaState } from '../firebase';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { IpPhoneRecord, LedgerPermissions } from '../types';
import { INITIAL_IP_PHONE_RECORDS, INITIAL_PHONE_MODELS, INITIAL_IP_PHONE_OPTIONS } from '../data/ipPhoneInitialData';
import { BRANCH_OPTIONS, DEPARTMENT_OPTIONS } from '../data/equipmentTemplates';
import { generateCanvasWithOklchFallback } from '../utils/pdfExport';
import {
  PhoneCall, Plus, Search, Trash2, Edit2, Eye, Copy, Check, X,
  Building2, Phone, User, Lock, CheckCircle2, Printer, Download, Upload,
  RefreshCw, FileSpreadsheet, Layers, Filter, Sparkles, Key,
  Radio, MapPin, Settings, CopyPlus, Camera, ShieldCheck,
  AlertTriangle, Wrench, Smartphone, Server, Cpu, CheckSquare,
  HelpCircle, EyeOff, Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface IpPhoneLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: LedgerPermissions;
}

const LOCAL_STORAGE_KEY = 'ip_phone_ledger_records';

export const IpPhoneLedger: React.FC<IpPhoneLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  // Initialize records from cache (without default seed records)
  const [records, setRecords] = useState<IpPhoneRecord[]>(() => {
    const cached = getLocalCache<IpPhoneRecord>(LOCAL_STORAGE_KEY);
    if (cached && cached.length > 0) {
      return cached.filter(r => !r.id.startsWith('ipphone-'));
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('All');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedIpFilter, setSelectedIpFilter] = useState('All');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IpPhoneRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<IpPhoneRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Quick Inline Row Entry
  const [showInlineRow, setShowInlineRow] = useState(false);
  const [inlineBranch, setInlineBranch] = useState('Head Office');
  const [inlineName, setInlineName] = useState('');
  const [inlineDept, setInlineDept] = useState('Information Technology');
  const [inlineExtension, setInlineExtension] = useState('');
  const [inlineIp, setInlineIp] = useState('');
  const [inlineServerIp, setInlineServerIp] = useState('192.168.10.200');
  const [inlineUserId, setInlineUserId] = useState('');
  const [inlinePassword, setInlinePassword] = useState('');
  const [inlineModel, setInlineModel] = useState('Yealink SIP-T21P E2');
  const [inlineStatus, setInlineStatus] = useState<'Active' | 'Inactive' | 'Damage' | 'Spare'>('Active');

  // Form Fields for Add / Edit
  const [branchCode, setBranchCode] = useState('Head Office');
  const [userName, setUserName] = useState('');
  const [identyNumber, setIdentyNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Information Technology');
  const [extensionNumber, setExtensionNumber] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [brandModel, setBrandModel] = useState('Yealink SIP-T21P E2');
  const [serialNumber, setSerialNumber] = useState('');
  const [sipUser, setSipUser] = useState('');
  const [sipPassword, setSipPassword] = useState('');
  const [showSipPassword, setShowSipPassword] = useState(false);
  const [pbxServer, setPbxServer] = useState('192.168.10.200');
  const [subnetMask, setSubnetMask] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('192.168.10.1');
  const [port, setPort] = useState('5060');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Damage' | 'Spare'>('Active');
  const [distributionDate, setDistributionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Dropdown options with persistence
  const [branchOptions, setBranchOptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ip_phone_branch_options');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return BRANCH_OPTIONS;
  });
  const [deptOptions, setDeptOptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ip_phone_dept_options');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEPARTMENT_OPTIONS;
  });
  const [ipOptions, setIpOptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ip_phone_number_options');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_IP_PHONE_OPTIONS;
  });
  const [manageCategory, setManageCategory] = useState<'Branch' | 'Department' | 'IpPhone'>('Branch');
  const [newOptionValue, setNewOptionValue] = useState('');
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingOptionValue, setEditingOptionValue] = useState('');

  // Persist dropdown options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ip_phone_branch_options', JSON.stringify(branchOptions));
    } catch (e) {}
  }, [branchOptions]);

  useEffect(() => {
    try {
      localStorage.setItem('ip_phone_dept_options', JSON.stringify(deptOptions));
    } catch (e) {}
  }, [deptOptions]);

  useEffect(() => {
    try {
      localStorage.setItem('ip_phone_number_options', JSON.stringify(ipOptions));
    } catch (e) {}
  }, [ipOptions]);

  // Combined IP phone options for dropdowns (configured list + all unique IPs from ledger)
  const allIpDropdownOptions = useMemo(() => {
    const set = new Set<string>();
    ipOptions.forEach(ip => {
      if (ip && ip.trim()) set.add(ip.trim());
    });
    records.forEach(r => {
      if (r.ipAddress && r.ipAddress.trim() && r.ipAddress !== '-') {
        set.add(r.ipAddress.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [ipOptions, records]);

  const handleStartEditOption = (opt: string) => {
    setEditingOption(opt);
    setEditingOptionValue(opt);
  };

  const handleCancelEditOption = () => {
    setEditingOption(null);
    setEditingOptionValue('');
  };

  const handleSaveEditOption = (oldVal: string) => {
    const trimmed = editingOptionValue.trim();
    if (!trimmed) {
      showToast("Option name cannot be empty.");
      return;
    }
    if (trimmed === oldVal) {
      setEditingOption(null);
      return;
    }

    if (manageCategory === 'Branch') {
      if (branchOptions.some(x => x.toLowerCase() === trimmed.toLowerCase() && x.toLowerCase() !== oldVal.toLowerCase())) {
        showToast(`"${trimmed}" already exists.`);
        return;
      }
      setBranchOptions(prev => prev.map(x => x === oldVal ? trimmed : x));
      setRecords(prev => prev.map(r => r.branchCode === oldVal ? { ...r, branchCode: trimmed, locationName: trimmed } : r));
    } else if (manageCategory === 'Department') {
      if (deptOptions.some(x => x.toLowerCase() === trimmed.toLowerCase() && x.toLowerCase() !== oldVal.toLowerCase())) {
        showToast(`"${trimmed}" already exists.`);
        return;
      }
      setDeptOptions(prev => prev.map(x => x === oldVal ? trimmed : x));
      setRecords(prev => prev.map(r => r.department === oldVal ? { ...r, department: trimmed } : r));
    } else {
      if (ipOptions.some(x => x.toLowerCase() === trimmed.toLowerCase() && x.toLowerCase() !== oldVal.toLowerCase())) {
        showToast(`"${trimmed}" already exists.`);
        return;
      }
      setIpOptions(prev => prev.map(x => x === oldVal ? trimmed : x));
      setRecords(prev => prev.map(r => r.ipAddress === oldVal ? { ...r, ipAddress: trimmed } : r));
    }

    setEditingOption(null);
    setEditingOptionValue('');
    showToast(`Updated to "${trimmed}"`);
  };

  // Copy & Action Feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);
  const detailCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  useEffect(() => {
    return subscribeQuotaState(setQuotaExceeded);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync with Firestore collection: 'ip_phone_records'
  useEffect(() => {
    try {
      const q = query(collection(db, 'ip_phone_records'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: IpPhoneRecord[] = [];
            const toDeleteFromDb: string[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              // Remove old default seed data if present in Firestore
              if (docSnap.id.startsWith('ipphone-') || (data.id && String(data.id).startsWith('ipphone-'))) {
                toDeleteFromDb.push(docSnap.id);
                return;
              }
              list.push({
                id: docSnap.id,
                sl: data.sl || 0,
                branchCode: data.branchCode || 'Head Office',
                locationName: data.locationName || data.branchCode || '',
                userName: data.userName || '',
                identyNumber: data.identyNumber || '',
                designation: data.designation || '',
                department: data.department || '',
                extensionNumber: data.extensionNumber || '',
                ipAddress: data.ipAddress || '',
                macAddress: data.macAddress || '',
                brandModel: data.brandModel || '',
                serialNumber: data.serialNumber || '',
                sipUser: data.sipUser || data.extensionNumber || '',
                sipPassword: data.sipPassword || '',
                pbxServer: data.pbxServer || '',
                subnetMask: data.subnetMask || '',
                gateway: data.gateway || '',
                port: data.port || '5060',
                status: (data.status as any) || 'Active',
                distributionDate: data.distributionDate || '',
                remarks: data.remarks || '',
                createdBy: data.createdBy || '',
                createdByEmail: data.createdByEmail || '',
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
              });
            });

            // Asynchronously delete default seed records from Firestore
            if (toDeleteFromDb.length > 0) {
              toDeleteFromDb.forEach(async (delId) => {
                try {
                  await deleteDoc(doc(db, 'ip_phone_records', delId));
                } catch (delErr) {
                  console.warn("Deleted default seed record from Firestore note:", delErr);
                }
              });
            }

            // Sort by SL or createdAt
            list.sort((a, b) => (a.sl || 0) - (b.sl || 0));
            setRecords(list);
            setLocalCache(LOCAL_STORAGE_KEY, list);
          } else {
            setRecords([]);
            setLocalCache(LOCAL_STORAGE_KEY, []);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'ip_phone_records');
          const cached = getLocalCache<IpPhoneRecord>(LOCAL_STORAGE_KEY);
          if (cached && cached.length > 0) {
            setRecords(cached.filter(r => !r.id.startsWith('ipphone-')));
          } else {
            setRecords([]);
          }
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore IP Phone subscription note:", e);
    }
  }, []);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.userName.toLowerCase().includes(q) ||
        r.extensionNumber.toLowerCase().includes(q) ||
        r.ipAddress.toLowerCase().includes(q) ||
        r.macAddress.toLowerCase().includes(q) ||
        r.brandModel.toLowerCase().includes(q) ||
        r.branchCode.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        (r.pbxServer && r.pbxServer.toLowerCase().includes(q)) ||
        (r.sipUser && r.sipUser.toLowerCase().includes(q)) ||
        (r.identyNumber && r.identyNumber.toLowerCase().includes(q)) ||
        (r.designation && r.designation.toLowerCase().includes(q));

      const matchesBranch = selectedBranchFilter === 'All' || r.branchCode === selectedBranchFilter;
      const matchesDept = selectedDeptFilter === 'All' || r.department === selectedDeptFilter;
      const matchesStatus = selectedStatusFilter === 'All' || r.status === selectedStatusFilter;
      const matchesIp = selectedIpFilter === 'All' || r.ipAddress === selectedIpFilter;

      return matchesSearch && matchesBranch && matchesDept && matchesStatus && matchesIp;
    });
  }, [records, searchQuery, selectedBranchFilter, selectedDeptFilter, selectedStatusFilter, selectedIpFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = records.length;
    const active = records.filter(r => r.status === 'Active').length;
    const inactive = records.filter(r => r.status === 'Inactive').length;
    const spare = records.filter(r => r.status === 'Spare').length;
    const damage = records.filter(r => r.status === 'Damage').length;
    const uniqueBranches = new Set(records.map(r => r.branchCode)).size;

    return { total, active, inactive, spare, damage, uniqueBranches };
  }, [records]);

  // Handle open Add Modal
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    const nextSl = records.length > 0 ? Math.max(...records.map(r => r.sl || 0)) + 1 : 1;
    setBranchCode('Head Office');
    setUserName('');
    setIdentyNumber('');
    setDesignation('');
    setDepartment('Information Technology');
    setExtensionNumber('');
    setIpAddress('');
    setMacAddress('');
    setBrandModel('Yealink SIP-T21P E2');
    setSerialNumber('');
    setSipUser('');
    setSipPassword('');
    setShowSipPassword(false);
    setPbxServer('192.168.10.200');
    setSubnetMask('255.255.255.0');
    setGateway('192.168.10.1');
    setPort('5060');
    setStatus('Active');
    setDistributionDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
    setIsFormOpen(true);
  };

  // Handle open Edit Modal
  const handleOpenEditModal = (rec: IpPhoneRecord) => {
    setEditingRecord(rec);
    setBranchCode(rec.branchCode || 'Head Office');
    setUserName(rec.userName || '');
    setIdentyNumber(rec.identyNumber || '');
    setDesignation(rec.designation || '');
    setDepartment(rec.department || 'Information Technology');
    setExtensionNumber(rec.extensionNumber || '');
    setIpAddress(rec.ipAddress || '');
    setMacAddress(rec.macAddress || '');
    setBrandModel(rec.brandModel || 'Yealink SIP-T21P E2');
    setSerialNumber(rec.serialNumber || '');
    setSipUser(rec.sipUser || rec.extensionNumber || '');
    setSipPassword(rec.sipPassword || '');
    setShowSipPassword(false);
    setPbxServer(rec.pbxServer || '192.168.10.200');
    setSubnetMask(rec.subnetMask || '255.255.255.0');
    setGateway(rec.gateway || '192.168.10.1');
    setPort(rec.port || '5060');
    setStatus(rec.status || 'Active');
    setDistributionDate(rec.distributionDate || new Date().toISOString().split('T')[0]);
    setRemarks(rec.remarks || '');
    setIsFormOpen(true);
  };

  // Save record (Create or Update)
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !extensionNumber.trim()) {
      showToast("User Name and Extension Number are required.");
      return;
    }

    try {
      const payload: Partial<IpPhoneRecord> = {
        branchCode: branchCode.trim(),
        locationName: branchCode.trim(),
        userName: userName.trim(),
        identyNumber: identyNumber.trim(),
        designation: designation.trim(),
        department: department.trim(),
        extensionNumber: extensionNumber.trim(),
        ipAddress: ipAddress.trim(),
        macAddress: macAddress.trim().toUpperCase(),
        brandModel: brandModel.trim(),
        serialNumber: serialNumber.trim(),
        sipUser: (sipUser.trim() || extensionNumber.trim()),
        sipPassword: sipPassword.trim(),
        pbxServer: pbxServer.trim(),
        subnetMask: subnetMask.trim(),
        gateway: gateway.trim(),
        port: port.trim() || '5060',
        status: status,
        distributionDate: distributionDate,
        remarks: remarks.trim(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.displayName || currentUser?.email || 'Admin',
        createdByEmail: currentUser?.email || ''
      };

      if (editingRecord) {
        // Update
        const targetId = editingRecord.id;
        const updatedList = records.map(r => r.id === targetId ? { ...r, ...payload } as IpPhoneRecord : r);
        setRecords(updatedList);
        saveLocalCacheItem(LOCAL_STORAGE_KEY, { ...editingRecord, ...payload });

        try {
          await updateDoc(doc(db, 'ip_phone_records', targetId), {
            ...payload,
            updatedAt: serverTimestamp()
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.UPDATE, `ip_phone_records/${targetId}`);
        }
        showToast("IP Phone record updated successfully!");
      } else {
        // Create
        const nextSl = records.length > 0 ? Math.max(...records.map(r => r.sl || 0)) + 1 : 1;
        const tempId = `ipphone-${Date.now()}`;
        const newRecord: IpPhoneRecord = {
          id: tempId,
          sl: nextSl,
          ...payload as any,
          createdAt: new Date().toISOString()
        };

        const updatedList = [...records, newRecord];
        setRecords(updatedList);
        saveLocalCacheItem(LOCAL_STORAGE_KEY, newRecord);

        try {
          const docRef = await addDoc(collection(db, 'ip_phone_records'), {
            ...payload,
            sl: nextSl,
            createdAt: serverTimestamp()
          });
          // Update temp ID with Firestore doc ID
          newRecord.id = docRef.id;
          saveLocalCacheItem(LOCAL_STORAGE_KEY, newRecord);
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, 'ip_phone_records');
        }
        showToast("New IP Phone registered successfully!");
      }

      setIsFormOpen(false);
      setEditingRecord(null);
    } catch (err: any) {
      console.error("Save error:", err);
      showToast("Error saving record: " + (err.message || String(err)));
    }
  };

  // Quick Inline Row Save
  const handleSaveInlineRow = async () => {
    if (!inlineName.trim() || !inlineExtension.trim()) {
      showToast("Please enter at least Name and Extension.");
      return;
    }

    try {
      const nextSl = records.length > 0 ? Math.max(...records.map(r => r.sl || 0)) + 1 : 1;
      const tempId = `ipphone-${Date.now()}`;
      const newRecord: IpPhoneRecord = {
        id: tempId,
        sl: nextSl,
        branchCode: inlineBranch,
        locationName: inlineBranch,
        userName: inlineName.trim(),
        department: inlineDept,
        designation: '',
        extensionNumber: inlineExtension.trim(),
        ipAddress: inlineIp.trim(),
        macAddress: '',
        brandModel: inlineModel,
        sipUser: inlineUserId.trim() || inlineExtension.trim(),
        sipPassword: inlinePassword.trim(),
        pbxServer: inlineServerIp.trim() || '192.168.10.200',
        port: '5060',
        status: inlineStatus,
        distributionDate: new Date().toISOString().split('T')[0],
        remarks: 'Quick Entry',
        createdAt: new Date().toISOString()
      };

      setRecords(prev => [...prev, newRecord]);
      saveLocalCacheItem(LOCAL_STORAGE_KEY, newRecord);

      try {
        const docRef = await addDoc(collection(db, 'ip_phone_records'), {
          ...newRecord,
          createdAt: serverTimestamp()
        });
        newRecord.id = docRef.id;
        saveLocalCacheItem(LOCAL_STORAGE_KEY, newRecord);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.CREATE, 'ip_phone_records');
      }

      showToast(`Extension ${inlineExtension} added successfully!`);
      // Reset inline inputs
      setInlineName('');
      setInlineExtension('');
      setInlineIp('');
      setInlineServerIp('192.168.10.200');
      setInlineUserId('');
      setInlinePassword('');
    } catch (err: any) {
      showToast("Error adding quick record: " + err.message);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id: string) => {
    try {
      const updatedList = records.filter(r => r.id !== id);
      setRecords(updatedList);
      deleteLocalCacheItem(LOCAL_STORAGE_KEY, id);

      try {
        await deleteDoc(doc(db, 'ip_phone_records', id));
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.DELETE, `ip_phone_records/${id}`);
      }

      setDeleteConfirmId(null);
      showToast("Record deleted successfully.");
    } catch (err: any) {
      showToast("Error deleting record: " + err.message);
    }
  };

  // Row Selection Handlers
  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filteredRecords.length > 0 && selectedRowIds.size === filteredRecords.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedRowIds(new Set());
  };

  const handleConfirmDeleteSelected = async () => {
    if (selectedRowIds.size === 0) return;
    const count = selectedRowIds.size;
    const idsToDelete: string[] = Array.from(selectedRowIds);

    // Immediately update local records state and cache
    const remaining = records.filter(r => !selectedRowIds.has(r.id));
    setRecords(remaining);
    setLocalCache(LOCAL_STORAGE_KEY, remaining);
    setSelectedRowIds(new Set());
    setIsBatchDeleteModalOpen(false);

    showToast(`Successfully deleted ${count} selected record(s).`);

    // Remove from Firestore
    for (const delId of idsToDelete) {
      try {
        await deleteDoc(doc(db, 'ip_phone_records', delId));
        deleteLocalCacheItem(LOCAL_STORAGE_KEY, delId);
      } catch (e) {
        console.warn("Delete batch error:", e);
      }
    }
  };

  // Copy text to clipboard
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    showToast(`Copied ${label}: ${text}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const dataToExport = filteredRecords.map((r, index) => ({
      'SL': index + 1,
      'Branch / Location': r.branchCode,
      'User Name': r.userName,
      'Department': r.department || '-',
      'IP Phone Number': r.ipAddress || '-',
      'Ext No.': r.extensionNumber,
      'Server IP': r.pbxServer || '-',
      'User ID': r.sipUser || r.extensionNumber || '-',
      'Password': r.sipPassword || '-',
      'MAC Address': r.macAddress || '-',
      'Status': r.status,
      'Distribution Date': r.distributionDate || '-',
      'Remarks': r.remarks || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IP Phone Ledger');

    // Auto column widths
    worksheet['!cols'] = [
      { wch: 6 },  // SL
      { wch: 18 }, // Branch / Location
      { wch: 22 }, // User Name
      { wch: 20 }, // Department
      { wch: 18 }, // IP Phone Number
      { wch: 12 }, // Ext No.
      { wch: 18 }, // Server IP
      { wch: 15 }, // User ID
      { wch: 16 }, // Password
      { wch: 20 }, // MAC Address
      { wch: 12 }, // Status
      { wch: 16 }, // Distribution Date
      { wch: 25 }, // Remarks
    ];

    XLSX.writeFile(workbook, `IP_Phone_Info_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast("Excel sheet exported successfully!");
  };

  // Import from Excel (.xlsx, .xls, .csv)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    showToast("Processing Excel file...");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        showToast("No data found in the uploaded file.");
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const newImportedRecords: IpPhoneRecord[] = [];
      let baseSl = records.length > 0 ? Math.max(...records.map(r => r.sl || 0)) : 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        // Flexible key lookups
        const userName = String(
          row['User Name'] || row['User / Desk Name'] || row['Name'] || row['User'] || row['ইউজার নাম'] || ''
        ).trim();

        const extNo = String(
          row['Ext No.'] || row['Extension Number'] || row['Extension'] || row['Ext'] || row['ডায়াল এক্সটেনশন'] || ''
        ).trim();

        const ipPhone = String(
          row['IP Phone Number'] || row['IP Phone'] || row['IP Address'] || row['IP'] || row['আইপি ফোন নম্বর'] || ''
        ).trim();

        const branch = String(
          row['Branch / Location'] || row['Branch'] || row['Location'] || row['শাখা'] || 'Head Office'
        ).trim();

        const dept = String(
          row['Department'] || row['Dept'] || row['বিভাগ'] || 'Information Technology'
        ).trim();

        const serverIp = String(
          row['Server IP'] || row['PBX Server'] || row['PBX Server IP'] || row['PBX'] || row['সার্ভার আইপি'] || '192.168.10.200'
        ).trim();

        const userId = String(
          row['User ID'] || row['SIP User'] || row['SIP Account'] || row['ইউজার আইডি'] || extNo || ''
        ).trim();

        const password = String(
          row['Password'] || row['Pass'] || row['SIP Password'] || row['Secret'] || row['পাসওয়ার্ড'] || ''
        ).trim();

        const mac = String(
          row['MAC Address'] || row['MAC'] || row['ম্যাক অ্যাড্রেস'] || ''
        ).trim();

        let statusVal: 'Active' | 'Inactive' = 'Active';
        const rawStatus = String(row['Status'] || row['Device Status'] || row['স্ট্যাটাস'] || '').trim().toLowerCase();
        if (rawStatus.includes('inact') || rawStatus.includes('নিষ্ক্রিয়') || rawStatus === 'inactive') {
          statusVal = 'Inactive';
        }

        const distDate = String(
          row['Distribution Date'] || row['Date'] || row['তারিখ'] || new Date().toISOString().split('T')[0]
        ).trim();

        const remarksVal = String(
          row['Remarks'] || row['Notes'] || row['Remarks / Notes'] || row['মন্তব্য'] || 'Imported from Excel'
        ).trim();

        // Skip row if no userName, extension, or IP phone
        if (!userName && !extNo && !ipPhone) {
          continue;
        }

        baseSl += 1;
        const tempId = `import-${Date.now()}-${i}`;
        const recordToAdd: IpPhoneRecord = {
          id: tempId,
          sl: baseSl,
          branchCode: branch,
          locationName: branch,
          userName: userName || `User ${extNo || baseSl}`,
          department: dept,
          designation: '',
          extensionNumber: extNo || String(1000 + baseSl),
          ipAddress: ipPhone,
          macAddress: mac,
          brandModel: 'Yealink SIP-T21P E2',
          sipUser: userId || extNo,
          sipPassword: password,
          pbxServer: serverIp,
          port: '5060',
          status: statusVal,
          distributionDate: distDate,
          remarks: remarksVal,
          createdAt: new Date().toISOString()
        };

        newImportedRecords.push(recordToAdd);
      }

      if (newImportedRecords.length === 0) {
        showToast("No valid rows could be parsed from the file.");
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Update state and local cache
      const updatedAll = [...records, ...newImportedRecords];
      setRecords(updatedAll);
      setLocalCache(LOCAL_STORAGE_KEY, updatedAll);

      // Async write to Firestore in background
      for (const rec of newImportedRecords) {
        try {
          const docRef = await addDoc(collection(db, 'ip_phone_records'), {
            ...rec,
            createdAt: serverTimestamp()
          });
          rec.id = docRef.id;
        } catch (dbErr) {
          console.warn("Firestore import write skipped/failed:", dbErr);
        }
      }
      setLocalCache(LOCAL_STORAGE_KEY, updatedAll);

      showToast(`Successfully imported ${newImportedRecords.length} IP Phone records!`);
    } catch (err: any) {
      console.error("Import error:", err);
      showToast("Error importing Excel file: " + (err.message || String(err)));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Capture Screenshot & Copy / Download
  const handleCaptureScreenshot = async (elementRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!elementRef.current) return;
    setIsCapturingScreenshot(true);
    showToast("Generating high-resolution snapshot...");

    try {
      const canvas = await generateCanvasWithOklchFallback(elementRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // Try copying to clipboard as PNG
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            showToast("Screenshot copied to clipboard & downloaded!");
          } catch (clipErr) {
            console.info("Direct clipboard write fallback:", clipErr);
          }

          // Trigger download
          const link = document.createElement('a');
          link.download = `${filename}_${Date.now()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
      }, 'image/png');
    } catch (err: any) {
      console.error("Screenshot error:", err);
      showToast("Error capturing screenshot: " + err.message);
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Print Formatted Sheet
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-600 flex items-center justify-center font-bold shadow-xs">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  IP Phone Info Ledger
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Live Database
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                আইপি ফোন ইনফো লেজার • Corporate IP Extensions, SIP Credentials & Hardware Register
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCaptureScreenshot(printAreaRef, 'IP_Phone_Ledger_Snapshot')}
              disabled={isCapturingScreenshot}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Take screenshot and copy to clipboard"
            >
              <Camera className="h-3.5 w-3.5 text-indigo-600" />
              <span>Snapshot</span>
            </button>

            {/* Hidden Input for Excel Import */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              onChange={handleImportExcel}
              className="hidden"
            />

            {/* Excel Import Button */}
            {canEdit && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
                title="Import records from Excel spreadsheet (.xlsx, .xls, .csv)"
              >
                <Upload className="h-3.5 w-3.5 text-blue-600" />
                <span>{isImporting ? 'Importing...' : 'Excel Import'}</span>
              </button>
            )}

            {/* Excel Export Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs transition cursor-pointer"
              title="Download ledger as Excel spreadsheet (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <Download className="h-3 w-3 text-emerald-600" />
              <span>Excel Export</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              <span>Print A4</span>
            </button>

            {canEdit && (
              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add IP Phone</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Phones</span>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
            <span className="text-[10px] text-slate-500 font-medium">All Units</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active Ext.</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">{stats.active}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Online & Linked</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Spare Standby</span>
            <div className="text-xl font-extrabold text-blue-700 mt-1">{stats.spare}</div>
            <span className="text-[10px] text-blue-600 font-medium">Ready in Stock</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inactive</span>
            <div className="text-xl font-extrabold text-slate-700 mt-1">{stats.inactive}</div>
            <span className="text-[10px] text-slate-500 font-medium">Unassigned</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Damaged</span>
            <div className="text-xl font-extrabold text-rose-700 mt-1">{stats.damage}</div>
            <span className="text-[10px] text-rose-600 font-medium">Under Repair</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/20 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Branches</span>
            <div className="text-xl font-extrabold text-purple-700 mt-1">{stats.uniqueBranches}</div>
            <span className="text-[10px] text-purple-600 font-medium">Locations</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IP Phone Number, Extension, User Name, Department, Server IP, MAC, Branch..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions & Inline Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowInlineRow(!showInlineRow)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                  showInlineRow
                    ? 'bg-purple-50 text-purple-700 border-purple-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Plus className="h-3.5 w-3.5 text-purple-600" />
                <span>{showInlineRow ? 'Hide Quick Row' : 'Quick Add Row'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManageModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition cursor-pointer"
                title="Manage dropdown options"
              >
                <Settings className="h-3.5 w-3.5 text-slate-600" />
                <span>Manage Options</span>
              </button>
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
            {/* Branch Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Branch / Location
              </label>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
              >
                <option value="All">All Locations ({records.length})</option>
                {branchOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Department
              </label>
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
              >
                <option value="All">All Departments</option>
                {deptOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Status
              </label>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* IP Phone Number Filter (Replaced Phone Model) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                IP Phone Number
              </label>
              <select
                value={selectedIpFilter}
                onChange={(e) => setSelectedIpFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
              >
                <option value="All">All IP Phone Numbers</option>
                {allIpDropdownOptions.map(ip => (
                  <option key={ip} value={ip}>{ip}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Printable & Capture Area */}
        <div ref={printAreaRef} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Print-only Header */}
          <div className="hidden print:block p-6 border-b border-slate-300 text-center">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">IT MANAGER • IT DEPARTMENT</h1>
            <h2 className="text-sm font-semibold text-slate-700 mt-1 uppercase">Corporate IP Phone & Extension Ledger</h2>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-4 border-t border-slate-200 pt-2">
              <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
              <span>Total Extensions Listed: {filteredRecords.length}</span>
              <span>PBX Server: 192.168.10.200</span>
            </div>
          </div>

          {/* Quick Inline Row Entry Section */}
          {showInlineRow && canEdit && (
            <div className="p-3 bg-purple-50/70 border-b border-purple-200 flex flex-wrap items-center gap-2 text-xs no-print animate-in fade-in">
              <span className="font-extrabold text-purple-900 text-[11px] uppercase tracking-wider">Quick Add:</span>
              <select
                value={inlineBranch}
                onChange={(e) => setInlineBranch(e.target.value)}
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs"
              >
                {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input
                type="text"
                value={inlineName}
                onChange={(e) => setInlineName(e.target.value)}
                placeholder="User / Desk Name *"
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs w-36"
              />
              <select
                value={inlineDept}
                onChange={(e) => setInlineDept(e.target.value)}
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs"
              >
                {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                type="text"
                list="quick-inline-ip-options"
                value={inlineIp}
                onChange={(e) => setInlineIp(e.target.value)}
                placeholder="IP Phone No."
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs w-32 font-mono"
              />
              <datalist id="quick-inline-ip-options">
                {allIpDropdownOptions.map(ip => (
                  <option key={ip} value={ip} />
                ))}
              </datalist>
              <input
                type="text"
                value={inlineExtension}
                onChange={(e) => setInlineExtension(e.target.value)}
                placeholder="Ext No. *"
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs w-24 font-mono font-bold"
              />
              <input
                type="text"
                value={inlineServerIp}
                onChange={(e) => setInlineServerIp(e.target.value)}
                placeholder="Server IP"
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs w-32 font-mono"
              />
              <input
                type="text"
                value={inlineUserId}
                onChange={(e) => setInlineUserId(e.target.value)}
                placeholder="User ID"
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs w-24 font-mono"
              />
              <input
                type="text"
                value={inlinePassword}
                onChange={(e) => setInlinePassword(e.target.value)}
                placeholder="Password"
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs w-24 font-mono"
              />
              <select
                value={inlineStatus}
                onChange={(e) => setInlineStatus(e.target.value as any)}
                className="px-2 py-1.5 bg-white border border-purple-200 rounded text-xs font-bold"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <button
                type="button"
                onClick={handleSaveInlineRow}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-xs transition cursor-pointer"
              >
                Save
              </button>
            </div>
          )}

          {/* Selected Rows Batch Action Bar */}
          {selectedRowIds.size > 0 && (
            <div className="bg-purple-100/90 border-b border-purple-200 px-4 py-2.5 flex items-center justify-between no-print animate-in fade-in text-xs">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-purple-900">
                  {selectedRowIds.size} row{selectedRowIds.size > 1 ? 's' : ''} selected
                </span>
                <span className="text-purple-400">|</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-purple-700 hover:text-purple-900 underline font-medium cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-2xs transition cursor-pointer text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedRowIds.size})</span>
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  {/* Select Column before SL */}
                  <th className="py-3 px-3 w-10 text-center no-print">
                    <input
                      type="checkbox"
                      checked={filteredRecords.length > 0 && selectedRowIds.size === filteredRecords.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer h-3.5 w-3.5"
                      title="Select / Deselect all"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center">SL</th>
                  <th className="py-3 px-3">Branch / Location</th>
                  <th className="py-3 px-3">User Name</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">IP Phone Number</th>
                  <th className="py-3 px-3 text-center">Ext No.</th>
                  <th className="py-3 px-3">Server IP</th>
                  <th className="py-3 px-3">User ID</th>
                  <th className="py-3 px-3">Password</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center no-print w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <PhoneCall className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-sm">No IP Phone records found.</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or add a new phone.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec, idx) => {
                    const isSpare = rec.status === 'Spare';
                    const isInactive = rec.status === 'Inactive';
                    const isDamage = rec.status === 'Damage';
                    const isActive = rec.status === 'Active';
                    const isSelected = selectedRowIds.has(rec.id);

                    return (
                      <tr
                        key={rec.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected
                            ? 'bg-purple-50/70'
                            : isDamage
                            ? 'bg-rose-50/30'
                            : isSpare
                            ? 'bg-blue-50/20'
                            : ''
                        }`}
                      >
                        {/* Select Checkbox before SL */}
                        <td className="py-3 px-3 text-center no-print">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(rec.id)}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer h-3.5 w-3.5"
                          />
                        </td>

                        {/* SL */}
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Branch / Location */}
                        <td className="py-3 px-3 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-900">{rec.branchCode}</span>
                          </div>
                        </td>

                        {/* User Name */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{rec.userName}</div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3 text-slate-600">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {rec.department || '-'}
                          </span>
                        </td>

                        {/* IP Phone Number */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {rec.ipAddress ? (
                            <button
                              type="button"
                              onClick={() => handleCopy(rec.ipAddress, 'IP Phone Number')}
                              className="group flex items-center gap-1 text-slate-700 hover:text-purple-600 font-medium transition cursor-pointer"
                              title="Click to copy IP Phone Number"
                            >
                              <span>{rec.ipAddress}</span>
                              <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Extension Number */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleCopy(rec.extensionNumber, 'Extension')}
                            className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-mono font-extrabold text-xs transition cursor-pointer"
                            title="Click to copy extension"
                          >
                            <span>{rec.extensionNumber}</span>
                            <Copy className="h-3 w-3 text-purple-400 opacity-60 group-hover:opacity-100" />
                          </button>
                        </td>

                        {/* Server IP */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                          {rec.pbxServer ? (
                            <button
                              type="button"
                              onClick={() => handleCopy(rec.pbxServer || '', 'Server IP')}
                              className="group flex items-center gap-1 hover:text-purple-600 transition cursor-pointer font-medium"
                              title="Click to copy Server IP"
                            >
                              <span>{rec.pbxServer}</span>
                              <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* User ID */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {(rec.sipUser || rec.identyNumber || rec.extensionNumber) ? (
                            <button
                              type="button"
                              onClick={() => handleCopy(rec.sipUser || rec.identyNumber || rec.extensionNumber || '', 'User ID')}
                              className="group inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-purple-600 transition cursor-pointer"
                              title="Click to copy User ID"
                            >
                              <span>{rec.sipUser || rec.identyNumber || rec.extensionNumber}</span>
                              <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Password */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {rec.sipPassword ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-700 font-medium select-all">
                                {showPasswordMap[rec.id] ? rec.sipPassword : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowPasswordMap(prev => ({ ...prev, [rec.id]: !prev[rec.id] }))}
                                className="p-0.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                title={showPasswordMap[rec.id] ? "Hide password" : "Show password"}
                              >
                                {showPasswordMap[rec.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(rec.sipPassword || '', 'Password')}
                                className="p-0.5 text-slate-400 hover:text-purple-600 transition cursor-pointer"
                                title="Copy Password"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isSpare
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : isDamage
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive
                                  ? 'bg-emerald-500 animate-pulse'
                                  : isSpare
                                  ? 'bg-blue-500'
                                  : isDamage
                                  ? 'bg-rose-500'
                                  : 'bg-slate-400'
                              }`}
                            ></span>
                            {rec.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            {/* Inspect */}
                            <button
                              type="button"
                              onClick={() => setViewingRecord(rec)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                              title="Inspect Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit */}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(rec)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Edit Record"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(rec.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-800">{filteredRecords.length}</span> of{' '}
              <span className="font-bold text-slate-800">{records.length}</span> IP Phone records
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Active: <strong className="text-emerald-600">{stats.active}</strong></span>
              <span>Spare: <strong className="text-blue-600">{stats.spare}</strong></span>
              <span>Damage: <strong className="text-rose-600">{stats.damage}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center font-bold">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingRecord ? 'Edit IP Phone Information' : 'Add New IP Phone Extension'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Enter the phone hardware, user assignment, network and SIP details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveRecord} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Section 1: User & Location Information */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Branch / Location *
                    </label>
                    <select
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      required
                    >
                      {branchOptions.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      User / Desk Name *
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="e.g. Md. Emon Hossain / Reception Counter"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Department *
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    >
                      {deptOptions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Hardware & Network Details */}
              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        IP Phone Number (আইপি ফোন নম্বর)
                      </label>
                      <span className="text-[10px] text-purple-600 font-medium">Dropdown / Type</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        list="modal-ip-phone-options"
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        placeholder="e.g. 192.168.10.101"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-purple-600"
                      />
                      <datalist id="modal-ip-phone-options">
                        {allIpDropdownOptions.map(ip => (
                          <option key={ip} value={ip} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Extension Number * (ডায়াল এক্সটেনশন)
                    </label>
                    <input
                      type="text"
                      value={extensionNumber}
                      onChange={(e) => setExtensionNumber(e.target.value)}
                      placeholder="e.g. 1001"
                      className="w-full px-3 py-2 text-xs bg-purple-50/50 border border-purple-300 rounded-lg text-purple-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      MAC Address (ম্যাক অ্যাড্রেস)
                    </label>
                    <input
                      type="text"
                      value={macAddress}
                      onChange={(e) => setMacAddress(e.target.value)}
                      placeholder="e.g. 80:5E:C0:11:A2:34"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: SIP / PBX Configuration */}
              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SIP User / Account
                    </label>
                    <input
                      type="text"
                      value={sipUser}
                      onChange={(e) => setSipUser(e.target.value)}
                      placeholder="Same as extension or custom"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SIP Password / Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSipPassword ? 'text' : 'password'}
                        value={sipPassword}
                        onChange={(e) => setSipPassword(e.target.value)}
                        placeholder="Secret password"
                        className="w-full px-3 pr-9 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-purple-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSipPassword(!showSipPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSipPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      PBX Server IP / Domain
                    </label>
                    <input
                      type="text"
                      value={pbxServer}
                      onChange={(e) => setPbxServer(e.target.value)}
                      placeholder="e.g. 192.168.10.200"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Status & Assignment */}
              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status *
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Distribution Date
                    </label>
                    <input
                      type="date"
                      value={distributionDate}
                      onChange={(e) => setDistributionDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Remarks / Notes
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={2}
                      placeholder="e.g. Configured with PoE on Cisco 2960 switch port 12"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition cursor-pointer"
                >
                  {editingRecord ? 'Update IP Phone' : 'Save IP Phone Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect / Detail Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
          <div
            ref={detailCardRef}
            className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95"
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold">
                  <PhoneCall className="h-5 w-5 text-purple-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight">Extension {viewingRecord.extensionNumber}</h2>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        viewingRecord.status === 'Active'
                          ? 'bg-emerald-500 text-white'
                          : viewingRecord.status === 'Spare'
                          ? 'bg-blue-500 text-white'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {viewingRecord.status}
                    </span>
                  </div>
                  <p className="text-xs text-purple-200/90 font-medium">
                    {viewingRecord.userName} • {viewingRecord.branchCode}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCaptureScreenshot(detailCardRef, `IP_Phone_${viewingRecord.extensionNumber}`)}
                  className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                  title="Capture snapshot of this card"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewingRecord(null)}
                  className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-3.5 text-xs">
              {/* 1. User & Location */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* User Name */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      User Name:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-slate-900 text-xs font-bold truncate" title={viewingRecord.userName}>
                        {viewingRecord.userName}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingRecord.userName, 'User Name')}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                        title="Copy User Name"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Department:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-slate-900 text-xs font-bold truncate" title={viewingRecord.department || '-'}>
                        {viewingRecord.department || '-'}
                      </strong>
                    </div>
                  </div>

                  {/* Branch / Location */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Branch / Location:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-purple-700 text-xs font-bold truncate" title={viewingRecord.branchCode}>
                        {viewingRecord.branchCode}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingRecord.branchCode, 'Branch / Location')}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                        title="Copy Branch"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Hardware & Network */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  {/* IP Phone Number */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block font-sans mb-1">
                      IP Phone Number:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-slate-800 text-xs truncate" title={viewingRecord.ipAddress || '-'}>
                        {viewingRecord.ipAddress || '-'}
                      </strong>
                      {viewingRecord.ipAddress && (
                        <button
                          type="button"
                          onClick={() => handleCopy(viewingRecord.ipAddress, 'IP Phone Number')}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                          title="Copy IP Phone Number"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Extension No. */}
                  <div className="bg-white p-2.5 rounded-lg border border-purple-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block font-sans mb-1">
                      Extension No.:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-purple-700 text-xs font-extrabold truncate" title={viewingRecord.extensionNumber}>
                        {viewingRecord.extensionNumber}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingRecord.extensionNumber, 'Extension No.')}
                        className="p-1 text-purple-600 hover:text-purple-800 cursor-pointer shrink-0"
                        title="Copy Extension"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* MAC Address */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block font-sans mb-1">
                      MAC Address:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-slate-800 text-xs uppercase truncate" title={viewingRecord.macAddress || '-'}>
                        {viewingRecord.macAddress || '-'}
                      </strong>
                      {viewingRecord.macAddress && (
                        <button
                          type="button"
                          onClick={() => handleCopy(viewingRecord.macAddress, 'MAC Address')}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                          title="Copy MAC Address"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Horizontal Credentials: User id, User Pass, Server IP (Red marked box - 3rd item) */}
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  {/* User id */}
                  <div className="bg-white p-2.5 rounded-lg border border-purple-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block font-sans mb-1">
                      User id
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-slate-900 text-xs font-bold truncate">
                        {viewingRecord.sipUser || viewingRecord.extensionNumber}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingRecord.sipUser || viewingRecord.extensionNumber, 'User id')}
                        className="p-1 text-purple-600 hover:text-purple-800 cursor-pointer shrink-0"
                        title="Copy User id"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* User Pass */}
                  <div className="bg-white p-2.5 rounded-lg border border-purple-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block font-sans mb-1">
                      User Pass
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 text-xs truncate">
                        {showPasswordMap[viewingRecord.id]
                          ? (viewingRecord.sipPassword || 'None')
                          : '••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswordMap(prev => ({ ...prev, [viewingRecord.id]: !prev[viewingRecord.id] }))
                          }
                          className="p-1 text-slate-400 hover:text-slate-700 font-sans cursor-pointer"
                          title={showPasswordMap[viewingRecord.id] ? "Hide Password" : "Show Password"}
                        >
                          {showPasswordMap[viewingRecord.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(viewingRecord.sipPassword || '', 'User Pass')}
                          className="p-1 text-purple-600 hover:text-purple-800 cursor-pointer"
                          title="Copy Password"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Server IP */}
                  <div className="bg-white p-2.5 rounded-lg border border-purple-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block font-sans mb-1">
                      Server IP
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-slate-900 text-xs font-bold truncate">
                        {viewingRecord.pbxServer || '192.168.10.200'}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingRecord.pbxServer || '192.168.10.200', 'Server IP')}
                        className="p-1 text-purple-600 hover:text-purple-800 cursor-pointer shrink-0"
                        title="Copy Server IP"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Distribution */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Status:</span>
                    <span
                      className={`inline-block font-bold text-xs px-2 py-0.5 rounded ${
                        viewingRecord.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {viewingRecord.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Distribution Date:</span>
                    <strong className="text-slate-800">{viewingRecord.distributionDate || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {viewingRecord.remarks && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Remarks / Notes</span>
                  <p className="text-slate-700">{viewingRecord.remarks}</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  const summary = `IP Phone: ${viewingRecord.ipAddress || '-'}\nExtension: ${viewingRecord.extensionNumber}\nUser Name: ${viewingRecord.userName}\nDepartment: ${viewingRecord.department || '-'}\nBranch: ${viewingRecord.branchCode}\nMAC Address: ${viewingRecord.macAddress || '-'}\nServer IP: ${viewingRecord.pbxServer || '-'}\nUser ID: ${viewingRecord.sipUser || viewingRecord.extensionNumber}\nPassword: ${viewingRecord.sipPassword || '-'}\nStatus: ${viewingRecord.status}`;
                  handleCopy(summary, 'Configuration Summary');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Config</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="px-4 py-1.5 font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete IP Phone Record?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to remove this IP phone record? This action will permanently remove it from the live database.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRecord(deleteConfirmId)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Delete {selectedRowIds.size} Selected Record{selectedRowIds.size > 1 ? 's' : ''}?
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to delete these {selectedRowIds.size} selected IP phone record(s)? This action will permanently remove them from the ledger and live database.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer shadow-sm"
              >
                Yes, Delete All ({selectedRowIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Options Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-4 w-4 text-purple-600" />
                Manage System Dropdown Options
              </h3>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4">
              {(['Branch', 'Department', 'IpPhone'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setManageCategory(cat)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                    manageCategory === cat
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'Branch' ? 'Branches' : cat === 'Department' ? 'Departments' : 'IP Phone Numbers'}
                </button>
              ))}
            </div>

            {/* Add New Option input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newOptionValue}
                onChange={(e) => setNewOptionValue(e.target.value)}
                placeholder={`Add new ${manageCategory === 'IpPhone' ? 'IP phone number' : manageCategory.toLowerCase()}...`}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newOptionValue.trim()) return;
                  const val = newOptionValue.trim();
                  if (manageCategory === 'Branch') {
                    if (!branchOptions.includes(val)) setBranchOptions(prev => [...prev, val]);
                  } else if (manageCategory === 'Department') {
                    if (!deptOptions.includes(val)) setDeptOptions(prev => [...prev, val]);
                  } else {
                    if (!ipOptions.includes(val)) setIpOptions(prev => [...prev, val]);
                  }
                  setNewOptionValue('');
                  showToast(`Added new ${manageCategory === 'IpPhone' ? 'IP Phone Number' : manageCategory}: ${val}`);
                }}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Option List */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50 text-xs">
              {(manageCategory === 'Branch' ? branchOptions : manageCategory === 'Department' ? deptOptions : ipOptions).map((opt) => {
                const isEditing = editingOption === opt;

                return (
                  <div
                    key={opt}
                    className={`flex items-center justify-between px-3 py-2 bg-white rounded-lg border transition-all ${
                      isEditing ? 'border-purple-400 ring-2 ring-purple-100 shadow-sm' : 'border-slate-200 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editingOptionValue}
                          onChange={(e) => setEditingOptionValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditOption(opt);
                            if (e.key === 'Escape') handleCancelEditOption();
                          }}
                          autoFocus
                          className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-purple-300 rounded-md text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600 font-mono font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditOption(opt)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition cursor-pointer shadow-2xs"
                          title="Save change"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditOption}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition cursor-pointer"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`font-medium text-slate-800 truncate pr-2 ${manageCategory === 'IpPhone' ? 'font-mono' : ''}`} title={opt}>
                          {opt}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditOption(opt)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition cursor-pointer"
                            title="Edit this option"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (manageCategory === 'Branch') {
                                setBranchOptions(prev => prev.filter(x => x !== opt));
                              } else if (manageCategory === 'Department') {
                                setDeptOptions(prev => prev.filter(x => x !== opt));
                              } else {
                                setIpOptions(prev => prev.filter(x => x !== opt));
                              }
                              showToast(`Removed: ${opt}`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            title="Delete this option"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

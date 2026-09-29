import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceeded, subscribeQuotaState, checkIsQuotaError, setQuotaExceededState } from '../firebase';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { Ledger, Credential } from '../types';
import { 
  Plus, Search, Trash2, Edit2, Key, BookOpen, Download, Upload, X, Check, Eye, EyeOff, 
  Copy, CopyPlus, Globe, User, Mail, Lock, ShieldCheck, FolderPlus, RefreshCw, FileSpreadsheet, Tag, Table, LayoutGrid,
  ChevronDown, Settings, FolderKanban
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface NotebookLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export const NotebookLedger: React.FC<NotebookLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  const [ledgers, setLedgers] = useState<Ledger[]>(() => getLocalCache<Ledger>('notebook_ledgers') || []);
  const [credentials, setCredentials] = useState<Credential[]>(() => getLocalCache<Credential>('notebook_credentials') || []);

  // View/Filter States
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedFieldMap, setCopiedFieldMap] = useState<Record<string, boolean>>({});

  // Modals & Form States
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [viewingCredential, setViewingCredential] = useState<Credential | null>(null);
  const [modalLedgerId, setModalLedgerId] = useState('');

  // Form Fields (Multi-Row Support)
  interface CredentialRowInput {
    id: string;
    websiteName: string;
    userNameOrMobile: string;
    email: string;
    password: string;
    remarks: string;
    showPassword?: boolean;
  }
  const [credentialRows, setCredentialRows] = useState<CredentialRowInput[]>([]);

  // Ledger Category Modals
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isManageLedgersModalOpen, setIsManageLedgersModalOpen] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState('');
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);

  // Confirmation Modals
  const [deleteConfirmCredentialId, setDeleteConfirmCredentialId] = useState<string | null>(null);
  const [deleteConfirmLedgerId, setDeleteConfirmLedgerId] = useState<string | null>(null);

  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded);

  useEffect(() => {
    return subscribeQuotaState(setQuotaExceeded);
  }, []);

  // Subscribe to ledgers collection
  useEffect(() => {
    const qLedgers = query(collection(db, 'ledgers'));
    const unsubLedgers = onSnapshot(qLedgers, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Ledger[];
      const cached = getLocalCache<Ledger>('notebook_ledgers') || [];
      const map = new Map<string, Ledger>();
      cached.forEach(l => { if (l && l.id) map.set(l.id, l); });
      data.forEach(l => { if (l && l.id) map.set(l.id, l); });
      const finalLedgers = Array.from(map.values());
      setLedgers(finalLedgers);
      setLocalCache('notebook_ledgers', finalLedgers);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'ledgers');
      const cached = getLocalCache<Ledger>('notebook_ledgers');
      if (cached) setLedgers(cached);
    });

    // Subscribe to notebook_credentials collection
    const qCredentials = query(collection(db, 'notebook_credentials'));
    const unsubCredentials = onSnapshot(qCredentials, (snapshot) => {
      const liveDocs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Credential[];

      const cached = getLocalCache<Credential>('notebook_credentials') || [];
      const combinedMap = new Map<string, Credential>();
      cached.forEach(c => { if (c && c.id) combinedMap.set(c.id, c); });
      liveDocs.forEach(c => { if (c && c.id) combinedMap.set(c.id, c); });

      const combinedList = Array.from(combinedMap.values());
      setCredentials(combinedList);
      setLocalCache('notebook_credentials', combinedList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notebook_credentials');
      const cached = getLocalCache<Credential>('notebook_credentials');
      if (cached) setCredentials(cached);
    });

    return () => {
      unsubLedgers();
      unsubCredentials();
    };
  }, []);

  // Map ledger names
  const ledgerMap = useMemo(() => {
    const map = new Map<string, string>();
    ledgers.forEach(l => map.set(l.id, l.name));
    return map;
  }, [ledgers]);

  // Filtered credentials
  const filteredCredentials = useMemo(() => {
    const list = credentials.filter(cred => {
      const matchesLedger = selectedLedgerId === 'ALL' || cred.ledgerId === selectedLedgerId;
      const ledgerName = ledgerMap.get(cred.ledgerId) || '';
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        cred.websiteName?.toLowerCase().includes(q) ||
        cred.userNameOrMobile?.toLowerCase().includes(q) ||
        cred.email?.toLowerCase().includes(q) ||
        cred.remarks?.toLowerCase().includes(q) ||
        ledgerName.toLowerCase().includes(q)
      );
      return matchesLedger && matchesSearch;
    });

    return list.sort((a, b) => {
      const nameA = (a.websiteName || '').trim();
      const nameB = (b.websiteName || '').trim();
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
    });
  }, [credentials, selectedLedgerId, searchQuery, ledgerMap]);

  // Helper: Copy text with instant visual feedback
  const handleCopyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedFieldMap(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedFieldMap(prev => ({ ...prev, [key]: false }));
    }, 1800);
  };

  // Multi-Row Helper Actions
  const handleAddRow = () => {
    setCredentialRows(prev => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        websiteName: '',
        userNameOrMobile: '',
        email: '',
        password: '',
        remarks: '',
        showPassword: false
      }
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (credentialRows.length <= 1) return;
    setCredentialRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleRowChange = (rowId: string, field: keyof CredentialRowInput, value: any) => {
    setCredentialRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const handleGenerateRowPassword = (rowId: string) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    let res = '';
    for (let i = 0; i < 14; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    handleRowChange(rowId, 'password', res);
  };

  // Handle Open Create/Edit Credential Modal
  const openCredentialModal = (cred?: Credential) => {
    const defaultLedger = selectedLedgerId !== 'ALL' ? selectedLedgerId : (ledgers[0]?.id || '');
    setModalLedgerId(defaultLedger);

    if (cred) {
      setEditingCredential(cred);
      setCredentialRows([{
        id: cred.id || `row_${Date.now()}`,
        websiteName: cred.websiteName || '',
        userNameOrMobile: cred.userNameOrMobile || '',
        email: cred.email || '',
        password: cred.password || '',
        remarks: cred.remarks || '',
        showPassword: false
      }]);
    } else {
      setEditingCredential(null);
      // Create 1 default empty row
      const initialRows: CredentialRowInput[] = [{
        id: `row_${Date.now()}_0`,
        websiteName: '',
        userNameOrMobile: '',
        email: '',
        password: '',
        remarks: '',
        showPassword: false
      }];
      setCredentialRows(initialRows);
    }
    setIsCredentialModalOpen(true);
  };

  // Handle Copy / Duplicate Credential to Create New
  const handleCopyAsNew = (cred: Credential) => {
    const defaultLedger = selectedLedgerId !== 'ALL' ? selectedLedgerId : (ledgers[0]?.id || '');
    setModalLedgerId(defaultLedger);
    setEditingCredential(null);
    setCredentialRows([{
      id: `row_${Date.now()}_1`,
      websiteName: cred.websiteName || '',
      userNameOrMobile: cred.userNameOrMobile || '',
      email: cred.email || '',
      password: cred.password || '',
      remarks: cred.remarks || '',
      showPassword: true
    }]);
    setIsCredentialModalOpen(true);
  };

  // Save Credential(s)
  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (credentialRows.length === 0) return;

    const effectiveLedgerId = modalLedgerId || (selectedLedgerId !== 'ALL' ? selectedLedgerId : '') || ledgers[0]?.id || 'default';

    // Filter out rows that are completely empty (if adding new)
    const activeRows = editingCredential 
      ? credentialRows 
      : credentialRows.filter(r => (r.websiteName || '').trim() || (r.userNameOrMobile || '').trim() || (r.email || '').trim() || (r.password || '').trim() || (r.remarks || '').trim());

    if (activeRows.length === 0) {
      alert('Please fill in at least one field to save.');
      return;
    }

    try {
      if (editingCredential) {
        // Edit single entry
        const row = activeRows[0];
        const payload: Credential = {
          id: editingCredential.id,
          userId: currentUser?.uid || 'system_user',
          ledgerId: effectiveLedgerId,
          websiteName: (row.websiteName || '').trim(),
          userNameOrMobile: (row.userNameOrMobile || '').trim(),
          email: (row.email || '').trim(),
          password: row.password || '',
          remarks: (row.remarks || '').trim(),
          updatedAt: new Date().toISOString()
        };
        const updatedCache = saveLocalCacheItem('notebook_credentials', payload);
        setCredentials(updatedCache);
        setIsCredentialModalOpen(false);

        // Sync to Firestore non-blocking
        setDoc(doc(db, 'notebook_credentials', editingCredential.id), payload, { merge: true })
          .then(() => deleteDoc(doc(db, 'credentials', editingCredential.id)).catch(() => {}))
          .catch(dbErr => {
            if (checkIsQuotaError(dbErr)) {
              setQuotaExceededState(true);
            }
            console.warn('Firestore sync skipped/failed. Local cache updated.', dbErr);
          });
      } else {
        // Save multiple new entries
        let newItems: Credential[] = [];
        for (let i = 0; i < activeRows.length; i++) {
          const row = activeRows[i];
          const docId = `cred_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`;
          const payload: Credential = {
            id: docId,
            userId: currentUser?.uid || 'system_user',
            ledgerId: effectiveLedgerId,
            websiteName: (row.websiteName || '').trim(),
            userNameOrMobile: (row.userNameOrMobile || '').trim(),
            email: (row.email || '').trim(),
            password: row.password || '',
            remarks: (row.remarks || '').trim(),
            createdAt: new Date().toISOString()
          };
          newItems.push(payload);
          saveLocalCacheItem('notebook_credentials', payload);
          
          setDoc(doc(db, 'notebook_credentials', docId), payload).catch(dbErr => {
            if (checkIsQuotaError(dbErr)) {
              setQuotaExceededState(true);
            }
            console.warn('Firestore write failed for row. Local copy preserved.', dbErr);
          });
        }
        setCredentials(prev => [...newItems, ...prev]);
        setIsCredentialModalOpen(false);
      }
    } catch (err) {
      console.error('Error saving credential(s):', err);
      setIsCredentialModalOpen(false);
    }
  };

  // Delete Credential
  const handleDeleteCredential = async (id: string) => {
    try {
      const updatedCache = deleteLocalCacheItem<Credential>('notebook_credentials', id);
      setCredentials(updatedCache);
      setDeleteConfirmCredentialId(null);

      try {
        await deleteDoc(doc(db, 'notebook_credentials', id)).catch(() => {});
        await deleteDoc(doc(db, 'credentials', id)).catch(() => {});
      } catch (dbErr) {
        if (checkIsQuotaError(dbErr)) {
          setQuotaExceededState(true);
        }
      }
    } catch (err) {
      console.error('Error deleting credential:', err);
      setDeleteConfirmCredentialId(null);
    }
  };

  // Save Ledger Category
  const handleSaveLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLedgerName.trim()) return;

    try {
      if (editingLedger) {
        const updatedLedger: Ledger = { ...editingLedger, name: newLedgerName.trim() };
        const updatedCache = saveLocalCacheItem('notebook_ledgers', updatedLedger);
        setLedgers(updatedCache);

        try {
          await updateDoc(doc(db, 'ledgers', editingLedger.id), {
            name: newLedgerName.trim()
          });
        } catch (dbErr) {
          if (checkIsQuotaError(dbErr)) setQuotaExceededState(true);
        }
      } else {
        const ledgerIdDoc = `ledger_${Date.now()}`;
        const newLedger: Ledger = {
          id: ledgerIdDoc,
          userId: currentUser?.uid || 'system_user',
          name: newLedgerName.trim(),
          createdAt: new Date().toISOString()
        };
        const updatedCache = saveLocalCacheItem('notebook_ledgers', newLedger);
        setLedgers(updatedCache);

        try {
          await setDoc(doc(db, 'ledgers', ledgerIdDoc), newLedger);
        } catch (dbErr) {
          if (checkIsQuotaError(dbErr)) setQuotaExceededState(true);
        }
      }
      setNewLedgerName('');
      setEditingLedger(null);
      setIsLedgerModalOpen(false);
    } catch (err) {
      console.error('Error saving ledger:', err);
      setIsLedgerModalOpen(false);
    }
  };

  // Delete Ledger Category
  const handleDeleteLedger = async (id: string) => {
    try {
      const updatedCache = deleteLocalCacheItem<Ledger>('notebook_ledgers', id);
      setLedgers(updatedCache);
      if (selectedLedgerId === id) setSelectedLedgerId('ALL');
      setDeleteConfirmLedgerId(null);

      try {
        await deleteDoc(doc(db, 'ledgers', id));
      } catch (dbErr) {
        if (checkIsQuotaError(dbErr)) setQuotaExceededState(true);
      }
    } catch (err) {
      console.error('Error deleting ledger:', err);
      setDeleteConfirmLedgerId(null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredCredentials.map(c => ({
      "Website Name": c.websiteName,
      "Ledger": ledgerMap.get(c.ledgerId) || 'Unassigned',
      "User Name / Mobile": c.userNameOrMobile,
      "Email": c.email || '',
      "Password": c.password,
      "Remarks": c.remarks || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notebook Credentials");
    XLSX.writeFile(workbook, `Notebook_Ledger_Credentials_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to JSON
  const handleExportJson = () => {
    const exportData = filteredCredentials.map(c => ({
      ...c,
      ledgerName: ledgerMap.get(c.ledgerId) || 'Unassigned'
    }));
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Notebook_Ledger_Credentials_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import from Excel / JSON
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const content = evt.target?.result as string;
          const rawData = JSON.parse(content);
          const items = Array.isArray(rawData) ? rawData : (rawData.credentials || [rawData]);

          let importedCount = 0;
          for (const item of items) {
            const webName = item.websiteName || item["Website Name"] || item.website;
            const userMobile = item.userNameOrMobile || item["User Name / Mobile"] || item.username;
            const pwd = item.password || item["Password"];
            if (webName && userMobile && pwd) {
              const docId = `cred_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              const defaultTargetLedger = selectedLedgerId !== 'ALL' ? selectedLedgerId : (ledgers[0]?.id || 'default');
              const payload: Credential = {
                id: docId,
                userId: currentUser?.uid || 'system_user',
                ledgerId: item.ledgerId || defaultTargetLedger,
                websiteName: String(webName).trim(),
                userNameOrMobile: String(userMobile).trim(),
                email: item.email ? String(item.email).trim() : '',
                password: String(pwd),
                remarks: item.remarks ? String(item.remarks).trim() : '',
                createdAt: new Date().toISOString()
              };

              const updatedCache = saveLocalCacheItem('notebook_credentials', payload);
              setCredentials(updatedCache);

              try {
                await setDoc(doc(db, 'notebook_credentials', docId), payload);
              } catch (dbErr) {
                if (checkIsQuotaError(dbErr)) setQuotaExceededState(true);
              }
              importedCount++;
            }
          }
          alert(`Imported ${importedCount} credentials successfully from JSON!`);
        } catch (err) {
          console.error('Error importing JSON:', err);
          alert('Failed to parse JSON file.');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        let importedCount = 0;
        for (const row of rawData as any[]) {
          const webName = row["Website Name"] || row["Website"] || row["websiteName"];
          const userMobile = row["User Name / Mobile"] || row["Username"] || row["userNameOrMobile"];
          const pwd = row["Password"] || row["password"];
          if (webName && userMobile && pwd) {
            const docId = `cred_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const defaultTargetLedger = selectedLedgerId !== 'ALL' ? selectedLedgerId : (ledgers[0]?.id || 'default');
            const payload: Credential = {
              id: docId,
              userId: currentUser?.uid || 'system_user',
              ledgerId: defaultTargetLedger,
              websiteName: String(webName),
              userNameOrMobile: String(userMobile),
              email: row["Email"] ? String(row["Email"]) : '',
              password: String(pwd),
              remarks: row["Remarks"] ? String(row["Remarks"]) : '',
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'notebook_credentials', docId), payload);
            importedCount++;
          }
        }
        alert(`Successfully imported ${importedCount} credential records!`);
      } catch (err) {
        console.error("Error importing file:", err);
        alert("Failed to parse Excel file. Please check format.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300 shadow-inner">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Website Credentials
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold ml-2">
                    Total Users: {credentials.length}
                  </span>
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  Securely record, manage, and categorize website credentials, user logins, and passwords in custom ledgers.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  setEditingLedger(null);
                  setNewLedgerName('');
                  setIsLedgerModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <FolderPlus className="h-4 w-4 text-indigo-400" />
                New Ledger
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              title="Export Credentials to Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              Excel
            </button>

            <button
              onClick={handleExportJson}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              title="Export Credentials to JSON"
            >
              <Download className="h-4 w-4 text-blue-400" />
              JSON
            </button>

            {canEdit && (
              <label className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer">
                <Upload className="h-4 w-4 text-amber-400" />
                Import
                <input type="file" accept=".xlsx, .xls, .csv, .json" onChange={handleImportExcel} className="hidden" />
              </label>
            )}

            {canEdit && (
              <button
                onClick={() => openCredentialModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Credential
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Selector Dropdown System & Search Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-4">
        {/* Ledger Dropdown System Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 p-3.5 rounded-2xl border border-indigo-100/80 shadow-2xs">
          {/* Dropdown Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider block">
                  Ledger Category
                </span>
                <span className="text-xs font-bold text-slate-800">Notebook Ledger</span>
              </div>
            </div>

            <div className="relative flex-1 min-w-[240px] max-w-md w-full">
              <select
                value={selectedLedgerId}
                onChange={(e) => setSelectedLedgerId(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-white border-2 border-indigo-200/90 hover:border-indigo-400 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition cursor-pointer appearance-none"
              >
                <option value="ALL">📖 All Ledgers ({credentials.length} entries total)</option>
                {ledgers.map(l => {
                  const count = credentials.filter(c => c.ledgerId === l.id).length;
                  return (
                    <option key={l.id} value={l.id}>
                      🏷️ {l.name} ({count} items)
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-600">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>

            {selectedLedgerId !== 'ALL' && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-xs">
                  <span>Filtered: {ledgerMap.get(selectedLedgerId) || 'Selected Ledger'}</span>
                  <button
                    onClick={() => setSelectedLedgerId('ALL')}
                    className="hover:bg-indigo-700 p-0.5 rounded-md transition cursor-pointer"
                    title="Clear ledger filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Manage & Add Ledger Buttons */}
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                onClick={() => setIsManageLedgersModalOpen(true)}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
                title="Manage All Ledgers"
              >
                <Settings className="h-4 w-4 text-indigo-600" />
                Manage Ledgers
              </button>
              <button
                onClick={() => {
                  setEditingLedger(null);
                  setNewLedgerName('');
                  setIsLedgerModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New Ledger
              </button>
            </div>
          )}
        </div>

        {/* Search Bar & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-auto flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search website, username, mobile, email, remarks, or ledger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <Table className="h-3.5 w-3.5" />
              Table View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Card View
            </button>
          </div>
        </div>
      </div>

      {/* Credentials Table / Cards Display */}
      {filteredCredentials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-inner">
            <Key className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Credentials Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery 
              ? 'No credential records match your search criteria. Try a different query.'
              : 'There are no website credentials stored in this ledger yet. Click "Add Credential" to create your first entry.'}
          </p>
          {canEdit && (
            <button
              onClick={() => openCredentialModal()}
              className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs inline-flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Credential Now
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW SYSTEM */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12 border-r border-slate-800">#</th>
                  <th className="py-3 px-3.5 border-r border-slate-800 w-36">Ledger Category</th>
                  <th className="py-3 px-4 border-r border-slate-800 min-w-[210px]">Website & User / Mobile</th>
                  <th className="py-3 px-4 border-r border-slate-800 min-w-[220px]">Email & Password</th>
                  <th className="py-3 px-4 border-r border-slate-800">Remarks / Notes</th>
                  <th className="py-3 px-3.5 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {filteredCredentials.map((cred, idx) => {
                  const isPasswordShown = showPasswordMap[cred.id] || false;
                  const ledgerName = ledgerMap.get(cred.ledgerId) || 'Unassigned';

                  return (
                    <tr 
                      key={cred.id} 
                      className={`hover:bg-indigo-50/40 transition duration-150 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* SL */}
                      <td className="py-3 px-3 text-center font-bold text-slate-400 text-[11px] border-r border-slate-200/60 align-middle">
                        {idx + 1}
                      </td>

                      {/* Ledger Category */}
                      <td className="py-3 px-3.5 border-r border-slate-200/60 align-middle">
                        <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 truncate max-w-[130px]" title={ledgerName}>
                          {ledgerName}
                        </span>
                      </td>

                      {/* Website Name (Top) & User Name / Mobile (Below) */}
                      <td className="py-2.5 px-4 border-r border-slate-200/60 align-middle">
                        <div className="space-y-1.5">
                          {/* Website Name */}
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Globe className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate" title={cred.websiteName || 'No Website'}>
                              {cred.websiteName || <span className="text-slate-400 font-normal italic text-[11px]">No Website</span>}
                            </span>
                          </div>

                          {/* User Name or Mobile */}
                          <div className="flex items-center justify-between gap-1.5 text-[11px] bg-slate-100/90 px-2 py-0.5 rounded-lg border border-slate-200/60 text-slate-700">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate font-semibold text-slate-700" title={cred.userNameOrMobile || 'No Username'}>
                                {cred.userNameOrMobile || <span className="text-slate-400 font-normal italic">No Username</span>}
                              </span>
                            </div>
                            {cred.userNameOrMobile && (
                              <button
                                onClick={() => handleCopyText(`user_${cred.id}`, cred.userNameOrMobile)}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer shrink-0"
                                title="Copy Username"
                              >
                                {copiedFieldMap[`user_${cred.id}`] ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email Address (Top) & Password (Below) */}
                      <td className="py-2.5 px-4 border-r border-slate-200/60 align-middle">
                        <div className="space-y-1.5">
                          {/* Email Address */}
                          <div className="flex items-center justify-between gap-1.5 text-[11px] px-1 text-slate-600 min-h-[20px]">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate" title={cred.email || 'No Email'}>
                                {cred.email || <span className="text-slate-400 italic text-[10px]">No Email</span>}
                              </span>
                            </div>
                            {cred.email && (
                              <button
                                onClick={() => handleCopyText(`email_${cred.id}`, cred.email || '')}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer shrink-0"
                                title="Copy Email"
                              >
                                {copiedFieldMap[`email_${cred.id}`] ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Password */}
                          <div className="flex items-center justify-between bg-slate-900 text-white px-2 py-1 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-1.5 min-w-0 truncate mr-1.5">
                              <Lock className="h-3 w-3 text-indigo-400 shrink-0" />
                              <span className="font-mono text-[11px] text-indigo-200 tracking-wider truncate">
                                {cred.password ? (isPasswordShown ? cred.password : '••••••••••••') : <span className="text-slate-500 italic font-sans text-[10px]">No Password</span>}
                              </span>
                            </div>
                            {cred.password && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setShowPasswordMap(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                                  className="p-0.5 text-slate-400 hover:text-white transition cursor-pointer"
                                  title={isPasswordShown ? "Hide Password" : "Show Password"}
                                >
                                  {isPasswordShown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={() => handleCopyText(`pass_${cred.id}`, cred.password)}
                                  className="p-0.5 text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                                  title="Copy Password"
                                >
                                  {copiedFieldMap[`pass_${cred.id}`] ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4 border-r border-slate-200/60 max-w-[200px] align-middle">
                        {cred.remarks ? (
                          <span className="text-[11px] text-slate-500 italic line-clamp-2" title={cred.remarks}>
                            {cred.remarks}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingCredential(cred)}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleCopyAsNew(cred)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Copy & Create New"
                            >
                              <CopyPlus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => openCredentialModal(cred)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Edit Credential"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmCredentialId(cred.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Credential"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCredentials.map((cred) => {
            const isPasswordShown = showPasswordMap[cred.id] || false;
            const ledgerName = ledgerMap.get(cred.ledgerId) || 'Unassigned';

            return (
              <div 
                key={cred.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition duration-200 p-5 flex flex-col justify-between group relative"
              >
                <div className="space-y-3">
                  {/* Top Header: Website Name & Ledger Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="inline-block text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md truncate max-w-[180px] mb-1">
                          {ledgerName}
                        </span>
                        <h3 className="text-sm font-bold text-slate-800 truncate" title={cred.websiteName}>
                          {cred.websiteName}
                        </h3>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setViewingCredential(cred)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleCopyAsNew(cred)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Copy & Create New"
                        >
                          <CopyPlus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => openCredentialModal(cred)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Edit Credential"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteConfirmCredentialId(cred.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Delete Credential"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body Details: User Name, Email, Password */}
                  <div className="space-y-2 text-xs">
                    {/* User Name / Mobile */}
                    <div className="flex items-center justify-between bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 truncate" title={cred.userNameOrMobile}>
                          {cred.userNameOrMobile}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyText(`user_${cred.id}`, cred.userNameOrMobile)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-white transition cursor-pointer shrink-0 flex items-center gap-1 text-[10px]"
                        title="Copy Username"
                      >
                        {copiedFieldMap[`user_${cred.id}`] ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Copied</span>
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Email (if present) */}
                    {cred.email && (
                      <div className="flex items-center justify-between bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-600 truncate" title={cred.email}>
                            {cred.email}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyText(`email_${cred.id}`, cred.email || '')}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-white transition cursor-pointer shrink-0 flex items-center gap-1 text-[10px]"
                          title="Copy Email"
                        >
                          {copiedFieldMap[`email_${cred.id}`] ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Copied</span>
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Password */}
                    <div className="flex items-center justify-between bg-slate-900 text-white p-2 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <Lock className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="font-mono text-xs text-indigo-200 tracking-wider truncate">
                          {isPasswordShown ? cred.password : '••••••••••••'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setShowPasswordMap(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                          className="p-1 text-slate-400 hover:text-white rounded-md transition cursor-pointer"
                          title={isPasswordShown ? "Hide Password" : "Show Password"}
                        >
                          {isPasswordShown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopyText(`pass_${cred.id}`, cred.password)}
                          className="p-1 text-slate-400 hover:text-emerald-400 rounded-md transition cursor-pointer flex items-center gap-1 text-[10px]"
                          title="Copy Password"
                        >
                          {copiedFieldMap[`pass_${cred.id}`] ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Copied</span>
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Remarks (if present) */}
                    {cred.remarks && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 line-clamp-2">
                        "{cred.remarks}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Credential Detail Modal */}
      {viewingCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30 shrink-0">
                  <Globe className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">{viewingCredential.websiteName}</h3>
                  <span className="inline-block mt-0.5 text-[10px] font-semibold text-indigo-200 bg-indigo-500/30 border border-indigo-400/30 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                    {ledgerMap.get(viewingCredential.ledgerId) || 'Unassigned'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingCredential(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin text-xs">
              {/* Website Name */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Website Name</span>
                  <button
                    onClick={() => handleCopyText(`view_web_${viewingCredential.id}`, viewingCredential.websiteName)}
                    className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedFieldMap[`view_web_${viewingCredential.id}`] ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</span>
                    )}
                  </button>
                </div>
                <p className="text-sm font-bold text-slate-800">{viewingCredential.websiteName}</p>
              </div>

              {/* User Name / Mobile */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">User Name / Mobile</span>
                  <button
                    onClick={() => handleCopyText(`view_user_${viewingCredential.id}`, viewingCredential.userNameOrMobile)}
                    className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedFieldMap[`view_user_${viewingCredential.id}`] ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</span>
                    )}
                  </button>
                </div>
                <p className="text-sm font-semibold text-slate-800">{viewingCredential.userNameOrMobile}</p>
              </div>

              {/* Email Address */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</span>
                  {viewingCredential.email && (
                    <button
                      onClick={() => handleCopyText(`view_email_${viewingCredential.id}`, viewingCredential.email || '')}
                      className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedFieldMap[`view_email_${viewingCredential.id}`] ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Copied</span>
                      ) : (
                        <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</span>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-700">{viewingCredential.email || 'Not provided'}</p>
              </div>

              {/* Password */}
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-white">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowPasswordMap(prev => ({ ...prev, [viewingCredential.id]: !prev[viewingCredential.id] }))}
                      className="text-xs text-indigo-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showPasswordMap[viewingCredential.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPasswordMap[viewingCredential.id] ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => handleCopyText(`view_pass_${viewingCredential.id}`, viewingCredential.password)}
                      className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedFieldMap[`view_pass_${viewingCredential.id}`] ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Copied</span>
                      ) : (
                        <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</span>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-sm font-mono text-indigo-200 tracking-wider select-all">
                  {showPasswordMap[viewingCredential.id] ? viewingCredential.password : '••••••••••••••••'}
                </p>
              </div>

              {/* Remarks */}
              {viewingCredential.remarks && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Remarks / Notes</span>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{viewingCredential.remarks}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100 shrink-0">
              {canEdit ? (
                <button
                  onClick={() => {
                    const current = viewingCredential;
                    setViewingCredential(null);
                    handleCopyAsNew(current);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <CopyPlus className="h-4 w-4" />
                  Copy & Create New
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    onClick={() => {
                      const current = viewingCredential;
                      setViewingCredential(null);
                      openCredentialModal(current);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => setViewingCredential(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credential Modal (Create / Edit) */}
      {isCredentialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingCredential ? 'Edit Website Credential' : 'Add Website Credentials'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCredential 
                      ? 'Update stored website login details below.' 
                      : 'Fill in details below. You can click "+ Add Row" to add multiple credentials at once.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCredentialModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveCredential} className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="p-5 space-y-6 overflow-y-auto flex-1 scrollbar-thin">
                
                {/* 1. Global Ledger Category (At the Top) */}
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      Ledger Category
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLedger(null);
                        setNewLedgerName('');
                        setIsLedgerModalOpen(true);
                      }}
                      className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> New Ledger
                    </button>
                  </div>
                  <select
                    value={modalLedgerId}
                    onChange={(e) => setModalLedgerId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-indigo-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
                  >
                    <option value="">-- Select Ledger Category (Optional) --</option>
                    {ledgers.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Credential Rows
                    </h4>
                    {!editingCredential && (
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="text-[11px] text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition hover:scale-105"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Row
                      </button>
                    )}
                  </div>

                  {credentialRows.map((row, index) => (
                    <div key={row.id} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 relative shadow-sm hover:border-indigo-200 transition group">
                      {/* Row Header/Actions */}
                      {!editingCredential && credentialRows.length > 1 && (
                        <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1.5 bg-rose-600 text-white rounded-full shadow-lg hover:bg-rose-700 transition cursor-pointer"
                            title="Remove this row"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Column 1: Website Name on top, User Name or Mobile below */}
                        <div className="space-y-3.5">
                          {/* 1. Website Name */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Website Name <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Google Cloud"
                              value={row.websiteName}
                              onChange={(e) => handleRowChange(row.id, 'websiteName', e.target.value)}
                              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                            />
                          </div>

                          {/* 2. User Name or Mobile (Under Website Name) */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              User Name or Mobile <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Username / Mobile"
                              value={row.userNameOrMobile}
                              onChange={(e) => handleRowChange(row.id, 'userNameOrMobile', e.target.value)}
                              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                            />
                          </div>
                        </div>

                        {/* Column 2: Email Address on top, Password below */}
                        <div className="space-y-3.5">
                          {/* 3. Email Address */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                              type="email"
                              placeholder="user@example.com"
                              value={row.email}
                              onChange={(e) => handleRowChange(row.id, 'email', e.target.value)}
                              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                            />
                          </div>

                          {/* 4. Password (Under Email Address) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Password <span className="text-slate-400 font-normal">(Optional)</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleGenerateRowPassword(row.id)}
                                className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                              >
                                Auto Generate
                              </button>
                            </div>
                            <div className="relative">
                              <input
                                type={row.showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={row.password}
                                onChange={(e) => handleRowChange(row.id, 'password', e.target.value)}
                                className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                              />
                              <button
                                type="button"
                                onClick={() => handleRowChange(row.id, 'showPassword', !row.showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors"
                              >
                                {row.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 5. Remarks / Notes */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Remarks / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <textarea
                            placeholder="Security questions, account recovery notes, PINs..."
                            value={row.remarks}
                            onChange={(e) => handleRowChange(row.id, 'remarks', e.target.value)}
                            rows={1}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 resize-none transition h-10 min-h-[40px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Add Row Option */}
                {!editingCredential && (
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-700 font-bold rounded-2xl text-[11px] flex items-center justify-center gap-2 transition cursor-pointer group"
                  >
                    <Plus className="h-4 w-4 group-hover:scale-125 transition" />
                    + Add More Credential Row
                  </button>
                )}
              </div>

              {/* Form Footer Buttons */}
              <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 border-t border-slate-100 shrink-0">
                <span className="text-xs font-semibold text-slate-500">
                  {credentialRows.length} {credentialRows.length === 1 ? 'row' : 'rows'} ready
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCredentialModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>
                      {editingCredential 
                        ? 'Update Credential' 
                        : (credentialRows.length > 1 ? `Save All ${credentialRows.length} Credentials` : 'Save Credential')}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Credential Confirmation */}
      {deleteConfirmCredentialId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Delete Credential?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this website credential? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmCredentialId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCredential(deleteConfirmCredentialId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-md cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Ledgers Modal */}
      {isManageLedgersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Manage Notebook Ledgers</h3>
              </div>
              <button
                onClick={() => setIsManageLedgersModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">Total Ledgers: {ledgers.length}</span>
                <button
                  onClick={() => {
                    setEditingLedger(null);
                    setNewLedgerName('');
                    setIsLedgerModalOpen(true);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Create New
                </button>
              </div>

              {ledgers.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No custom ledgers created yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {ledgers.map((l) => {
                    const count = credentials.filter(c => c.ledgerId === l.id).length;
                    return (
                      <div key={l.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Tag className="h-4 w-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{l.name}</p>
                            <span className="text-[10px] text-slate-400">{count} credential records</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingLedger(l);
                                setNewLedgerName(l.name);
                                setIsLedgerModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Rename Ledger"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmLedgerId(l.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Ledger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setIsManageLedgersModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal (Create / Edit Ledger Category) - Rendered with z-[70] so it opens on top of Manage modal */}
      {isLedgerModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingLedger ? 'Rename Ledger' : 'Create New Ledger'}
              </h3>
              <button
                onClick={() => setIsLedgerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLedger} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ledger Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Official Portals, Social Media, Banking"
                  value={newLedgerName}
                  onChange={(e) => setNewLedgerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLedgerModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  {editingLedger ? 'Update Name' : 'Create Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Ledger Confirmation - Rendered with z-[75] */}
      {deleteConfirmLedgerId && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Delete Ledger Category?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deleting this ledger category will not erase saved credentials, but they will become unassigned.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmLedgerId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLedger(deleteConfirmLedgerId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-md cursor-pointer"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

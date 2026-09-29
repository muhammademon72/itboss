import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceeded, subscribeQuotaState } from '../firebase';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { DEPARTMENT_OPTIONS, BRANCH_OPTIONS } from '../data/equipmentTemplates';
import { generateCanvasWithOklchFallback } from '../utils/pdfExport';
import {
  Plus, Search, Trash2, Edit2, Wifi, Download, Upload, X, Check,
  Copy, Eye, RefreshCw, Filter, Sparkles, Code, CheckCircle2, Building2,
  Camera, FileImage, LayoutGrid, Printer, Image
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface HotspotCredential {
  id: string;
  branchCode: string;
  userName: string;
  departmentName: string;
  userId: string;
  userPass: string;
  macAddress?: string;
  terminalCode?: string;
  ownerId?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface HotspotLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export const generateHotspotTerminalCode = (userName: string, userId: string, userPass: string, _macAddress?: string): string => {
  const name = userName.trim();
  const id = userId.trim();
  const pass = userPass.trim();

  return `/ip hotspot user add comment="${name}" name=${id} password=${pass}`;
};

export const HotspotLedger: React.FC<HotspotLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  const [records, setRecords] = useState<HotspotCredential[]>(() => {
    return getLocalCache<HotspotCredential>('hotspot_credentials') || [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<HotspotCredential | null>(null);

  // Form Fields
  const [branchCode, setBranchCode] = useState('BWH-1');
  const [userName, setUserName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [userId, setUserId] = useState('');
  const [userPass, setUserPass] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [customTerminalCode, setCustomTerminalCode] = useState('');

  // Quick Inline Data Entry Row State
  const [showInlineRow, setShowInlineRow] = useState(false);
  const [inlineBranch, setInlineBranch] = useState('BWH-1');
  const [inlineName, setInlineName] = useState('');
  const [inlineDept, setInlineDept] = useState('');
  const [inlineUserId, setInlineUserId] = useState('');
  const [inlineUserPass, setInlineUserPass] = useState('');
  const [inlineMac, setInlineMac] = useState('');

  // Copy Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Column View Mode & Screenshot Modal State
  const [columnViewMode, setColumnViewMode] = useState<'full' | 'short'>('full');
  const [isShortScreenshotModalOpen, setIsShortScreenshotModalOpen] = useState(false);
  const [isDownloadingScreenshot, setIsDownloadingScreenshot] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [copiedScreenshot, setCopiedScreenshot] = useState(false);

  // Modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded);

  useEffect(() => {
    return subscribeQuotaState(setQuotaExceeded);
  }, []);

  // Fetch from Firestore with fallback to Cache
  useEffect(() => {
    const cached = getLocalCache<HotspotCredential>('hotspot_credentials');
    if (cached && cached.length > 0) {
      setRecords(cached);
    }

    const q = query(collection(db, 'hotspot_credentials'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as HotspotCredential[];

      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      setRecords(data);
      setLocalCache('hotspot_credentials', data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hotspot_credentials');
      const cachedList = getLocalCache<HotspotCredential>('hotspot_credentials');
      if (cachedList && cachedList.length > 0) {
        setRecords(cachedList);
      }
    });

    return () => unsubscribe();
  }, []);

  // Options for Branch and Department
  const branchOptions = useMemo(() => {
    const fromRecords = records.map(r => r.branchCode).filter(Boolean);
    return Array.from(new Set(['BWH-1', ...BRANCH_OPTIONS, ...fromRecords])).sort();
  }, [records]);

  const departmentOptions = useMemo(() => {
    const fromRecords = records.map(r => r.departmentName).filter(Boolean);
    return Array.from(new Set([...DEPARTMENT_OPTIONS, ...fromRecords])).sort();
  }, [records]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (r.userName || '').toLowerCase().includes(q) ||
        (r.branchCode || '').toLowerCase().includes(q) ||
        (r.departmentName || '').toLowerCase().includes(q) ||
        (r.userId || '').toLowerCase().includes(q) ||
        (r.userPass || '').toLowerCase().includes(q) ||
        (r.macAddress || '').toLowerCase().includes(q) ||
        (r.terminalCode || '').toLowerCase().includes(q);

      const matchesBranch = selectedBranch === 'All' || r.branchCode === selectedBranch;
      const matchesDept = selectedDepartment === 'All' || r.departmentName === selectedDepartment;

      return matchesSearch && matchesBranch && matchesDept;
    });
  }, [records, searchQuery, selectedBranch, selectedDepartment]);

  // Auto-generate password helper
  const handleGeneratePassword = () => {
    const randomPass = Math.floor(100000 + Math.random() * 900000).toString();
    setUserPass(randomPass);
    setCustomTerminalCode('');
  };

  const handleGenerateInlinePassword = () => {
    const randomPass = Math.floor(100000 + Math.random() * 900000).toString();
    setInlineUserPass(randomPass);
  };

  const resetForm = () => {
    setBranchCode('BWH-1');
    setUserName('');
    setDepartmentName('');
    setUserId('');
    setUserPass('');
    setMacAddress('');
    setCustomTerminalCode('');
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (rec: HotspotCredential) => {
    setBranchCode(rec.branchCode || 'BWH-1');
    setUserName(rec.userName || '');
    setDepartmentName(rec.departmentName || '');
    setUserId(rec.userId || '');
    setUserPass(rec.userPass || '');
    setMacAddress(rec.macAddress || '');

    // Reset customTerminalCode if stored code matches standard format so editing updates preview automatically
    const autoCode = generateHotspotTerminalCode(rec.userName || '', rec.userId || '', rec.userPass || '', rec.macAddress || '');
    if (!rec.terminalCode || rec.terminalCode.trim() === autoCode.trim()) {
      setCustomTerminalCode('');
    } else {
      setCustomTerminalCode(rec.terminalCode || '');
    }

    setEditingId(rec.id);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const computedTerminal = customTerminalCode.trim() || generateHotspotTerminalCode(userName, userId, userPass, macAddress);
    const targetId = editingId || `hotspot_${Date.now()}`;

    const recordObj: HotspotCredential = {
      id: targetId,
      branchCode: branchCode.trim(),
      userName: userName.trim(),
      departmentName: departmentName.trim(),
      userId: userId.trim(),
      userPass: userPass.trim(),
      macAddress: macAddress.trim(),
      terminalCode: computedTerminal,
      ownerId: currentUser?.uid || 'local',
      createdAt: editingId ? (records.find(r => r.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const firestoreData = {
      branchCode: branchCode.trim(),
      userName: userName.trim(),
      departmentName: departmentName.trim(),
      userId: userId.trim(),
      userPass: userPass.trim(),
      macAddress: macAddress.trim(),
      terminalCode: computedTerminal,
      ownerId: currentUser?.uid || 'local',
      updatedAt: serverTimestamp(),
    };

    // Optimistically update local state immediately so user sees entry
    setRecords(prev => {
      const exists = prev.some(r => r.id === targetId);
      const updated = exists
        ? prev.map(r => r.id === targetId ? recordObj : r)
        : [recordObj, ...prev];
      setLocalCache('hotspot_credentials', updated);
      return updated;
    });

    try {
      if (editingId) {
        await updateDoc(doc(db, 'hotspot_credentials', editingId), firestoreData);
      } else {
        await setDoc(doc(db, 'hotspot_credentials', targetId), {
          ...firestoreData,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'hotspot_credentials');
      resetForm();
    }
  };

  // Inline Quick Add Handler
  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineName.trim() || !inlineUserId.trim() || !inlineUserPass.trim()) {
      alert('Please fill in User Name, User ID, and User Pass.');
      return;
    }

    const computedTerminal = generateHotspotTerminalCode(inlineName, inlineUserId, inlineUserPass, inlineMac);
    const targetId = `hotspot_${Date.now()}`;

    const recordObj: HotspotCredential = {
      id: targetId,
      branchCode: inlineBranch.trim() || 'BWH-1',
      userName: inlineName.trim(),
      departmentName: inlineDept.trim() || 'Staff',
      userId: inlineUserId.trim(),
      userPass: inlineUserPass.trim(),
      macAddress: inlineMac.trim(),
      terminalCode: computedTerminal,
      ownerId: currentUser?.uid || 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const firestoreData = {
      branchCode: inlineBranch.trim() || 'BWH-1',
      userName: inlineName.trim(),
      departmentName: inlineDept.trim() || 'Staff',
      userId: inlineUserId.trim(),
      userPass: inlineUserPass.trim(),
      macAddress: inlineMac.trim(),
      terminalCode: computedTerminal,
      ownerId: currentUser?.uid || 'local',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Optimistically update state immediately
    setRecords(prev => {
      const updated = [recordObj, ...prev];
      setLocalCache('hotspot_credentials', updated);
      return updated;
    });

    setInlineName('');
    setInlineUserId('');
    setInlineUserPass('');
    setInlineMac('');

    try {
      await setDoc(doc(db, 'hotspot_credentials', targetId), firestoreData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'hotspot_credentials');
    }
  };

  const handleDelete = async (id: string) => {
    setRecords(prev => {
      const updated = prev.filter(r => r.id !== id);
      setLocalCache('hotspot_credentials', updated);
      return updated;
    });
    setDeleteConfirmId(null);

    try {
      await deleteDoc(doc(db, 'hotspot_credentials', id));
      deleteLocalCacheItem('hotspot_credentials', id);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hotspot_credentials');
    }
  };

  const handleClearAll = async () => {
    const recordsToDelete = [...records];
    setLocalCache('hotspot_credentials', []);
    setRecords([]);
    setIsClearAllModalOpen(false);

    try {
      for (const rec of recordsToDelete) {
        await deleteDoc(doc(db, 'hotspot_credentials', rec.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hotspot_credentials');
    }
  };

  // Copy Single Terminal Code
  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy All Terminal Codes
  const handleCopyAllCodes = () => {
    if (filteredRecords.length === 0) return;
    const allCodes = filteredRecords
      .map(r => r.terminalCode || generateHotspotTerminalCode(r.userName, r.userId, r.userPass, r.macAddress))
      .join('\n');

    navigator.clipboard.writeText(allCodes);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Copy 5-Column Short View Screenshot Image directly to Clipboard
  const handleCopyShortScreenshotImage = async (targetId: string = 'hotspot-short-screenshot-card') => {
    setIsCapturingScreenshot(true);

    // Modern browsers support passing a Promise<Blob> to ClipboardItem
    // when instantiated synchronously during the click gesture
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const blobPromise = new Promise<Blob>(async (resolve, reject) => {
          try {
            let el = document.getElementById(targetId);
            let attempts = 0;
            while (!el && attempts < 10) {
              await new Promise((r) => setTimeout(r, 20));
              el = document.getElementById(targetId);
              attempts++;
            }
            if (!el) {
              el = document.getElementById('hotspot-main-table-card');
            }
            if (!el) {
              reject(new Error('Table element not found for screenshot capture.'));
              return;
            }

            const canvas = await generateCanvasWithOklchFallback(el as HTMLElement, { scale: 2 });
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas blob generation failed.'));
            }, 'image/png');
          } catch (err) {
            reject(err);
          }
        });

        const clipboardItem = new ClipboardItem({ 'image/png': blobPromise });
        await navigator.clipboard.write([clipboardItem]);

        setCopiedScreenshot(true);
        setTimeout(() => setCopiedScreenshot(false), 3500);
        setIsCapturingScreenshot(false);
        return;
      } catch (clipErr) {
        console.warn('ClipboardItem write with Promise failed, using standard fallback:', clipErr);
      }
    }

    // Standard fallback flow
    try {
      let el = document.getElementById(targetId) || document.getElementById('hotspot-main-table-card');
      if (!el) {
        alert('Table element not found for screenshot capture.');
        return;
      }
      const canvas = await generateCanvasWithOklchFallback(el as HTMLElement, { scale: 2 });
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (blob && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopiedScreenshot(true);
          setTimeout(() => setCopiedScreenshot(false), 3500);
          return;
        } catch (e) {
          console.warn('Fallback direct write failed:', e);
        }
      }

      // Download PNG if clipboard write is blocked
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const branchTag = selectedBranch === 'All' ? 'All_Branches' : selectedBranch.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Hotspot_Credentials_${branchTag}_5Cols_${new Date().toISOString().split('T')[0]}.png`;
      link.href = imgData;
      link.click();
      setCopiedScreenshot(true);
      setTimeout(() => setCopiedScreenshot(false), 3500);
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
      alert("Failed to capture screenshot image. Please try again.");
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Download 5-Column Short View Screenshot Image (PNG)
  const handleDownloadShortScreenshot = async (targetId: string = 'hotspot-short-screenshot-card') => {
    const el = document.getElementById(targetId) || document.getElementById('hotspot-main-table-card');
    if (!el) {
      alert('Table element not found for screenshot capture.');
      return;
    }

    setIsDownloadingScreenshot(true);
    try {
      const canvas = await generateCanvasWithOklchFallback(el as HTMLElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const branchTag = selectedBranch === 'All' ? 'All_Branches' : selectedBranch.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Hotspot_Credentials_${branchTag}_5Cols_${new Date().toISOString().split('T')[0]}.png`;
      link.href = imgData;
      link.click();
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
      alert("Failed to capture screenshot image. Please try again.");
    } finally {
      setIsDownloadingScreenshot(false);
    }
  };

  const handlePrintShortList = () => {
    window.print();
  };

  // Excel Export
  const handleExportXLS = () => {
    const exportData = filteredRecords.map(r => ({
      'Branch Code': r.branchCode || '',
      'User Name': r.userName || '',
      'Department Name': r.departmentName || '',
      'User ID': r.userId || '',
      'User Pass': r.userPass || '',
      'Mac Address': r.macAddress || '',
      'Terminal Code': r.terminalCode || generateHotspotTerminalCode(r.userName, r.userId, r.userPass, r.macAddress)
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hotspot Users');
    XLSX.writeFile(workbook, `Hotspot_Information_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Excel Import
  const handleImportXLS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let addedCount = 0;
        const newRecords: HotspotCredential[] = [];

        for (const row of data) {
          const bCode = (row['Branch Code'] || row['Branch'] || 'BWH-1').toString().trim();
          const uName = (row['User Name'] || row['Name'] || row['User'] || '').toString().trim();
          const dName = (row['Department Name'] || row['Department'] || row['Dept'] || '').toString().trim();
          const uId = (row['User ID'] || row['UserId'] || row['Username'] || '').toString().trim();
          const uPass = (row['User Pass'] || row['Password'] || row['Pass'] || '').toString().trim();
          const mac = (row['Mac Address'] || row['MAC'] || row['Mac'] || '').toString().trim();
          const termCode = (row['Terminal Code'] || row['Terminal'] || '').toString().trim() ||
                           generateHotspotTerminalCode(uName, uId, uPass, mac);

          if (uName && uId && uPass) {
            const targetId = `hotspot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const rec: HotspotCredential = {
              id: targetId,
              branchCode: bCode,
              userName: uName,
              departmentName: dName,
              userId: uId,
              userPass: uPass,
              macAddress: mac,
              terminalCode: termCode,
              ownerId: currentUser?.uid || 'local',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            newRecords.push(rec);

            await setDoc(doc(db, 'hotspot_credentials', targetId), {
              branchCode: bCode,
              userName: uName,
              departmentName: dName,
              userId: uId,
              userPass: uPass,
              macAddress: mac,
              terminalCode: termCode,
              ownerId: currentUser?.uid || 'local',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }).catch(err => {
              console.warn("Firestore error importing single record:", err);
            });

            saveLocalCacheItem('hotspot_credentials', rec);
            addedCount++;
          }
        }

        if (newRecords.length > 0) {
          setRecords(prev => [...newRecords, ...prev]);
        }

        alert(`Successfully imported ${addedCount} Hotspot users!`);
      } catch (err) {
        console.error("Error importing file:", err);
        alert("Failed to parse Excel file. Please check column format.");
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-blue-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30 backdrop-blur-sm">
              <Wifi className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Hotspot Information Ledger</h1>
              <p className="text-xs md:text-sm text-blue-200/80 font-medium mt-0.5">
                MikroTik & Router Hotspot User Management & Script Generator
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add User</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsShortScreenshotModalOpen(true);
                handleCopyShortScreenshotImage('hotspot-short-screenshot-card');
              }}
              disabled={isCapturingScreenshot}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                copiedScreenshot
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-sm'
              }`}
              title="Copy 5-column screenshot image to clipboard and open preview"
            >
              {isCapturingScreenshot ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : copiedScreenshot ? (
                <Check className="h-4 w-4 text-white" />
              ) : (
                <Camera className="h-4 w-4 text-emerald-200" />
              )}
              <span>{copiedScreenshot ? 'Copied to Clipboard!' : 'Short Screenshot (5 Cols)'}</span>
            </button>

            <button
              onClick={handleCopyAllCodes}
              disabled={filteredRecords.length === 0}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                copiedAll
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-blue-600/80 hover:bg-blue-600 text-white border border-blue-400/40 shadow-sm disabled:opacity-50'
              }`}
              title="Copy all visible rows' MikroTik Terminal Codes"
            >
              {copiedAll ? <CheckCircle2 className="h-4 w-4" /> : <Code className="h-4 w-4" />}
              <span>{copiedAll ? 'Copied All Scripts!' : 'Copy Terminal Codes'}</span>
            </button>

            <button
              onClick={handleExportXLS}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/90 hover:bg-slate-800 text-blue-100 rounded-xl text-xs font-semibold border border-slate-700/80 transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-blue-400" />
              <span>Export Excel</span>
            </button>

            {canEdit && (
              <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/90 hover:bg-slate-800 text-blue-100 rounded-xl text-xs font-semibold border border-slate-700/80 cursor-pointer transition-all">
                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                <span>Import Excel</span>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleImportXLS}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by User Name, User ID, Password, MAC, or Branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
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

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Filter */}
            <div className="flex items-center gap-1.5 min-w-[170px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                Branch:
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="All">All Branches</option>
                {branchOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5 min-w-[190px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-indigo-600" />
                Dept:
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="All">All Departments</option>
                {departmentOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Column View Toggle Switch */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setColumnViewMode('full')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  columnViewMode === 'full'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Full 7-Column View"
              >
                Full (7 Cols)
              </button>
              <button
                type="button"
                onClick={() => setColumnViewMode('short')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  columnViewMode === 'short'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Short 5-Column View (Branch Code, User Name, Department Name, User ID, User Pass)"
              >
                Short (5 Cols)
              </button>
            </div>

            {/* Screenshot Button in Filter Bar */}
            <button
              type="button"
              onClick={() => {
                setIsShortScreenshotModalOpen(true);
                handleCopyShortScreenshotImage('hotspot-short-screenshot-card');
              }}
              disabled={isCapturingScreenshot}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
                copiedScreenshot
                  ? 'bg-emerald-600 text-white font-black'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
              title="Open 5-Column Screenshot Snippet Modal & Copy Image"
            >
              {isCapturingScreenshot ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-200" />
              ) : copiedScreenshot ? (
                <Check className="h-3.5 w-3.5 text-emerald-200" />
              ) : (
                <Camera className="h-3.5 w-3.5 text-indigo-200" />
              )}
              <span>{copiedScreenshot ? 'Copied Image!' : 'Screenshot (5 Cols)'}</span>
            </button>

            {/* Inline Entry Toggle */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowInlineRow(!showInlineRow)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  showInlineRow
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Toggle Quick Data Entry row at top of table"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{showInlineRow ? 'Hide Quick Row' : 'Quick Row'}</span>
              </button>
            )}

            {/* Reset Filters */}
            {(selectedBranch !== 'All' || selectedDepartment !== 'All' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedBranch('All');
                  setSelectedDepartment('All');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-xl transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>Showing <span className="text-blue-700 font-bold">{filteredRecords.length}</span> of {records.length} hotspot users</span>
            {selectedBranch !== 'All' && (
              <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
                Branch: {selectedBranch}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {columnViewMode === 'short' ? '5-Column Short View Mode Active' : 'Format matches MikroTik Hotspot Specification'}
          </div>
        </div>
      </div>

      {/* Main Table Styled like Screenshot */}
      <div id="hotspot-main-table-card" className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[750px]">
            {/* Deep Blue Header matching user photo format */}
            <thead style={{ backgroundColor: '#1F619D' }} className="text-white border-b-2 border-blue-900 uppercase font-black tracking-wider select-none">
              <tr>
                <th className="px-3.5 py-3 border-r border-blue-800/80 w-[110px] text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span>Branch Code</span>
                    <Filter className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-3.5 py-3 border-r border-blue-800/80 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span>User Name</span>
                    <Filter className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-3.5 py-3 border-r border-blue-800/80 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span>Department Name</span>
                    <Filter className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-3.5 py-3 border-r border-blue-800/80 text-left font-mono">
                  <div className="flex items-center justify-between gap-1">
                    <span>User ID</span>
                    <Filter className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-3.5 py-3 border-r border-blue-800/80 text-left font-mono">
                  <div className="flex items-center justify-between gap-1">
                    <span>User Pass</span>
                    <Filter className="h-3 w-3 opacity-60" />
                  </div>
                </th>

                {columnViewMode === 'full' && (
                  <>
                    <th className="px-3.5 py-3 border-r border-blue-800/80 text-left font-mono">
                      <div className="flex items-center justify-between gap-1">
                        <span>Mac Address</span>
                        <Filter className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th className="px-3.5 py-3 border-r border-blue-800/80 text-left font-mono">
                      <div className="flex items-center justify-between gap-1">
                        <span>Terminal Code</span>
                        <Filter className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                  </>
                )}

                <th className="px-3 py-3 text-center w-[90px]">
                  <span>Action</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {/* Quick Inline Data Entry Row */}
              {showInlineRow && canEdit && (
                <tr className="bg-indigo-50/60 border-b-2 border-indigo-300">
                  <td className="p-1 border-r border-indigo-200">
                    <input
                      type="text"
                      placeholder="BWH-1"
                      value={inlineBranch}
                      onChange={(e) => setInlineBranch(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-1 border-r border-indigo-200">
                    <input
                      type="text"
                      placeholder="User Name..."
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-1 border-r border-indigo-200">
                    <input
                      type="text"
                      placeholder="Department..."
                      value={inlineDept}
                      onChange={(e) => setInlineDept(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-1 border-r border-indigo-200">
                    <input
                      type="text"
                      placeholder="asrg1989..."
                      value={inlineUserId}
                      onChange={(e) => setInlineUserId(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-1 border-r border-indigo-200 bg-emerald-100/50">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Pass..."
                        value={inlineUserPass}
                        onChange={(e) => setInlineUserPass(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-emerald-400 rounded text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateInlinePassword}
                        className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-200 rounded"
                        title="Random password"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    </div>
                  </td>

                  {columnViewMode === 'full' && (
                    <>
                      <td className="p-1 border-r border-indigo-200">
                        <input
                          type="text"
                          placeholder="MAC (optional)"
                          value={inlineMac}
                          onChange={(e) => setInlineMac(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-1 border-r border-indigo-200 font-mono text-[11px] text-slate-500 italic px-2">
                        {inlineName && inlineUserId && inlineUserPass
                          ? generateHotspotTerminalCode(inlineName, inlineUserId, inlineUserPass, inlineMac)
                          : 'Auto-generates on entry...'}
                      </td>
                    </>
                  )}

                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={handleInlineSubmit}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs shadow-xs cursor-pointer"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              )}

              {/* Data Rows */}
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={columnViewMode === 'full' ? 8 : 6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wifi className="h-8 w-8 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">No Hotspot Users Found</p>
                      <p className="text-xs text-slate-400">Click "Add User" or "Quick Data Entry" to add records.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const computedCode = rec.terminalCode || generateHotspotTerminalCode(rec.userName, rec.userId, rec.userPass, rec.macAddress);

                  return (
                    <tr key={rec.id} className="hover:bg-blue-50/40 transition-colors font-sans border-b border-slate-200">
                      {/* Branch Code */}
                      <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-800 whitespace-nowrap">
                        {rec.branchCode || 'BWH-1'}
                      </td>

                      {/* User Name */}
                      <td className="px-3.5 py-2.5 border-r border-slate-200 font-semibold text-slate-900 whitespace-nowrap">
                        {rec.userName}
                      </td>

                      {/* Department Name */}
                      <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-700 font-medium whitespace-nowrap">
                        {rec.departmentName || 'General'}
                      </td>

                      {/* User ID */}
                      <td className="px-3.5 py-2.5 border-r border-slate-200 font-mono font-bold text-blue-800 whitespace-nowrap">
                        {rec.userId}
                      </td>

                      {/* User Pass (Highlighted Green like screenshot) */}
                      <td
                        style={{ backgroundColor: '#D1E7DD', color: '#0F5132' }}
                        className="px-3.5 py-2.5 border-r border-slate-200 font-mono font-bold whitespace-nowrap"
                      >
                        {rec.userPass}
                      </td>

                      {columnViewMode === 'full' && (
                        <>
                          {/* Mac Address */}
                          <td className="px-3.5 py-2.5 border-r border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                            {rec.macAddress || '—'}
                          </td>

                          {/* Terminal Code */}
                          <td className="px-3.5 py-2.5 border-r border-slate-200 font-mono text-[11px] text-slate-700 italic max-w-[450px] truncate" title={computedCode}>
                            {computedCode}
                          </td>
                        </>
                      )}

                      {/* Actions */}
                      <td className="px-2 py-2 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleCopyCode(rec.id, computedCode)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              copiedId === rec.id
                                ? 'bg-emerald-100 text-emerald-800 font-bold'
                                : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                            title="Copy Terminal Code"
                          >
                            {copiedId === rec.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>

                          <button
                            onClick={() => setViewingRecord(rec)}
                            className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => handleEdit(rec)}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                              title="Edit Record"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmId(rec.id)}
                              className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
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
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                <Wifi className="h-5 w-5 text-blue-600" />
                <span>{editingId ? 'Edit Hotspot User' : 'Add New Hotspot User'}</span>
              </div>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Branch Code */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Branch Code *</label>
                  <input
                    required
                    type="text"
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    placeholder="e.g. BWH-1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* User Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">User Name *</label>
                  <input
                    required
                    type="text"
                    value={userName}
                    onChange={(e) => {
                      setUserName(e.target.value);
                      setCustomTerminalCode('');
                    }}
                    placeholder="e.g. Md. Mahadi Hasan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Department Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Department Name</label>
                  <input
                    type="text"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="e.g. Senior Executive"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* User ID */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">User ID *</label>
                  <input
                    required
                    type="text"
                    value={userId}
                    onChange={(e) => {
                      setUserId(e.target.value);
                      setCustomTerminalCode('');
                    }}
                    placeholder="e.g. asrg198900337"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* User Pass */}
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">User Pass *</label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" /> Auto Pass
                    </button>
                  </div>
                  <input
                    required
                    type="text"
                    value={userPass}
                    onChange={(e) => {
                      setUserPass(e.target.value);
                      setCustomTerminalCode('');
                    }}
                    placeholder="e.g. 991367"
                    className="w-full px-3 py-2 bg-emerald-50/60 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Mac Address */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mac Address (Optional)</label>
                  <input
                    type="text"
                    value={macAddress}
                    onChange={(e) => {
                      setMacAddress(e.target.value);
                      setCustomTerminalCode('');
                    }}
                    placeholder="e.g. 00:1A:2B:3C:4D:5E"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Terminal Code Preview */}
                <div className="space-y-1 sm:col-span-2 p-3 bg-slate-900 text-blue-200 rounded-xl border border-slate-800 font-mono text-xs">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 font-sans font-bold mb-1">
                    <span>Generated Terminal Code Preview:</span>
                    {customTerminalCode && (
                      <button
                        type="button"
                        onClick={() => setCustomTerminalCode('')}
                        className="text-blue-400 hover:text-blue-300 text-[10px] font-semibold cursor-pointer underline"
                      >
                        Reset to Auto
                      </button>
                    )}
                  </div>
                  <div className="break-all select-all font-mono">
                    {customTerminalCode || generateHotspotTerminalCode(userName || 'User', userId || 'id', userPass || 'pass', macAddress)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Record Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <Wifi className="h-5 w-5 text-blue-400" />
                <span>Hotspot User Details</span>
              </div>
              <button onClick={() => setViewingRecord(null)} className="text-white/80 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Branch Code</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">{viewingRecord.branchCode || 'BWH-1'}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Department</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">{viewingRecord.departmentName || 'General'}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">User Name</div>
                  <div className="font-bold text-slate-900 text-base mt-0.5">{viewingRecord.userName}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">User ID</div>
                  <div className="font-mono font-bold text-blue-900 text-sm mt-0.5">{viewingRecord.userId}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">User Pass</div>
                  <div className="font-mono font-bold text-emerald-900 text-sm mt-0.5">{viewingRecord.userPass}</div>
                </div>
                {viewingRecord.macAddress && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">MAC Address</div>
                    <div className="font-mono font-semibold text-slate-700 text-xs mt-0.5">{viewingRecord.macAddress}</div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-900 rounded-xl text-blue-200 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans font-bold">
                  <span>TERMINAL SCRIPT:</span>
                  <button
                    onClick={() => handleCopyCode(viewingRecord.id, viewingRecord.terminalCode || generateHotspotTerminalCode(viewingRecord.userName, viewingRecord.userId, viewingRecord.userPass, viewingRecord.macAddress))}
                    className="text-blue-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" /> Copy Script
                  </button>
                </div>
                <div className="break-all font-mono select-all">
                  {viewingRecord.terminalCode || generateHotspotTerminalCode(viewingRecord.userName, viewingRecord.userId, viewingRecord.userPass, viewingRecord.macAddress)}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingRecord(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Delete Hotspot Record?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this hotspot user credential? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-bold text-rose-700 text-base flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Clear All Hotspot Data?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently wipe all hotspot records from the database. Are you absolutely sure?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen 5-Column Card for Instant DOM Access & Direct Clipboard Capture */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0 overflow-hidden"
        style={{ width: '850px' }}
      >
        <div
          id="hotspot-short-screenshot-card"
          className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm max-w-full mx-auto space-y-4"
        >
          {/* Header Info */}
          <div className="border-b-2 border-blue-900 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Wifi className="h-5 w-5 text-blue-700" />
                <span>ASR GROUP - Hotspot User Credentials</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Filtered Branch Credentials Snippet (5-Column Format)
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-900">
                <span>Branch:</span>
                <span className="text-blue-700">{selectedBranch}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Total Records: <strong className="text-slate-800">{filteredRecords.length}</strong> | Date: {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* 5-Column Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table className="w-full text-xs text-left border-collapse">
              <thead style={{ backgroundColor: '#1F619D' }} className="text-white uppercase font-black tracking-wider select-none">
                <tr>
                  <th className="px-3.5 py-2.5 border-r border-blue-800/80 w-[120px] text-left">Branch Code</th>
                  <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left">User Name</th>
                  <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left">Department Name</th>
                  <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left font-mono">User ID</th>
                  <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left font-mono">User Pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-sans">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                      No credentials found for current filter settings.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-blue-50/30 border-b border-slate-200">
                      <td className="px-3.5 py-2 border-r border-slate-200 font-bold text-slate-800 whitespace-nowrap">
                        {rec.branchCode || 'BWH-1'}
                      </td>
                      <td className="px-3.5 py-2 border-r border-slate-200 font-semibold text-slate-900 whitespace-nowrap">
                        {rec.userName}
                      </td>
                      <td className="px-3.5 py-2 border-r border-slate-200 text-slate-700 font-medium whitespace-nowrap">
                        {rec.departmentName || 'General'}
                      </td>
                      <td className="px-3.5 py-2 border-r border-slate-200 font-mono font-bold text-blue-800 whitespace-nowrap">
                        {rec.userId}
                      </td>
                      <td
                        style={{ backgroundColor: '#D1E7DD', color: '#0F5132' }}
                        className="px-3.5 py-2 border-r border-slate-200 font-mono font-bold whitespace-nowrap"
                      >
                        {rec.userPass}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-200">
            <span>Generated from ASR Group Hotspot Information Ledger</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Short 5-Column Screenshot Snippet Modal */}
      {isShortScreenshotModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 px-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold text-base">
                <Camera className="h-5 w-5 text-emerald-400" />
                <span>Hotspot Credentials Screenshot Snippet (5 Columns)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyShortScreenshotImage('hotspot-short-screenshot-card')}
                  disabled={isCapturingScreenshot}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                    copiedScreenshot
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title="Copy image directly to clipboard (Paste with Ctrl+V)"
                >
                  {isCapturingScreenshot ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : copiedScreenshot ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedScreenshot ? 'Copied Image!' : 'Copy Image'}</span>
                </button>

                <button
                  onClick={() => handleDownloadShortScreenshot('hotspot-short-screenshot-card')}
                  disabled={isDownloadingScreenshot}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingScreenshot ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{isDownloadingScreenshot ? 'Generating...' : 'Download PNG'}</span>
                </button>

                <button
                  onClick={handlePrintShortList}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-400" />
                  <span>Print</span>
                </button>

                <button
                  onClick={() => setIsShortScreenshotModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable/Capturable Card */}
            <div className="p-6 bg-slate-100/70 overflow-x-auto">
              <div
                id="hotspot-short-screenshot-card"
                className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm max-w-full mx-auto space-y-4"
                style={{ minWidth: '700px' }}
              >
                {/* Header Info */}
                <div className="border-b-2 border-blue-900 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <Wifi className="h-5 w-5 text-blue-700" />
                      <span>ASR GROUP - Hotspot User Credentials</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Filtered Branch Credentials Snippet (5-Column Format)
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-900">
                      <span>Branch:</span>
                      <span className="text-blue-700">{selectedBranch}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Total Records: <strong className="text-slate-800">{filteredRecords.length}</strong> | Date: {new Date().toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* 5-Column Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-300">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead style={{ backgroundColor: '#1F619D' }} className="text-white uppercase font-black tracking-wider select-none">
                      <tr>
                        <th className="px-3.5 py-2.5 border-r border-blue-800/80 w-[120px] text-left">Branch Code</th>
                        <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left">User Name</th>
                        <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left">Department Name</th>
                        <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left font-mono">User ID</th>
                        <th className="px-3.5 py-2.5 border-r border-blue-800/80 text-left font-mono">User Pass</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-sans">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                            No credentials found for current filter settings.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((rec) => (
                          <tr key={rec.id} className="hover:bg-blue-50/30 border-b border-slate-200">
                            <td className="px-3.5 py-2 border-r border-slate-200 font-bold text-slate-800 whitespace-nowrap">
                              {rec.branchCode || 'BWH-1'}
                            </td>
                            <td className="px-3.5 py-2 border-r border-slate-200 font-semibold text-slate-900 whitespace-nowrap">
                              {rec.userName}
                            </td>
                            <td className="px-3.5 py-2 border-r border-slate-200 text-slate-700 font-medium whitespace-nowrap">
                              {rec.departmentName || 'General'}
                            </td>
                            <td className="px-3.5 py-2 border-r border-slate-200 font-mono font-bold text-blue-800 whitespace-nowrap">
                              {rec.userId}
                            </td>
                            <td
                              style={{ backgroundColor: '#D1E7DD', color: '#0F5132' }}
                              className="px-3.5 py-2 border-r border-slate-200 font-mono font-bold whitespace-nowrap"
                            >
                              {rec.userPass}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-200">
                  <span>Generated from ASR Group Hotspot Information Ledger</span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-blue-700">{filteredRecords.length}</strong> user records formatted for screenshot/printing
              </div>
              <button
                onClick={() => setIsShortScreenshotModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

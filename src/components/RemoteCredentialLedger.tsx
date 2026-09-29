import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceeded, subscribeQuotaState } from '../firebase';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { Plus, Search, Trash2, Edit2, Key, Monitor, Download, Upload, X, Check, Building2, FolderKanban, Eye, EyeOff, Lock, KeyRound, Copy, Filter, FilterX } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface RemoteCredential {
  id: string;
  userName: string;
  branchCode: string;
  departmentName: string;
  userIdentityNumber: string;
  category: string;
  ultraviewerId?: string;
  ultraviewerPassword?: string;
  anydeskId?: string;
  anydeskPassword?: string;
  teamviewerId?: string;
  teamviewerPassword?: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

interface RemoteCredentialLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export const RemoteCredentialLedger: React.FC<RemoteCredentialLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;
  const [credentials, setCredentials] = useState<RemoteCredential[]>(() => getLocalCache<RemoteCredential>('credentials') || []);
  const [categories, setCategories] = useState<{id: string, name: string}[]>(() => getLocalCache<{id: string, name: string}>('categories') || []);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>(() => getLocalCache<{id: string, name: string}>('departments') || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingCredential, setViewingCredential] = useState<RemoteCredential | null>(null);
  
  // Form State
  const [userName, setUserName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [userIdentityNumber, setUserIdentityNumber] = useState('');
  const [category, setCategory] = useState('');
  const [ultraviewerId, setUltraviewerId] = useState('');
  const [ultraviewerPassword, setUltraviewerPassword] = useState('');
  const [anydeskId, setAnydeskId] = useState('');
  const [anydeskPassword, setAnydeskPassword] = useState('');
  const [teamviewerId, setTeamviewerId] = useState('');
  const [teamviewerPassword, setTeamviewerPassword] = useState('');

  // Dialog State
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded);

  useEffect(() => {
    return subscribeQuotaState(setQuotaExceeded);
  }, []);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPassMap, setShowPassMap] = useState<Record<string, boolean>>({});

  const handleCopy = (key: string, text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleShowPass = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowPassMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const qRemote = query(collection(db, 'credentials'));
    const unsubRemote = onSnapshot(qRemote, (snapshot) => {
      const firestoreDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RemoteCredential[];

      const deletedItems = getLocalCache<{id: string}>('deleted_credentials_ids') || [];
      const deletedSet = new Set(deletedItems.map(d => d.id));

      const cached = getLocalCache<RemoteCredential>('credentials') || [];
      const combinedMap = new Map<string, RemoteCredential>();

      cached.forEach(c => { if (c && c.id && !deletedSet.has(c.id)) combinedMap.set(c.id, c); });
      firestoreDocs.forEach(c => { if (c && c.id && !deletedSet.has(c.id)) combinedMap.set(c.id, c); });

      const finalData = Array.from(combinedMap.values());
      finalData.sort((a, b) => {
        const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt?.toMillis?.() || 0);
        const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt?.toMillis?.() || 0);
        return timeB - timeA;
      });

      setCredentials(finalData);
      setLocalCache('credentials', finalData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'credentials');
      const deletedItems = getLocalCache<{id: string}>('deleted_credentials_ids') || [];
      const deletedSet = new Set(deletedItems.map(d => d.id));
      const cached = getLocalCache<RemoteCredential>('credentials') || [];
      const filtered = cached.filter(c => c && c.id && !deletedSet.has(c.id));
      setCredentials(filtered);
    });

    const catQ = query(collection(db, 'categories'));
    const unsubCat = onSnapshot(catQ, (snapshot) => {
      const catData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      const deletedCats = getLocalCache<{id: string}>('deleted_categories_ids') || [];
      const deletedSet = new Set(deletedCats.map(d => d.id));

      const cached = getLocalCache<{id: string, name: string}>('categories') || [];
      const combinedMap = new Map<string, {id: string, name: string}>();
      cached.forEach(c => { if (c && c.id && !deletedSet.has(c.id)) combinedMap.set(c.id, c); });
      catData.forEach(c => { if (c && c.id && !deletedSet.has(c.id)) combinedMap.set(c.id, c); });
      const finalCats = Array.from(combinedMap.values());

      setCategories(finalCats);
      setLocalCache('categories', finalCats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
      const deletedCats = getLocalCache<{id: string}>('deleted_categories_ids') || [];
      const deletedSet = new Set(deletedCats.map(d => d.id));
      const cached = getLocalCache<{id: string, name: string}>('categories') || [];
      setCategories(cached.filter(c => c && c.id && !deletedSet.has(c.id)));
    });

    const deptQ = query(collection(db, 'departments'));
    const unsubDept = onSnapshot(deptQ, (snapshot) => {
      const deptData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      const deletedDepts = getLocalCache<{id: string}>('deleted_departments_ids') || [];
      const deletedSet = new Set(deletedDepts.map(d => d.id));

      const cached = getLocalCache<{id: string, name: string}>('departments') || [];
      const combinedMap = new Map<string, {id: string, name: string}>();
      cached.forEach(d => { if (d && d.id && !deletedSet.has(d.id)) combinedMap.set(d.id, d); });
      deptData.forEach(d => { if (d && d.id && !deletedSet.has(d.id)) combinedMap.set(d.id, d); });
      const finalDepts = Array.from(combinedMap.values());

      setDepartments(finalDepts);
      setLocalCache('departments', finalDepts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'departments');
      const deletedDepts = getLocalCache<{id: string}>('deleted_departments_ids') || [];
      const deletedSet = new Set(deletedDepts.map(d => d.id));
      const cached = getLocalCache<{id: string, name: string}>('departments') || [];
      setDepartments(cached.filter(d => d && d.id && !deletedSet.has(d.id)));
    });

    return () => {
      unsubRemote();
      unsubCat();
      unsubDept();
    };
  }, []);

  const uniqueBranches = useMemo(() => {
    const set = new Set<string>();
    credentials.forEach(c => {
      const b = c.branchCode || (c as any).ledgerId;
      if (b) set.add(b);
    });
    return Array.from(set).sort();
  }, [credentials]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    departments.forEach(d => { if (d.name) set.add(d.name); });
    credentials.forEach(c => {
      const d = c.departmentName;
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [departments, credentials]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach(c => { if (c.name) set.add(c.name); });
    credentials.forEach(c => {
      const cat = c.category || (c as any).websiteName;
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [categories, credentials]);

  const filteredCredentials = useMemo(() => {
    return credentials.filter(c => {
      const displayUserName = c.userName || (c as any).userNameOrMobile || (c as any).websiteName || '';
      const displayDept = c.departmentName || 'GENERAL';
      const displayBranch = c.branchCode || (c as any).ledgerId || '';
      const displayCategory = c.category || (c as any).websiteName || '';

      const matchesSearch = !searchQuery || 
        displayUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        displayBranch.toLowerCase().includes(searchQuery.toLowerCase()) ||
        displayDept.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.userIdentityNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        displayCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.ultraviewerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.anydeskId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.teamviewerId || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = !selectedDepartment || selectedDepartment === 'ALL' || 
        displayDept.toLowerCase() === selectedDepartment.toLowerCase();

      const matchesBranch = !selectedBranch || selectedBranch === 'ALL' || 
        displayBranch.toLowerCase() === selectedBranch.toLowerCase();

      const matchesCategory = !selectedCategory || selectedCategory === 'ALL' || 
        displayCategory.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesDept && matchesBranch && matchesCategory;
    });
  }, [credentials, searchQuery, selectedDepartment, selectedBranch, selectedCategory]);

  const resetForm = () => {
    setUserName('');
    setBranchCode('');
    setDepartmentName('');
    setUserIdentityNumber('');
    setCategory('');
    setUltraviewerId('');
    setUltraviewerPassword('');
    setAnydeskId('');
    setAnydeskPassword('');
    setTeamviewerId('');
    setTeamviewerPassword('');
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (cred: RemoteCredential) => {
    setUserName(cred.userName || '');
    setBranchCode(cred.branchCode || '');
    setDepartmentName(cred.departmentName || '');
    setUserIdentityNumber(cred.userIdentityNumber || '');
    setCategory(cred.category || '');
    setUltraviewerId(cred.ultraviewerId || '');
    setUltraviewerPassword(cred.ultraviewerPassword || '');
    setAnydeskId(cred.anydeskId || '');
    setAnydeskPassword(cred.anydeskPassword || '');
    setTeamviewerId(cred.teamviewerId || '');
    setTeamviewerPassword(cred.teamviewerPassword || '');
    setEditingId(cred.id);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const targetId = editingId || `cred_${Date.now()}`;

    const credentialObj: RemoteCredential = {
      id: targetId,
      userName: userName.trim(),
      branchCode: branchCode.trim(),
      departmentName: departmentName.trim(),
      userIdentityNumber: userIdentityNumber.trim(),
      category: category.trim(),
      ultraviewerId: ultraviewerId.trim(),
      ultraviewerPassword: ultraviewerPassword.trim(),
      anydeskId: anydeskId.trim(),
      anydeskPassword: anydeskPassword.trim(),
      teamviewerId: teamviewerId.trim(),
      teamviewerPassword: teamviewerPassword.trim(),
      ownerId: currentUser.uid,
      createdAt: editingId ? (credentials.find(c => c.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const firestoreData = {
      userName: userName.trim(),
      branchCode: branchCode.trim(),
      departmentName: departmentName.trim(),
      userIdentityNumber: userIdentityNumber.trim(),
      category: category.trim(),
      ultraviewerId: ultraviewerId.trim(),
      ultraviewerPassword: ultraviewerPassword.trim(),
      anydeskId: anydeskId.trim(),
      anydeskPassword: anydeskPassword.trim(),
      teamviewerId: teamviewerId.trim(),
      teamviewerPassword: teamviewerPassword.trim(),
      ownerId: currentUser.uid,
      updatedAt: serverTimestamp(),
    };

    // 1. Immediately update local state & cache, and close the dialog
    saveLocalCacheItem('credentials', credentialObj);
    if (editingId) {
      setCredentials(prev => prev.map(c => c.id === editingId ? credentialObj : c));
    } else {
      setCredentials(prev => [credentialObj, ...prev.filter(c => c.id !== targetId)]);
    }
    resetForm();

    // 2. Non-blocking sync to Firestore
    if (editingId) {
      updateDoc(doc(db, 'credentials', editingId), firestoreData).catch(error => {
        console.warn('Firestore update error; local cache maintained:', error);
      });
    } else {
      setDoc(doc(db, 'credentials', targetId), {
        ...firestoreData,
        createdAt: serverTimestamp(),
      }).catch(error => {
        console.warn('Firestore create error; local cache maintained:', error);
      });
    }
  };

  const confirmDeleteCredential = async (id: string) => {
    try {
      // 1. Immediately record in deleted_credentials_ids cache
      saveLocalCacheItem('deleted_credentials_ids', { id });
      
      // 2. Remove from local cache and state
      deleteLocalCacheItem('credentials', id);
      deleteLocalCacheItem('notebook_credentials', id);
      setCredentials(prev => prev.filter(c => c.id !== id));
      setDeleteConfirmId(null);

      // 3. Delete from Firestore in background
      try {
        await deleteDoc(doc(db, 'credentials', id)).catch(() => {});
        await deleteDoc(doc(db, 'notebook_credentials', id)).catch(() => {});
      } catch (dbErr) {
        console.warn('Firestore deletion failed; item remains removed locally.', dbErr);
      }
    } catch (error: any) {
      console.error('Error deleting credential:', error);
      setDeleteConfirmId(null);
    }
  };

  const handleClearAllData = async () => {
    try {
      // 1. Record all current items in deleted cache
      credentials.forEach(c => saveLocalCacheItem('deleted_credentials_ids', { id: c.id }));
      categories.forEach(c => saveLocalCacheItem('deleted_categories_ids', { id: c.id }));
      departments.forEach(d => saveLocalCacheItem('deleted_departments_ids', { id: d.id }));

      // 2. Clear state and local cache immediately
      setCredentials([]);
      setLocalCache('credentials', []);
      setLocalCache('notebook_credentials', []);
      setCategories([]);
      setLocalCache('categories', []);
      setDepartments([]);
      setLocalCache('departments', []);
      setIsClearAllModalOpen(false);

      // 3. Delete from Firestore
      for (const cred of credentials) {
        await deleteDoc(doc(db, 'credentials', cred.id)).catch(() => {});
        await deleteDoc(doc(db, 'notebook_credentials', cred.id)).catch(() => {});
      }
      for (const cat of categories) {
        await deleteDoc(doc(db, 'categories', cat.id)).catch(() => {});
      }
      for (const dept of departments) {
        await deleteDoc(doc(db, 'departments', dept.id)).catch(() => {});
      }
    } catch (error: any) {
      console.error('Error clearing data:', error);
      setIsClearAllModalOpen(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const catId = `cat_${Date.now()}`;
    const newCat = { id: catId, name: newCategoryName.trim() };
    try {
      if (quotaExceeded) {
        throw new Error('Quota exceeded. Please try again later.');
      }
      await setDoc(doc(db, 'categories', catId), {
        name: newCategoryName.trim(),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      saveLocalCacheItem('categories', newCat);
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      alert('Category added successfully');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'categories/' + catId);
      saveLocalCacheItem('categories', newCat);
      setCategories(getLocalCache<{id: string, name: string}>('categories'));
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      alert('Category saved locally.');
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;
    const updatedCat = { id, name: editingCategoryName.trim() };
    try {
      if (quotaExceeded) {
        throw new Error('Quota exceeded. Please try again later.');
      }
      await updateDoc(doc(db, 'categories', id), {
        name: editingCategoryName.trim(),
        updatedAt: serverTimestamp(),
      });
      saveLocalCacheItem('categories', updatedCat);
      setEditingCategoryId(null);
      setEditingCategoryName('');
      alert('Category updated successfully');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'categories/' + id);
      saveLocalCacheItem('categories', updatedCat);
      setCategories(getLocalCache<{id: string, name: string}>('categories'));
      setEditingCategoryId(null);
      setEditingCategoryName('');
      alert('Category updated in local cache.');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      saveLocalCacheItem('deleted_categories_ids', { id });
      deleteLocalCacheItem('categories', id);
      setCategories(prev => prev.filter(c => c.id !== id));
      try {
        await deleteDoc(doc(db, 'categories', id)).catch(() => {});
      } catch (err) {
        console.warn('Firestore category delete failed; local deletion maintained.', err);
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartmentName.trim()) return;
    const deptId = `dept_${Date.now()}`;
    const newDept = { id: deptId, name: newDepartmentName.trim() };
    try {
      if (quotaExceeded) {
        throw new Error('Quota exceeded. Please try again later.');
      }
      await setDoc(doc(db, 'departments', deptId), {
        name: newDepartmentName.trim(),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      saveLocalCacheItem('departments', newDept);
      setDepartmentName(newDepartmentName.trim());
      setNewDepartmentName('');
      alert('Department added successfully');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'departments/' + deptId);
      saveLocalCacheItem('departments', newDept);
      setDepartments(getLocalCache<{id: string, name: string}>('departments'));
      setDepartmentName(newDepartmentName.trim());
      setNewDepartmentName('');
      alert('Department saved locally.');
    }
  };

  const handleUpdateDepartment = async (id: string) => {
    if (!editingDepartmentName.trim()) return;
    const updatedDept = { id, name: editingDepartmentName.trim() };
    try {
      if (quotaExceeded) {
        throw new Error('Quota exceeded. Please try again later.');
      }
      await updateDoc(doc(db, 'departments', id), {
        name: editingDepartmentName.trim(),
        updatedAt: serverTimestamp(),
      });
      saveLocalCacheItem('departments', updatedDept);
      setEditingDepartmentId(null);
      setEditingDepartmentName('');
      alert('Department updated successfully');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'departments/' + id);
      saveLocalCacheItem('departments', updatedDept);
      setDepartments(getLocalCache<{id: string, name: string}>('departments'));
      setEditingDepartmentId(null);
      setEditingDepartmentName('');
      alert('Department updated in local cache.');
    }
  };

  const handleDeleteDepartment = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      saveLocalCacheItem('deleted_departments_ids', { id });
      deleteLocalCacheItem('departments', id);
      setDepartments(prev => prev.filter(d => d.id !== id));
      try {
        await deleteDoc(doc(db, 'departments', id)).catch(() => {});
      } catch (err) {
        console.warn('Firestore department delete failed; local deletion maintained.', err);
      }
    } catch (error: any) {
      console.error('Error deleting department:', error);
    }
  };

  // Export XLS Handler
  const handleExportXLS = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Categories sheet
      const catData = categories.map((cat, idx) => ({
        "SL": idx + 1,
        "Category Name": cat.name,
      }));
      const wsCat = XLSX.utils.json_to_sheet(catData);
      XLSX.utils.book_append_sheet(wb, wsCat, "Categories");

      // Credentials sheet
      const credData = credentials.map((c, idx) => ({
        "SL": idx + 1,
        "User Name": c.userName || "",
        "Branch Code": c.branchCode || "",
        "Identity Number": c.userIdentityNumber || "",
        "Department": c.departmentName || "",
        "Category": c.category || "",
        "UltraView ID": c.ultraviewerId || "",
        "UltraView Password": c.ultraviewerPassword || "",
        "AnyDesk ID": c.anydeskId || "",
        "AnyDesk Password": c.anydeskPassword || "",
        "TeamViewer ID": c.teamviewerId || "",
        "TeamViewer Password": c.teamviewerPassword || "",
      }));
      const wsCred = XLSX.utils.json_to_sheet(credData);
      XLSX.utils.book_append_sheet(wb, wsCred, "Credentials");

      XLSX.writeFile(wb, `Remote_Credentials_and_Categories_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert("Error exporting XLS: " + err.message);
    }
  };

  // Import XLS Handler
  const handleImportXLS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let catImportCount = 0;
        let credImportCount = 0;

        // Check if Categories sheet exists
        if (workbook.SheetNames.includes("Categories")) {
          const wsCat = workbook.Sheets["Categories"];
          const jsonCat: any[] = XLSX.utils.sheet_to_json(wsCat);
          for (const row of jsonCat) {
            const catName = row["Category Name"] || row["Category"] || row["Name"] || row["categoryName"];
            if (catName && typeof catName === 'string' && catName.trim()) {
              const trimmed = catName.trim();
              const exists = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
              if (!exists) {
                await addDoc(collection(db, 'categories'), {
                  name: trimmed,
                  ownerId: currentUser?.uid || '',
                  createdAt: serverTimestamp(),
                });
                catImportCount++;
              }
            }
          }
        }

        // Check for Credentials or main sheet
        const mainSheetName = workbook.SheetNames.includes("Credentials") ? "Credentials" : workbook.SheetNames[0];
        if (mainSheetName && mainSheetName !== "Categories") {
          const wsCred = workbook.Sheets[mainSheetName];
          const jsonCred: any[] = XLSX.utils.sheet_to_json(wsCred);
          for (const row of jsonCred) {
            const uName = row["User Name"] || row["UserName"] || row["Name"] || row["userName"] || row["User"] || row["User Name *"];
            const bCode = row["Branch Code"] || row["BranchCode"] || row["branchCode"] || row["Branch"] || row["Branch Code *"];
            if (uName || bCode) {
              await addDoc(collection(db, 'credentials'), {
                userName: String(uName || ''),
                branchCode: String(bCode || ''),
                departmentName: String(row["Department"] || row["departmentName"] || ''),
                userIdentityNumber: String(row["Identity Number"] || row["User ID / IP"] || row["userIdentityNumber"] || row["User Identity"] || ''),
                category: String(row["Category"] || row["category"] || ''),
                ultraviewerId: String(row["UltraView ID"] || row["Ultraviewer ID"] || row["ultraviewerId"] || ''),
                ultraviewerPassword: String(row["UltraView Password"] || row["Ultraviewer Pass"] || row["ultraviewerPassword"] || row["Ultraviewer Password"] || ''),
                anydeskId: String(row["AnyDesk ID"] || row["anydeskId"] || ''),
                anydeskPassword: String(row["AnyDesk Password"] || row["AnyDesk Pass"] || row["anydeskPassword"] || row["AnyDesk Password"] || ''),
                teamviewerId: String(row["TeamViewer ID"] || row["teamviewerId"] || ''),
                teamviewerPassword: String(row["TeamViewer Password"] || row["TeamViewer Pass"] || row["teamviewerPassword"] || row["TeamViewer Password"] || ''),
                ownerId: currentUser?.uid || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              credImportCount++;
            }
          }
        }

        alert(`XLS Import Complete! Imported ${catImportCount} categories and ${credImportCount} credentials.`);
      } catch (err: any) {
        alert("Error reading XLS file: " + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">Remote Credentials Ledger</h2>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Total Users: {credentials.length}
              </span>
            </div>
            <p className="text-sm text-slate-500">Manage remote access info securely</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users, branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Export & Import XLS Options (Positioned on the Left Side of Categories) */}
          {canEdit && (
            <button
              onClick={handleExportXLS}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium shrink-0 transition-colors cursor-pointer shadow-xs"
              title="Export to XLS Format"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Export (XLS)</span>
            </button>
          )}

          {canEdit && (
            <label
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium shrink-0 transition-colors cursor-pointer shadow-xs"
              title="Import from XLS Format"
            >
              <Upload className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">Import (XLS)</span>
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleImportXLS}
                className="hidden"
              />
            </label>
          )}

          {canEdit && (
            <>
              <button
                onClick={() => setIsCategoryDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium shrink-0"
                title="Manage Categories"
              >
                <FolderKanban className="h-4 w-4 text-indigo-600" />
                <span className="hidden sm:inline">Categories</span>
              </button>
              <button
                onClick={() => setIsDepartmentDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium shrink-0"
                title="Manage Departments"
              >
                <Building2 className="h-4 w-4 text-indigo-600" />
                <span className="hidden sm:inline">Departments</span>
              </button>
            </>
          )}



          {canEdit && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shrink-0 text-sm font-medium cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add New
            </button>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider pr-2 border-r border-slate-200">
          <Filter className="h-4 w-4 text-indigo-600" />
          <span>Filters</span>
        </div>

        {/* 1. DEPT FILTER */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Departments ({uniqueDepartments.length})</option>
            {uniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* 2. BRANCH FILTER */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Branch Code</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Branches ({uniqueBranches.length})</option>
            {uniqueBranches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>

        {/* 3. CATEGORY FILTER */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Categories ({uniqueCategories.length})</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* RESET FILTERS BUTTON */}
        {(selectedDepartment !== 'ALL' || selectedBranch !== 'ALL' || selectedCategory !== 'ALL' || searchQuery !== '') && (
          <div className="self-end">
            <button
              onClick={() => {
                setSelectedDepartment('ALL');
                setSelectedBranch('ALL');
                setSelectedCategory('ALL');
                setSearchQuery('');
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Reset all filters"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Credential' : 'Add New Credential'}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. BRANCH CODE */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">Branch Code *</label>
                  <input required type="text" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* 2. USER NAME */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">User Name *</label>
                  <input required type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* 3. IDENTITY NO */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">Identity No</label>
                  <input type="text" value={userIdentityNumber} onChange={(e) => setUserIdentityNumber(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* 4. DEPARTMENT */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 uppercase">Department</label>
                    {isAdmin && (
                      <button type="button" onClick={() => setIsDepartmentDialogOpen(true)} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center">
                        <Plus className="h-3 w-3 mr-0.5" /> Add
                      </button>
                    )}
                  </div>
                  <select value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                {/* 5. CATEGORY */}
                <div className="space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 uppercase">Category</label>
                    <button type="button" onClick={() => setIsCategoryDialogOpen(true)} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center">
                      <Plus className="h-3 w-3 mr-0.5" /> Add
                    </button>
                  </div>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                {/* 6. UltraViewer */}
                <div className="space-y-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 text-sm flex items-center gap-2">UltraViewer</h4>
                  <input type="text" placeholder="ID" value={ultraviewerId} onChange={(e) => setUltraviewerId(e.target.value)} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white" />
                  <input type="text" placeholder="Password" value={ultraviewerPassword} onChange={(e) => setUltraviewerPassword(e.target.value)} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white" />
                </div>

                {/* 7. AnyDesk */}
                <div className="space-y-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2">AnyDesk</h4>
                  <input type="text" placeholder="ID" value={anydeskId} onChange={(e) => setAnydeskId(e.target.value)} className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm bg-white" />
                  <input type="text" placeholder="Password" value={anydeskPassword} onChange={(e) => setAnydeskPassword(e.target.value)} className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm bg-white" />
                </div>

                {/* 8. TeamViewer */}
                <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2">TeamViewer</h4>
                  <input type="text" placeholder="ID" value={teamviewerId} onChange={(e) => setTeamviewerId(e.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
                  <input type="text" placeholder="Password" value={teamviewerPassword} onChange={(e) => setTeamviewerPassword(e.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100/90 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5 font-bold tracking-wider text-left text-[11px] text-slate-600 uppercase">USER & DEPT</th>
                <th className="px-4 py-3.5 font-bold tracking-wider text-left text-[11px] text-slate-600 uppercase">BRANCH & ID</th>
                <th className="px-4 py-3.5 font-bold tracking-wider text-left text-[11px] text-slate-600 uppercase">CATEGORY</th>
                <th className="px-4 py-3.5 font-bold tracking-wider text-left text-[11px] text-slate-600 uppercase">ULTRAVIEW</th>
                <th className="px-4 py-3.5 font-bold tracking-wider text-left text-[11px] text-slate-600 uppercase">ANYDESK</th>
                <th className="px-4 py-3.5 font-bold tracking-wider text-left text-[11px] text-slate-600 uppercase">TEAMVIEWER</th>
                <th className="px-4 py-3.5 font-bold tracking-wider text-right text-[11px] text-slate-600 uppercase">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredCredentials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No credentials found.
                  </td>
                </tr>
              ) : (
                filteredCredentials.map((cred) => {
                  const displayUserName = cred.userName || (cred as any).userNameOrMobile || (cred as any).websiteName || 'N/A';
                  const displayDept = cred.departmentName || 'GENERAL';
                  const displayBranch = cred.branchCode || (cred as any).ledgerId || 'ASR';
                  const displayIdNum = cred.userIdentityNumber || 'ASRG';
                  const displayCategory = cred.category || (cred as any).websiteName || '';
                  const generalPass = (cred as any).password;

                  const uvShowPass = showPassMap[`uv_${cred.id}`];
                  const adShowPass = showPassMap[`ad_${cred.id}`];
                  const tvShowPass = showPassMap[`tv_${cred.id}`];
                  const genShowPass = showPassMap[`gen_${cred.id}`];

                  return (
                    <tr key={cred.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* USER & DEPT */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-bold text-slate-900 text-sm sm:text-[15px] flex items-center gap-1.5">
                          <span>{displayUserName}</span>
                          <button
                            onClick={(e) => handleCopy(`user_${cred.id}`, displayUserName, e)}
                            className="text-slate-300 hover:text-indigo-600 transition-colors p-0.5"
                            title="Copy User Name"
                          >
                            {copiedKey === `user_${cred.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          {displayDept}
                        </div>
                        {generalPass && (
                          <div className="mt-1 inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 border border-purple-100 rounded px-2 py-0.5 text-xs font-mono">
                            <KeyRound className="h-3 w-3 text-purple-600 shrink-0" />
                            <span>{genShowPass ? generalPass : '••••••••'}</span>
                            <button
                              onClick={(e) => toggleShowPass(`gen_${cred.id}`, e)}
                              className="text-purple-500 hover:text-purple-700 p-0.5"
                              title={genShowPass ? "Hide Password" : "Show Password"}
                            >
                              {genShowPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                            <button
                              onClick={(e) => handleCopy(`genpass_${cred.id}`, generalPass, e)}
                              className="text-purple-400 hover:text-purple-700 p-0.5"
                              title="Copy Password"
                            >
                              {copiedKey === `genpass_${cred.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* BRANCH & ID */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-bold text-indigo-600 text-sm flex items-center gap-1">
                          <span>{displayBranch}</span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          ID: <span className="font-mono font-bold text-slate-700">{displayIdNum}</span>
                        </div>
                      </td>

                      {/* CATEGORY */}
                      <td className="px-4 py-3.5 align-middle">
                        {displayCategory ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold tracking-wide bg-slate-100 text-slate-700 uppercase">
                            {displayCategory}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* ULTRAVIEW */}
                      <td className="px-4 py-3.5 align-middle">
                        {cred.ultraviewerId ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-blue-600 font-mono text-sm">{cred.ultraviewerId}</span>
                              <button
                                onClick={(e) => handleCopy(`uvid_${cred.id}`, cred.ultraviewerId!, e)}
                                className="text-slate-300 hover:text-blue-600 p-0.5"
                                title="Copy ID"
                              >
                                {copiedKey === `uvid_${cred.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            {cred.ultraviewerPassword ? (
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded font-mono">
                                <KeyRound className="h-3 w-3 text-blue-500 shrink-0" />
                                <span>{uvShowPass ? cred.ultraviewerPassword : '••••••••'}</span>
                                <button
                                  onClick={(e) => toggleShowPass(`uv_${cred.id}`, e)}
                                  className="text-blue-500 hover:text-blue-700 p-0.5"
                                  title={uvShowPass ? "Hide Password" : "Show Password"}
                                >
                                  {uvShowPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={(e) => handleCopy(`uvpass_${cred.id}`, cred.ultraviewerPassword!, e)}
                                  className="text-blue-400 hover:text-blue-700 p-0.5"
                                  title="Copy Password"
                                >
                                  {copiedKey === `uvpass_${cred.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono">
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                <span>No Pass</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* ANYDESK */}
                      <td className="px-4 py-3.5 align-middle">
                        {cred.anydeskId ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-orange-600 font-mono text-sm">{cred.anydeskId}</span>
                              <button
                                onClick={(e) => handleCopy(`adid_${cred.id}`, cred.anydeskId!, e)}
                                className="text-slate-300 hover:text-orange-600 p-0.5"
                                title="Copy ID"
                              >
                                {copiedKey === `adid_${cred.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            {cred.anydeskPassword ? (
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-orange-800 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded font-mono">
                                <KeyRound className="h-3 w-3 text-orange-500 shrink-0" />
                                <span>{adShowPass ? cred.anydeskPassword : '••••••••'}</span>
                                <button
                                  onClick={(e) => toggleShowPass(`ad_${cred.id}`, e)}
                                  className="text-orange-500 hover:text-orange-700 p-0.5"
                                  title={adShowPass ? "Hide Password" : "Show Password"}
                                >
                                  {adShowPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={(e) => handleCopy(`adpass_${cred.id}`, cred.anydeskPassword!, e)}
                                  className="text-orange-400 hover:text-orange-700 p-0.5"
                                  title="Copy Password"
                                >
                                  {copiedKey === `adpass_${cred.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono">
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                <span>No Pass</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* TEAMVIEWER */}
                      <td className="px-4 py-3.5 align-middle">
                        {cred.teamviewerId ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-indigo-600 font-mono text-sm">{cred.teamviewerId}</span>
                              <button
                                onClick={(e) => handleCopy(`tvid_${cred.id}`, cred.teamviewerId!, e)}
                                className="text-slate-300 hover:text-indigo-600 p-0.5"
                                title="Copy ID"
                              >
                                {copiedKey === `tvid_${cred.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            {cred.teamviewerPassword ? (
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-mono">
                                <KeyRound className="h-3 w-3 text-indigo-500 shrink-0" />
                                <span>{tvShowPass ? cred.teamviewerPassword : '••••••••'}</span>
                                <button
                                  onClick={(e) => toggleShowPass(`tv_${cred.id}`, e)}
                                  className="text-indigo-500 hover:text-indigo-700 p-0.5"
                                  title={tvShowPass ? "Hide Password" : "Show Password"}
                                >
                                  {tvShowPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={(e) => handleCopy(`tvpass_${cred.id}`, cred.teamviewerPassword!, e)}
                                  className="text-indigo-400 hover:text-indigo-700 p-0.5"
                                  title="Copy Password"
                                >
                                  {copiedKey === `tvpass_${cred.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono">
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                <span>No Pass</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                    {/* ACTIONS */}
                    <td className="px-4 py-3.5 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingCredential(cred)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(cred)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Credential"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirmId(cred.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Credential"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Delete Remote Credential?</h3>
              <p className="text-xs text-slate-500 mt-1">This entry will be deleted permanently.</p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteCredential(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50">
                <Trash2 className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-800">Wipe All Data?</h3>
                <p className="text-slate-500">
                  This will permanently delete all <span className="font-semibold text-rose-600">credentials</span>, 
                  <span className="font-semibold text-rose-600"> categories</span>, and 
                  <span className="font-semibold text-rose-600"> departments</span>. 
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsClearAllModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllData}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                >
                  Clear Everything
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingCredential && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800">Remote Credential Details</h3>
              </div>
              <button onClick={() => setViewingCredential(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">User Name</span>
                  <p className="font-bold text-slate-900">{viewingCredential.userName}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Department</span>
                  <p className="font-semibold text-slate-700">{viewingCredential.departmentName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Branch Code</span>
                  <p className="font-bold text-indigo-600">{viewingCredential.branchCode}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Identity No</span>
                  <p className="font-medium text-slate-600">{viewingCredential.userIdentityNumber || 'ASRG'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Category</span>
                  <p className="font-semibold text-slate-800">{viewingCredential.category || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remote Access Software</h4>
                <div className="grid grid-cols-1 gap-3">
                  {/* UltraViewer */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-blue-800 uppercase">UltraViewer</span>
                      <p className="font-mono font-bold text-blue-900">{viewingCredential.ultraviewerId || 'Not Set'}</p>
                    </div>
                    <span className="text-xs font-mono font-medium px-2 py-1 bg-white border border-blue-200 rounded text-blue-800">
                      Pass: {viewingCredential.ultraviewerPassword || 'No Pass'}
                    </span>
                  </div>

                  {/* AnyDesk */}
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-orange-800 uppercase">AnyDesk</span>
                      <p className="font-mono font-bold text-orange-900">{viewingCredential.anydeskId || 'Not Set'}</p>
                    </div>
                    <span className="text-xs font-mono font-medium px-2 py-1 bg-white border border-orange-200 rounded text-orange-800">
                      Pass: {viewingCredential.anydeskPassword || 'No Pass'}
                    </span>
                  </div>

                  {/* TeamViewer */}
                  <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-800 uppercase">TeamViewer</span>
                      <p className="font-mono font-bold text-indigo-900">{viewingCredential.teamviewerId || 'Not Set'}</p>
                    </div>
                    <span className="text-xs font-mono font-medium px-2 py-1 bg-white border border-indigo-200 rounded text-indigo-800">
                      Pass: {viewingCredential.teamviewerPassword || 'No Pass'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setViewingCredential(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isCategoryDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-indigo-600" />
                Manage Categories
              </h3>
              <button onClick={() => { setIsCategoryDialogOpen(false); setEditingCategoryId(null); }} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Add New Category Form */}
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  required
                  type="text"
                  placeholder="New category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-1 shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>

              {/* Categories List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    No categories created yet.
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                      {editingCategoryId === cat.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateCategory(cat.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditingCategoryName(cat.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => { setIsCategoryDialogOpen(false); setEditingCategoryId(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isDepartmentDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Manage Departments
              </h3>
              <button onClick={() => { setIsDepartmentDialogOpen(false); setEditingDepartmentId(null); }} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Add New Department Form */}
              <form onSubmit={handleAddDepartment} className="flex gap-2">
                <input
                  required
                  type="text"
                  placeholder="New department name..."
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-1 shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>

              {/* Departments List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {departments.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    No departments created yet.
                  </div>
                ) : (
                  departments.map((dept) => (
                    <div key={dept.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                      {editingDepartmentId === dept.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingDepartmentName}
                            onChange={(e) => setEditingDepartmentName(e.target.value)}
                            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateDepartment(dept.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingDepartmentId(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-slate-800">{dept.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingDepartmentId(dept.id);
                                setEditingDepartmentName(dept.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => { setIsDepartmentDialogOpen(false); setEditingDepartmentId(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

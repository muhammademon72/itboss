import React, { useState, useEffect, FormEvent } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { generateCanvasWithOklchFallback } from '../utils/pdfExport';
import { Requisition, RequisitionItem, SignatureState, PresetSigner } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { saveLocalCacheItem, getLocalCache, setLocalCache } from '../utils/localCache';
import { DEFAULT_EQUIPMENT_LIST, DEPARTMENT_OPTIONS, BRANCH_OPTIONS, ADDRESS_OPTIONS } from '../data/equipmentTemplates';
import { Printer, ArrowLeft, Save, CheckSquare, Plus, FileSpreadsheet, Eye, Download, Edit, X } from 'lucide-react';

interface RequisitionFormProps {
  requisition?: Requisition;
  onBack: () => void;
  currentUserUid: string;
  currentUserEmail: string;
  isAdmin?: boolean;
  isCopy?: boolean;
}

const CATEGORY_CHECKBOXES = [
  'Desktop',
  'Laptop',
  'Network',
  'CCTV',
  'PC-Update',
  'Others Accessories',
  'Repairing'
];

const getDynamicFontSize = (text: string) => {
  if (!text) return 'text-xs sm:text-sm';
  const len = text.length;
  if (len > 35) return 'text-[8.5px] sm:text-[9px]';
  if (len > 25) return 'text-[9.5px] sm:text-[10px]';
  if (len > 18) return 'text-[10.5px] sm:text-xs';
  if (len > 12) return 'text-xs sm:text-[13px]';
  return 'text-xs sm:text-sm';
};

const formatDisplayDate = (dateVal: string | undefined): string => {
  if (!dateVal) return '';
  
  // 1. If it's in YYYY-MM-DD or YYYY/MM/DD format (e.g. "2026-06-05")
  const yyyymmddRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  const matchYmd = dateVal.match(yyyymmddRegex);
  if (matchYmd) {
    const [_, y, m, d] = matchYmd;
    const formattedDay = d.padStart(2, '0');
    const formattedMonth = m.padStart(2, '0');
    return `${formattedDay}/${formattedMonth}/${y}`;
  }

  // 2. If it's in DD/MM/YYYY or DD-MM-YYYY format, it's already correct. Let's make sure it has padded zeros.
  const ddMmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const matchDmy = dateVal.match(ddMmyyyyRegex);
  if (matchDmy) {
    const [_, d, m, y] = matchDmy;
    const formattedDay = d.padStart(2, '0');
    const formattedMonth = m.padStart(2, '0');
    return `${formattedDay}/${formattedMonth}/${y}`;
  }

  // 3. Try parsing with native Date
  try {
    const dObj = new Date(dateVal);
    if (!isNaN(dObj.getTime())) {
      const day = String(dObj.getDate()).padStart(2, '0');
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const year = dObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // ignore
  }

  return dateVal;
};

const FALLBACK_PRESET_SIGNERS = {
  Applicant: [] as string[],
  Manager: [] as string[],
  Recommender: [] as string[],
  Authority: [] as string[]
};

export default function RequisitionForm({
  requisition,
  onBack,
  currentUserUid,
  currentUserEmail,
  isAdmin = false,
  isCopy = false
}: RequisitionFormProps) {
  // If editing/viewing, use existing, otherwise start fresh
  const [isEditingState, setIsEditingState] = useState(isCopy ? true : false);
  const isViewMode = !!requisition && !isCopy && !isEditingState;
  const [date, setDate] = useState(() => {
    if (requisition?.date && !isCopy) {
      return formatDisplayDate(requisition.date);
    }
    return formatDisplayDate(new Date().toISOString().split('T')[0]);
  });
  const [applicantName, setApplicantName] = useState(requisition?.applicantName || '');
  const [applicantDepartment, setApplicantDepartment] = useState(requisition?.applicantDepartment || DEPARTMENT_OPTIONS[0]);
  const [employeeId, setEmployeeId] = useState(requisition?.employeeId || '');
  const [branchName, setBranchName] = useState(requisition?.branchName || BRANCH_OPTIONS[0]);
  const [address, setAddress] = useState(requisition?.address || ADDRESS_OPTIONS[0]);
  const [contact, setContact] = useState(requisition?.contact || '');
  
  // Selected categories
  const [types, setTypes] = useState<string[]>(requisition?.types || []);

  // Items: 20 rows
  // If we are viewing, we get existing items. Otherwise we build 20 items
  const [items, setItems] = useState<RequisitionItem[]>(() => {
    if (requisition?.items) {
      const items = [...requisition.items];
      // Pad to 20 rows if needed
      for (let sl = items.length + 1; sl <= 20; sl++) {
        items.push({
          sl,
          equipmentName: '',
          description: '',
          qty: 0,
          condition: '',
          approximatePrice: 0
        });
      }
      return items;
    }
    // Pre-fill 1-15 with defaults, add empty slots for 16-20
    const initialList = [...DEFAULT_EQUIPMENT_LIST];
    for (let sl = 16; sl <= 20; sl++) {
      initialList.push({
        sl,
        equipmentName: '',
        description: '',
        qty: 0,
        condition: '',
        approximatePrice: 0
      });
    }
    return initialList;
  });

  // Track which rows are "active/checked"
  // If viewing, any item with qty > 0 or approximatePrice > 0 is treated as active, or we can check the checked status
  const [activeRows, setActiveRows] = useState<Record<number, boolean>>(() => {
    if (requisition?.items) {
      const active: Record<number, boolean> = {};
      requisition.items.forEach(item => {
        if (item.qty > 0 || item.approximatePrice > 0 || item.description !== '') {
          active[item.sl] = true;
        }
      });
      return active;
    }
    return {};
  });

  const [reason, setReason] = useState(requisition?.reason || '');
  
  // Signatures
  const [applicantSignature, setApplicantSignature] = useState<SignatureState>(
    isCopy ? { signed: false } : (requisition?.applicantSignature || { signed: false })
  );
  const [managerSignature, setManagerSignature] = useState<SignatureState>(
    isCopy ? { signed: false } : (requisition?.managerSignature || { signed: false })
  );
  const [recommenderSignature, setRecommenderSignature] = useState<SignatureState>(
    isCopy ? { signed: false } : (requisition?.recommenderSignature || { signed: false })
  );
  const [authoritySignature, setAuthoritySignature] = useState<SignatureState>(
    isCopy ? { signed: false } : (requisition?.authoritySignature || { signed: false })
  );

  // Status
  const [status, setStatus] = useState<Requisition['status']>(isCopy ? 'Submitted' : (requisition?.status || 'Submitted'));
  
  // Selection states for pre-entered roles
  const [selectedApplicant, setSelectedApplicant] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedRecommender, setSelectedRecommender] = useState('');
  const [selectedAuthority, setSelectedAuthority] = useState('');

  const [applicantOptions, setApplicantOptions] = useState<string[]>(FALLBACK_PRESET_SIGNERS.Applicant);
  const [managerOptions, setManagerOptions] = useState<string[]>(FALLBACK_PRESET_SIGNERS.Manager);
  const [recommenderOptions, setRecommenderOptions] = useState<string[]>(FALLBACK_PRESET_SIGNERS.Recommender);
  const [authorityOptions, setAuthorityOptions] = useState<string[]>(FALLBACK_PRESET_SIGNERS.Authority);

  // Dynamic Options for Department, Branch, and Address
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(() => {
    const cached = getLocalCache<string>('requisition_departments');
    if (cached && cached.length > 0) {
      return Array.from(new Set([...DEPARTMENT_OPTIONS, ...cached])).sort();
    }
    return DEPARTMENT_OPTIONS;
  });
  const [branchOptions, setBranchOptions] = useState<string[]>(() => {
    const cached = getLocalCache<string>('requisition_branches');
    if (cached && cached.length > 0) {
      return Array.from(new Set([...BRANCH_OPTIONS, ...cached])).sort();
    }
    return BRANCH_OPTIONS;
  });
  const [addressOptions, setAddressOptions] = useState<string[]>(() => {
    const cached = getLocalCache<string>('requisition_addresses');
    if (cached && cached.length > 0) {
      return Array.from(new Set([...ADDRESS_OPTIONS, ...cached])).sort();
    }
    return ADDRESS_OPTIONS;
  });

  // Modal state for adding custom option
  const [addOptionModal, setAddOptionModal] = useState<{
    type: 'department' | 'branch' | 'address';
    title: string;
  } | null>(null);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [isSavingOption, setIsSavingOption] = useState(false);

  // Sync custom departments, branches, and addresses from Firestore
  useEffect(() => {
    const qDepts = query(collection(db, 'requisition_departments'));
    const unsubDepts = onSnapshot(qDepts, (snapshot) => {
      const customDepts: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name) customDepts.push(data.name);
      });
      const combined = Array.from(new Set([...DEPARTMENT_OPTIONS, ...customDepts])).sort();
      setDepartmentOptions(combined);
      setLocalCache('requisition_departments', combined);
    }, (error) => {
      console.error("Failed to load requisition_departments:", error);
    });

    const qBranches = query(collection(db, 'requisition_branches'));
    const unsubBranches = onSnapshot(qBranches, (snapshot) => {
      const customBranches: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name) customBranches.push(data.name);
      });
      const combined = Array.from(new Set([...BRANCH_OPTIONS, ...customBranches])).sort();
      setBranchOptions(combined);
      setLocalCache('requisition_branches', combined);
    }, (error) => {
      console.error("Failed to load requisition_branches:", error);
    });

    const qAddresses = query(collection(db, 'requisition_addresses'));
    const unsubAddresses = onSnapshot(qAddresses, (snapshot) => {
      const customAddresses: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name) customAddresses.push(data.name);
      });
      const combined = Array.from(new Set([...ADDRESS_OPTIONS, ...customAddresses])).sort();
      setAddressOptions(combined);
      setLocalCache('requisition_addresses', combined);
    }, (error) => {
      console.error("Failed to load requisition_addresses:", error);
    });

    return () => {
      unsubDepts();
      unsubBranches();
      unsubAddresses();
    };
  }, []);

  const openAddNewModal = (type: 'department' | 'branch' | 'address') => {
    if (!isAdmin) return;
    const titles = {
      department: 'Add New Applicant Department',
      branch: 'Add New Branch Name',
      address: 'Add New Address'
    };
    setAddOptionModal({ type, title: titles[type] });
    setNewOptionValue('');
  };

  const handleAddNewOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !addOptionModal || !newOptionValue.trim()) return;

    const val = newOptionValue.trim();
    const type = addOptionModal.type;
    setIsSavingOption(true);

    const collectionName = type === 'department'
      ? 'requisition_departments'
      : type === 'branch'
      ? 'requisition_branches'
      : 'requisition_addresses';

    const docId = `${type}_${Date.now()}`;

    try {
      await setDoc(doc(db, collectionName, docId), {
        name: val,
        createdAt: serverTimestamp(),
        createdBy: currentUserUid
      });

      if (type === 'department') {
        setDepartmentOptions(prev => Array.from(new Set([...prev, val])).sort());
        setApplicantDepartment(val);
      } else if (type === 'branch') {
        setBranchOptions(prev => Array.from(new Set([...prev, val])).sort());
        setBranchName(val);
      } else {
        setAddressOptions(prev => Array.from(new Set([...prev, val])).sort());
        setAddress(val);
      }

      setMessage({
        type: 'success',
        text: `New ${type === 'department' ? 'Applicant Department' : type === 'branch' ? 'Branch Name' : 'Address'} "${val}" added successfully!`
      });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      console.error(`Error adding new ${type}:`, err);
      if (type === 'department') {
        setDepartmentOptions(prev => Array.from(new Set([...prev, val])).sort());
        setApplicantDepartment(val);
      } else if (type === 'branch') {
        setBranchOptions(prev => Array.from(new Set([...prev, val])).sort());
        setBranchName(val);
      } else {
        setAddressOptions(prev => Array.from(new Set([...prev, val])).sort());
        setAddress(val);
      }
      setMessage({
        type: 'success',
        text: `Added "${val}" locally.`
      });
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setIsSavingOption(false);
      setAddOptionModal(null);
      setNewOptionValue('');
    }
  };

  // Sync Signers with Firestore presets database
  useEffect(() => {
    // Simplify query by removing orderBy to prevent exclusions of documents missing specific fields
    const q = query(collection(db, 'presetSigners'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: PresetSigner[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          name: data.name || '',
          role: data.role || 'Manager',
          createdAt: data.createdAt || ''
        });
      });

      // Sort fetched signers in memory by createdAt descending
      fetched.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      const applicants = fetched.filter(item => item.role === 'Applicant').map(item => item.name);
      const managers = fetched.filter(item => item.role === 'Manager').map(item => item.name);
      const recommenders = fetched.filter(item => item.role === 'Recommender').map(item => item.name);
      const authorities = fetched.filter(item => item.role === 'Authority').map(item => item.name);

      const finalApplicants = applicants.length > 0 ? applicants : [];
      const finalManagers = managers.length > 0 ? managers : ["(Please add IT Managers in Database)"];
      const finalRecommenders = recommenders.length > 0 ? recommenders : ["(Please add Recommend Officers in Database)"];
      const finalAuthorities = authorities.length > 0 ? authorities : ["(Please add Approving Authorities in Database)"];

      setApplicantOptions(finalApplicants);
      setManagerOptions(finalManagers);
      setRecommenderOptions(finalRecommenders);
      setAuthorityOptions(finalAuthorities);

      setSelectedApplicant(prev => prev && finalApplicants.includes(prev) ? prev : (finalApplicants[0] || ''));
      setSelectedManager(prev => prev && finalManagers.includes(prev) ? prev : finalManagers[0]);
      setSelectedRecommender(prev => prev && finalRecommenders.includes(prev) ? prev : finalRecommenders[0]);
      setSelectedAuthority(prev => prev && finalAuthorities.includes(prev) ? prev : finalAuthorities[0]);
    }, (error) => {
      console.error("Failed to load preset signers snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-calculate Total Amount
  const totalAmount = items.reduce((sum, item) => {
    if (activeRows[item.sl]) {
      return sum + (item.qty * item.approximatePrice || 0);
    }
    return sum;
  }, 0);

  const handleTypeToggle = (type: string) => {
    if (isViewMode) return;
    if (types.includes(type)) {
      setTypes(types.filter(t => t !== type));
    } else {
      setTypes([...types, type]);
    }
  };

  const handleRowCheckboxToggle = (sl: number) => {
    if (isViewMode) return;
    setActiveRows(prev => {
      const updated = { ...prev, [sl]: !prev[sl] };
      // If turning off, clear numeric values to keep validation clean
      if (!updated[sl]) {
        setItems(prevItems =>
          prevItems.map(item =>
            item.sl === sl
              ? { ...item, qty: 0, approximatePrice: 0 }
              : item
          )
        );
      } else {
        // If turning on, set default quantity to 1
        setItems(prevItems =>
          prevItems.map(item =>
            item.sl === sl && item.qty === 0
              ? { ...item, qty: 1 }
              : item
          )
        );
      }
      return updated;
    });
  };

  const handleItemFieldChange = (sl: number, field: keyof RequisitionItem, value: any) => {
    if (isViewMode) return;
    setItems(prev =>
      prev.map(item => {
        if (item.sl === sl) {
          const updated = { ...item, [field]: value };
          // If the user starts entering values, automatically make row active
          if (!activeRows[sl] && (field === 'qty' || field === 'approximatePrice' || field === 'description' || field === 'equipmentName')) {
            setActiveRows(prevActive => ({ ...prevActive, [sl]: true }));
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleReset = () => {
    if (isViewMode) return;
    setDate(formatDisplayDate(new Date().toISOString().split('T')[0]));
    setApplicantName('');
    setApplicantDepartment(DEPARTMENT_OPTIONS[0]);
    setEmployeeId('');
    setBranchName(BRANCH_OPTIONS[0]);
    setAddress(ADDRESS_OPTIONS[0]);
    setContact('');
    setTypes([]);
    setActiveRows({});
    setItems(items.map(item => ({
      ...item,
      description: '',
      qty: 0,
      condition: '',
      approximatePrice: 0,
      equipmentName: item.sl >= 16 ? '' : item.equipmentName
    })));
    setReason('');
    setApplicantSignature({ signed: false });
    setManagerSignature({ signed: false });
    setRecommenderSignature({ signed: false });
    setAuthoritySignature({ signed: false });
    setStatus('Submitted');
    setMessage({ type: 'success', text: 'Form reset completed.' });
  };

  const handleSave = async () => {
    if (requisition?.status === 'Fully_Approved' && !isAdmin && !isCopy) {
      setMessage({ type: 'error', text: 'Fully Approved requisitions cannot be edited.' });
      return;
    }
    if (!applicantName.trim()) {
      setMessage({ type: 'error', text: 'Applicant Name is required.' });
      return;
    }
    if (!employeeId.trim()) {
      setMessage({ type: 'error', text: 'Employee ID is required.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    // Filter only active items with valid definitions to save space
    const activeItems = items.map(item => {
      const isActive = activeRows[item.sl];
      return {
        ...item,
        // Make sure it has correct values
        qty: isActive ? Number(item.qty) || 0 : 0,
        approximatePrice: isActive ? Number(item.approximatePrice) || 0 : 0,
        description: isActive ? item.description : '',
        condition: isActive ? item.condition : ''
      };
    });

    const docId = (requisition?.id && !isCopy) ? requisition.id : `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const payload: Requisition = {
      id: docId,
      date,
      applicantName,
      applicantDepartment,
      employeeId,
      branchName,
      address,
      contact,
      types,
      items: activeItems,
      totalAmount,
      reason,
      status: isCopy ? 'Submitted' : (requisition?.status || 'Submitted'),
      applicantSignature,
      managerSignature,
      recommenderSignature,
      authoritySignature,
      createdBy: (requisition?.createdBy && !isCopy) ? requisition.createdBy : currentUserUid,
      createdByEmail: (requisition?.createdByEmail && !isCopy) ? requisition.createdByEmail : currentUserEmail,
    };

    const fullSavedRecord: Requisition = {
      ...payload,
      id: docId,
      createdAt: (requisition?.createdAt && !isCopy) ? requisition.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Requisition;

    // 1. Save locally immediately
    saveLocalCacheItem('requisitions', fullSavedRecord);

    // 2. Update UI instantly
    setMessage({ type: 'success', text: 'Requisition saved successfully!' });
    setIsSubmitting(false);

    setTimeout(() => {
      onBack();
    }, 600);

    // 3. Sync to Firestore in background without blocking UI
    const requisitionsRef = collection(db, 'requisitions');
    setDoc(doc(requisitionsRef, docId), {
      ...payload,
      createdAt: fullSavedRecord.createdAt,
      updatedAt: fullSavedRecord.updatedAt
    }).catch((err) => {
      console.warn('Firestore sync skipped or failed; saved locally.', err);
    });
  };

  const handleSign = async (role: 'Applicant' | 'Manager' | 'Recommender' | 'Authority', customName?: string) => {
    const targetId = requisition?.id;
    if (!targetId) {
      setMessage({ type: 'error', text: 'Please save the requisition first before signing off as separate reviewers.' });
      return;
    }

    const todayDate = formatDisplayDate(new Date().toISOString().split('T')[0]);
    let updatedStatus: Requisition['status'] = status;
    
    let finalSignerName = '';
    if (role === 'Applicant') {
      finalSignerName = customName || applicantName || 'Applicant';
    } else {
      if (!customName || customName.includes('Please add') || customName.includes('Database')) {
        setMessage({ 
          type: 'error', 
          text: 'দুঃখিত, কোনো অনুমোদনকারী সিলেক্ট করা হয়নি বা ডাটাবেজ খালি। অনুগ্রহ করে প্রথমে ড্যাশবোর্ড থেকে "Signers Database" মেনুতে গিয়ে নাম এন্ট্রি করুন।' 
        });
        return;
      }
      finalSignerName = customName;
    }

    const updateSig = () => {
      return {
        signed: true,
        name: finalSignerName,
        date: todayDate
      };
    };

    let newApplicantSig = { ...applicantSignature };
    let newManagerSig = { ...managerSignature };
    let newRecommenderSig = { ...recommenderSignature };
    let newAuthoritySig = { ...authoritySignature };

    if (role === 'Applicant') {
      newApplicantSig = updateSig();
    } else if (role === 'Manager') {
      newManagerSig = updateSig();
    } else if (role === 'Recommender') {
      newRecommenderSig = updateSig();
    } else if (role === 'Authority') {
      newAuthoritySig = updateSig();
    }

    updatedStatus = status;
    if (newAuthoritySig.signed) {
      updatedStatus = 'Fully_Approved';
    } else if (newRecommenderSig.signed) {
      updatedStatus = 'Recommended';
    } else if (newManagerSig.signed) {
      updatedStatus = 'Manager_Approved';
    } else if (newApplicantSig.signed) {
      updatedStatus = 'Submitted';
    }

    const payload = {
      status: updatedStatus,
      applicantSignature: newApplicantSig,
      managerSignature: newManagerSig,
      recommenderSignature: newRecommenderSig,
      authoritySignature: newAuthoritySig,
      updatedAt: new Date().toISOString()
    };

    // Update local state instantly
    if (role === 'Applicant') setApplicantSignature(newApplicantSig);
    if (role === 'Manager') setManagerSignature(newManagerSig);
    if (role === 'Recommender') setRecommenderSignature(newRecommenderSig);
    if (role === 'Authority') setAuthoritySignature(newAuthoritySig);
    setStatus(updatedStatus);

    if (requisition) {
      saveLocalCacheItem('requisitions', {
        ...requisition,
        ...payload
      });
    }

    setMessage({ type: 'success', text: `Signed successfully as ${role}!` });
    setTimeout(() => setMessage(null), 3000);

    // Background sync
    setDoc(doc(db, 'requisitions', targetId), payload, { merge: true }).catch((err) => {
      console.warn('Firestore sign sync error:', err);
    });
  };

  const handleRemoveSign = async (role: 'Applicant' | 'Manager' | 'Recommender' | 'Authority') => {
    const targetId = requisition?.id;
    if (!targetId) return;

    let newApplicantSig = { ...applicantSignature };
    let newManagerSig = { ...managerSignature };
    let newRecommenderSig = { ...recommenderSignature };
    let newAuthoritySig = { ...authoritySignature };

    if (role === 'Applicant') {
      newApplicantSig = { signed: false, name: '', date: '' };
    } else if (role === 'Manager') {
      newManagerSig = { signed: false, name: '', date: '' };
    } else if (role === 'Recommender') {
      newRecommenderSig = { signed: false, name: '', date: '' };
    } else if (role === 'Authority') {
      newAuthoritySig = { signed: false, name: '', date: '' };
    }

    // Recalculate status
    let updatedStatus: Requisition['status'] = 'Draft';
    if (newAuthoritySig.signed) {
      updatedStatus = 'Fully_Approved';
    } else if (newRecommenderSig.signed) {
      updatedStatus = 'Recommended';
    } else if (newManagerSig.signed) {
      updatedStatus = 'Manager_Approved';
    } else if (newApplicantSig.signed) {
      updatedStatus = 'Submitted';
    }

    const payload = {
      status: updatedStatus,
      applicantSignature: newApplicantSig,
      managerSignature: newManagerSig,
      recommenderSignature: newRecommenderSig,
      authoritySignature: newAuthoritySig,
      updatedAt: new Date().toISOString()
    };

    // Update local state instantly
    if (role === 'Applicant') setApplicantSignature(newApplicantSig);
    if (role === 'Manager') setManagerSignature(newManagerSig);
    if (role === 'Recommender') setRecommenderSignature(newRecommenderSig);
    if (role === 'Authority') setAuthoritySignature(newAuthoritySig);
    setStatus(updatedStatus);

    if (requisition) {
      saveLocalCacheItem('requisitions', {
        ...requisition,
        ...payload
      });
    }

    setMessage({ type: 'success', text: `${role} signature removed successfully.` });
    setTimeout(() => setMessage(null), 3000);

    // Background sync
    setDoc(doc(db, 'requisitions', targetId), payload, { merge: true }).catch((err) => {
      console.warn('Firestore remove sign sync error:', err);
    });
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    const cardElement = document.getElementById('equipment-requisition-form-card');
    if (!cardElement) {
      setMessage({ type: 'error', text: 'Form element not found in DOM.' });
      return;
    }

    // Scroll to top temporarily to ensure html2canvas starts from the very beginning of the document
    const originalScrollY = window.scrollY;
    const originalScrollX = window.scrollX;
    window.scrollTo(0, 0);

    // Save original styling to restore later
    const originalWidth = cardElement.style.width;
    const originalMinWidth = cardElement.style.minWidth;
    const originalMaxWidth = cardElement.style.maxWidth;
    const originalPadding = cardElement.style.padding;

    // Detect and save scroll wrapper overflows to prevent vertical/horizontal clipping inside html2canvas
    const scrollContainers = cardElement.querySelectorAll('.overflow-x-auto, .overflow-y-auto, .overflow-auto');
    const originalOverflowStyles: Array<{ element: HTMLElement; overflow: string }> = [];
    
    scrollContainers.forEach((wrapper) => {
      const el = wrapper as HTMLElement;
      originalOverflowStyles.push({
        element: el,
        overflow: el.style.overflow || '',
      });
      // Temporarily expand overflow for high-fidelity canvas capturing
      el.style.overflow = 'visible';
    });

    try {
      setIsDownloadingPdf(true);
      setMessage({ type: 'success', text: 'Preparing high-quality A4 PDF...' });

      // standard vertical A4 format resolution (794px width) to align with A4 page dimensions
      cardElement.style.width = '794px';
      cardElement.style.minWidth = '794px';
      cardElement.style.maxWidth = '794px';
      cardElement.style.margin = '0 auto';
      cardElement.style.padding = '8px 8px 8px 8px';

      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await generateCanvasWithOklchFallback(cardElement, {
        scale: 3, // Premium quality scaling
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1000,
        imageTimeout: 0,
        removeContainer: true
      });

      // Restore styling and overflow structures
      cardElement.style.width = originalWidth;
      cardElement.style.minWidth = originalMinWidth;
      cardElement.style.maxWidth = originalMaxWidth;
      cardElement.style.padding = originalPadding;
      cardElement.style.margin = '';
      
      originalOverflowStyles.forEach(({ element, overflow }) => {
        element.style.overflow = overflow;
      });

      window.scrollTo(originalScrollX, originalScrollY);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const topMargin = 7; // Top margin
      const bottomMargin = 12.7; // Bottom margin (0.5 inch)
      const leftMargin = 7; // Left margin
      const rightMargin = 7; // Right margin

      const pWidth = pageWidth - (leftMargin + rightMargin);
      const pHeight = pageHeight - (topMargin + bottomMargin);

      const ratio = pWidth / canvas.width;
      const imgWidth = pWidth;
      const imgHeight = canvas.height * ratio;

      // Fit the content onto a single page, maintaining aspect ratio
      const widthRatio = pWidth / canvas.width;
      const heightRatio = pHeight / canvas.height;
      const fitRatio = Math.min(widthRatio, heightRatio);

      const finalImgWidth = canvas.width * fitRatio;
      const finalImgHeight = canvas.height * fitRatio;

      // Position it in the page area
      const xOffset = leftMargin + (pWidth - finalImgWidth) / 2;
      const yOffset = topMargin + (pHeight - finalImgHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalImgWidth, finalImgHeight, undefined, 'FAST');

      const reportName = `requisition_${requisition?.id || 'doc'}.pdf`;
      pdf.save(reportName);
      
      setMessage({ type: 'success', text: 'PDF exported successfully!' });
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      console.error('PDF generation error:', err);
      // Restore styles and scroll dimensions in case of error
      if (cardElement) {
        cardElement.style.width = originalWidth;
        cardElement.style.minWidth = originalMinWidth;
        cardElement.style.maxWidth = originalMaxWidth;
        cardElement.style.padding = originalPadding;
        cardElement.style.margin = '';
      }
      
      originalOverflowStyles.forEach(({ element, overflow }) => {
        element.style.overflow = overflow;
      });

      window.scrollTo(originalScrollX, originalScrollY);

      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ 
        type: 'error', 
        text: `Failed to generate PDF (${errMsg}). Please try the 'Print Form' option instead.` 
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    setMessage({
      type: 'success',
      text: "প্রিন্ট উইন্ডো খোলার চেষ্টা করা হচ্ছে... যদি সিকিউরিটি পলিসির কারণে প্রিন্ট ডায়ালগ না আসে, তবে অনুগ্রহ করে উপরের ডানপাশের 'Open in New Tab' (↗️) বাটনে ক্লিক করে নতুন ট্যাবে গিয়ে প্রিন্ট করুন অথবা বামপাশের 'PDF Download' বাটনটি ব্যবহার করুন।"
    });
    setTimeout(() => setMessage(null), 12000);

    try {
      window.focus();
      window.print();
    } catch (err) {
      console.error("Print failed:", err);
      setMessage({
        type: 'error',
        text: "সরাসরি প্রিন্ট করা যায়নি। অনুগ্রহ করে উপরের ডানপাশের 'Open in New Tab' (↗️) বাটনে ক্লিক করে নতুন ট্যাবে গিয়ে প্রিন্ট করুন, অথবা 'PDF Download' ব্যবহার করুন।"
      });
      setTimeout(() => setMessage(null), 10000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {/* Action panel & Header (Hidden on print) */}
      <div className="no-print mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center transition text-xs font-bold shadow-xs cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-full">
              {isViewMode ? `Form View: #${requisition?.id.slice(-6)}` : 'Create Requisition'}
            </span>
            <h1 className="text-lg font-bold font-sans text-slate-950 mt-1.5">
              {isViewMode ? 'View Requisition details' : 'Draft Equipment Requisition'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isViewMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs font-bold border border-emerald-700 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 flex items-center transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSubmitting ? 'Saving...' : 'Save Requisition'}
              </button>
            </>
          ) : (
            <>
              {(requisition?.status !== 'Fully_Approved' || isAdmin) && (
                <button
                  onClick={() => setIsEditingState(true)}
                  className="px-4 py-1.5 text-xs font-bold border border-amber-600 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center transition shadow-xs cursor-pointer shadow-sm"
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit Requisition
                </button>
              )}
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="px-4 py-1.5 text-xs font-bold border border-indigo-600 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 rounded-lg flex items-center transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {isDownloadingPdf ? 'Downloading...' : 'PDF Download'}
              </button>
              {isAdmin && (
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 text-xs font-bold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg flex items-center transition shadow-xs cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print Form
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {message && (
        <div className={`no-print mb-4 p-4 rounded-xl flex items-center justify-between shadow-xs text-xs font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
            {message.text}
          </span>
          <button onClick={() => setMessage(null)} className="text-[10px] uppercase font-bold tracking-wider hover:opacity-85 underline">Dismiss</button>
        </div>
      )}

      {/* Reviewer / Multi-User Test Signoff Module (Shown when an existing record is loaded, in view mode, and only for admins) */}
      {requisition && isViewMode && isAdmin && (
        <div className="no-print mb-6 p-5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-sans shadow-md">
          <div className="flex items-center text-indigo-400 mb-2 font-bold text-xs uppercase tracking-wider">
            <span>Workflow Review Sign-off Workspace</span>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Since this is an interactive demo representation of a corporate environment, you can pick different pre-entered roles and reviewer names below to authorize, recommend or fully sign this request. All actions persist securely to Firebase.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Step 1: Applicant */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              applicantSignature.signed 
                ? 'bg-slate-800/60 border-emerald-500/20' 
                : 'bg-slate-800/30 border-slate-800'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Step 1</span>
                  <div className="flex items-center gap-2">
                    {applicantSignature.signed && (
                      <button 
                        onClick={() => handleRemoveSign('Applicant')}
                        className="text-[8px] uppercase font-bold text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      applicantSignature.signed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {applicantSignature.signed ? 'Signed' : 'Pending'}
                    </span>
                  </div>
                </div>
                <h4 className="text-white font-bold text-xs mt-2.5">Applicant</h4>
                
                {applicantOptions.length > 0 ? (
                  <>
                    <div className="mt-2 text-[10px] font-semibold text-slate-400 mb-1">Select Persona:</div>
                    <select
                      value={selectedApplicant}
                      onChange={(e) => setSelectedApplicant(e.target.value)}
                      disabled={applicantSignature.signed}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/60 disabled:opacity-60 mb-2"
                    >
                      <option value="">{applicantName || '(Use Entered Name)'}</option>
                      {applicantOptions.map((person) => (
                        <option key={person} value={person}>{person}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400 font-medium truncate mt-1 bg-slate-900/50 px-2 py-1.5 rounded border border-slate-800 select-all">
                      {applicantName || '(No Name Entered)'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Defaults to applicant name</p>
                  </>
                )}
              </div>
              <button
                onClick={() => handleSign('Applicant', selectedApplicant || undefined)}
                disabled={applicantSignature.signed}
                className={`w-full mt-4 text-[11px] font-bold py-2 rounded-lg transition-all ${
                  applicantSignature.signed 
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-default' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-[0.98]'
                }`}
              >
                {applicantSignature.signed ? '✓ Already Signed' : 'Sign Applicant'}
              </button>
            </div>

            {/* Step 2: IT Manager / In-Charge */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              managerSignature.signed 
                ? 'bg-slate-800/60 border-emerald-500/20' 
                : 'bg-slate-800/30 border-slate-800'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Step 2</span>
                  <div className="flex items-center gap-2">
                    {managerSignature.signed && (
                      <button 
                        onClick={() => handleRemoveSign('Manager')}
                        className="text-[8px] uppercase font-bold text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      managerSignature.signed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {managerSignature.signed ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                </div>
                <h4 className="text-white font-bold text-xs mt-2.5">Manager / In-Charge</h4>
                
                <div className="mt-2 text-[10px] font-semibold text-slate-400 mb-1">Select Persona:</div>
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  disabled={managerSignature.signed}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/60 disabled:opacity-60"
                >
                  {managerOptions.map((person) => (
                    <option key={person} value={person}>{person}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleSign('Manager', selectedManager)}
                disabled={managerSignature.signed}
                className={`w-full mt-4 text-[11px] font-bold py-2 rounded-lg transition-all ${
                  managerSignature.signed 
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-default' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-[0.98]'
                }`}
              >
                {managerSignature.signed ? '✓ Already Approved' : 'Authorize & Sign'}
              </button>
            </div>

            {/* Step 3: Recommend By */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              recommenderSignature.signed 
                ? 'bg-slate-800/60 border-emerald-500/20' 
                : 'bg-slate-800/30 border-slate-800'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Step 3</span>
                  <div className="flex items-center gap-2">
                    {recommenderSignature.signed && (
                      <button 
                        onClick={() => handleRemoveSign('Recommender')}
                        className="text-[8px] uppercase font-bold text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      recommenderSignature.signed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {recommenderSignature.signed ? 'Recommended' : 'Pending'}
                    </span>
                  </div>
                </div>
                <h4 className="text-white font-bold text-xs mt-2.5">Recommend By</h4>
                
                <div className="mt-2 text-[10px] font-semibold text-slate-400 mb-1">Select Persona:</div>
                <select
                  value={selectedRecommender}
                  onChange={(e) => setSelectedRecommender(e.target.value)}
                  disabled={recommenderSignature.signed}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/60 disabled:opacity-60"
                >
                  {recommenderOptions.map((person) => (
                    <option key={person} value={person}>{person}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleSign('Recommender', selectedRecommender)}
                disabled={recommenderSignature.signed}
                className={`w-full mt-4 text-[11px] font-bold py-2 rounded-lg transition-all ${
                  recommenderSignature.signed 
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-default' 
                    : 'bg-teal-600 hover:bg-teal-500 text-white cursor-pointer active:scale-[0.98]'
                }`}
              >
                {recommenderSignature.signed ? '✓ Recommended' : 'Recommend & Sign'}
              </button>
            </div>

            {/* Step 4: Authority Sign */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              authoritySignature.signed 
                ? 'bg-slate-800/60 border-emerald-500/20' 
                : 'bg-slate-800/30 border-slate-800'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Step 4</span>
                  <div className="flex items-center gap-2">
                    {authoritySignature.signed && (
                      <button 
                        onClick={() => handleRemoveSign('Authority')}
                        className="text-[8px] uppercase font-bold text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      authoritySignature.signed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {authoritySignature.signed ? 'Authorized' : 'Pending'}
                    </span>
                  </div>
                </div>
                <h4 className="text-white font-bold text-xs mt-2.5">Authority Sign</h4>
                
                <div className="mt-2 text-[10px] font-semibold text-slate-400 mb-1">Select Persona:</div>
                <select
                  value={selectedAuthority}
                  onChange={(e) => setSelectedAuthority(e.target.value)}
                  disabled={authoritySignature.signed}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/60 disabled:opacity-60"
                >
                  {authorityOptions.map((person) => (
                    <option key={person} value={person}>{person}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleSign('Authority', selectedAuthority)}
                disabled={authoritySignature.signed}
                className={`w-full mt-4 text-[11px] font-bold py-2 rounded-lg transition-all ${
                  authoritySignature.signed 
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-default' 
                    : 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer active:scale-[0.98]'
                }`}
              >
                {authoritySignature.signed ? '✓ Fully Approved' : 'Authorize & Finish'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- PRINTABLE ENVELOPE SHEET CARD --- */}
      <div id="equipment-requisition-form-card" style={{ backgroundColor: '#ffffff', color: '#000000' }} className="bg-white border border-gray-400 pt-3 px-4 md:pt-4 md:px-6 pb-4 shadow-md font-serif print-sheet">
        
        {/* Heading Blocks */}
        <div className="text-center mt-4 mb-3 pt-0">
          <h1 className="text-2xl font-black font-sans uppercase tracking-tight leading-none text-black" style={{ color: '#000000' }}>
            Equipment Requisition Form
          </h1>
          <p className="text-sm font-sans font-semibold mt-0.5 mb-6" style={{ color: '#1f2937' }}>
            Information and Technology Department
          </p>
        </div>

        {/* Top Details Grid */}
        <div className="grid grid-cols-2 gap-4 items-start mb-3">
          
          {/* Left Column (Static Company Address Info) */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="font-sans font-bold text-sm min-w-[50px]" style={{ color: '#000000' }}>Date:</label>
              {isViewMode ? (
                <span className="font-sans border-b border-gray-400 pb-0.5 font-medium px-1 flex-1" style={{ color: '#111827' }}>{formatDisplayDate(date)}</span>
              ) : (
                <input
                  type="text"
                  value={date}
                  placeholder="DD/MM/YYYY"
                  onChange={(e) => setDate(e.target.value)}
                  className="font-sans border-b border-gray-300 focus:border-black outline-none px-1 py-0.5 flex-1 bg-transparent text-sm"
                  style={{ color: '#111827' }}
                />
              )}
            </div>

            <div style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }} className="font-sans text-xs space-y-1 p-2 rounded border">
              <p className="font-bold" style={{ color: '#000000' }}>To,</p>
              <p className="font-extrabold text-sm uppercase" style={{ color: '#000000' }}>ASR Group</p>
              <p className="font-semibold" style={{ color: '#000000' }}>Information and Technology Department</p>
              <p style={{ color: '#000000' }}>House: 282/B, Shahid Janani Jahanara Imam Sharani, Elephant Road Dhaka -1205, Bangladesh</p>
            </div>
          </div>

          {/* Right Column (Applicant Info Block matching image layout) */}
          <div className="border border-black font-sans text-xs">
            
            {/* Applicant Name */}
            <div className="grid grid-cols-12 border-b border-black">
              <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="col-span-6 px-3 border-r border-black font-bold flex items-center whitespace-nowrap h-7">
                Applicant Name
              </div>
              <div className="col-span-6 px-3 flex flex-row justify-start items-center h-7">
                {isViewMode ? (
                  <span className={`font-medium w-full h-full flex items-center text-left justify-start ${getDynamicFontSize(applicantName)}`} style={{ color: '#111827' }}>{applicantName}</span>
                ) : (
                  <input
                    type="text"
                    value={applicantName}
                    placeholder="Enter Employee Name"
                    onChange={(e) => setApplicantName(e.target.value)}
                    className={`w-full h-full py-0 my-0 border-none bg-transparent outline-none font-medium text-left ${getDynamicFontSize(applicantName)}`}
                    style={{ color: '#111827' }}
                  />
                )}
              </div>
            </div>

            {/* Applicant Department */}
            <div className="grid grid-cols-12 border-b border-black">
              <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="col-span-6 px-3 border-r border-black font-bold flex items-center justify-between whitespace-nowrap h-7">
                <span>Applicant Department</span>
                {!isViewMode && isAdmin && (
                  <button
                    type="button"
                    onClick={() => openAddNewModal('department')}
                    className="no-print text-[10px] font-sans font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                    title="Add new department"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                )}
              </div>
              <div className="col-span-6 px-3 flex flex-row justify-start items-center h-7">
                {isViewMode ? (
                  <span className={`font-medium w-full h-full flex items-center text-left justify-start ${getDynamicFontSize(applicantDepartment)}`} style={{ color: '#111827' }}>{applicantDepartment}</span>
                ) : (
                  <select
                    value={applicantDepartment}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_NEW__') {
                        if (isAdmin) openAddNewModal('department');
                      } else {
                        setApplicantDepartment(e.target.value);
                      }
                    }}
                    className={`w-full h-full py-0 my-0 border-none bg-transparent outline-none text-black font-medium text-left ${getDynamicFontSize(applicantDepartment)}`}
                    style={{ color: '#111827' }}
                  >
                    {departmentOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {isAdmin && <option value="__ADD_NEW__" className="font-bold text-indigo-600">+ Add New Department...</option>}
                  </select>
                )}
              </div>
            </div>

            {/* Employee ID */}
            <div className="grid grid-cols-12 border-b border-black">
              <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="col-span-6 px-3 border-r border-black font-bold flex flex-row items-center h-7">
                Employee ID
              </div>
              <div className="col-span-6 px-3 flex flex-row justify-start items-center h-7">
                {isViewMode ? (
                  <span className={`font-mono font-medium whitespace-nowrap truncate w-full h-full flex items-center text-left justify-start ${getDynamicFontSize(employeeId)}`} style={{ color: '#111827' }}>{employeeId}</span>
                ) : (
                  <input
                    type="text"
                    value={employeeId}
                    placeholder="e.g. ASR-10492"
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className={`w-full h-full py-0 my-0 border-none bg-transparent outline-none font-mono text-left ${getDynamicFontSize(employeeId)}`}
                    style={{ color: '#111827' }}
                  />
                )}
              </div>
            </div>

            {/* Branch Name */}
            <div className="grid grid-cols-12 border-b border-black">
              <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="col-span-6 px-3 border-r border-black font-bold flex items-center justify-between whitespace-nowrap h-7">
                <span>Branch Name</span>
                {!isViewMode && isAdmin && (
                  <button
                    type="button"
                    onClick={() => openAddNewModal('branch')}
                    className="no-print text-[10px] font-sans font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                    title="Add new branch"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                )}
              </div>
              <div className="col-span-6 px-3 flex flex-row justify-start items-center h-7">
                {isViewMode ? (
                  <span className={`font-medium whitespace-nowrap truncate w-full h-full flex items-center text-left justify-start ${getDynamicFontSize(branchName)}`} style={{ color: '#111827' }}>{branchName}</span>
                ) : (
                  <select
                    value={branchName}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_NEW__') {
                        if (isAdmin) openAddNewModal('branch');
                      } else {
                        setBranchName(e.target.value);
                      }
                    }}
                    className={`w-full h-full py-0 my-0 border-none bg-transparent outline-none text-black font-medium text-left ${getDynamicFontSize(branchName)}`}
                    style={{ color: '#111827' }}
                  >
                    {branchOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {isAdmin && <option value="__ADD_NEW__" className="font-bold text-indigo-600">+ Add New Branch...</option>}
                  </select>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-12 border-b border-black">
              <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="col-span-6 px-3 border-r border-black font-bold flex items-center justify-between whitespace-nowrap h-7">
                <span>Address</span>
                {!isViewMode && isAdmin && (
                  <button
                    type="button"
                    onClick={() => openAddNewModal('address')}
                    className="no-print text-[10px] font-sans font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                    title="Add new address"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                )}
              </div>
              <div className="col-span-6 px-3 flex flex-row justify-start items-center h-7">
                {isViewMode ? (
                  <span className={`font-medium whitespace-nowrap truncate w-full h-full flex items-center text-left justify-start ${getDynamicFontSize(address)}`} style={{ color: '#111827' }}>{address}</span>
                ) : (
                  <select
                    value={address}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_NEW__') {
                        if (isAdmin) openAddNewModal('address');
                      } else {
                        setAddress(e.target.value);
                      }
                    }}
                    className={`w-full h-full py-0 my-0 border-none bg-transparent outline-none text-black font-medium text-left ${getDynamicFontSize(address)}`}
                    style={{ color: '#111827' }}
                  >
                    {addressOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {isAdmin && <option value="__ADD_NEW__" className="font-bold text-indigo-600">+ Add New Address...</option>}
                  </select>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-12">
              <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="col-span-6 px-3 border-r border-black font-bold flex flex-row items-center h-7">
                Contact
              </div>
              <div className="col-span-6 px-3 flex flex-row justify-start items-center h-7">
                {isViewMode ? (
                  <span className={`font-medium whitespace-nowrap truncate w-full h-full flex items-center text-left justify-start ${getDynamicFontSize(contact)}`} style={{ color: '#111827' }}>{contact}</span>
                ) : (
                  <input
                    type="text"
                    value={contact}
                    placeholder="Phone or extension"
                    onChange={(e) => setContact(e.target.value)}
                    className={`w-full h-full py-0 my-0 border-none bg-transparent outline-none font-medium text-left ${getDynamicFontSize(contact)}`}
                    style={{ color: '#111827' }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Categories Checklist block */}
        <div className="border border-black p-3 mb-3" style={{ color: '#000000' }}>
          <div className="flex flex-row flex-wrap items-center justify-around md:justify-between font-sans px-2 md:px-4 gap-x-4 gap-y-2">
            {CATEGORY_CHECKBOXES.map((category) => {
               const isChecked = types.includes(category);
               return (
                 <div
                   key={category}
                   onClick={() => handleTypeToggle(category)}
                   className={`flex flex-row items-center gap-1.5 text-[10px] sm:text-xs font-bold select-none cursor-pointer p-0.5 rounded-sm transition ${isViewMode ? 'opacity-90' : 'hover:bg-gray-50'}`}
                   style={{ color: '#000000' }}
                 >
                   <div 
                     style={{ backgroundColor: isChecked ? '#000000' : '#ffffff', color: isChecked ? '#ffffff' : 'transparent', boxSizing: 'border-box' }} 
                     className={`w-3.5 h-3.5 border border-black flex items-center justify-center font-bold text-[10px] flex-shrink-0 self-center`}
                   >
                     ✓
                   </div>
                   <span style={{ color: '#000000' }} className="leading-tight">{category}</span>
                 </div>
               );
            })}
          </div>
        </div>

        {/* --- MAIN REQUISITION TABLE --- */}
        <div className="border-t border-x border-black overflow-x-auto mb-2.5">
          <table className="w-full text-left border-collapse table-fixed min-w-[650px] font-sans text-xs">
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="font-extrabold border-b border-black text-center text-[10px] md:text-xs">
                <th className="w-[10%] py-1 px-1 border-r border-black" style={{ color: '#000000', verticalAlign: 'middle' }}>Select | SL</th>
                <th className="w-[25%] py-1 px-2 border-r border-black text-left" style={{ color: '#000000', verticalAlign: 'middle' }}>EQUIPMENT NAME</th>
                <th className="w-[30%] py-1 px-2 border-r border-black text-left" style={{ color: '#000000', verticalAlign: 'middle' }}>DESCRIPTION</th>
                <th className="w-[8%] py-1 px-1 border-r border-black" style={{ color: '#000000', verticalAlign: 'middle' }}>QTY</th>
                <th className="w-[12%] py-1 px-1 border-r border-black" style={{ color: '#000000', verticalAlign: 'middle' }}>CONDITION</th>
                <th className="w-[15%] py-1 px-1" style={{ color: '#000000', verticalAlign: 'middle' }}>APPROX PRICE</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isActive = activeRows[item.sl];
                const isCustomRow = item.sl >= 16;
                const textColor = isActive ? '#000000' : '#6b7280';
                
                return (
                  <tr
                    key={item.sl}
                    style={{ backgroundColor: isActive ? '#f8fafc' : '#ffffff', color: textColor }}
                    className={`border-b border-black transition-colors ${isActive ? '' : 'opacity-70'}`}
                  >
                    {/* Select box | SL index */}
                    <td className="p-0 border-r border-black text-center align-middle" style={{ color: textColor, verticalAlign: 'middle' }}>
                      <div className="flex flex-row flex-nowrap items-center justify-center gap-1.5 w-full min-h-[25px] py-1 whitespace-nowrap">
                        {!isViewMode ? (
                           <input
                            type="checkbox"
                            checked={!!isActive}
                            onChange={() => handleRowCheckboxToggle(item.sl)}
                            className="w-3 w-3 cursor-pointer accent-black"
                          />
                        ) : (
                           isActive && (
                            <span 
                              style={{ backgroundColor: '#000000', color: '#ffffff', width: '11px', height: '11px' }} 
                              className="inline-flex items-center justify-center border border-black font-sans font-bold text-[7.5px] leading-[10px] text-center flex-shrink-0"
                            >
                              ✓
                            </span>
                          )
                        )}
                        <span className="font-bold text-[10px] flex-shrink-0" style={{ color: textColor }}>{item.sl}</span>
                      </div>
                    </td>

                    {/* Equipment Name */}
                    <td className="p-0 border-r border-black font-extrabold text-[11px] md:text-xs text-left align-middle" style={{ color: isActive ? '#000000' : '#4b5563', verticalAlign: 'middle' }}>
                      <div className="flex items-center justify-start text-left w-full min-h-[25px] px-2 py-1">
                        {isCustomRow && !isViewMode ? (
                          <textarea
                            rows={1}
                            value={item.equipmentName}
                            disabled={!isActive}
                            placeholder="Type equipment name..."
                            onChange={(e) => handleItemFieldChange(item.sl, 'equipmentName', e.target.value)}
                            className="w-full bg-transparent outline-none placeholder:text-gray-400 placeholder:font-normal font-bold text-left text-[11px] resize-none overflow-hidden h-auto py-0.5 focus:bg-slate-50 rounded"
                            style={{ color: '#000000' }}
                            onInput={(e) => {
                              const target = e.currentTarget;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                          />
                        ) : (
                          <span className="w-full flex items-center justify-start text-left font-extrabold text-[11px] whitespace-normal break-words leading-tight" style={{ color: isActive ? '#000000' : '#4b5563' }}>
                            {item.equipmentName || (isViewMode ? '—' : '')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="p-0 border-r border-black text-left align-middle" style={{ verticalAlign: 'middle' }}>
                      <div className="flex items-center justify-start text-left w-full min-h-[25px] px-2 py-1">
                        {isViewMode ? (
                          <span className="w-full flex items-center justify-start font-medium text-[10px] md:text-xs text-left whitespace-normal break-words leading-tight" style={{ color: isActive ? '#111827' : '#6b7280' }}>
                            {item.description || '—'}
                          </span>
                        ) : (
                          <textarea
                            rows={1}
                            value={item.description}
                            placeholder="e.g. Core i7, 16GB"
                            disabled={!isActive}
                            onChange={(e) => handleItemFieldChange(item.sl, 'description', e.target.value)}
                            className="w-full bg-transparent outline-none text-[10px] md:text-[11px] disabled:opacity-40 text-left resize-none overflow-hidden h-auto py-0.5 focus:bg-slate-50 rounded"
                            style={{ color: isActive ? '#111827' : '#6b7280' }}
                            onInput={(e) => {
                              const target = e.currentTarget;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                          />
                        )}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="p-0 border-r border-black text-center align-middle" style={{ verticalAlign: 'middle' }}>
                      <div className="flex items-center justify-center text-center w-full min-h-[25px] px-1 py-1">
                        {isViewMode ? (
                          <span className="font-bold text-[11px] md:text-xs w-full flex items-center justify-center text-center" style={{ color: isActive ? '#111827' : '#6b7280' }}>
                            {item.qty || '—'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            value={item.qty || ''}
                            disabled={!isActive}
                            placeholder="0"
                            onChange={(e) => handleItemFieldChange(item.sl, 'qty', Number(e.target.value))}
                            className="w-full bg-transparent text-center outline-none font-bold text-[11px] md:text-xs disabled:text-gray-400 py-0.5 focus:bg-slate-50 rounded"
                            style={{ color: isActive ? '#111827' : '#6b7280' }}
                          />
                        )}
                      </div>
                    </td>

                    {/* Condition */}
                    <td className="p-0 border-r border-black text-center align-middle" style={{ verticalAlign: 'middle' }}>
                      <div className="flex items-center justify-center text-center w-full min-h-[25px] px-1 py-1">
                        {isViewMode ? (
                          <span className="text-center font-medium w-full flex items-center justify-center text-[11px] md:text-xs whitespace-normal break-words leading-tight" style={{ color: isActive ? '#111827' : '#6b7280' }}>
                            {item.condition || '—'}
                          </span>
                        ) : (
                          <textarea
                            rows={1}
                            placeholder="e.g. Brand New"
                            value={item.condition}
                            disabled={!isActive}
                            onChange={(e) => handleItemFieldChange(item.sl, 'condition', e.target.value)}
                            className="w-full bg-transparent outline-none text-[10px] md:text-[11px] text-center disabled:opacity-40 resize-none overflow-hidden h-auto py-0.5 focus:bg-slate-50 rounded"
                            style={{ color: isActive ? '#111827' : '#6b7280' }}
                            onInput={(e) => {
                              const target = e.currentTarget;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                          />
                        )}
                      </div>
                    </td>

                    {/* Approximate Price */}
                    <td className="p-0 text-center align-middle" style={{ verticalAlign: 'middle' }}>
                      <div className="flex items-center justify-center text-center w-full min-h-[25px] px-2 py-1">
                        {isViewMode ? (
                          <span className="font-bold text-[11px] md:text-xs w-full flex items-center justify-center text-center" style={{ color: isActive ? '#111827' : '#6b7280' }}>
                            {item.approximatePrice ? `৳${item.approximatePrice.toLocaleString()}` : '—'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            value={item.approximatePrice || ''}
                            disabled={!isActive || !isAdmin}
                            placeholder={isAdmin ? "0" : "—"}
                            onChange={(e) => handleItemFieldChange(item.sl, 'approximatePrice', Number(e.target.value))}
                            className={`w-full bg-transparent text-center outline-none font-bold text-[11px] md:text-xs py-0.5 focus:bg-slate-50 rounded ${
                              !isAdmin ? 'cursor-not-allowed text-slate-400 bg-slate-50/50' : ''
                            }`}
                            style={{ color: isActive ? '#111827' : '#6b7280' }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
 
              {/* Total Amount row */}
              <tr style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="font-extrabold text-sm border-b border-black">
                <td colSpan={5} className="py-1.5 px-3 border-r border-black text-right font-extrabold" style={{ color: '#000000' }}>
                  Total Amount
                </td>
                <td style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }} className="py-1.5 px-2 text-right">
                  ৳{totalAmount.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Reason Section */}
        <div className="border border-black p-2.5 mb-1 font-sans" style={{ color: '#000000' }}>
          <label className="block text-xs font-black mb-0.5 uppercase tracking-wide" style={{ color: '#000000' }}>
            Please write a reason :
          </label>
          {isViewMode ? (
            <p style={{ backgroundColor: '#f9fafb', color: '#1f2937', borderColor: '#f3f4f6' }} className="text-xs font-medium leading-relaxed min-h-[144px] p-1.5 rounded border whitespace-pre-line">
              {reason || '(No reason specified for this requisition)'}
            </p>
          ) : (
            <textarea
              rows={8}
              value={reason}
              placeholder="Provide justification or usage context..."
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-1.5 border border-gray-300 rounded focus:border-black outline-none text-xs font-medium bg-transparent"
              style={{ color: '#111827' }}
            />
          )}
        </div>

        {/* Signatures section matching paper layout */}
        <div className="grid grid-cols-4 gap-4 font-sans mt-1">
          
          {/* Signature 1: Applicant or User */}
          <div className="text-center relative h-20 pt-1" style={{ color: '#000000' }}>
            <div className="text-xs">
              {applicantSignature.signed ? (
                <div className="flex flex-col items-center justify-center font-mono font-bold leading-tight" style={{ color: '#065f46' }}>
                  <span className="italic text-[10px]">✓ Signed</span>
                  <span className="text-[9px] font-normal max-w-[150px] block text-center" style={{ color: '#4b5563' }}>{applicantSignature.name}</span>
                  <span className="text-[8px] font-normal" style={{ color: '#6b7280' }}>{formatDisplayDate(applicantSignature.date)}</span>
                </div>
              ) : (
                null
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0">
              <p className="font-extrabold text-[10px] border-t border-dashed border-gray-300 pt-0.5" style={{ color: '#000000' }}>Signature</p>
              <p className="text-[9px] font-medium" style={{ color: '#4b5563' }}>Applicant</p>
            </div>
          </div>

          {/* Signature 2: Manager / In-Charge */}
          <div className="text-center relative h-20 pt-1" style={{ color: '#000000' }}>
            <div className="text-xs">
              {managerSignature.signed ? (
                <div className="flex flex-col items-center justify-center font-mono font-bold leading-tight" style={{ color: '#065f46' }}>
                  <span className="italic text-[10px]">✓ Authorized</span>
                  <span className="text-[9px] font-normal max-w-[150px] block text-center" style={{ color: '#4b5563' }}>{managerSignature.name}</span>
                  <span className="text-[8px] font-normal" style={{ color: '#6b7280' }}>{formatDisplayDate(managerSignature.date)}</span>
                </div>
              ) : (
                null
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0">
              <p className="font-extrabold text-[10px] border-t border-dashed border-gray-300 pt-0.5" style={{ color: '#000000' }}>Signature</p>
              <p className="text-[9px] font-medium" style={{ color: '#4b5563' }}>Manager / In-Charge</p>
            </div>
          </div>

          {/* Signature 3: Recommend by (CTO/IT Expert) */}
          <div className="text-center relative h-20 pt-1" style={{ color: '#000000' }}>
            <div className="text-xs">
              {recommenderSignature.signed ? (
                <div className="flex flex-col items-center justify-center font-mono font-bold leading-tight" style={{ color: '#065f46' }}>
                  <span className="italic text-[10px]">✓ Recommended</span>
                  <span className="text-[9px] font-normal max-w-[150px] block text-center" style={{ color: '#4b5563' }}>{recommenderSignature.name}</span>
                  <span className="text-[8px] font-normal" style={{ color: '#6b7280' }}>{formatDisplayDate(recommenderSignature.date)}</span>
                </div>
              ) : (
                null
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0">
              <p className="font-extrabold text-[10px] border-t border-dashed border-gray-300 pt-0.5" style={{ color: '#000000' }}>Signature</p>
              <p className="text-[9px] font-medium" style={{ color: '#4b5563' }}>Recommend by</p>
            </div>
          </div>

          {/* Signature 4: Authorized Managing Director */}
          <div className="text-center relative h-20 pt-1" style={{ color: '#000000' }}>
            <div className="text-xs">
              {authoritySignature.signed ? (
                <div className="flex flex-col items-center justify-center font-mono font-bold leading-tight" style={{ color: '#065f46' }}>
                  <span className="italic text-[10px]">✓ Fully Approved</span>
                  <span className="text-[9px] font-normal max-w-[150px] block text-center" style={{ color: '#4b5563' }}>{authoritySignature.name}</span>
                  <span className="text-[8px] font-normal" style={{ color: '#6b7280' }}>{formatDisplayDate(authoritySignature.date)}</span>
                </div>
              ) : (
                null
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0">
              <p className="font-extrabold text-[10px] border-t border-dashed border-gray-300 pt-0.5" style={{ color: '#000000' }}>Signature</p>
              <p className="text-[9px] font-medium" style={{ color: '#4b5563' }}>Authority</p>
            </div>
          </div>

        </div>
       </div>

      {/* Modal for adding a new Department, Branch Name, or Address */}
      {addOptionModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>{addOptionModal.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAddOptionModal(null);
                  setNewOptionValue('');
                }}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewOption} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {addOptionModal.type === 'department' ? 'Department Name' : addOptionModal.type === 'branch' ? 'Branch Name' : 'Address Name'} *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  placeholder={`Enter new ${addOptionModal.type === 'department' ? 'Department' : addOptionModal.type === 'branch' ? 'Branch' : 'Address'} name...`}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAddOptionModal(null);
                    setNewOptionValue('');
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOption || !newOptionValue.trim()}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingOption ? 'Saving...' : 'Add Option'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

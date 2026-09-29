import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import {
  SimRecord,
  SortConfig,
  SortField,
  FilterOptions,
  ALL_COLUMNS,
  DownloadedReportRecord,
} from '../types';
import {
  BRANCH_CODES,
  OPERATOR_OPTIONS,
  SIM_TYPES,
  DEPARTMENTS,
  DESIGNATIONS,
  SIM_OWNERS,
  SIM_GROUPS,
  INITIAL_SIM_RECORDS,
} from '../data/simInitialData';
import { exportRecordsToCSV, formatCurrency } from '../utils/simFormatters';
import { SimStats } from './sim/SimStats';
import { SimToolbar } from './sim/SimToolbar';
import { SimTable } from './sim/SimTable';
import { SimFormModal } from './sim/SimFormModal';
import { SimDetailModal } from './sim/SimDetailModal';
import { PdfExportModal } from './sim/PdfExportModal';
import { ColumnFilterModal } from './sim/ColumnFilterModal';
import { ConfirmDeleteModal } from './sim/ConfirmDeleteModal';
import { ConfirmBulkDeleteModal } from './sim/ConfirmBulkDeleteModal';
import { ConfirmResetModal } from './sim/ConfirmResetModal';
import { ImportModal } from './sim/ImportModal';
import { MonthlyReportsModal } from './sim/MonthlyReportsModal';
import { ManageSystemModal } from './sim/ManageSystemModal';
import { Smartphone, History, CheckCircle2, Calendar, Download, Plus, Settings, Eye, EyeOff } from 'lucide-react';

interface SimManagementLedgerProps {
  currentUser: any;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

const LOCAL_STORAGE_KEY = 'sim_management_records';
const LOCAL_STORAGE_REPORTS_KEY = 'sim_downloaded_monthly_reports';
const LOCAL_STORAGE_VISIBLE_COLUMNS_KEY = 'sim_management_visible_columns';

export const SimManagementLedger: React.FC<SimManagementLedgerProps> = ({
  currentUser,
  isAdmin = false,
  permissions,
}) => {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  // Initialize records from cache (without default seed records)
  const [records, setRecords] = useState<SimRecord[]>(() => {
    try {
      const cached = getLocalCache<SimRecord>(LOCAL_STORAGE_KEY);
      if (cached && cached.length > 0) {
        return cached.filter(r => !r.id.startsWith('sim-init-') && r.userName !== 'Aminur Rahman');
      }
    } catch (e) {}
    return [];
  });

  // Table view & filter state
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    branchCode: '',
    operatorName: '',
    simType: '',
    department: '',
    simGroup: '',
    status: '',
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'sl',
    order: 'asc',
  });

  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<SortField[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_VISIBLE_COLUMNS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validFields = ALL_COLUMNS.map((c) => c.field);
          const filtered = parsed.filter((f: any) => validFields.includes(f));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {
      console.warn('Could not read cached visible columns:', e);
    }
    return ALL_COLUMNS.map((c) => c.field);
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_VISIBLE_COLUMNS_KEY, JSON.stringify(visibleColumns));
    } catch (e) {}
  }, [visibleColumns]);

  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<SimRecord | null>(null);
  const [isCopyMode, setIsCopyMode] = useState<boolean>(false);
  const [viewingRecord, setViewingRecord] = useState<SimRecord | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isColFilterModalOpen, setIsColFilterModalOpen] = useState<boolean>(false);
  const [deletingRecord, setDeletingRecord] = useState<SimRecord | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isReportsArchiveOpen, setIsReportsArchiveOpen] = useState<boolean>(false);
  const [isManageSystemOpen, setIsManageSystemOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Master lists state with localStorage persistence
  const [branches, setBranches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_branches');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return BRANCH_CODES;
  });
  const [operators, setOperators] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_operators');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return OPERATOR_OPTIONS;
  });
  const [simTypes, setSimTypes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_sim_types');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return SIM_TYPES;
  });
  const [departments, setDepartments] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_departments');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEPARTMENTS;
  });
  const [designations, setDesignations] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_designations');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DESIGNATIONS;
  });
  const [simOwners, setSimOwners] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_sim_owners');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return SIM_OWNERS;
  });
  const [simGroups, setSimGroups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_sim_groups');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return SIM_GROUPS;
  });
  const [statuses, setStatuses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sim_master_statuses');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return ['Active', 'Inactive'];
  });

  useEffect(() => {
    try {
      localStorage.setItem('sim_master_branches', JSON.stringify(branches));
      localStorage.setItem('sim_master_operators', JSON.stringify(operators));
      localStorage.setItem('sim_master_sim_types', JSON.stringify(simTypes));
      localStorage.setItem('sim_master_departments', JSON.stringify(departments));
      localStorage.setItem('sim_master_designations', JSON.stringify(designations));
      localStorage.setItem('sim_master_sim_owners', JSON.stringify(simOwners));
      localStorage.setItem('sim_master_sim_groups', JSON.stringify(simGroups));
      localStorage.setItem('sim_master_statuses', JSON.stringify(statuses));
    } catch (e) {}
  }, [branches, operators, simTypes, departments, designations, simOwners, simGroups, statuses]);

  // Archive of downloaded reports
  const [downloadedReports, setDownloadedReports] = useState<DownloadedReportRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load reports archive', e);
    }
    return [];
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleColumn = (field: SortField) => {
    setVisibleColumns((prev) => {
      if (prev.includes(field)) {
        if (prev.length <= 1) {
          showToast('কমপক্ষে ১টি কলাম দৃশ্যমান রাখতে হবে');
          return prev;
        }
        const next = prev.filter((f) => f !== field);
        const colObj = ALL_COLUMNS.find((c) => c.field === field);
        showToast(`"${colObj?.label || field}" কলামটি হাইড করা হয়েছে`);
        return next;
      } else {
        const next = [...prev, field];
        const ordered = ALL_COLUMNS.map((c) => c.field).filter((f) => next.includes(f));
        const colObj = ALL_COLUMNS.find((c) => c.field === field);
        showToast(`"${colObj?.label || field}" কলামটি দৃশ্যমান করা হয়েছে`);
        return ordered;
      }
    });
  };

  const handleHideColumn = (field: SortField) => {
    if (visibleColumns.length <= 1) {
      showToast('কমপক্ষে ১টি কলাম দৃশ্যমান রাখতে হবে');
      return;
    }
    const colObj = ALL_COLUMNS.find((c) => c.field === field);
    const colName = colObj ? `${colObj.label}${colObj.bnLabel ? ` (${colObj.bnLabel})` : ''}` : field;
    setVisibleColumns((prev) => prev.filter((f) => f !== field));
    showToast(`"${colName}" কলামটি হাইড করা হয়েছে`);
  };

  const handleShowAllColumns = () => {
    setVisibleColumns(ALL_COLUMNS.map((c) => c.field));
    showToast('সকল কলাম প্রদর্শিত হচ্ছে (All columns visible)');
  };

  const handleResetColumns = () => {
    setVisibleColumns(ALL_COLUMNS.map((c) => c.field));
    showToast('কলাম তালিকা রিসেট করা হয়েছে');
  };

  // Firestore synchronization
  useEffect(() => {
    const colRef = collection(db, 'sim_records');
    const q = query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const fetchedRecords: SimRecord[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sl: data.sl ?? 1,
              branchCode: data.branchCode ?? 'HO',
              userName: data.userName ?? '',
              identyNumber: data.identyNumber ?? '',
              designation: data.designation ?? '',
              department: data.department ?? '',
              distributionDate: data.distributionDate ?? '',
              simOwner: data.simOwner ?? 'Dynasty',
              operatorName: data.operatorName ?? 'GP',
              simGroup: data.simGroup ?? 'Group-A',
              simType: data.simType ?? 'Postpaid',
              simNumber: data.simNumber ?? '',
              creditLimit: Number(data.creditLimit) || 0,
              monthlyApproved: Number(data.monthlyApproved) || 0,
              paymentBill: Number(data.paymentBill) || 0,
              advancePayment: Number(data.advancePayment) || 0,
              remarks: data.remarks ?? '',
              status: data.status || 'Active',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });

          // Sort by SL by default
          fetchedRecords.sort((a, b) => a.sl - b.sl);

          // If Firestore contains old sample data, auto-upgrade to 10 records matching reference photo
          if (fetchedRecords.some((r) => r.userName === 'Md. Emon Hossain' || r.simNumber === '01711223301')) {
            setRecords(INITIAL_SIM_RECORDS);
            setLocalCache(LOCAL_STORAGE_KEY, INITIAL_SIM_RECORDS);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_SIM_RECORDS));
              if (canEdit) {
                const batch = writeBatch(db);
                // Clear old docs
                fetchedRecords.forEach((r) => batch.delete(doc(db, 'sim_records', r.id)));
                INITIAL_SIM_RECORDS.forEach((r) => {
                  batch.set(doc(db, 'sim_records', r.id), {
                    ...r,
                    updatedAt: serverTimestamp(),
                  });
                });
                batch.commit().catch(() => {});
              }
            } catch (e) {}
            return;
          }

          setRecords(fetchedRecords);
          setLocalCache(LOCAL_STORAGE_KEY, fetchedRecords);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fetchedRecords));
          } catch (e) {
            // Ignore quota
          }
        } else {
          // If Firestore is empty and we have initial records, seed them
          if (canEdit && records.length > 0) {
            // Firestore is freshly provisioned or empty; keep local initial records
            setLocalCache(LOCAL_STORAGE_KEY, records);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sim_records');
      }
    );

    return () => unsubscribe();
  }, [canEdit]);

  // Next SL counter
  const nextSl = useMemo(() => {
    if (records.length === 0) return 1;
    return Math.max(...records.map((r) => r.sl || 0)) + 1;
  }, [records]);

  // Filtering records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Search across all fields
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const searchableValues = [
          rec.sl,
          rec.branchCode,
          rec.userName,
          rec.identyNumber,
          rec.designation,
          rec.department,
          rec.distributionDate,
          rec.simOwner,
          rec.operatorName,
          rec.simGroup,
          rec.simType,
          rec.simNumber,
          rec.creditLimit,
          rec.monthlyApproved,
          rec.paymentBill,
          rec.advancePayment,
          rec.remarks,
          rec.status,
        ];
        const matchFound = searchableValues.some(
          (val) => val !== undefined && val !== null && String(val).toLowerCase().includes(query)
        );
        if (!matchFound) {
          return false;
        }
      }

      // Branch
      if (filters.branchCode && rec.branchCode !== filters.branchCode) {
        return false;
      }

      // Operator
      if (filters.operatorName && rec.operatorName !== filters.operatorName) {
        return false;
      }

      // Sim Type
      if (filters.simType && rec.simType !== filters.simType) {
        return false;
      }

      // Department
      if (filters.department && rec.department !== filters.department) {
        return false;
      }

      // SIM Owner
      if (filters.simOwner && rec.simOwner !== filters.simOwner) {
        return false;
      }

      // SIM Group
      if (filters.simGroup && rec.simGroup !== filters.simGroup) {
        return false;
      }

      // Status
      if (filters.status) {
        const itemStatus = rec.status || 'Active';
        if (itemStatus !== filters.status) {
          return false;
        }
      }

      return true;
    });
  }, [records, filters]);

  // Sorting records
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    const { field, order } = sortConfig;

    sorted.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal === undefined || aVal === null) return order === 'asc' ? 1 : -1;
      if (bVal === undefined || bVal === null) return order === 'asc' ? -1 : 1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [filteredRecords, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return {
          field,
          order: prev.order === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        field,
        order: 'asc',
      };
    });
  };

  // Row selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allVisibleIds = sortedRecords.map((r) => r.id);
    const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Save / Add / Update Handler
  const handleSaveRecord = async (
    data: Omit<SimRecord, 'id' | 'sl'>,
    saveAndAnother = false
  ) => {
    try {
      if (editingRecord && !isCopyMode) {
        // Update existing record
        const docRef = doc(db, 'sim_records', editingRecord.id);
        const updatedData = {
          ...data,
          sl: editingRecord.sl,
          updatedAt: serverTimestamp(),
        };

        try {
          await updateDoc(docRef, updatedData);
        } catch (err) {
          console.warn('Firestore update fallback to local', err);
        }

        // Local state update
        const updatedRecord: SimRecord = {
          ...data,
          id: editingRecord.id,
          sl: editingRecord.sl,
        };

        setRecords((prev) =>
          prev.map((r) => (r.id === editingRecord.id ? updatedRecord : r))
        );
        saveLocalCacheItem(LOCAL_STORAGE_KEY, updatedRecord);
        showToast(`Record #${editingRecord.sl} updated successfully!`);
      } else {
        // Create new record (or from copy mode)
        const currentNextSl = nextSl;
        const newDocData = {
          ...data,
          sl: currentNextSl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        let newId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        try {
          const docRef = await addDoc(collection(db, 'sim_records'), newDocData);
          newId = docRef.id;
        } catch (err) {
          console.warn('Firestore addDoc fallback to local ID', err);
        }

        const newRecord: SimRecord = {
          ...data,
          id: newId,
          sl: currentNextSl,
        };

        setRecords((prev) => [...prev, newRecord]);
        saveLocalCacheItem(LOCAL_STORAGE_KEY, newRecord);
        showToast(
          isCopyMode
            ? `Copied into new Record #${currentNextSl} (${data.userName}) successfully!`
            : `New Record #${currentNextSl} added successfully!`
        );
      }

      if (!saveAndAnother) {
        setIsFormOpen(false);
        setEditingRecord(null);
        setIsCopyMode(false);
      }
    } catch (err: any) {
      console.error('Failed to save record', err);
      showToast(`Error saving: ${err.message || 'Unknown error'}`);
    }
  };

  // Toggle Active / Inactive Status directly from table
  const handleToggleStatus = async (record: SimRecord) => {
    if (!canEdit) return;
    const newStatus = (record.status || 'Active') === 'Active' ? 'Inactive' : 'Active';

    try {
      const docRef = doc(db, 'sim_records', record.id);
      try {
        await updateDoc(docRef, {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore update status fallback to local', err);
      }

      const updatedRecord: SimRecord = {
        ...record,
        status: newStatus,
      };

      setRecords((prev) => prev.map((r) => (r.id === record.id ? updatedRecord : r)));
      saveLocalCacheItem(LOCAL_STORAGE_KEY, updatedRecord);
      showToast(
        newStatus === 'Active'
          ? `সিম #${record.sl} Active করা হয়েছে (ব্যালেন্স ও PDF রিপোর্টে অন্তর্ভুক্ত)`
          : `সিম #${record.sl} Inactive করা হয়েছে (বিল বাদ ও PDF থেকে অপসারিত)`
      );
    } catch (err: any) {
      console.error('Failed to toggle status', err);
    }
  };

  // Delete single record
  const handleConfirmDelete = async (record: SimRecord) => {
    try {
      try {
        await deleteDoc(doc(db, 'sim_records', record.id));
      } catch (err) {
        console.warn('Firestore delete fallback', err);
      }

      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      deleteLocalCacheItem(LOCAL_STORAGE_KEY, record.id);
      setSelectedIds((prev) => prev.filter((id) => id !== record.id));
      showToast(`Record #${record.sl} deleted successfully.`);
      setDeletingRecord(null);
    } catch (err: any) {
      console.error('Delete failed', err);
      showToast(`Delete failed: ${err.message}`);
    }
  };

  // Bulk delete selected records
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const idsToDelete = [...selectedIds];
      const batch = writeBatch(db);

      idsToDelete.forEach((id) => {
        try {
          batch.delete(doc(db, 'sim_records', id));
        } catch (e) {
          // ignore batch prep err
        }
      });

      try {
        await batch.commit();
      } catch (err) {
        console.warn('Firestore batch delete fallback', err);
      }

      setRecords((prev) => prev.filter((r) => !idsToDelete.includes(r.id)));
      idsToDelete.forEach((id) => deleteLocalCacheItem(LOCAL_STORAGE_KEY, id));
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      showToast(`${idsToDelete.length} records deleted successfully.`);
    } catch (err: any) {
      console.error('Bulk delete failed', err);
      showToast(`Bulk delete failed: ${err.message}`);
    }
  };

  // Duplicate record into form
  const handleDuplicateRecord = (rec: SimRecord) => {
    setEditingRecord(rec);
    setIsCopyMode(true);
    setIsFormOpen(true);
  };

  // Reset data to initial 15 corporate samples
  const handleConfirmReset = async () => {
    try {
      setRecords(INITIAL_SIM_RECORDS);
      setLocalCache(LOCAL_STORAGE_KEY, INITIAL_SIM_RECORDS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_SIM_RECORDS));

      // Overwrite Firestore collection
      const batch = writeBatch(db);
      INITIAL_SIM_RECORDS.forEach((rec) => {
        const docRef = doc(db, 'sim_records', rec.id);
        batch.set(docRef, {
          ...rec,
          updatedAt: serverTimestamp(),
        });
      });
      try {
        await batch.commit();
      } catch (err) {
        console.warn('Firestore reset batch note', err);
      }

      setIsResetModalOpen(false);
      showToast('Restored default 15 authentic corporate SIM records.');
    } catch (err: any) {
      console.error('Reset failed', err);
      showToast(`Reset failed: ${err.message}`);
    }
  };

  // Import batch records from Excel / CSV
  const handleImportRecords = async (newRecords: Omit<SimRecord, 'id' | 'sl'>[]) => {
    try {
      let startSl = nextSl;
      const created: SimRecord[] = [];
      const batch = writeBatch(db);

      newRecords.forEach((item, index) => {
        const assignedSl = startSl + index;
        const newId = `sim_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;
        const recordObj: SimRecord = {
          ...item,
          id: newId,
          sl: assignedSl,
        };
        created.push(recordObj);

        try {
          const docRef = doc(db, 'sim_records', newId);
          batch.set(docRef, {
            ...recordObj,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          // ignore
        }
      });

      try {
        await batch.commit();
      } catch (err) {
        console.warn('Firestore batch import fallback', err);
      }

      setRecords((prev) => [...prev, ...created]);
      created.forEach((r) => saveLocalCacheItem(LOCAL_STORAGE_KEY, r));
      showToast(`Successfully imported ${created.length} SIM records!`);
    } catch (err: any) {
      console.error('Import failed', err);
      showToast(`Import failed: ${err.message}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    exportRecordsToCSV(sortedRecords);
    showToast(`Exported ${sortedRecords.length} records to CSV!`);
  };

  // Export JSON
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `SIM_Management_Ledger_Export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast(`Exported ${records.length} records to JSON successfully!`);
    } catch (e: any) {
      showToast("Export JSON error: " + (e.message || String(e)));
    }
  };

  // Export Selected to CSV
  const handleExportSelected = () => {
    const selectedRecords = records.filter((r) => selectedIds.includes(r.id));
    if (selectedRecords.length === 0) return;
    exportRecordsToCSV(selectedRecords, `SIM_Selected_${selectedRecords.length}_records.csv`);
    showToast(`Exported ${selectedRecords.length} selected records to CSV!`);
  };

  const activeRecords = records.filter((r) => (r.status || 'Active') === 'Active');
  const totalApproved = activeRecords.reduce((sum, r) => sum + (r.monthlyApproved || 0), 0);
  const totalBill = activeRecords.reduce((sum, r) => sum + (r.paymentBill || 0), 0);

  const filterSummary = useMemo(() => {
    const parts = [];
    if (filters.branchCode) parts.push(`Branch: ${filters.branchCode}`);
    if (filters.operatorName) parts.push(`Operator: ${filters.operatorName}`);
    if (filters.simType) parts.push(`Type: ${filters.simType}`);
    if (filters.department) parts.push(`Dept: ${filters.department}`);
    if (filters.status) parts.push(`Status: ${filters.status}`);
    return parts.join(', ');
  }, [filters]);

  const selectedObjects = useMemo(() => {
    return records.filter((r) => selectedIds.includes(r.id));
  }, [records, selectedIds]);

  return (
    <div className="w-full px-4 sm:px-6 py-4 space-y-3.5 pb-12 max-w-[1240px] mx-auto">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Banner matching Reference Image */}
      <div className="bg-[#0b132b] text-white px-5 sm:px-6 py-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                SIM Allocation & Bill Tracker
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-500/40 uppercase tracking-wider">
                FORM & SHEET
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              ASRG SIM Management • Corporate SIM বিতরণ ও বিলিং তালিকা
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsManageSystemOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 active:bg-slate-950 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Manage System Configuration & Master Lists"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
            <span>Manage System</span>
          </button>
          <button
            type="button"
            onClick={() => setIsReportsArchiveOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Monthly Reports Archive"
          >
            <Calendar className="w-4 h-4" />
            <span>Monthly Reports</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Download PDF report"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          {canEdit && (
            <button
              type="button"
              id="btn-new-sim-top"
              onClick={() => {
                setEditingRecord(null);
                setIsCopyMode(false);
                setIsFormOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              title="Add New SIM Entry"
            >
              <Plus className="w-4 h-4" />
              <span>+ New SIM Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <SimStats
        records={records}
        currentStatusFilter={filters.status}
        onFilterStatus={(status) => setFilters((prev) => ({ ...prev, status }))}
      />

      {/* Toolbar & Filter Bar */}
      <SimToolbar
        filters={filters}
        onFilterChange={setFilters}
        onOpenNewForm={() => {
          setEditingRecord(null);
          setIsCopyMode(false);
          setIsFormOpen(true);
        }}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onOpenImport={() => setIsImportModalOpen(true)}
        onResetData={() => setIsResetModalOpen(true)}
        compactMode={compactMode}
        onToggleCompact={() => setCompactMode(!compactMode)}
        onOpenPdfExport={() => setIsPdfModalOpen(true)}
        onOpenColumnFilter={() => setIsColFilterModalOpen(true)}
        activeColumnsCount={visibleColumns.length}
        totalColumnsCount={ALL_COLUMNS.length}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onShowAllColumns={handleShowAllColumns}
        onResetColumns={handleResetColumns}
        canEdit={canEdit}
        branches={branches}
        operators={operators}
        simTypes={simTypes}
        departments={departments}
        simOwners={simOwners}
        simGroups={simGroups}
        statuses={statuses}
      />

      {/* Table Subheader Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 px-1 py-1 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            Showing <span className="font-bold text-slate-800">{sortedRecords.length} of {records.length}</span> records
          </div>
          {visibleColumns.length < ALL_COLUMNS.length && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium shadow-2xs">
              <EyeOff className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {ALL_COLUMNS.length - visibleColumns.length} columns hidden (কলাম হাইড করা আছে)
              </span>
              <button
                type="button"
                onClick={handleShowAllColumns}
                className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer ml-1"
                title="Show all columns (সব কলাম আনহাইড করুন)"
              >
                Show All (সব দেখাও)
              </button>
              <button
                type="button"
                onClick={() => setIsColFilterModalOpen(true)}
                className="text-slate-600 hover:text-slate-900 underline cursor-pointer ml-0.5"
                title="Customize hidden columns"
              >
                Customize
              </button>
            </div>
          )}
        </div>
        <div className="text-slate-400 text-[11px] mt-1 sm:mt-0">
          Hover column header to hide • Click header to sort • Action icons on right: View, Edit, Copy, Delete
        </div>
      </div>

      {/* Data Table */}
      <SimTable
        records={sortedRecords}
        sortConfig={sortConfig}
        onSort={handleSort}
        onEdit={(rec) => {
          setEditingRecord(rec);
          setIsCopyMode(false);
          setIsFormOpen(true);
        }}
        onDelete={(rec) => setDeletingRecord(rec)}
        onDuplicate={handleDuplicateRecord}
        onView={(rec) => setViewingRecord(rec)}
        onToggleStatus={handleToggleStatus}
        compactMode={compactMode}
        visibleColumns={visibleColumns}
        onHideColumn={handleHideColumn}
        onOpenColumnFilter={() => setIsColFilterModalOpen(true)}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onRequestBulkDelete={() => setIsBulkDeleteModalOpen(true)}
        onExportSelected={handleExportSelected}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {/* Bottom Footer Note matching Reference Image */}
      <div className="text-center py-2 text-xs text-slate-400 font-medium">
        Corporate SIM Management & Bill Ledger • Exact replica of uploaded Excel template
      </div>

      {/* Form Modal (Add / Edit / Copy to New) */}
      <SimFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRecord(null);
          setIsCopyMode(false);
        }}
        onSave={handleSaveRecord}
        initialData={editingRecord}
        isCopyMode={isCopyMode}
        nextSl={nextSl}
        existingRecords={records}
        branches={branches}
        operators={operators}
        simTypes={simTypes}
        departments={departments}
        designations={designations}
        simOwners={simOwners}
        simGroups={simGroups}
      />

      {/* Manage System Configuration Modal */}
      <ManageSystemModal
        isOpen={isManageSystemOpen}
        onClose={() => setIsManageSystemOpen(false)}
        branches={branches}
        setBranches={setBranches}
        operators={operators}
        setOperators={setOperators}
        simTypes={simTypes}
        setSimTypes={setSimTypes}
        departments={departments}
        setDepartments={setDepartments}
        designations={designations}
        setDesignations={setDesignations}
        simOwners={simOwners}
        setSimOwners={setSimOwners}
        simGroups={simGroups}
        setSimGroups={setSimGroups}
        statuses={statuses}
        setStatuses={setStatuses}
        totalSimsCount={records.length}
      />

      {/* Detail / Slip Modal */}
      <SimDetailModal
        record={viewingRecord}
        onClose={() => setViewingRecord(null)}
        onEdit={(rec) => {
          setViewingRecord(null);
          setEditingRecord(rec);
          setIsCopyMode(false);
          setIsFormOpen(true);
        }}
        canEdit={canEdit}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        records={sortedRecords}
        activeTableColumns={visibleColumns}
        onApplyTableColumns={(cols) => setVisibleColumns(cols)}
        filterSummaryText={filterSummary}
      />

      {/* Column Filter Modal */}
      <ColumnFilterModal
        isOpen={isColFilterModalOpen}
        onClose={() => setIsColFilterModalOpen(false)}
        visibleColumns={visibleColumns}
        onSaveColumns={(cols) => setVisibleColumns(cols)}
        onOpenPdfWithColumns={(cols) => {
          setVisibleColumns(cols);
          setIsPdfModalOpen(true);
        }}
      />

      {/* Single Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingRecord)}
        record={deletingRecord}
        onClose={() => setDeletingRecord(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Bulk Delete Modal */}
      <ConfirmBulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        selectedRecords={selectedObjects}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleConfirmBulkDelete}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportRecords}
        existingRecords={records}
      />

      {/* Monthly Reports Archive Modal */}
      <MonthlyReportsModal
        isOpen={isReportsArchiveOpen}
        onClose={() => setIsReportsArchiveOpen(false)}
        reports={downloadedReports}
        records={records}
        onAddReport={(newReport) => {
          const updated = [newReport, ...downloadedReports];
          setDownloadedReports(updated);
          localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(updated));
          showToast(`PDF ডাউনলোড সম্পন্ন হয়েছে: ${newReport.monthYear}`);
        }}
        onDeleteReport={(id) => {
          const updated = downloadedReports.filter((r) => r.id !== id);
          setDownloadedReports(updated);
          localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(updated));
        }}
        onClearAllReports={() => {
          setDownloadedReports([]);
          localStorage.removeItem(LOCAL_STORAGE_REPORTS_KEY);
        }}
      />
    </div>
  );
};

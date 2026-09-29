import React, { useState } from 'react';
import {
  X,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Check,
  Building2,
  PhoneCall,
  Layers,
  Briefcase,
  Users,
  Shield,
  Tag,
  CheckCircle2,
} from 'lucide-react';

interface ManageSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: string[];
  setBranches: React.Dispatch<React.SetStateAction<string[]>>;
  operators: string[];
  setOperators: React.Dispatch<React.SetStateAction<string[]>>;
  simTypes: string[];
  setSimTypes: React.Dispatch<React.SetStateAction<string[]>>;
  departments: string[];
  setDepartments: React.Dispatch<React.SetStateAction<string[]>>;
  designations: string[];
  setDesignations: React.Dispatch<React.SetStateAction<string[]>>;
  simOwners: string[];
  setSimOwners: React.Dispatch<React.SetStateAction<string[]>>;
  simGroups: string[];
  setSimGroups: React.Dispatch<React.SetStateAction<string[]>>;
  statuses: string[];
  setStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  totalSimsCount: number;
}

export const ManageSystemModal: React.FC<ManageSystemModalProps> = ({
  isOpen,
  onClose,
  branches,
  setBranches,
  operators,
  setOperators,
  simTypes,
  setSimTypes,
  departments,
  setDepartments,
  designations,
  setDesignations,
  simOwners,
  setSimOwners,
  simGroups,
  setSimGroups,
  statuses,
  setStatuses,
  totalSimsCount,
}) => {
  const [activeTab, setActiveTab] = useState<
    'branches' | 'operators' | 'departments' | 'designations' | 'types' | 'owners' | 'groups' | 'statuses'
  >('branches');
  
  const [newItemValue, setNewItemValue] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const getCurrentList = () => {
    switch (activeTab) {
      case 'branches':
        return branches;
      case 'operators':
        return operators;
      case 'departments':
        return departments;
      case 'designations':
        return designations;
      case 'types':
        return simTypes;
      case 'owners':
        return simOwners;
      case 'groups':
        return simGroups;
      case 'statuses':
        return statuses;
      default:
        return [];
    }
  };

  const getSetter = () => {
    switch (activeTab) {
      case 'branches':
        return setBranches;
      case 'operators':
        return setOperators;
      case 'departments':
        return setDepartments;
      case 'designations':
        return setDesignations;
      case 'types':
        return setSimTypes;
      case 'owners':
        return setSimOwners;
      case 'groups':
        return setSimGroups;
      case 'statuses':
        return setStatuses;
      default:
        return () => {};
    }
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'branches':
        return 'Branch';
      case 'operators':
        return 'Operator';
      case 'departments':
        return 'Department';
      case 'designations':
        return 'Designation';
      case 'types':
        return 'SIM Type';
      case 'owners':
        return 'SIM Owner';
      case 'groups':
        return 'SIM Group';
      case 'statuses':
        return 'Status';
      default:
        return '';
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newItemValue.trim();
    if (!val) return;

    const list = getCurrentList();
    if (list.includes(val)) {
      alert(`${getTabLabel()} "${val}" already exists!`);
      return;
    }

    const setter = getSetter() as React.Dispatch<React.SetStateAction<string[]>>;
    setter([...list, val]);
    showSuccess(`Successfully created ${getTabLabel().toLowerCase()} "${val}".`);
    setNewItemValue('');
  };

  const handleDeleteItem = (itemToDelete: string) => {
    const list = getCurrentList();
    if (list.length <= 1) {
      alert(`You must keep at least one ${getTabLabel().toLowerCase()}.`);
      return;
    }

    const setter = getSetter() as React.Dispatch<React.SetStateAction<string[]>>;
    setter(list.filter((item) => item !== itemToDelete));
    showSuccess(`Successfully deleted ${getTabLabel().toLowerCase()} "${itemToDelete}".`);
    if (editingIndex !== null) {
      setEditingIndex(null);
    }
  };

  const handleStartEdit = (index: number, currentVal: string) => {
    setEditingIndex(index);
    setEditValue(currentVal);
  };

  const handleSaveEdit = (index: number, oldVal: string) => {
    const val = editValue.trim();
    if (!val) {
      alert('Value cannot be empty.');
      return;
    }

    const list = getCurrentList();
    if (list.includes(val) && val !== oldVal) {
      alert(`${getTabLabel()} "${val}" already exists!`);
      return;
    }

    const setter = getSetter() as React.Dispatch<React.SetStateAction<string[]>>;
    const updated = [...list];
    updated[index] = val;
    setter(updated);
    showSuccess(`Successfully updated ${getTabLabel().toLowerCase()} to "${val}".`);
    setEditingIndex(null);
  };

  const list = getCurrentList();

  return (
    <div
      id="manage-system-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="manage-system-modal-container"
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">System Master Management (Create, Edit, Delete)</h2>
              <p className="text-xs text-slate-400">
                Manage all system dropdown options, filters, and master lists across the ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* System Overview Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-6">
            <div>
              <span className="font-semibold text-slate-900">{totalSimsCount}</span> Total SIM Records
            </div>
            <div>
              <span className="font-semibold text-slate-900">{branches.length}</span> Branches
            </div>
            <div>
              <span className="font-semibold text-slate-900">{operators.length}</span> Operators
            </div>
            <div>
              <span className="font-semibold text-slate-900">{departments.length}</span> Departments
            </div>
          </div>
          <span className="text-[11px] text-slate-400">Full CRUD support for all dropdown lists</span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 gap-2 shrink-0 overflow-x-auto">
          {[
            { id: 'branches', label: 'Branches', count: branches.length, icon: Building2 },
            { id: 'operators', label: 'Operators', count: operators.length, icon: PhoneCall },
            { id: 'departments', label: 'Departments', count: departments.length, icon: Layers },
            { id: 'designations', label: 'Designations', count: designations.length, icon: Briefcase },
            { id: 'types', label: 'SIM Types', count: simTypes.length, icon: Users },
            { id: 'owners', label: 'SIM Owners', count: simOwners.length, icon: Shield },
            { id: 'groups', label: 'SIM Groups', count: simGroups.length, icon: Tag },
            { id: 'statuses', label: 'Statuses', count: statuses.length, icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setEditingIndex(null);
                  setNewItemValue('');
                }}
                className={`px-3.5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>
                  {tab.label} ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Create Item Form */}
          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              type="text"
              value={newItemValue}
              onChange={(e) => setNewItemValue(e.target.value)}
              placeholder={`Create new ${getTabLabel()} (e.g. New Item)...`}
              className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white shadow-2xs"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add {getTabLabel()}</span>
            </button>
          </form>

          {/* List Items with Edit & Delete */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Manage {getTabLabel()} Options</span>
              <span className="text-[11px] font-normal text-slate-500">{list.length} total items</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
              {list.map((item, idx) => (
                <div key={item + idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3 flex-1 mr-4">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-semibold text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    {editingIndex === idx ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs border border-blue-400 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(idx, item);
                            if (e.key === 'Escape') setEditingIndex(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx, item)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                          title="Save Changes"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors cursor-pointer text-xs px-2"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-800">{item}</span>
                    )}
                  </div>

                  {editingIndex !== idx && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(idx, item)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                        title={`Edit ${item}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                        title={`Delete ${item}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 italic">
            Changes apply instantly to all create, edit, and filter selectors.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

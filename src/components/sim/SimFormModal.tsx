import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  PlusCircle,
  Building2,
  Smartphone,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Copy,
  ShieldAlert,
} from 'lucide-react';
import { SimRecord } from '../../types';
import {
  BRANCH_CODES,
  OPERATOR_OPTIONS,
  SIM_GROUPS,
  SIM_TYPES,
  DEPARTMENTS,
  DESIGNATIONS,
  SIM_OWNERS,
} from '../../data/simInitialData';
import { normalizeSimNumber } from '../../utils/simFormatters';

interface SimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<SimRecord, 'id' | 'sl'>, saveAndAnother?: boolean) => void;
  initialData?: SimRecord | null;
  isCopyMode?: boolean;
  nextSl: number;
  existingRecords?: SimRecord[];
  branches?: string[];
  operators?: string[];
  simTypes?: string[];
  departments?: string[];
  designations?: string[];
  simOwners?: string[];
  simGroups?: string[];
}

export const SimFormModal: React.FC<SimFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isCopyMode = false,
  nextSl,
  existingRecords = [],
  branches = BRANCH_CODES,
  operators = OPERATOR_OPTIONS,
  simTypes = SIM_TYPES,
  departments = DEPARTMENTS,
  designations = DESIGNATIONS,
  simOwners = SIM_OWNERS,
  simGroups = SIM_GROUPS,
}) => {
  const [formData, setFormData] = useState({
    branchCode: 'HO',
    userName: '',
    identyNumber: '',
    designation: '',
    department: 'Central Administration',
    distributionDate: new Date().toISOString().slice(0, 10),
    simOwner: 'Dynasty',
    operatorName: 'GP',
    simGroup: 'Group-A',
    simType: 'Postpaid' as 'Postpaid' | 'Prepaid',
    simNumber: '',
    creditLimit: 1000,
    monthlyApproved: 1000,
    paymentBill: 0,
    advancePayment: 0,
    remarks: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        branchCode: initialData.branchCode || 'HO',
        userName: initialData.userName || '',
        identyNumber: initialData.identyNumber || '',
        designation: initialData.designation || '',
        department: initialData.department || '',
        distributionDate: isCopyMode ? new Date().toISOString().slice(0, 10) : (initialData.distributionDate || new Date().toISOString().slice(0, 10)),
        simOwner: initialData.simOwner || 'Dynasty',
        operatorName: initialData.operatorName || 'GP',
        simGroup: initialData.simGroup || 'Group-A',
        simType: initialData.simType || 'Postpaid',
        simNumber: initialData.simNumber || '',
        creditLimit: initialData.creditLimit ?? 1000,
        monthlyApproved: initialData.monthlyApproved ?? 1000,
        paymentBill: isCopyMode ? 0 : (initialData.paymentBill ?? 0),
        advancePayment: isCopyMode ? 0 : (initialData.advancePayment ?? 0),
        remarks: isCopyMode && initialData.remarks ? `${initialData.remarks}` : (initialData.remarks || ''),
        status: (initialData.status || 'Active') as 'Active' | 'Inactive',
      });
    } else {
      setFormData({
        branchCode: 'HO',
        userName: '',
        identyNumber: '',
        designation: '',
        department: 'Central Administration',
        distributionDate: new Date().toISOString().slice(0, 10),
        simOwner: 'Dynasty',
        operatorName: 'GP',
        simGroup: 'Group-A',
        simType: 'Postpaid',
        simNumber: '',
        creditLimit: 1000,
        monthlyApproved: 1000,
        paymentBill: 0,
        advancePayment: 0,
        remarks: '',
        status: 'Active',
      });
    }
    setErrors({});
  }, [initialData, isOpen, isCopyMode]);

  // Real-time duplicate check against existing database records
  const duplicateRecord = useMemo(() => {
    const norm = normalizeSimNumber(formData.simNumber);
    if (!norm || norm.length < 5) return null;
    return (
      existingRecords.find((r) => {
        // If editing an existing record and not copying, exclude this record itself
        if (initialData && !isCopyMode && r.id === initialData.id) {
          return false;
        }
        return normalizeSimNumber(r.simNumber) === norm;
      }) || null
    );
  }, [formData.simNumber, existingRecords, initialData, isCopyMode]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!formData.userName.trim()) {
      errs.userName = 'User Name is required';
    }
    if (!formData.simNumber.trim()) {
      errs.simNumber = 'SIM Number is required';
    } else if (!/^[0-9+ ]{8,15}$/.test(formData.simNumber.trim())) {
      errs.simNumber = 'Enter valid SIM phone number (e.g., 01714141000)';
    } else if (duplicateRecord) {
      errs.simNumber = `ডুপ্লিকেট সিম নিষিদ্ধ! এই নম্বরটি ইতিমধ্যে #${duplicateRecord.sl} (${duplicateRecord.userName} - ${duplicateRecord.branchCode}) এর নামে সিস্টেমে রয়েছে।`;
    }
    if (formData.creditLimit < 0) {
      errs.creditLimit = 'Credit limit must be positive';
    }
    if (formData.monthlyApproved < 0) {
      errs.monthlyApproved = 'Approved limit must be positive';
    }
    if (formData.paymentBill < 0) {
      errs.paymentBill = 'Payment bill must be positive';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (saveAndAnother = false) => {
    if (!validate()) return;
    onSave(formData, saveAndAnother);
    if (saveAndAnother) {
      setFormData((prev) => ({
        ...prev,
        userName: '',
        identyNumber: '',
        simNumber: '',
        remarks: '',
        paymentBill: 0,
        advancePayment: 0,
      }));
      setErrors({});
    }
  };

  const isBillOverApproved = formData.paymentBill > formData.monthlyApproved;

  return (
    <div
      id="sim-form-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="sim-form-modal"
        className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between text-white ${
          isCopyMode ? 'bg-purple-900 border-b border-purple-800' : 'bg-slate-900'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg border ${
              isCopyMode
                ? 'bg-purple-600/30 border-purple-400/40 text-purple-300'
                : 'bg-blue-600/30 border-blue-400/40 text-blue-300'
            }`}>
              {isCopyMode ? <Copy className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                {isCopyMode
                  ? 'Copy to New SIM Entry'
                  : initialData
                  ? 'Edit SIM Allocation Record'
                  : 'SIM Allocation & Billing Entry Form'}
                <span className={`text-xs font-normal px-2 py-0.5 rounded border ${
                  isCopyMode
                    ? 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                }`}>
                  {isCopyMode
                    ? `New SL #${nextSl} (Copy of #${initialData?.sl})`
                    : `SL #${initialData ? initialData.sl : nextSl}`}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {isCopyMode
                  ? `কপি করে নতুন এন্ট্রি: SL #${initialData?.sl} (${initialData?.userName}) থেকে তথ্য নেওয়া হয়েছে।`
                  : initialData
                  ? 'Update employee assignment, network operator, and billing data'
                  : 'সিম বিতরণ ও বিলিং তথ্য যুক্ত করুন (Enter corporate SIM information)'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-form"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Copy Notice Banner */}
          {isCopyMode && initialData && (
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2.5 animate-in fade-in duration-150">
              <Copy className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-purple-950">
                  Copy to New System Active (কপি মোড সক্রিয়)
                </p>
                <p className="text-purple-800 leading-relaxed">
                  SL #{initialData.sl} ({initialData.userName || 'Unknown'} - {initialData.branchCode}) এর সমস্ত তথ্য এই নতুন ফর্মে লোড করা হয়েছে। নতুন সিম নম্বর ও প্রয়োজনীয় বিবরণ পরিবর্তন করে নিচে <strong>"Save as New SIM"</strong> বাটনে ক্লিক করুন।
                </p>
              </div>
            </div>
          )}

          {/* Section 1: User & Organization Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800 font-medium text-sm">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>1. Branch & Employee Profile (শাখা ও কর্মীর বিবরণ)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {/* Branch Code */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Branch Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-slate-50/50"
                  >
                    <option value="" disabled>Select Branch</option>
                    {branches.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* User Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  User Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.userName}
                    onChange={(e) => {
                      setFormData({ ...formData, userName: e.target.value });
                      if (errors.userName) setErrors({ ...errors, userName: '' });
                    }}
                    placeholder="e.g. Aminur Rahman or Central Warehouse (Fabrics)"
                    className={`w-full px-3 py-2 border rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden ${
                      errors.userName ? 'border-red-400 bg-red-50/30' : 'border-slate-300 bg-white'
                    }`}
                  />
                  {errors.userName && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.userName}
                    </p>
                  )}
                </div>
              </div>

              {/* Identy Number */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Identy Number (ID / NID)
                </label>
                <input
                  type="text"
                  value={formData.identyNumber}
                  onChange={(e) => setFormData({ ...formData, identyNumber: e.target.value })}
                  placeholder="e.g. ASRG1989001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
                />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                <select
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
                >
                  <option value="" disabled>Select Designation</option>
                  {designations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: SIM Card & Network Provider Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800 font-medium text-sm">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>2. SIM & Network Allocation (সিম ও অপারেটরের বিবরণ)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {/* Sim Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Sim Number <span className="text-red-500">*</span>
                  </label>
                  {duplicateRecord ? (
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wide flex items-center gap-0.5">
                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                      Duplicate SIM
                    </span>
                  ) : formData.simNumber && !errors.simNumber && /^[0-9+ ]{8,15}$/.test(formData.simNumber.trim()) ? (
                    <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Unique SIM
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.simNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, simNumber: e.target.value });
                      if (errors.simNumber) setErrors({ ...errors, simNumber: '' });
                    }}
                    placeholder="e.g. 01714141000"
                    className={`w-full px-3 py-2 border rounded-lg font-mono text-sm outline-hidden transition-all ${
                      duplicateRecord
                        ? 'border-rose-500 bg-rose-50/40 text-rose-950 ring-2 ring-rose-300/60 focus:ring-rose-500 focus:border-rose-500'
                        : errors.simNumber
                        ? 'border-red-400 bg-red-50/30 text-slate-900 focus:ring-2 focus:ring-red-400'
                        : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {errors.simNumber && !duplicateRecord && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.simNumber}
                    </p>
                  )}
                </div>

                {/* Prominent Duplicate Warning Banner */}
                {duplicateRecord && (
                  <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs shadow-2xs animate-in fade-in duration-150">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-rose-950">
                          ডুপ্লিকেট সিম নম্বর নিষিদ্ধ (Duplicate SIM Not Allowed)
                        </p>
                        <p className="text-[11px] text-rose-800 leading-snug">
                          সিম <strong>{formData.simNumber}</strong> ইতিমধ্যে রেকর্ড নং{' '}
                          <span className="font-semibold px-1 py-0.5 bg-rose-200/70 rounded text-rose-950">
                            #{duplicateRecord.sl}
                          </span>{' '}
                          (<strong>{duplicateRecord.userName}</strong> • {duplicateRecord.branchCode} •{' '}
                          {duplicateRecord.operatorName}) এর নামে ডাটাবেজে রয়েছে।
                        </p>
                        <p className="text-[10px] text-rose-700 font-medium">
                          একটি সিম নম্বর একাধিকবার এন্ট্রি করা যাবে না। দয়া করে ভিন্ন বা সঠিক নম্বর দিন।
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Operator Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Operator Name
                </label>
                <select
                  value={formData.operatorName}
                  onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                >
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sim Type */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sim Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {simTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, simType: type })}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        formData.simType === type
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sim Owner */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sim Owner</label>
                <select
                  value={formData.simOwner}
                  onChange={(e) => setFormData({ ...formData, simOwner: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                >
                  <option value="" disabled>Select SIM Owner</option>
                  {simOwners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>

              {/* SIM Group */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">SIM Group</label>
                <select
                  value={formData.simGroup}
                  onChange={(e) => setFormData({ ...formData, simGroup: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                >
                  {simGroups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Distribution Date */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Distribution Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.distributionDate}
                    onChange={(e) =>
                      setFormData({ ...formData, distributionDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Credit Limits, Billing & Payment */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800 font-medium text-sm">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span>3. Financial Limits & Monthly Bill (ক্রেডিট লিমিট ও বিলিং)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {/* Credit Limit */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Credit Limit (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-medium">৳</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.creditLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, creditLimit: Number(e.target.value) || 0 })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
                  />
                </div>
              </div>

              {/* Monthly Approved */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Monthly Approved (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-medium">৳</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formData.monthlyApproved}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyApproved: Number(e.target.value) || 0 })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
                  />
                </div>
              </div>

              {/* Payment Bill */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span>Payment Bill (৳)</span>
                  {isBillOverApproved && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-semibold">
                      Over limit
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-medium">৳</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formData.paymentBill}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentBill: Number(e.target.value) || 0 })
                    }
                    className={`w-full pl-8 pr-3 py-2 border rounded-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden ${
                      isBillOverApproved
                        ? 'border-amber-400 bg-amber-50/40 text-amber-900'
                        : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Advance Payment */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Advance Payment (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-medium">৳</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formData.advancePayment}
                    onChange={(e) =>
                      setFormData({ ...formData, advancePayment: Number(e.target.value) || 0 })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Remarks (মন্তব্য / নোট)
              </label>
              <textarea
                rows={2}
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Optional remarks, package notes, or allocation reasons..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white text-sm"
              />
            </div>

            {/* Status (Active / Inactive) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  Status (স্ট্যাটাস)
                </label>
                <span className="text-[11px] text-slate-500">
                  * Active সিম কেবল PDF তালিকায় আসবে
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'Active' })}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    formData.status === 'Active'
                      ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-1 ring-emerald-400 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Active (সচল)</p>
                      <p className="text-[10px] text-emerald-700">PDF রিপোর্টে অন্তর্ভুক্ত হবে</p>
                    </div>
                  </div>
                  {formData.status === 'Active' && (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'Inactive' })}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    formData.status === 'Inactive'
                      ? 'bg-rose-50/80 border-rose-500 text-rose-950 ring-1 ring-rose-400 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Inactive (নিষ্ক্রিয়)</p>
                      <p className="text-[10px] text-rose-700">PDF ডাউনলোড লিস্টে আসবে না</p>
                    </div>
                  </div>
                  {formData.status === 'Inactive' && (
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
          >
            Cancel (বাতিল)
          </button>

          <div className="flex items-center gap-3">
            {(!initialData || isCopyMode) && (
              <button
                type="button"
                disabled={Boolean(duplicateRecord)}
                onClick={() => handleSubmit(true)}
                title={duplicateRecord ? 'ডুপ্লিকেট সিম নম্বর দিয়ে সংরক্ষণ করা যাবে না' : undefined}
                className={`px-4 py-2 text-sm font-medium rounded-lg shadow-xs flex items-center gap-1.5 transition-colors ${
                  duplicateRecord
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                    : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-slate-500" />
                <span>Save & Add Another</span>
              </button>
            )}

            <button
              id="btn-save-sim"
              type="button"
              disabled={Boolean(duplicateRecord)}
              onClick={() => handleSubmit(false)}
              title={duplicateRecord ? 'ডুপ্লিকেট সিম নম্বর থাকায় সংরক্ষণ করা যাবে না' : undefined}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-colors ${
                duplicateRecord
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : isCopyMode
                  ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 cursor-pointer'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 cursor-pointer'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isCopyMode
                  ? 'Save as New SIM (নতুন রেকর্ড সংরক্ষণ)'
                  : initialData
                  ? 'Update Record'
                  : 'Save Record (সংরক্ষণ)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

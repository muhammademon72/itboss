import React from 'react';
import { X, Printer, Edit2, Smartphone, Building2, User, CreditCard } from 'lucide-react';
import { SimRecord } from '../../types';
import { formatCurrency, formatSimNumber } from '../../utils/simFormatters';

interface SimDetailModalProps {
  record: SimRecord | null;
  onClose: () => void;
  onEdit: (record: SimRecord) => void;
  canEdit?: boolean;
}

export const SimDetailModal: React.FC<SimDetailModalProps> = ({ record, onClose, onEdit, canEdit = true }) => {
  if (!record) return null;

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 border border-blue-400/40 rounded-lg">
              <Smartphone className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">
                SIM Allocation Slip / বিবরণী
              </h2>
              <p className="text-xs text-slate-300">
                SL #{record.sl} • {record.userName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-slate-700 print:p-0">
          {/* Top Badge strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-medium">
                Allocated Mobile Number
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900">
                {formatSimNumber(record.simNumber)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                  (record.status || 'Active') === 'Active'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    (record.status || 'Active') === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <span>{(record.status || 'Active') === 'Active' ? 'Active (PDF অন্তর্ভুক্ত)' : 'Inactive (PDF বাদ)'}</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                {record.operatorName} • {record.simType}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                {record.simGroup}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Employee & User Profile</span>
              </div>
              <div>
                <p className="text-xs text-slate-400">User Name</p>
                <p className="font-semibold text-slate-800">{record.userName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Identy Number (ID)</p>
                <p className="font-mono font-medium text-slate-800">{record.identyNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Designation</p>
                <p className="text-slate-800">{record.designation || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Department</p>
                <p className="text-slate-800">{record.department || '—'}</p>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Branch & SIM Ownership</span>
              </div>
              <div>
                <p className="text-xs text-slate-400">Branch Code</p>
                <p className="font-mono font-semibold text-slate-800">{record.branchCode || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">SIM Owner</p>
                <p className="text-slate-800">{record.simOwner || 'Dynasty'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Distribution Date</p>
                <p className="text-slate-800">{record.distributionDate || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">SIM Group</p>
                <p className="text-slate-800">{record.simGroup || 'Group-A'}</p>
              </div>
            </div>
          </div>

          {/* Financial summary card */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>Billing & Credit Limits (আর্থিক সীমা ও বিল)</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800 text-center">
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Credit Limit</p>
                <p className="text-base font-bold font-mono text-white">
                  ৳{formatCurrency(record.creditLimit)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Monthly Approved</p>
                <p className="text-base font-bold font-mono text-emerald-400">
                  ৳{formatCurrency(record.monthlyApproved)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Payment Bill</p>
                <p className="text-base font-bold font-mono text-amber-300">
                  ৳{formatCurrency(record.paymentBill)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Advance Paid</p>
                <p className="text-base font-bold font-mono text-slate-200">
                  ৳{formatCurrency(record.advancePayment)}
                </p>
              </div>
            </div>
          </div>

          {record.remarks && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
              <span className="font-semibold block mb-0.5">Remarks / মন্তব্য:</span>
              <p>{record.remarks}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between print:hidden">
          <button
            onClick={handlePrintSlip}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Slip</span>
          </button>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(record);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

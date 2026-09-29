import React from 'react';
import { Smartphone, PhoneOff, CreditCard, ShieldCheck, Receipt, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { SimRecord } from '../../types';
import { formatCurrency } from '../../utils/simFormatters';

interface SimStatsProps {
  records: SimRecord[];
  currentStatusFilter?: string;
  onFilterStatus?: (status: string) => void;
}

export const SimStats: React.FC<SimStatsProps> = ({
  records,
  currentStatusFilter,
  onFilterStatus,
}) => {
  const totalSims = records.length;
  const activeRecords = records.filter((r) => (r.status || 'Active') === 'Active');
  const inactiveRecords = records.filter((r) => (r.status || 'Active') === 'Inactive');

  const activeSims = activeRecords.length;
  const inactiveSims = inactiveRecords.length;

  // Financial balance calculations dynamically tied to Active SIMs
  const totalCreditLimit = activeRecords.reduce((sum, r) => sum + (r.creditLimit || 0), 0);
  const totalMonthlyApproved = activeRecords.reduce((sum, r) => sum + (r.monthlyApproved || 0), 0);
  const totalPaymentBill = activeRecords.reduce((sum, r) => sum + (r.paymentBill || 0), 0);
  const netBalance = totalMonthlyApproved - totalPaymentBill; // Surplus / Deficit

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
      {/* 1. Total SIMs Active Count */}
      <div
        onClick={() => onFilterStatus && onFilterStatus(currentStatusFilter === 'Active' ? '' : 'Active')}
        className={`bg-white rounded-xl border p-2.5 sm:p-3 shadow-xs flex items-center gap-2.5 transition-all ${
          onFilterStatus ? 'cursor-pointer hover:border-emerald-400 hover:shadow-sm' : ''
        } ${currentStatusFilter === 'Active' ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/20' : 'border-slate-200/90'}`}
        title="TOTAL SIMS ACTIVE (সচল সিম)"
      >
        <div className="w-8 h-8 rounded-lg bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0 border border-emerald-100/60">
          <Smartphone className="w-4 h-4 stroke-[2]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
            TOTAL SIMS ACTIVE
          </p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg font-bold text-[#065f46] leading-none tracking-tight">{activeSims}</span>
            <span className="text-[11px] text-slate-400 font-normal truncate">/{totalSims} SIMs</span>
          </div>
          <span className="text-[10px] font-semibold text-[#10b981] block truncate mt-0.5">
            সচল সিম (Active)
          </span>
        </div>
      </div>

      {/* 2. Total SIMs Inactive Count */}
      <div
        onClick={() => onFilterStatus && onFilterStatus(currentStatusFilter === 'Inactive' ? '' : 'Inactive')}
        className={`bg-white rounded-xl border p-2.5 sm:p-3 shadow-xs flex items-center gap-2.5 transition-all ${
          onFilterStatus ? 'cursor-pointer hover:border-rose-400 hover:shadow-sm' : ''
        } ${currentStatusFilter === 'Inactive' ? 'ring-2 ring-rose-500 border-rose-400 bg-rose-50/20' : 'border-slate-200/90'}`}
        title="TOTAL SIMS INACTIVE (নিষ্ক্রিয়)"
      >
        <div className="w-8 h-8 rounded-lg bg-[#fff1f2] text-[#f43f5e] flex items-center justify-center shrink-0 border border-rose-100/60">
          <PhoneOff className="w-4 h-4 stroke-[2]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate" title="TOTAL SIMS INACTIVE">
            TOTAL SIMS INACT...
          </p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg font-bold text-[#f43f5e] leading-none tracking-tight">{inactiveSims}</span>
            <span className="text-[11px] text-slate-400 font-normal truncate">lines</span>
          </div>
          <span className="text-[10px] font-semibold text-[#f43f5e] block truncate mt-0.5">
            নিষ্ক্রিয় (বিল বাদ)
          </span>
        </div>
      </div>

      {/* 3. Monthly Approved */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#eff6ff] text-[#3b82f6] flex items-center justify-center shrink-0 border border-blue-100/60">
          <ShieldCheck className="w-4 h-4 stroke-[2]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate" title="MONTHLY APPROVED">
            MONTHLY APPRO...
          </p>
          <p className="text-lg font-bold text-slate-900 leading-none truncate mt-0.5 tracking-tight">
            ৳{formatCurrency(totalMonthlyApproved)}
          </p>
          <span className="text-[10px] text-slate-500 font-normal truncate block mt-0.5">
            {activeSims} সচল সিমের বরাদ্দ
          </span>
        </div>
      </div>

      {/* 4. Payment Bill */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#fffbeb] text-[#f59e0b] flex items-center justify-center shrink-0 border border-amber-100/60">
          <Receipt className="w-4 h-4 stroke-[2]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
            PAYMENT BILL
          </p>
          <p className="text-lg font-bold text-[#1e3a8a] leading-none truncate mt-0.5 tracking-tight">
            ৳{formatCurrency(totalPaymentBill)}
          </p>
          <span className="text-[10px] text-slate-500 font-normal truncate block mt-0.5">
            সচল সিমের চলতি বিল
          </span>
        </div>
      </div>

      {/* 5. Net Balance */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0 border border-emerald-100/60">
          <Wallet className="w-4 h-4 stroke-[2]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate flex items-center gap-1">
            <span>NET BALANCE</span>
            <span className="text-[#10b981] font-bold text-xs leading-none">↗</span>
          </p>
          <p className="text-lg font-bold text-[#047857] leading-none truncate mt-0.5 tracking-tight">
            ৳{formatCurrency(Math.abs(netBalance))}
          </p>
          <span className="text-[10px] font-semibold text-[#10b981] truncate block mt-0.5">
            {netBalance >= 0 ? 'Surplus (অবশিষ্ট)' : 'Deficit (ঘাটতি)'}
          </span>
        </div>
      </div>

      {/* 6. Total Credit Limit */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#eef2ff] text-[#6366f1] flex items-center justify-center shrink-0 border border-indigo-100/60">
          <CreditCard className="w-4 h-4 stroke-[2]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
            CREDIT LIMIT
          </p>
          <p className="text-lg font-bold text-slate-900 leading-none truncate mt-0.5 tracking-tight">
            ৳{formatCurrency(totalCreditLimit)}
          </p>
          <span className="text-[10px] text-slate-500 font-normal truncate block mt-0.5">
            সচল সিম লিমিট
          </span>
        </div>
      </div>
    </div>
  );
};

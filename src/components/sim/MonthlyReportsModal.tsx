import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  Clock,
  PlusCircle,
  Columns3,
  Check,
  ChevronDown,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { DownloadedReportRecord, SimRecord, SortField } from '../../types';
import { generateSimReportPdf } from '../../utils/simPdfExport';
import { formatCurrency } from '../../utils/simFormatters';

interface ColumnOption {
  field: SortField;
  label: string;
}

const PDF_COLUMNS_CONFIG: ColumnOption[] = [
  { field: 'sl', label: 'SL (ক্রমিক)' },
  { field: 'branchCode', label: 'Branch Code (শাখা কোড)' },
  { field: 'userName', label: 'User Name (ব্যবহারকারী...' },
  { field: 'identyNumber', label: 'Identy Number (আইডি ...' },
  { field: 'designation', label: 'Designation (পদবী)' },
  { field: 'department', label: 'Department (বিভাগ)' },
  { field: 'distributionDate', label: 'Distribution date (বিতর...' },
  { field: 'simOwner', label: 'Sim Owner (সিম মালিক)' },
  { field: 'operatorName', label: 'Operator Name (অপারে...' },
  { field: 'simGroup', label: 'SIM Group (গ্রুপ)' },
  { field: 'simType', label: 'Sim Type (টাইপ)' },
  { field: 'simNumber', label: 'Sim Number (সিম নম্বর)' },
  { field: 'creditLimit', label: 'Credit Limit (ক্রেডিট লি...' },
  { field: 'monthlyApproved', label: 'Monthly Approved (মাসি...' },
  { field: 'paymentBill', label: 'Payment Bill (চলতি বিল)' },
  { field: 'advancePayment', label: 'Advance Payment (অগ্রি...' },
  { field: 'remarks', label: 'Remarks (মন্তব্য)' },
  { field: 'status', label: 'Status (স্ট্যাটাস)' },
];

const DEFAULT_SELECTED_COLUMNS: SortField[] = [
  'sl',
  'operatorName',
  'simType',
  'simNumber',
  'paymentBill',
  'advancePayment',
  'status',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [
  CURRENT_YEAR - 2,
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
].map(String);

interface MonthlyReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: DownloadedReportRecord[];
  onDeleteReport: (reportId: string) => void;
  onClearAllReports: () => void;
  records?: SimRecord[];
  onAddReport?: (report: DownloadedReportRecord) => void;
}

export const MonthlyReportsModal: React.FC<MonthlyReportsModalProps> = ({
  isOpen,
  onClose,
  reports,
  onDeleteReport,
  onClearAllReports,
  records = [],
  onAddReport,
}) => {
  const [selectedColumns, setSelectedColumns] = useState<SortField[]>(DEFAULT_SELECTED_COLUMNS);
  const [selectedMonth, setSelectedMonth] = useState<string>('October');
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [reportToDelete, setReportToDelete] = useState<DownloadedReportRecord | null>(null);

  if (!isOpen) return null;

  const toggleColumn = (field: SortField) => {
    if (selectedColumns.includes(field)) {
      if (selectedColumns.length === 1) return; // Keep at least 1
      setSelectedColumns(selectedColumns.filter((c) => c !== field));
    } else {
      setSelectedColumns([...selectedColumns, field]);
    }
  };

  const handleSelectAll = () => {
    setSelectedColumns(PDF_COLUMNS_CONFIG.map((c) => c.field));
  };

  const handleResetDefault = () => {
    setSelectedColumns(DEFAULT_SELECTED_COLUMNS);
  };

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    try {
      const activeRecords = records.filter((r) => (r.status || 'Active') === 'Active');
      const totalBill = activeRecords.reduce((sum, r) => sum + (r.paymentBill || 0), 0);
      const title = `Corporate SIM Monthly Bill Report - ${selectedMonth} ${selectedYear}`;

      generateSimReportPdf({
        title,
        subtitle: `ASRG Corporate SIM Management • Month: ${selectedMonth} ${selectedYear}`,
        selectedColumns,
        orientation: selectedColumns.length > 7 ? 'landscape' : 'portrait',
        includeSummary: false,
        records: activeRecords,
      });

      if (onAddReport) {
        const inactiveCount = records.length - activeRecords.length;
        const totalApproved = activeRecords.reduce((sum, r) => sum + (r.monthlyApproved || 0), 0);

        const newRecord: DownloadedReportRecord = {
          id: `report-${Date.now()}`,
          title,
          monthYear: `${selectedMonth} ${selectedYear}`,
          generatedAt: new Date().toISOString(),
          totalRecords: activeRecords.length,
          activeCount: activeRecords.length,
          inactiveCount,
          totalBill,
          totalApproved,
          selectedColumns,
        };
        onAddReport(newRecord);
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      id="monthly-reports-archive-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="monthly-reports-archive-modal"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        {/* Top Dark Navy Header */}
        <div className="bg-[#0b1426] text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                Monthly PDF Reports Archive
              </h2>
              <p className="text-xs text-slate-300/80 leading-normal">
                মাসিক পিডিএফ রিপোর্ট ডাউনলোড ও অতীতের সকল ডাউনলোড রেকর্ডের সংরক্ষণ (View, Delete &amp; Column Filter)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-[#f8fafc] flex-1">
          {/* Section 1: Generate New Monthly PDF Report Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
            {/* Section 1 Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Generate New Monthly PDF Report (নতুন মাসিক রিপোর্ট তৈরি করুন)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 pl-6">
                  Select month, year, and customize columns to compile and download the official PDF report.
                </p>
              </div>

              <div className="self-start sm:self-auto pl-6 sm:pl-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 bg-rose-50/50 text-xs font-semibold">
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>Column Filter ({selectedColumns.length} selected)</span>
                </span>
              </div>
            </div>

            {/* Column Selector Box */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3">
              {/* Header row with actions */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
                <p className="text-xs font-bold text-slate-800">
                  Select Columns for PDF Report (পিডিএফ রিপোর্টের জন্য কলাম নির্বাচন করুন):
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
              </div>

              {/* 18 Column items grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {PDF_COLUMNS_CONFIG.map((col) => {
                  const isChecked = selectedColumns.includes(col.field);
                  return (
                    <button
                      key={col.field}
                      type="button"
                      onClick={() => toggleColumn(col.field)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11px] sm:text-xs transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'border-rose-300 bg-rose-50/40 text-rose-950 font-medium'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      title={col.label}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-[#e11d48] text-white'
                            : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{col.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selectors Row: Month, Year, and Action Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 pt-1">
              <div className="flex items-center gap-3 flex-1">
                {/* Month Dropdown */}
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Month (মাস)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs font-medium"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Year Dropdown */}
                <div className="w-28 sm:w-36">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Year (বছর)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs font-medium"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Red Download Button */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloading || selectedColumns.length === 0}
                className="bg-[#e11d48] hover:bg-[#be123c] active:bg-[#9f1239] text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {isDownloading
                    ? 'Generating PDF...'
                    : `Download ${selectedMonth} Report (${selectedColumns.length} Cols)`}
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Download History & Records */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-slate-800">
                  Download History &amp; Records ({reports.length})
                </span>
              </div>
              <span className="text-slate-500 text-[11px] sm:text-xs">
                সকল অতীতের ডাউনলোড রেকর্ড ও ম্যানেজমেন্ট অপশন
              </span>
            </div>

            {/* Content Container */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                    <FileText className="w-6 h-6 stroke-[1.5]" />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.map((rpt) => (
                    <div
                      key={rpt.id}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                            {rpt.title}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                            {rpt.monthYear}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
                          <span>Date: {new Date(rpt.generatedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{rpt.totalRecords} SIMs</span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            Bill: ৳{formatCurrency(rpt.totalBill)}
                          </span>
                          <span>•</span>
                          <span>{rpt.selectedColumns?.length || 0} Columns</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setReportToDelete(rpt)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete report entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-5 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Total Downloaded Reports: {reports.length}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#0b1426] hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Close Archive
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {reportToDelete && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setReportToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Monthly Report
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to permanently delete this report record?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Report:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[240px]">
                  {reportToDelete.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Month &amp; Year:</span>
                <span className="font-semibold text-rose-700">
                  {reportToDelete.monthYear}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SIM Lines:</span>
                <span className="font-medium text-slate-800">
                  {reportToDelete.totalRecords} SIMs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Bill:</span>
                <span className="font-bold text-slate-900">
                  ৳{formatCurrency(reportToDelete.totalBill)}
                </span>
              </div>
            </div>

            <p className="text-xs text-rose-600 font-medium">
              This action cannot be undone. The archived snapshot will be deleted.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteReport(reportToDelete.id);
                  setReportToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

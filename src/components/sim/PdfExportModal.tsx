import React, { useState } from 'react';
import {
  X,
  FileDown,
  CheckSquare,
  Square,
  Sparkles,
  Sliders,
  Eye,
  Settings2,
  FileText,
} from 'lucide-react';
import { SimRecord, SortField, ALL_COLUMNS } from '../../types';
import { generateSimReportPdf } from '../../utils/simPdfExport';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SimRecord[];
  activeTableColumns: SortField[];
  onApplyTableColumns?: (columns: SortField[]) => void;
  filterSummaryText?: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  records,
  activeTableColumns,
  onApplyTableColumns,
  filterSummaryText,
}) => {
  const [selectedColumns, setSelectedColumns] = useState<SortField[]>(activeTableColumns);
  const [reportTitle, setReportTitle] = useState<string>('Corporate SIM Allocation & Bill Ledger Report');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [includeSummary, setIncludeSummary] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedColumns(activeTableColumns);
    }
  }, [isOpen, activeTableColumns]);

  if (!isOpen) return null;

  const toggleColumn = (field: SortField) => {
    if (selectedColumns.includes(field)) {
      if (selectedColumns.length === 1) {
        return;
      }
      setSelectedColumns(selectedColumns.filter((c) => c !== field));
    } else {
      setSelectedColumns([...selectedColumns, field]);
    }
  };

  const selectAll = () => {
    setSelectedColumns(ALL_COLUMNS.map((c) => c.field));
  };

  const selectNone = () => {
    setSelectedColumns(['sl', 'userName', 'simNumber']);
  };

  // Presets
  const applyPreset = (type: 'all' | 'essential' | 'financial' | 'hr') => {
    switch (type) {
      case 'all':
        setSelectedColumns(ALL_COLUMNS.map((c) => c.field));
        break;
      case 'essential':
        setSelectedColumns([
          'sl',
          'branchCode',
          'userName',
          'simNumber',
          'operatorName',
          'simType',
          'monthlyApproved',
          'paymentBill',
        ]);
        break;
      case 'financial':
        setSelectedColumns([
          'sl',
          'branchCode',
          'userName',
          'simNumber',
          'creditLimit',
          'monthlyApproved',
          'paymentBill',
          'advancePayment',
          'remarks',
          'status',
        ]);
        break;
      case 'hr':
        setSelectedColumns([
          'sl',
          'branchCode',
          'userName',
          'identyNumber',
          'designation',
          'department',
          'simOwner',
          'simNumber',
          'distributionDate',
          'status',
        ]);
        break;
    }
  };

  const activeRecords = records.filter((r) => (r.status || 'Active') === 'Active');
  const inactiveCount = records.length - activeRecords.length;

  const handleDownloadPdf = () => {
    setIsExporting(true);
    try {
      generateSimReportPdf({
        title: reportTitle,
        subtitle: 'ASRG Corporate SIM Allocation System',
        selectedColumns,
        orientation,
        includeSummary,
        filterSummaryText,
        records: activeRecords,
      });
      if (onApplyTableColumns) {
        onApplyTableColumns(selectedColumns);
      }
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (err) {
      console.error('PDF Generation failed', err);
      setIsExporting(false);
    }
  };

  const isAllSelected = selectedColumns.length === ALL_COLUMNS.length;

  return (
    <div
      id="pdf-export-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/65 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="pdf-export-modal"
        className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-600/30 border border-rose-400/40 rounded-lg">
              <FileDown className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Column Filter & PDF Export
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  কলাম ফিল্টার ও পিডিএফ ডাউনলোড
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                আপনার প্রয়োজন অনুযায়ী কলাম নির্বাচন করে প্রফেশনাল PDF রিপোর্ট ডাউনলোড করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6 text-sm">
          {/* Active SIMs filter notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div>
                <p className="text-xs font-semibold text-emerald-950">
                  পিডিএফ তালিকায় শুধুমাত্র Active (সচল) সিম অন্তর্ভুক্ত হবে
                </p>
                <p className="text-[11px] text-emerald-700">
                  Currently exporting <strong>{activeRecords.length} Active SIMs</strong>
                </p>
              </div>
            </div>
            {inactiveCount > 0 && (
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                {inactiveCount} Inactive SIMs বাদ দেওয়া হয়েছে
              </span>
            )}
          </div>

          {/* Preset Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Quick Column Presets (দ্রুত কলাম বাচাই)</span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  Select All (সব)
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Minimum (ন্যূনতম)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                  isAllSelected
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-400'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-semibold">All 17 Columns</div>
                <div className="text-[10px] text-slate-500">সম্পূর্ণ স্প্রেডশীট ডেটা</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('essential')}
                className="px-3 py-2 text-xs font-medium rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold">Essential / জরুরি কলাম</div>
                <div className="text-[10px] text-slate-500">নাম, নম্বর, বিল ও বরাদ্দ</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('financial')}
                className="px-3 py-2 text-xs font-medium rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold">Billing & Financial</div>
                <div className="text-[10px] text-slate-500">ক্রেডিট, বিল ও পেমেন্ট</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('hr')}
                className="px-3 py-2 text-xs font-medium rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold">Employee & Branch</div>
                <div className="text-[10px] text-slate-500">কর্মী, শাখা ও পদবী</div>
              </button>
            </div>
          </div>

          {/* Column Checkbox Selection Grid */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                Select Columns to Include in PDF ({selectedColumns.length} of {ALL_COLUMNS.length}{' '}
                selected)
              </span>
              <span className="text-xs font-medium text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                {selectedColumns.length} Columns Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {ALL_COLUMNS.map((col) => {
                const isChecked = selectedColumns.includes(col.field);
                return (
                  <label
                    key={col.field}
                    onClick={() => toggleColumn(col.field)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer select-none text-xs transition-all ${
                      isChecked
                        ? 'bg-white border-blue-400 shadow-xs ring-1 ring-blue-400/30'
                        : 'bg-white/60 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium leading-tight ${
                          isChecked ? 'text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {col.label}
                      </p>
                      {col.bnLabel && (
                        <p className="text-[11px] text-slate-400 leading-tight">{col.bnLabel}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* PDF Report Settings */}
          <div className="space-y-4 pt-1">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>PDF Document Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Report Title */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Report Title (হেডার শিরোনাম)
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Report Title"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              {/* Page Orientation */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Page Orientation (পৃষ্ঠার দিক)
                </label>
                <select
                  value={orientation}
                  onChange={(e) =>
                    setOrientation(e.target.value as 'auto' | 'portrait' | 'landscape')
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  <option value="auto">
                    Auto Detect (স্বয়ংক্রিয়: {selectedColumns.length > 7 ? 'Landscape' : 'Portrait'}
                    )
                  </option>
                  <option value="landscape">Landscape (আড়াআড়ি - প্রশস্ত কলামের জন্য উত্তম)</option>
                  <option value="portrait">Portrait (লম্বালম্বি - কম কলামের জন্য)</option>
                </select>
              </div>
            </div>

            {/* Include KPI summary check */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="check-kpi-summary"
                type="checkbox"
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="check-kpi-summary"
                className="text-xs text-slate-700 cursor-pointer select-none"
              >
                Include Financial Summary Badges at top of PDF (মোট বিল, অনুমোদিত বাজেট ও সারাংশ যুক্ত করুন)
              </label>
            </div>

            {/* Filter Notice */}
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  The PDF will export <strong>{records.length} records</strong> matching your current
                  search and filters.
                </span>
              </div>
              {filterSummaryText && (
                <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">
                  {filterSummaryText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onApplyTableColumns && (
              <button
                type="button"
                onClick={() => {
                  onApplyTableColumns(selectedColumns);
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="Only change screen table view without closing"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Apply to Table View (টেবিলে দেখাও)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="btn-confirm-download-pdf"
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-60 rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Generating PDF...'
                  : `Download PDF (${selectedColumns.length} Columns)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

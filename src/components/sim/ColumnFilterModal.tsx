import React, { useState } from 'react';
import {
  X,
  Sliders,
  CheckSquare,
  Square,
  Sparkles,
  FileDown,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SortField, ALL_COLUMNS } from '../../types';

interface ColumnFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  visibleColumns: SortField[];
  onSaveColumns: (columns: SortField[]) => void;
  onOpenPdfWithColumns: (columns: SortField[]) => void;
}

export const ColumnFilterModal: React.FC<ColumnFilterModalProps> = ({
  isOpen,
  onClose,
  visibleColumns,
  onSaveColumns,
  onOpenPdfWithColumns,
}) => {
  const [selected, setSelected] = useState<SortField[]>(visibleColumns);

  React.useEffect(() => {
    if (isOpen) {
      setSelected(visibleColumns);
    }
  }, [isOpen, visibleColumns]);

  if (!isOpen) return null;

  const toggleColumn = (field: SortField) => {
    if (selected.includes(field)) {
      if (selected.length <= 1) {
        return;
      }
      setSelected(selected.filter((c) => c !== field));
    } else {
      setSelected([...selected, field]);
    }
  };

  const selectAll = () => {
    setSelected(ALL_COLUMNS.map((c) => c.field));
  };

  const applyPreset = (type: 'all' | 'essential' | 'financial' | 'hr') => {
    switch (type) {
      case 'all':
        setSelected(ALL_COLUMNS.map((c) => c.field));
        break;
      case 'essential':
        setSelected([
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
        setSelected([
          'sl',
          'branchCode',
          'userName',
          'simNumber',
          'creditLimit',
          'monthlyApproved',
          'paymentBill',
          'advancePayment',
          'remarks',
        ]);
        break;
      case 'hr':
        setSelected([
          'sl',
          'branchCode',
          'userName',
          'identyNumber',
          'designation',
          'department',
          'simOwner',
          'simNumber',
          'distributionDate',
        ]);
        break;
    }
  };

  const handleApply = () => {
    onSaveColumns(selected);
    onClose();
  };

  const handlePdfClick = () => {
    onSaveColumns(selected);
    onClose();
    onOpenPdfWithColumns(selected);
  };

  const isAll = selected.length === ALL_COLUMNS.length;

  return (
    <div
      id="column-filter-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="column-filter-modal"
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 border border-blue-400/40 rounded-lg">
              <Sliders className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Column Visibility & Hide / Show
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  কলাম হাইড ও শো
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                যে কলামগুলো দেখতে বা টেবিল থেকে হাইড করতে চান তা টিক দিন বা আনচেক করুন ({selected.length} of {ALL_COLUMNS.length} দৃশ্যমান)
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
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 text-sm">
          {/* Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Quick Presets (কলামের দ্রুত ধরণ)</span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  Select All (সব দেখাও)
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelected(ALL_COLUMNS.map((c) => c.field))}
                  className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                  isAll
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-400'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-semibold">All {ALL_COLUMNS.length} Columns</div>
                <div className="text-[10px] text-slate-500">সকল কলাম (আনহাইড)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('essential')}
                className="px-3 py-2 text-xs font-medium rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold">Essential</div>
                <div className="text-[10px] text-slate-500">সংক্ষিপ্ত ও জরুরি</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('financial')}
                className="px-3 py-2 text-xs font-medium rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold">Billing & Financial</div>
                <div className="text-[10px] text-slate-500">বিল ও পেমেন্ট</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('hr')}
                className="px-3 py-2 text-xs font-medium rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold">Employee & SIM</div>
                <div className="text-[10px] text-slate-500">ব্যবহারকারী ও সিম</div>
              </button>
            </div>
          </div>

          {/* Column Checkbox Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {ALL_COLUMNS.map((col) => {
              const isChecked = selected.includes(col.field);
              return (
                <div
                  key={col.field}
                  onClick={() => toggleColumn(col.field)}
                  className={`flex items-start justify-between gap-2 p-2.5 rounded-lg border cursor-pointer select-none text-xs transition-all ${
                    isChecked
                      ? 'bg-blue-50/40 border-blue-400 text-slate-900 ring-1 ring-blue-400/20'
                      : 'bg-slate-50/70 border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold truncate ${isChecked ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                        {col.label}
                      </p>
                      {col.bnLabel && (
                        <p className="text-[11px] text-slate-500 leading-tight truncate">{col.bnLabel}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {isChecked ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100/70 text-blue-700 font-medium flex items-center gap-0.5">
                        <Eye className="w-2.5 h-2.5" />
                        <span>Visible</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold flex items-center gap-0.5">
                        <EyeOff className="w-2.5 h-2.5" />
                        <span>Hidden</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelected(ALL_COLUMNS.map((c) => c.field))}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Show All Columns (সব দেখাও)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePdfClick}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-rose-600" />
              <span>Download PDF with These</span>
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply to Table ({selected.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';

interface ConfirmResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmResetModal: React.FC<ConfirmResetModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-3 text-amber-600">
            <div className="p-3 bg-amber-100 rounded-full">
              <RotateCcw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Restore Image Data</h3>
              <p className="text-xs text-slate-500">
                Restore the 10 authentic corporate SIM allocation records
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            This will reset your SIM Management Ledger to the exact 10 corporate sample
            records from the design reference (including Aminur Rahman, Md. Shafiqur Rahman,
            Abu Nazam Md. Ruhullah, Abu Nazam Md. Shahidullah, Central Warehouse, and Tailor lines).
            Any custom edits will be replaced with these authentic baseline records.
          </p>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-reset"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore Image Data (১০টি রেকর্ড)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

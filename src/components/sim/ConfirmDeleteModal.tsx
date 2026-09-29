import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { SimRecord } from '../../types';
import { formatSimNumber } from '../../utils/simFormatters';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  record: SimRecord | null;
  onClose: () => void;
  onConfirm: (record: SimRecord) => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  record,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !record) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-3 text-red-600">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete SIM Record</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete this allocation?
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Record SL:</span>
              <span className="font-semibold text-slate-900">#{record.sl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">User Name:</span>
              <span className="font-semibold text-slate-900">{record.userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">SIM Number:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatSimNumber(record.simNumber)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Operator & Branch:</span>
              <span className="font-medium text-slate-800">
                {record.operatorName} • {record.branchCode}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            This action cannot be undone. All billing records tied to this SIM line will be removed
            from the active ledger.
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
            id="btn-confirm-delete"
            onClick={() => onConfirm(record)}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
};

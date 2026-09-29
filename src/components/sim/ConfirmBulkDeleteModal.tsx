import React from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';
import { SimRecord } from '../../types';

interface ConfirmBulkDeleteModalProps {
  isOpen: boolean;
  selectedRecords: SimRecord[];
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmBulkDeleteModal: React.FC<ConfirmBulkDeleteModalProps> = ({
  isOpen,
  selectedRecords,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || selectedRecords.length === 0) return null;

  return (
    <div
      id="bulk-delete-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-3 text-rose-600">
            <div className="p-3 bg-rose-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Delete {selectedRecords.length} Selected Records?
              </h3>
              <p className="text-xs text-slate-500">
                নির্বাচিত {selectedRecords.length} টি সিম রেকর্ড স্থায়ীভাবে মুছে ফেলতে চান?
              </p>
            </div>
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>
              <strong>সতর্কতা:</strong> এই অপারেশনের মাধ্যমে নির্বাচিত {selectedRecords.length} টি সিমের সমস্ত বিবরণ ও হিসেব ডাটাবেজ থেকে সম্পূর্ণ মুছে যাবে।
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50 text-xs">
            {selectedRecords.map((r) => (
              <div key={r.id} className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-500">#{r.sl}</span>
                  <span className="font-semibold text-slate-800">{r.userName}</span>
                  <span className="text-slate-400 font-mono">({r.simNumber})</span>
                </div>
                <span className="text-slate-500 text-[11px] bg-slate-200/70 px-1.5 py-0.5 rounded">
                  {r.branchCode}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Are you sure you want to proceed? This batch deletion cannot be undone.
          </p>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
          >
            Cancel (বাতিল)
          </button>
          <button
            id="btn-confirm-bulk-delete"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Yes, Delete All {selectedRecords.length} Records</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Receipt } from '../types';
import { formatCurrency } from '../utils/receiptUtils';
import { Eye, Edit2, Copy, Trash2, CreditCard, Banknote, Smartphone, CheckSquare } from 'lucide-react';

interface ReceiptTableProps {
  receipts: Receipt[];
  onView: (receipt: Receipt) => void;
  onEdit: (receipt: Receipt) => void;
  onDuplicate: (receipt: Receipt) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ReceiptTable: React.FC<ReceiptTableProps> = ({
  receipts,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  canEdit = true,
  canDelete = true,
}) => {
  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'Cash':
        return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Mobile Banking':
        return <Smartphone className="w-3.5 h-3.5 text-pink-600" />;
      case 'Bank Transfer':
      case 'Check':
        return <CreditCard className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <CheckSquare className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Receipt No</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Payer Name</th>
              <th className="py-3 px-4">Subject / Particulars</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4 text-center">Paid / Due</th>
              <th className="py-3 px-4 text-right">Amount (BDT)</th>
              <th className="py-3 px-4">Authorized By</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  No money receipts found matching your criteria.
                </td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                      {receipt.receiptNo}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                    {receipt.date}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {receipt.payerName}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-700">{receipt.subject}</div>
                    {receipt.notes && (
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{receipt.notes}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {getPaymentIcon(receipt.paymentMethod)}
                      <span>{receipt.paymentMethod}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border ${
                        receipt.status === 'Due'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : receipt.status === 'Cancelled'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {receipt.status || 'Paid'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm whitespace-nowrap">
                    {formatCurrency(receipt.amount)}
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-600">
                    {receipt.authorizedBy}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => onView(receipt)}
                        title="View / Print / PDF"
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => onEdit(receipt)}
                          title="Edit"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => onDuplicate(receipt)}
                          title="Duplicate"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => onDelete(receipt.id)}
                          title="Delete"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

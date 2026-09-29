import React, { useState, useEffect } from 'react';
import { Receipt } from '../types';
import { numberToWords, getNextReceiptNo } from '../utils/receiptUtils';
import { X, Save, FileText, Sparkles } from 'lucide-react';

interface ReceiptFormProps {
  receipt?: Receipt | null;
  onSave: (receipt: Receipt) => void;
  onClose: () => void;
  currentUserDisplayName?: string;
  existingReceipts?: Receipt[];
}

export const ReceiptForm: React.FC<ReceiptFormProps> = ({
  receipt,
  onSave,
  onClose,
  currentUserDisplayName,
  existingReceipts = [],
}) => {
  const [formData, setFormData] = useState<Omit<Receipt, 'id'>>({
    receiptNo: receipt ? receipt.receiptNo : getNextReceiptNo(existingReceipts),
    date: new Date().toISOString().split('T')[0],
    companyName: 'General Money Receipt',
    payerName: 'Valued Client',
    subject: 'Mobile Recharge',
    amount: 5000,
    amountInWords: 'Five thousand only.',
    receivedBy: currentUserDisplayName || 'Md Emon Hossain',
    authorizedBy: 'Md Shafiqur Rahman',
    paymentMethod: 'Cash',
    notes: '',
    status: 'Paid',
  });

  useEffect(() => {
    if (receipt) {
      setFormData({
        receiptNo: receipt.receiptNo,
        date: receipt.date,
        companyName: receipt.companyName || 'General Money Receipt',
        payerName: receipt.payerName,
        subject: receipt.subject,
        amount: receipt.amount,
        amountInWords: receipt.amountInWords || numberToWords(receipt.amount),
        receivedBy: receipt.receivedBy || currentUserDisplayName || 'Md Emon Hossain',
        authorizedBy: receipt.authorizedBy || 'Md Shafiqur Rahman',
        paymentMethod: receipt.paymentMethod || 'Cash',
        notes: receipt.notes || '',
        status: receipt.status || 'Paid',
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        receiptNo: getNextReceiptNo(existingReceipts),
      }));
    }
  }, [receipt, currentUserDisplayName, existingReceipts]);

  const handleAmountChange = (val: number) => {
    const num = isNaN(val) ? 0 : val;
    const words = numberToWords(num);
    setFormData((prev) => ({
      ...prev,
      amount: num,
      amountInWords: words,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReceipt: Receipt = {
      id: receipt ? receipt.id : `rcpt-${Date.now()}`,
      ...formData,
    };
    onSave(finalReceipt);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold">
              {receipt ? 'Edit Money Receipt' : 'Create New Money Receipt'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Company / Issuer Title</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Receipt No</label>
                {!receipt && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, receiptNo: getNextReceiptNo(existingReceipts) }))}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Auto generate next sequence number"
                  >
                    <Sparkles className="w-3 h-3" /> Auto Next
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={formData.receiptNo}
                onChange={(e) => setFormData({ ...formData, receiptNo: e.target.value })}
                placeholder="e.g. GMR-2026-101"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Received From (Payer Name)</label>
              <input
                type="text"
                required
                placeholder="e.g. IT Department / Client Name"
                value={formData.payerName}
                onChange={(e) => setFormData({ ...formData, payerName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Subject / Particulars</label>
            <input
              type="text"
              required
              placeholder="e.g. Mobile Recharge / Hardware Repair"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Amount (BDT ৳)</label>
              <input
                type="number"
                required
                min="1"
                value={formData.amount}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Payment Method</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="Mobile Banking">Mobile Banking</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Check">Check</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Paid Due Method</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Paid">Paid</option>
                <option value="Due">Due</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Amount in Words</label>
            <input
              type="text"
              required
              value={formData.amountInWords}
              onChange={(e) => setFormData({ ...formData, amountInWords: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm italic font-medium text-emerald-900 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Received By</label>
              <input
                type="text"
                required
                value={formData.receivedBy}
                onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Authorized By</label>
              <input
                type="text"
                required
                value={formData.authorizedBy}
                onChange={(e) => setFormData({ ...formData, authorizedBy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Notes / Remarks (Optional)</label>
            <textarea
              rows={2}
              value={formData.notes}
              placeholder="Any additional info or payment reference..."
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors flex items-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

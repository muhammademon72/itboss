import React, { useState, useEffect } from 'react';
import { DamagedStockProposal, DamagedStockItem, CompanyProfile } from '../types';
import { addDamagedStockProposal, updateDamagedStockProposal } from '../services/damagedStockService';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getLocalCache } from '../utils/localCache';
import { exportElementToPdf } from '../utils/pdfExport';
import { ArrowLeft, Plus, Trash2, Printer, Save, FileDown, CheckCircle2, AlertTriangle, Building, UserCheck, RefreshCw } from 'lucide-react';

interface DamagedStockProposalFormProps {
  onBack: () => void;
  currentUserUid: string;
  currentUserEmail: string;
  initialProposal?: DamagedStockProposal;
  readOnly?: boolean;
  isCopy?: boolean;
}

export default function DamagedStockProposalForm({
  onBack,
  currentUserUid,
  currentUserEmail,
  initialProposal,
  readOnly = false,
  isCopy = false
}: DamagedStockProposalFormProps) {
  const [formData, setFormData] = useState<Partial<DamagedStockProposal>>(() => {
    if (initialProposal) {
      if (isCopy) {
        const { id, proposalNumber, createdAt, updatedAt, ...rest } = initialProposal;
        return {
          ...rest,
          proposalNumber: `PROP-DISP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          date: new Date().toISOString().split('T')[0],
          status: 'Draft'
        };
      }
      return initialProposal;
    }
    return {
      proposalNumber: `PROP-DISP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      subject: 'Proposal for the Sale and Disposal of Broken/Damaged Product Stock',
      companyName: 'ASR Group Limited',
      companyAddress: 'Corporate HQ, Dhaka, Bangladesh',
      submittedBy: 'Store & Inventory Manager',
      submittedByDesignation: 'Manager (Store)',
      approvedBy: 'Managing Director / CEO',
      approvedByDesignation: 'Executive Director',
      status: 'Draft',
      remarks: 'The above-mentioned items are physically broken/damaged beyond economical repair during operations/transit. Approval is requested for sale as scrap/disposal to recover maximum value.',
      items: []
    };
  });

  const [items, setItems] = useState<DamagedStockItem[]>(() => {
    if (initialProposal?.items && initialProposal.items.length > 0) {
      return initialProposal.items;
    }
    return [
      {
        id: '1',
        sl: 1,
        productName: 'Broken Monitor / Equipment',
        category: 'Electronics',
        quantity: 10,
        unit: 'pcs',
        originalUnitCost: 5000,
        originalTotalValue: 50000,
        usageTime: '2 Years',
        proposedUnitSalePrice: 500,
        proposedTotalSaleValue: 5000,
        damageCondition: 'Internal circuit damage / screen cracked'
      }
    ];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(readOnly);
  const [isExporting, setIsExporting] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Fetch Company Profile Settings
  useEffect(() => {
    const fetchCompanyProfile = async () => {
      try {
        const docRef = doc(db, 'settings', 'companyProfile');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profile = docSnap.data() as CompanyProfile;
          setCompanyProfile(profile);
          if (!initialProposal || isCopy) {
            setFormData((prev) => ({
              ...prev,
              companyName: profile.name || prev.companyName || 'ASR Group Limited',
              companyAddress: profile.address || prev.companyAddress || 'Corporate HQ, Dhaka, Bangladesh'
            }));
          }
        } else {
          const cached = getLocalCache<CompanyProfile>('companyProfile');
          if (cached && cached.length > 0 && cached[0]) {
            const profile = cached[0];
            setCompanyProfile(profile);
            if (!initialProposal || isCopy) {
              setFormData((prev) => ({
                ...prev,
                companyName: profile.name || prev.companyName || 'ASR Group Limited',
                companyAddress: profile.address || prev.companyAddress || 'Corporate HQ, Dhaka, Bangladesh'
              }));
            }
          }
        }
      } catch (err) {
        console.error('Error fetching company profile:', err);
        const cached = getLocalCache<CompanyProfile>('companyProfile');
        if (cached && cached.length > 0 && cached[0]) {
          const profile = cached[0];
          setCompanyProfile(profile);
          if (!initialProposal || isCopy) {
            setFormData((prev) => ({
              ...prev,
              companyName: profile.name || prev.companyName || 'ASR Group Limited',
              companyAddress: profile.address || prev.companyAddress || 'Corporate HQ, Dhaka, Bangladesh'
            }));
          }
        }
      }
    };
    fetchCompanyProfile();
  }, [initialProposal, isCopy]);

  const handleLoadCompanyProfile = () => {
    if (companyProfile) {
      setFormData((prev) => ({
        ...prev,
        companyName: companyProfile.name || prev.companyName,
        companyAddress: companyProfile.address || prev.companyAddress
      }));
      alert('Company profile loaded!');
    } else {
      const cached = getLocalCache<CompanyProfile>('companyProfile');
      if (cached && cached.length > 0 && cached[0]) {
        setFormData((prev) => ({
          ...prev,
          companyName: cached[0].name || prev.companyName,
          companyAddress: cached[0].address || prev.companyAddress
        }));
        alert('Company profile loaded!');
      } else {
        alert('No Company Profile found. Please configure Company Profile in settings.');
      }
    }
  };

  // Recalculate totals
  const totalOriginalValue = items.reduce((acc, item) => acc + (item.originalTotalValue || 0), 0);
  const totalProposedSaleValue = items.reduce((acc, item) => acc + (item.proposedTotalSaleValue || 0), 0);
  const estimatedLoss = totalOriginalValue - totalProposedSaleValue;

  const handleAddItem = () => {
    const newItem: DamagedStockItem = {
      id: Date.now().toString(),
      sl: items.length + 1,
      productName: '',
      category: 'General',
      quantity: 1,
      unit: 'pcs',
      originalUnitCost: 0,
      originalTotalValue: 0,
      usageTime: '',
      proposedUnitSalePrice: 0,
      proposedTotalSaleValue: 0,
      damageCondition: 'Damaged / Non-functional'
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index).map((item, idx) => ({
      ...item,
      sl: idx + 1
    }));
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof DamagedStockItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    // Auto calculate row values
    if (field === 'quantity' || field === 'originalUnitCost') {
      const qty = field === 'quantity' ? Number(value) || 0 : current.quantity;
      const origCost = field === 'originalUnitCost' ? Number(value) || 0 : current.originalUnitCost;
      current.originalTotalValue = qty * origCost;
    }

    if (field === 'quantity' || field === 'proposedUnitSalePrice') {
      const qty = field === 'quantity' ? Number(value) || 0 : current.quantity;
      const salePrice = field === 'proposedUnitSalePrice' ? Number(value) || 0 : current.proposedUnitSalePrice;
      current.proposedTotalSaleValue = qty * salePrice;
    }

    updated[index] = current;
    setItems(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.proposalNumber || !formData.date || !formData.subject) {
      alert('Please fill in required proposal header fields.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item to the disposal proposal.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        proposalNumber: formData.proposalNumber,
        date: formData.date,
        subject: formData.subject,
        companyName: formData.companyName || '',
        companyAddress: formData.companyAddress || '',
        submittedBy: formData.submittedBy || '',
        submittedByDesignation: formData.submittedByDesignation || '',
        approvedBy: formData.approvedBy || '',
        approvedByDesignation: formData.approvedByDesignation || '',
        status: (formData.status as any) || 'Draft',
        remarks: formData.remarks || '',
        items,
        totalOriginalValue,
        totalProposedSaleValue,
        createdBy: currentUserUid,
        createdByEmail: currentUserEmail
      };

      if (initialProposal?.id && !isCopy) {
        await updateDamagedStockProposal(initialProposal.id, payload);
      } else {
        await addDamagedStockProposal(payload);
      }

      onBack();
    } catch (err) {
      console.error('Error saving proposal:', err);
      alert('Failed to save proposal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    let wasPreview = showPreview;
    if (!wasPreview) {
      setShowPreview(true);
      // Wait for React DOM render
      await new Promise((res) => setTimeout(res, 300));
    }

    const printEl = document.getElementById('printable-proposal-document');
    if (!printEl) {
      alert('Printable proposal view not found.');
      return;
    }

    setIsExporting(true);
    try {
      const fileName = `${formData.proposalNumber || 'Proposal'}_Damaged_Stock_Disposal.pdf`;
      await exportElementToPdf(printEl, fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF document. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Proposals
        </button>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              {showPreview ? 'Edit Proposal Form' : 'Printable Preview'}
            </button>
          )}

          {showPreview && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          )}

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
          >
            <FileDown className="h-4 w-4" />
            {isExporting ? 'Generating PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Main Form or Printable Preview */}
      {!showPreview ? (
        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-8">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">
              <AlertTriangle className="h-4 w-4" />
              Stock Disposal Ledger
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {initialProposal && !isCopy ? 'Edit Disposal Proposal' : 'New Disposal Proposal'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Proposal for the Sale and Disposal of Broken / Damaged Product Stock
            </p>
          </div>

          {/* Proposal Meta Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Proposal Number *</label>
              <input
                type="text"
                required
                value={formData.proposalNumber || ''}
                onChange={(e) => setFormData({ ...formData, proposalNumber: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Proposal Status</label>
              <select
                value={formData.status || 'Draft'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="Draft">Draft</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Disposed">Disposed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Document Title *</label>
              <input
                type="text"
                required
                value={formData.subject || ''}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Company & Signer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Building className="h-4 w-4 text-indigo-500" />
                  Company Profile
                </div>
                <button
                  type="button"
                  onClick={handleLoadCompanyProfile}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-all active:scale-95"
                  title="Load saved company profile details"
                >
                  <RefreshCw className="h-3 w-3" />
                  Load Profile
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName || ''}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 font-medium"
                  placeholder="Company Name"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Company Address</label>
                <input
                  type="text"
                  value={formData.companyAddress || ''}
                  onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                  placeholder="Company Address"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                <UserCheck className="h-4 w-4 text-emerald-500" />
                Submission & Approval Authority
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Submitted By</label>
                  <input
                    type="text"
                    value={formData.submittedBy || ''}
                    onChange={(e) => setFormData({ ...formData, submittedBy: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                    placeholder="Name / Title"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Approved By</label>
                  <input
                    type="text"
                    value={formData.approvedBy || ''}
                    onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                    placeholder="Name / Designation"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Broken/Damaged Stock Items</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl transition-all"
              >
                <Plus className="h-4 w-4" /> Add Item Row
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">SL</th>
                    <th className="py-2.5 px-3">Product Name / Description</th>
                    <th className="py-2.5 px-3 w-24">Qty & Unit</th>
                    <th className="py-2.5 px-3 text-right w-28">Orig Cost (TK)</th>
                    <th className="py-2.5 px-3 text-right w-28">Orig Total</th>
                    <th className="py-2.5 px-3 w-28">Usage Time</th>
                    <th className="py-2.5 px-3 text-right w-28">Prop Sale (TK)</th>
                    <th className="py-2.5 px-3 text-right w-28">Prop Total</th>
                    <th className="py-2.5 px-3">Damage Notes</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          placeholder="Item Name / Model"
                          value={item.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-center font-semibold"
                          />
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                            className="w-10 px-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] outline-none text-center"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={item.originalUnitCost}
                          onChange={(e) => handleItemChange(index, 'originalUnitCost', e.target.value)}
                          className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-right font-medium"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-700">
                        ৳ {(item.originalTotalValue || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="e.g. 2 Years"
                          value={item.usageTime || ''}
                          onChange={(e) => handleItemChange(index, 'usageTime', e.target.value)}
                          className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={item.proposedUnitSalePrice}
                          onChange={(e) => handleItemChange(index, 'proposedUnitSalePrice', e.target.value)}
                          className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-right font-bold text-emerald-600"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">
                        ৳ {(item.proposedTotalSaleValue || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="Condition / damage reason"
                          value={item.damageCondition}
                          onChange={(e) => handleItemChange(index, 'damageCondition', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Remove Row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Net Loss Summary */}
          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-700">Total Items:</span> {items.length} units line items
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-slate-500 font-medium">Original Cost:</span>{' '}
                <span className="font-bold text-slate-900">৳ {totalOriginalValue.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Proposed Scrap Sale:</span>{' '}
                <span className="font-bold text-emerald-600">৳ {totalProposedSaleValue.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Est. Write-off / Loss:</span>{' '}
                <span className="font-bold text-rose-600">৳ {estimatedLoss.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Remarks / Justification */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Proposal Justification / Remarks</label>
            <textarea
              rows={3}
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter reasons for disposal, physical inspection details, or disposal process instructions..."
            />
          </div>

          {/* Form Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 shrink-0"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Proposal'}
            </button>
          </div>
        </form>
      ) : (
        /* Printable Document View */
        <div className="bg-slate-100 p-4 md:p-8 rounded-3xl border border-slate-200 overflow-x-auto">
          <div
            id="printable-proposal-document"
            className="bg-white p-8 md:p-12 rounded-xl shadow-lg border border-slate-200 max-w-4xl mx-auto text-slate-900 font-sans space-y-6"
            style={{ minHeight: '1000px' }}
          >
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  {formData.companyName || 'ASR GROUP LIMITED'}
                </h1>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  {formData.companyAddress || 'Dhaka, Bangladesh'}
                </p>
                {companyProfile && (companyProfile.contact || companyProfile.email || companyProfile.website) && (
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    {[companyProfile.contact, companyProfile.email, companyProfile.website].filter(Boolean).join(' | ')}
                  </p>
                )}
                <div className="mt-2 inline-block px-3 py-1 bg-amber-100 text-amber-900 rounded-md font-bold text-xs uppercase tracking-wider">
                  Stock & Asset Management Division
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="text-xs font-bold text-slate-500">PROPOSAL REF</div>
                <div className="text-sm font-black text-indigo-600">{formData.proposalNumber}</div>
                <div className="text-xs font-semibold text-slate-600">Date: {formData.date}</div>
                <div className="mt-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-300">
                    Status: {formData.status || 'Draft'}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Subject */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase block mb-1">SUBJECT:</span>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {formData.subject}
              </h2>
            </div>

            {/* Printable Items Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Schedule of Broken/Damaged Stock Items Proposed for Sale & Disposal
              </div>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300">
                    <th className="py-2 px-3 border-r border-slate-300 text-center w-10">SL</th>
                    <th className="py-2 px-3 border-r border-slate-300">Item Description</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center w-20">Qty</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right w-28">Orig Cost (TK)</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right w-28">Orig Total (TK)</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center w-24">Usage Time</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right w-28">Prop Sale (TK)</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right w-28">Prop Total (TK)</th>
                    <th className="py-2 px-3">Condition / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-bold text-slate-600">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">{item.productName}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center">{item.quantity} {item.unit}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right">{(item.originalUnitCost || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right font-semibold">{(item.originalTotalValue || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-center font-medium text-slate-700">{item.usageTime || '-'}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right">{(item.proposedUnitSalePrice || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right font-bold text-slate-900">{(item.proposedTotalSaleValue || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-slate-600 italic text-[11px]">{item.damageCondition}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={4} className="py-2.5 px-3 border-r border-slate-300 text-right uppercase">
                      Grand Total:
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-300 text-right">
                      ৳ {totalOriginalValue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-300"></td>
                    <td className="py-2.5 px-3 border-r border-slate-300"></td>
                    <td className="py-2.5 px-3 border-r border-slate-300 text-right text-indigo-700">
                      ৳ {totalProposedSaleValue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-600">
                      Net Loss: ৳ {estimatedLoss.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Justification & Remarks */}
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Remarks / Justification:</div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                {formData.remarks || 'No additional notes provided.'}
              </div>
            </div>

            {/* Signatures Section */}
            <div className="pt-16 grid grid-cols-2 gap-8">
              <div className="text-center space-y-1">
                <div className="border-t-2 border-slate-800 pt-2 font-bold text-xs text-slate-900 uppercase">
                  {formData.submittedBy || 'Store / Inventory Manager'}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Prepared & Submitted By</div>
              </div>

              <div className="text-center space-y-1">
                <div className="border-t-2 border-slate-800 pt-2 font-bold text-xs text-slate-900 uppercase">
                  {formData.approvedBy || 'Managing Director / CEO'}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Approved / Management Sign-off</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

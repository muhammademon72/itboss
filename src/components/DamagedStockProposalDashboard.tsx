import React, { useState, useEffect } from 'react';
import { DamagedStockProposal } from '../types';
import { subscribeToDamagedStockProposals, deleteDamagedStockProposal } from '../services/damagedStockService';
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  Trash2, 
  Edit2, 
  Eye, 
  Copy, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  PackageX,
  Printer,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DamagedStockProposalDashboardProps {
  onNewProposal: () => void;
  onEditProposal: (proposal: DamagedStockProposal) => void;
  onViewProposal: (proposal: DamagedStockProposal) => void;
  onCopyProposal: (proposal: DamagedStockProposal) => void;
  currentUserUid: string;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export default function DamagedStockProposalDashboard({
  onNewProposal,
  onEditProposal,
  onViewProposal,
  onCopyProposal,
  currentUserUid,
  isAdmin = false,
  permissions
}: DamagedStockProposalDashboardProps) {
  const [proposals, setProposals] = useState<DamagedStockProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;

  useEffect(() => {
    const unsubscribe = subscribeToDamagedStockProposals((data) => {
      setProposals(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDamagedStockProposal(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting proposal:', err);
    }
  };

  const filteredProposals = proposals.filter((prop) => {
    const matchesStatus = selectedStatus === 'All' || prop.status === selectedStatus;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !query ||
      prop.proposalNumber?.toLowerCase().includes(query) ||
      prop.subject?.toLowerCase().includes(query) ||
      prop.submittedBy?.toLowerCase().includes(query) ||
      prop.remarks?.toLowerCase().includes(query) ||
      prop.items?.some(item => item.productName?.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  // Calculate Summary metrics
  const totalOriginalVal = proposals.reduce((acc, p) => acc + (p.totalOriginalValue || 0), 0);
  const totalProposedSaleVal = proposals.reduce((acc, p) => acc + (p.totalProposedSaleValue || 0), 0);
  const pendingCount = proposals.filter(p => p.status === 'Pending Approval').length;
  const approvedCount = proposals.filter(p => p.status === 'Approved' || p.status === 'Disposed').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
      case 'Disposed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"><PackageX className="w-3 h-3" /> Disposed</span>;
      case 'Pending Approval':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" /> Pending</span>;
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200"><Ban className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Stock & Asset Disposal Ledger
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            Proposal for Sale & Disposal of Broken/Damaged Product Stock
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage, record, and track stock damage reports, valuation, and disposal proposals.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={onNewProposal}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Disposal Proposal
          </button>
        )}
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <PackageX className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Proposals</p>
            <p className="text-xl font-bold text-slate-900">{proposals.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Original Stock Value</p>
            <p className="text-xl font-bold text-slate-900">৳ {totalOriginalVal.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Proposed Recovery Value</p>
            <p className="text-xl font-bold text-slate-900">৳ {totalProposedSaleVal.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Approved / Disposed</p>
            <p className="text-xl font-bold text-slate-900">{approvedCount} <span className="text-xs font-normal text-slate-400">({pendingCount} pending)</span></p>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filter */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Proposal #, Subject, Product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['All', 'Draft', 'Pending Approval', 'Approved', 'Disposed', 'Rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading proposals...</div>
        ) : filteredProposals.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-12 w-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No proposals found</p>
            <p className="text-xs text-slate-400 mt-1">Create a new proposal to record damaged stock sale and disposal details.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Proposal No & Date</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Original Cost</th>
                  <th className="py-3 px-4 text-right">Proposed Sale</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredProposals.map((prop) => (
                  <tr key={prop.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="font-bold text-indigo-600">{prop.proposalNumber}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {prop.date}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-slate-800 line-clamp-1">{prop.subject}</div>
                      {prop.submittedBy && (
                        <div className="text-[11px] text-slate-400 mt-0.5">By: {prop.submittedBy}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-600 font-semibold text-[11px]">
                        {prop.items?.length || 0} items
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-slate-600 whitespace-nowrap">
                      ৳ {(prop.totalOriginalValue || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                      ৳ {(prop.totalProposedSaleValue || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(prop.status)}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewProposal(prop)}
                          className="p-1.5 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-all"
                          title="View / Print Document"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {canEdit && (
                          <button
                            onClick={() => onEditProposal(prop)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-all"
                            title="Edit Proposal"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {canEdit && (
                          <button
                            onClick={() => onCopyProposal(prop)}
                            className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-all"
                            title="Duplicate Proposal"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirmId(prop.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                            title="Delete Proposal"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100 z-10 text-center"
            >
              <div className="h-12 w-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Proposal?</h3>
              <p className="text-xs text-slate-500 mt-1">This action cannot be undone. The proposal record will be permanently deleted.</p>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

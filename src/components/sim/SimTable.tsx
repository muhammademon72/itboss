import React from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Columns3,
  Phone,
  AlertTriangle,
  CheckSquare,
  Download,
} from 'lucide-react';
import { SimRecord, SortConfig, SortField, ALL_COLUMNS } from '../../types';
import { formatCurrency, formatSimNumber } from '../../utils/simFormatters';

interface SimTableProps {
  records: SimRecord[];
  sortConfig: SortConfig;
  onSort: (field: SortField) => void;
  onEdit: (record: SimRecord) => void;
  onDelete: (record: SimRecord) => void;
  onDuplicate: (record: SimRecord) => void;
  onView: (record: SimRecord) => void;
  onToggleStatus?: (record: SimRecord) => void;
  compactMode?: boolean;
  visibleColumns?: SortField[];
  onHideColumn?: (field: SortField) => void;
  onOpenColumnFilter?: () => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onRequestBulkDelete?: () => void;
  onExportSelected?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const SimTable: React.FC<SimTableProps> = ({
  records,
  sortConfig,
  onSort,
  onEdit,
  onDelete,
  onDuplicate,
  onView,
  onToggleStatus,
  compactMode = false,
  visibleColumns,
  onHideColumn,
  onOpenColumnFilter,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onRequestBulkDelete,
  onExportSelected,
  canEdit = true,
  canDelete = true,
}) => {
  const allTableColumns: { field: SortField; label: string; minWidth: string; align?: 'left' | 'right' | 'center' }[] = [
    { field: 'sl', label: 'SL', minWidth: 'w-12', align: 'center' },
    { field: 'branchCode', label: 'BRANCH CODE', minWidth: 'w-24', align: 'center' },
    { field: 'userName', label: 'USER NAME', minWidth: 'w-48', align: 'left' },
    { field: 'identyNumber', label: 'IDENTY NUMBER', minWidth: 'w-36', align: 'left' },
    { field: 'designation', label: 'DESIGNATION', minWidth: 'w-44', align: 'left' },
    { field: 'department', label: 'DEPARTMENT', minWidth: 'w-48', align: 'left' },
    { field: 'distributionDate', label: 'DISTRIBUTION DATE', minWidth: 'w-32', align: 'center' },
    { field: 'simOwner', label: 'SIM OWNER', minWidth: 'w-28', align: 'center' },
    { field: 'operatorName', label: 'OPERATOR NAME', minWidth: 'w-28', align: 'center' },
    { field: 'simGroup', label: 'SIM GROUP', minWidth: 'w-28', align: 'center' },
    { field: 'simType', label: 'SIM TYPE', minWidth: 'w-24', align: 'center' },
    { field: 'simNumber', label: 'SIM NUMBER', minWidth: 'w-32', align: 'left' },
    { field: 'creditLimit', label: 'CREDIT LIMIT', minWidth: 'w-28', align: 'right' },
    { field: 'monthlyApproved', label: 'MONTHLY APPROVED', minWidth: 'w-32', align: 'right' },
    { field: 'paymentBill', label: 'PAYMENT BILL', minWidth: 'w-28', align: 'right' },
    { field: 'advancePayment', label: 'ADVANCE PAYMENT', minWidth: 'w-28', align: 'right' },
    { field: 'remarks', label: 'REMARKS', minWidth: 'w-40', align: 'left' },
    { field: 'status', label: 'STATUS', minWidth: 'w-24', align: 'center' },
  ];

  const columns = visibleColumns && visibleColumns.length > 0
    ? allTableColumns.filter((col) => visibleColumns.includes(col.field))
    : allTableColumns;

  // Calculate totals based on ACTIVE SIM records
  const activeRecords = records.filter((r) => (r.status || 'Active') === 'Active');
  const inactiveCount = records.length - activeRecords.length;

  const totalCredit = activeRecords.reduce((acc, r) => acc + (r.creditLimit || 0), 0);
  const totalApproved = activeRecords.reduce((acc, r) => acc + (r.monthlyApproved || 0), 0);
  const totalBill = activeRecords.reduce((acc, r) => acc + (r.paymentBill || 0), 0);
  const totalAdvance = activeRecords.reduce((acc, r) => acc + (r.advancePayment || 0), 0);

  const renderSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />;
    }
    return sortConfig.order === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold" />
    );
  };

  const padCell = compactMode ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-[13px]';

  const renderCell = (rec: SimRecord, index: number, field: SortField) => {
    const isOverBudget = rec.paymentBill > rec.monthlyApproved;

    switch (field) {
      case 'sl':
        return (
          <td key={field} className={`${padCell} text-center font-medium text-slate-500 border-r border-slate-200`}>
            {rec.sl || index + 1}
          </td>
        );
      case 'branchCode':
        return (
          <td key={field} className={`${padCell} text-center font-medium border-r border-slate-200`}>
            <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {rec.branchCode || '—'}
            </span>
          </td>
        );
      case 'userName':
        return (
          <td key={field} className={`${padCell} font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap`}>
            <span>{rec.userName || '—'}</span>
          </td>
        );
      case 'identyNumber':
        return (
          <td key={field} className={`${padCell} font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap`}>
            {rec.identyNumber ? (
              <span className="text-xs bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                {rec.identyNumber}
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
        );
      case 'designation':
        return (
          <td key={field} className={`${padCell} text-slate-700 border-r border-slate-200 whitespace-nowrap`}>
            {rec.designation || <span className="text-slate-300">—</span>}
          </td>
        );
      case 'department':
        return (
          <td key={field} className={`${padCell} text-slate-600 border-r border-slate-200 whitespace-nowrap`}>
            {rec.department || <span className="text-slate-300">—</span>}
          </td>
        );
      case 'distributionDate':
        return (
          <td key={field} className={`${padCell} text-center text-slate-600 border-r border-slate-200 whitespace-nowrap`}>
            {rec.distributionDate || <span className="text-slate-300">—</span>}
          </td>
        );
      case 'simOwner':
        return (
          <td key={field} className={`${padCell} text-center text-slate-700 border-r border-slate-200`}>
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              {rec.simOwner || 'Dynasty'}
            </span>
          </td>
        );
      case 'operatorName':
        return (
          <td key={field} className={`${padCell} text-center border-r border-slate-200 font-semibold`}>
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                rec.operatorName === 'GP'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : rec.operatorName === 'Robi'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : rec.operatorName === 'Banglalink'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-purple-100 text-purple-800 border border-purple-200'
              }`}
            >
              {rec.operatorName || 'GP'}
            </span>
          </td>
        );
      case 'simGroup':
        return (
          <td key={field} className={`${padCell} text-center border-r border-slate-200 text-slate-600 whitespace-nowrap`}>
            {rec.simGroup || 'Group-A'}
          </td>
        );
      case 'simType':
        return (
          <td key={field} className={`${padCell} text-center border-r border-slate-200`}>
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                rec.simType === 'Postpaid'
                  ? 'bg-slate-100 text-slate-800 border border-slate-300'
                  : 'bg-teal-50 text-teal-800 border border-teal-200'
              }`}
            >
              {rec.simType}
            </span>
          </td>
        );
      case 'simNumber':
        return (
          <td key={field} className={`${padCell} font-mono font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap`}>
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{formatSimNumber(rec.simNumber)}</span>
            </div>
          </td>
        );
      case 'creditLimit': {
        const isActive = (rec.status || 'Active') === 'Active';
        return (
          <td
            key={field}
            className={`${padCell} text-right font-medium border-r border-slate-200 ${
              isActive ? 'text-slate-800' : 'text-slate-400 line-through opacity-70'
            }`}
            title={isActive ? undefined : 'Inactive SIM - Active Balance থেকে বাদ'}
          >
            {formatCurrency(rec.creditLimit)}
          </td>
        );
      }
      case 'monthlyApproved': {
        const isActive = (rec.status || 'Active') === 'Active';
        return (
          <td
            key={field}
            className={`${padCell} text-right font-medium border-r border-slate-200 ${
              isActive ? 'text-slate-800' : 'text-slate-400 line-through opacity-70'
            }`}
            title={isActive ? undefined : 'Inactive SIM - Active Balance থেকে বাদ'}
          >
            {formatCurrency(rec.monthlyApproved)}
          </td>
        );
      }
      case 'paymentBill': {
        const isActive = (rec.status || 'Active') === 'Active';
        return (
          <td
            key={field}
            className={`${padCell} text-right font-semibold border-r border-slate-200 ${
              !isActive
                ? 'text-slate-400 line-through opacity-70'
                : isOverBudget
                ? 'text-amber-700 bg-amber-50/50'
                : 'text-slate-900'
            }`}
            title={isActive ? (isOverBudget ? 'Exceeded monthly approved budget!' : undefined) : 'Inactive SIM - Active Balance থেকে বাদ'}
          >
            <div className="flex items-center justify-end gap-1">
              {isActive && isOverBudget && (
                <AlertTriangle className="w-3 h-3 text-amber-600" title="Exceeded monthly approved budget!" />
              )}
              <span>{formatCurrency(rec.paymentBill)}</span>
            </div>
          </td>
        );
      }
      case 'advancePayment': {
        const isActive = (rec.status || 'Active') === 'Active';
        return (
          <td
            key={field}
            className={`${padCell} text-right border-r border-slate-200 ${
              isActive ? 'text-slate-600' : 'text-slate-400 line-through opacity-70'
            }`}
          >
            {rec.advancePayment ? formatCurrency(rec.advancePayment) : '—'}
          </td>
        );
      }
      case 'remarks':
        return (
          <td key={field} className={`${padCell} text-slate-500 border-r border-slate-200 max-w-xs truncate`}>
            {rec.remarks || <span className="text-slate-300">—</span>}
          </td>
        );
      case 'status': {
        const isActive = (rec.status || 'Active') === 'Active';
        return (
          <td key={field} className={`${padCell} text-center border-r border-slate-200 whitespace-nowrap`}>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onToggleStatus && onToggleStatus(rec)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                canEdit ? 'cursor-pointer' : 'cursor-default'
              } ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                  : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 hover:border-rose-400'
              }`}
              title={
                isActive
                  ? 'Active (সচল) - ব্যালেন্সে অন্তর্ভুক্ত। ক্লিক করে Inactive করুন'
                  : 'Inactive (নিষ্ক্রিয়) - ব্যালেন্স ও PDF থেকে বাদ। ক্লিক করে Active করুন'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{isActive ? 'Active' : 'Inactive'}</span>
            </button>
          </td>
        );
      }
      default:
        return null;
    }
  };

  const hasAnyFinancialCol = columns.some((c) =>
    ['creditLimit', 'monthlyApproved', 'paymentBill', 'advancePayment'].includes(c.field)
  );

  const selectedCount = selectedIds.length;
  const isAllSelected = records.length > 0 && records.every((r) => selectedIds.includes(r.id));
  const isSomeSelected = records.some((r) => selectedIds.includes(r.id)) && !isAllSelected;

  return (
    <div className="w-full bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
      {/* Bulk Action Top Bar when records are selected */}
      {selectedCount > 0 && (
        <div
          id="bulk-actions-bar"
          className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shadow-inner animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-400/30 rounded-lg text-xs font-semibold text-blue-300">
              <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>{selectedCount} Selected (নির্বাচিত)</span>
            </div>
            <span className="text-xs text-slate-300 hidden sm:inline">
              {selectedCount} of {records.length} records selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onExportSelected && (
              <button
                id="btn-export-selected"
                type="button"
                onClick={onExportSelected}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export selected records to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Export Selected</span>
              </button>
            )}

            <button
              id="btn-clear-selection"
              type="button"
              onClick={onClearSelection}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title="Deselect all records"
            >
              Deselect All (বাতিল)
            </button>

            {canDelete && onRequestBulkDelete && (
              <button
                id="btn-bulk-delete-action"
                type="button"
                onClick={onRequestBulkDelete}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Delete all selected records"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedCount}) / মুছুন</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable Container with Spreadsheet Borders */}
      <div className="overflow-x-auto w-full max-w-full">
        <table className="w-full border-collapse text-left font-sans select-text">
          {/* Header */}
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 text-xs uppercase tracking-wider font-semibold border-b border-slate-300">
              {/* Select All Checkbox Header */}
              <th className={`${padCell} w-10 text-center bg-slate-100/90 border-r border-slate-300 select-none`}>
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    id="checkbox-select-all-header"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={onSelectAll}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    title={isAllSelected ? 'Deselect all visible records' : 'Select all visible records'}
                  />
                </div>
              </th>

              {columns.map((col) => (
                <th
                  key={col.field}
                  onClick={() => onSort(col.field)}
                  className={`${padCell} ${col.minWidth} cursor-pointer select-none hover:bg-slate-200/80 transition-colors border-r border-slate-300 last:border-r-0 whitespace-nowrap group`}
                  title={`Sort by ${col.label} • Hover to hide`}
                >
                  <div
                    className={`flex items-center gap-1.5 ${
                      col.align === 'right'
                        ? 'justify-end'
                        : col.align === 'center'
                        ? 'justify-center'
                        : 'justify-between'
                    }`}
                  >
                    <span className="truncate">{col.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {onHideColumn && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onHideColumn(col.field);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                          title={`Hide "${col.label}" column (এই কলামটি হাইড করুন)`}
                        >
                          <EyeOff className="w-3 h-3" />
                        </button>
                      )}
                      <span className="inline-flex items-center text-[10px] bg-slate-200/60 p-0.5 rounded text-slate-600">
                        {renderSortIcon(col.field)}
                      </span>
                    </div>
                  </div>
                </th>
              ))}
              <th className={`${padCell} w-24 text-center font-semibold bg-slate-100 border-l border-slate-300`}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>Actions</span>
                  {onOpenColumnFilter && (
                    <button
                      type="button"
                      onClick={onOpenColumnFilter}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      title="Hide or show columns (কলাম হাইড ও শো করুন)"
                    >
                      <Columns3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {records.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="py-12 text-center text-slate-400">
                  <p className="text-sm font-medium">No matching records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try resetting filters or adding a new record</p>
                </td>
              </tr>
            ) : (
              records.map((rec, index) => {
                const isSelected = selectedIds.includes(rec.id);

                return (
                  <tr
                    key={rec.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 hover:bg-blue-100/70 border-l-2 border-l-blue-600'
                        : index % 2 === 1
                        ? 'bg-slate-50/40 hover:bg-blue-50/30'
                        : 'bg-white hover:bg-blue-50/30'
                    }`}
                  >
                    {/* Row Select Checkbox */}
                    <td
                      className={`${padCell} w-10 text-center border-r border-slate-200 select-none ${
                        isSelected ? 'bg-blue-100/40' : ''
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          id={`checkbox-select-row-${rec.id}`}
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(rec.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
                          title={`Select record #${rec.sl} ${rec.userName}`}
                        />
                      </div>
                    </td>

                    {columns.map((col) => renderCell(rec, index, col.field))}

                    {/* Actions */}
                    <td className={`${padCell} text-center border-l border-slate-200`}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          id={`btn-view-${rec.id}`}
                          type="button"
                          onClick={() => onView(rec)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Details (বিস্তারিত দেখুন)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            id={`btn-edit-${rec.id}`}
                            type="button"
                            onClick={() => onEdit(rec)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Record (সম্পাদনা করুন)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            id={`btn-copy-${rec.id}`}
                            type="button"
                            onClick={() => onDuplicate(rec)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Copy to New (কপি করে নতুন এন্ট্রি তৈরি করুন)"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            id={`btn-delete-${rec.id}`}
                            type="button"
                            onClick={() => onDelete(rec)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record (মুছে ফেলুন)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Table Footer Total Row matching Spreadsheet */}
          {records.length > 0 && hasAnyFinancialCol && (
            <tfoot>
              <tr className="bg-slate-100 font-semibold text-slate-900 border-t-2 border-slate-300 text-xs uppercase">
                {(() => {
                  const firstFinIndex = columns.findIndex((c) =>
                    ['creditLimit', 'monthlyApproved', 'paymentBill', 'advancePayment'].includes(c.field)
                  );
                  const cells = [];
                  if (firstFinIndex > 0) {
                    cells.push(
                      <td
                        key="total-label"
                        colSpan={firstFinIndex + 1}
                        className={`${padCell} text-right pr-4 tracking-wider text-slate-700`}
                      >
                        <div>
                          <span className="font-bold text-slate-900">Active Balance / মোট ব্যালেন্স ({activeRecords.length} Active SIMs):</span>
                          {inactiveCount > 0 && (
                            <span className="text-[11px] text-rose-600 font-normal ml-1.5">
                              ({inactiveCount} Inactive বাদ)
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  } else {
                    cells.push(
                      <td key="checkbox-footer" className={`${padCell} bg-slate-100 border-r border-slate-300`}></td>
                    );
                  }
                  columns.slice(Math.max(0, firstFinIndex)).forEach((col) => {
                    if (col.field === 'creditLimit') {
                      cells.push(
                        <td
                          key={col.field}
                          className={`${padCell} text-right font-bold text-slate-900 font-mono border-r border-slate-300`}
                        >
                          ৳{formatCurrency(totalCredit)}
                        </td>
                      );
                    } else if (col.field === 'monthlyApproved') {
                      cells.push(
                        <td
                          key={col.field}
                          className={`${padCell} text-right font-bold text-slate-900 font-mono border-r border-slate-300`}
                        >
                          ৳{formatCurrency(totalApproved)}
                        </td>
                      );
                    } else if (col.field === 'paymentBill') {
                      cells.push(
                        <td
                          key={col.field}
                          className={`${padCell} text-right font-bold text-blue-800 font-mono border-r border-slate-300`}
                        >
                          ৳{formatCurrency(totalBill)}
                        </td>
                      );
                    } else if (col.field === 'advancePayment') {
                      cells.push(
                        <td
                          key={col.field}
                          className={`${padCell} text-right font-bold text-slate-800 font-mono border-r border-slate-300`}
                        >
                          ৳{formatCurrency(totalAdvance)}
                        </td>
                      );
                    } else {
                      cells.push(<td key={col.field} className={`${padCell} bg-slate-100 border-r border-slate-300`}></td>);
                    }
                  });
                  cells.push(<td key="actions-footer" className={`${padCell} bg-slate-100`}></td>);
                  return cells;
                })()}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

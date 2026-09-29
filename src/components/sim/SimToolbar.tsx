import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Download,
  Upload,
  X,
  Filter,
  FileDown,
  Columns3,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { FilterOptions, SortField, ALL_COLUMNS } from '../../types';
import {
  BRANCH_CODES,
  OPERATOR_OPTIONS,
  SIM_TYPES,
  DEPARTMENTS,
  SIM_OWNERS,
  SIM_GROUPS,
} from '../../data/simInitialData';

interface SimToolbarProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  onOpenNewForm: () => void;
  onExportCSV: () => void;
  onOpenImport: () => void;
  onResetData?: () => void;
  compactMode?: boolean;
  onToggleCompact?: () => void;
  onOpenPdfExport: () => void;
  onOpenColumnFilter: () => void;
  activeColumnsCount?: number;
  totalColumnsCount?: number;
  visibleColumns?: SortField[];
  onToggleColumn?: (field: SortField) => void;
  onShowAllColumns?: () => void;
  onResetColumns?: () => void;
  canEdit?: boolean;
  branches?: string[];
  operators?: string[];
  simTypes?: string[];
  departments?: string[];
  simOwners?: string[];
  simGroups?: string[];
  statuses?: string[];
}

export const SimToolbar: React.FC<SimToolbarProps> = ({
  filters,
  onFilterChange,
  onOpenNewForm,
  onExportCSV,
  onOpenImport,
  onResetData,
  compactMode,
  onToggleCompact,
  onOpenPdfExport,
  onOpenColumnFilter,
  activeColumnsCount = 18,
  totalColumnsCount = 18,
  visibleColumns,
  onToggleColumn,
  onShowAllColumns,
  onResetColumns,
  canEdit = true,
  branches = BRANCH_CODES,
  operators = OPERATOR_OPTIONS,
  simTypes = SIM_TYPES,
  departments = DEPARTMENTS,
  simOwners = SIM_OWNERS,
  simGroups = SIM_GROUPS,
  statuses = ['Active', 'Inactive'],
}) => {
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };
    if (isColumnDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColumnDropdownOpen]);

  const filteredColumnsList = ALL_COLUMNS.filter((col) => {
    if (!columnSearch.trim()) return true;
    const q = columnSearch.toLowerCase();
    return col.label.toLowerCase().includes(q) || (col.bnLabel && col.bnLabel.toLowerCase().includes(q));
  });

  const hasActiveFilters =
    filters.branchCode !== '' ||
    filters.operatorName !== '' ||
    filters.simType !== '' ||
    filters.department !== '' ||
    filters.simOwner !== '' ||
    filters.simGroup !== '' ||
    Boolean(filters.status) ||
    Boolean(filters.search);

  const resetFilters = () => {
    onFilterChange({
      ...filters,
      branchCode: '',
      operatorName: '',
      simType: '',
      department: '',
      simOwner: '',
      simGroup: '',
      status: '',
      search: '',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
      {/* Top row: Search & Primary Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            id="search-input"
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search by User Name, SIM Number."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white shadow-2xs"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Column Hide / Show Button with Popover Dropdown */}
          <div className="relative" ref={columnDropdownRef}>
            <button
              id="btn-column-filter"
              type="button"
              onClick={() => setIsColumnDropdownOpen((prev) => !prev)}
              className={`px-3 py-2 text-xs font-medium border rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeColumnsCount < totalColumnsCount
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 ring-1 ring-amber-200'
                  : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50'
              }`}
              title="Hide or show table columns (কলাম হাইড বা শো করুন)"
            >
              {activeColumnsCount < totalColumnsCount ? (
                <EyeOff className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Columns3 className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>
                {activeColumnsCount < totalColumnsCount
                  ? `Columns (${activeColumnsCount}/${totalColumnsCount}) • ${totalColumnsCount - activeColumnsCount} Hidden`
                  : `Columns (${activeColumnsCount}/${totalColumnsCount})`}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isColumnDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isColumnDropdownOpen && (
              <div
                id="column-visibility-dropdown"
                className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Column Hide / Show</span>
                      <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        কলাম হাইড/শো
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      টিক আনচেক করলে কলামটি টেবিল থেকে হাইড হবে
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsColumnDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick actions */}
                <div className="flex items-center justify-between text-xs px-1.5 py-1 bg-slate-50 rounded-lg border border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (onShowAllColumns) onShowAllColumns();
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] cursor-pointer"
                  >
                    Show All (সব দেখাও)
                  </button>
                  <span className="text-slate-200">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onResetColumns) onResetColumns();
                    }}
                    className="text-slate-600 hover:text-slate-800 font-medium text-[11px] cursor-pointer"
                  >
                    Reset (রিসেট)
                  </button>
                  <span className="text-slate-200">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsColumnDropdownOpen(false);
                      onOpenColumnFilter();
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Presets / PDF</span>
                  </button>
                </div>

                {/* Filter / Search inside dropdown */}
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    placeholder="Search columns / কলাম খুঁজুন..."
                    className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-slate-50/50"
                  />
                  {columnSearch && (
                    <button
                      type="button"
                      onClick={() => setColumnSearch('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Columns list */}
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredColumnsList.map((col) => {
                    const isVisible = visibleColumns ? visibleColumns.includes(col.field) : true;
                    return (
                      <div
                        key={col.field}
                        onClick={() => onToggleColumn && onToggleColumn(col.field)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs select-none transition-all ${
                          isVisible
                            ? 'bg-blue-50/30 hover:bg-blue-50 text-slate-900 border border-transparent'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-400 line-through border border-slate-200/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer pointer-events-none"
                          />
                          <span className={`truncate font-medium ${isVisible ? 'text-slate-800' : 'text-slate-400'}`}>
                            {col.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {col.bnLabel && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              {col.bnLabel}
                            </span>
                          )}
                          {isVisible ? (
                            <Eye className="w-3.5 h-3.5 text-blue-500 opacity-60" />
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold flex items-center gap-0.5">
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
            )}
          </div>

          {/* PDF Download Button with Red Outline matching image */}
          <button
            id="btn-download-pdf"
            onClick={onOpenPdfExport}
            className="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Filter columns and download styled PDF report"
          >
            <FileDown className="w-4 h-4 text-rose-600" />
            <span>PDF Download</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={onExportCSV}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download CSV file for Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {canEdit && (
            <button
              id="btn-import-data"
              onClick={onOpenImport}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-400 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Import SIM data from Excel or CSV file (এক্সেল বা সিএসভি ইমপোর্ট)"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import (ইমপোর্ট)</span>
            </button>
          )}

          {canEdit && (
            <button
              id="btn-open-form-modal"
              onClick={onOpenNewForm}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New SIM (নতুন এন্ট্রি)</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center text-slate-500 font-medium mr-1">
          <Filter className="w-3.5 h-3.5 mr-1" />
          <span>Filters:</span>
        </div>

        {/* Branch Code */}
        <select
          value={filters.branchCode}
          onChange={(e) => onFilterChange({ ...filters, branchCode: e.target.value })}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              Branch: {b}
            </option>
          ))}
        </select>

        {/* Operator */}
        <select
          value={filters.operatorName}
          onChange={(e) => onFilterChange({ ...filters, operatorName: e.target.value })}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Operators</option>
          {operators.map((op) => (
            <option key={op} value={op}>
              Operator: {op}
            </option>
          ))}
        </select>

        {/* Sim Type */}
        <select
          value={filters.simType}
          onChange={(e) => onFilterChange({ ...filters, simType: e.target.value })}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All SIM Types</option>
          {simTypes.map((t) => (
            <option key={t} value={t}>
              Type: {t}
            </option>
          ))}
        </select>

        {/* Department */}
        <select
          value={filters.department}
          onChange={(e) => onFilterChange({ ...filters, department: e.target.value })}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500 max-w-[180px] truncate"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Sim Owner */}
        <select
          value={filters.simOwner || ''}
          onChange={(e) => onFilterChange({ ...filters, simOwner: e.target.value })}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All SIM Owners</option>
          {simOwners.map((owner) => (
            <option key={owner} value={owner}>
              Owner: {owner}
            </option>
          ))}
        </select>

        {/* Sim Group */}
        <select
          value={filters.simGroup}
          onChange={(e) => onFilterChange({ ...filters, simGroup: e.target.value })}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All SIM Groups</option>
          {simGroups.map((grp) => (
            <option key={grp} value={grp}>
              Group: {grp}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status || ''}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
        >
          <option value="">All Statuses</option>
          {statuses.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="px-2 py-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
};

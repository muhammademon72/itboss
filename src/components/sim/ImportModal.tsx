import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SimRecord } from '../../types';
import { normalizeSimNumber, formatSimNumber } from '../../utils/simFormatters';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newRecords: Omit<SimRecord, 'id' | 'sl'>[]) => void;
  existingRecords: SimRecord[];
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingRecords,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          setError('The uploaded file contains no data rows.');
          setParsedData([]);
          return;
        }

        // Map column variations commonly seen in Excel/CSV
        const mapped = json
          .map((row) => {
            const userName =
              row['User Name'] ||
              row['UserName'] ||
              row['Name'] ||
              row['user_name'] ||
              row['Employee Name'] ||
              row['ব্যবহারকারীর নাম'] ||
              '';

            const rawNumber =
              row['Sim Number'] ||
              row['SIM Number'] ||
              row['Mobile'] ||
              row['Phone'] ||
              row['Number'] ||
              row['sim_number'] ||
              row['সিম নম্বর'] ||
              '';

            const simNumber = normalizeSimNumber(String(rawNumber));

            const branchCode =
              row['Branch Code'] ||
              row['Branch'] ||
              row['branch_code'] ||
              row['HO'] ||
              'HO';

            const identyNumber =
              row['Identy Number'] ||
              row['Identity Number'] ||
              row['ID'] ||
              row['identy_number'] ||
              '';

            const designation =
              row['Designation'] ||
              row['designation'] ||
              row['পদবী'] ||
              '';

            const department =
              row['Department'] ||
              row['Dept'] ||
              row['department'] ||
              '';

            const distributionDate =
              row['Distribution date'] ||
              row['Distribution Date'] ||
              row['Date'] ||
              new Date().toISOString().slice(0, 10);

            const simOwner =
              row['Sim Owner'] ||
              row['SIM Owner'] ||
              row['Owner'] ||
              'Dynasty';

            const operatorName =
              row['Operator Name'] ||
              row['Operator'] ||
              row['operator'] ||
              'GP';

            const simGroup =
              row['SIM Group'] ||
              row['Group'] ||
              'Group-A';

            const simType =
              String(row['Sim Type'] || row['Type'] || 'Postpaid').toLowerCase().includes('pre')
                ? 'Prepaid'
                : 'Postpaid';

            const creditLimit = Number(row['Credit Limit'] || row['Credit'] || 1000) || 1000;
            const monthlyApproved =
              Number(row['Monthly Approved'] || row['Approved'] || row['monthly_approved'] || 1000) || 1000;
            const paymentBill = Number(row['Payment Bill'] || row['Bill'] || 0) || 0;
            const advancePayment = Number(row['Advance Payment'] || row['Advance'] || 0) || 0;
            const remarks = row['Remarks'] || row['Note'] || '';
            const status = String(row['Status'] || 'Active').toLowerCase().includes('inact')
              ? 'Inactive'
              : 'Active';

            return {
              branchCode: String(branchCode).trim(),
              userName: String(userName).trim(),
              identyNumber: String(identyNumber).trim(),
              designation: String(designation).trim(),
              department: String(department).trim(),
              distributionDate: String(distributionDate).trim(),
              simOwner: String(simOwner).trim(),
              operatorName: String(operatorName).trim(),
              simGroup: String(simGroup).trim(),
              simType: simType as 'Postpaid' | 'Prepaid',
              simNumber: simNumber,
              creditLimit,
              monthlyApproved,
              paymentBill,
              advancePayment,
              remarks: String(remarks).trim(),
              status: status as 'Active' | 'Inactive',
            };
          })
          .filter((r) => r.userName || r.simNumber);

        if (mapped.length === 0) {
          setError(
            'Could not find matching columns. Please make sure columns have headers like "User Name", "Sim Number", etc.'
          );
        }

        setParsedData(mapped);
      } catch (err: any) {
        setError(`Failed to parse file: ${err.message || 'Unknown error'}`);
        setParsedData([]);
      }
    };

    reader.readAsBinaryString(selectedFile);
  };

  // Duplicate analysis
  const existingNumbers = new Set(existingRecords.map((r) => normalizeSimNumber(r.simNumber)));
  const seenInFile = new Set<string>();

  const analyzedData = parsedData.map((item) => {
    const norm = item.simNumber;
    let isDuplicate = false;
    let duplicateReason = '';

    if (!norm) {
      isDuplicate = true;
      duplicateReason = 'Missing SIM number';
    } else if (existingNumbers.has(norm)) {
      isDuplicate = true;
      duplicateReason = 'Already exists in system database';
    } else if (seenInFile.has(norm)) {
      isDuplicate = true;
      duplicateReason = 'Duplicate entry within this file';
    } else {
      seenInFile.add(norm);
    }

    return {
      ...item,
      isDuplicate,
      duplicateReason,
    };
  });

  const duplicateCount = analyzedData.filter((i) => i.isDuplicate).length;
  const validCount = analyzedData.filter((i) => !i.isDuplicate).length;

  const handleDownloadSample = () => {
    const sampleRows = [
      {
        'SL': 1,
        'Branch Code': 'HO',
        'User Name': 'Aminur Rahman',
        'Identy Number': 'ASRG1989001',
        'Designation': 'Managing Director',
        'Department': 'Central Administration',
        'Distribution date': '2024-01-15',
        'Sim Owner': 'Dynasty',
        'Operator Name': 'GP',
        'SIM Group': 'Group-A',
        'Sim Type': 'Postpaid',
        'Sim Number': '01714141000',
        'Credit Limit': 5000,
        'Monthly Approved': 5000,
        'Payment Bill': 4800,
        'Advance Payment': 0,
        'Remarks': 'Director corporate line',
        'Status': 'Active',
      },
      {
        'SL': 2,
        'Branch Code': 'CWH-1',
        'User Name': 'Central Warehouse Security',
        'Identy Number': 'SEC-892',
        'Designation': 'Incharge',
        'Department': 'Logistics',
        'Distribution date': '2024-02-01',
        'Sim Owner': 'Dynasty',
        'Operator Name': 'Robi',
        'SIM Group': 'Group-B',
        'Sim Type': 'Postpaid',
        'Sim Number': '01819998877',
        'Credit Limit': 1500,
        'Monthly Approved': 1500,
        'Payment Bill': 1200,
        'Advance Payment': 0,
        'Remarks': 'Warehouse shift duty',
        'Status': 'Active',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SIM_Template');
    XLSX.writeFile(workbook, 'SIM_Ledger_Import_Template.xlsx');
  };

  const handleExecuteImport = () => {
    const recordsToImport = skipDuplicates
      ? analyzedData.filter((i) => !i.isDuplicate)
      : analyzedData;

    if (recordsToImport.length === 0) {
      setError('No valid records to import.');
      return;
    }

    const cleaned = recordsToImport.map(({ isDuplicate, duplicateReason, ...clean }) => clean);
    onImport(cleaned);
    onClose();
  };

  return (
    <div
      id="import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/65 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="import-modal"
        className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600/30 border border-emerald-400/40 rounded-lg">
              <Upload className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Import SIM Ledger from Excel / CSV
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  এক্সেল বা সিএসভি থেকে আমদানি
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Upload `.xlsx`, `.xls` or `.csv` files to batch load corporate SIM records
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
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-sm">
          {/* Step 1: Upload box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Spreadsheet File (.xlsx, .xls, .csv)
              </label>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template (নমুনা ফাইল ডাউনলোড)</span>
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              {file ? (
                <div>
                  <p className="font-semibold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • Click to choose a different file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-slate-700">Click to browse or drag and drop file here</p>
                  <p className="text-xs text-slate-400 mt-1">Supports Excel Workbook (.xlsx) and CSV</p>
                </div>
              )}
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Step 2: Verification and duplicate check preview */}
          {parsedData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Analysis & Preview ({parsedData.length} rows found)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {validCount} Valid
                  </span>
                  {duplicateCount > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      {duplicateCount} Duplicates
                    </span>
                  )}
                </div>
              </div>

              {/* Duplicate settings */}
              {duplicateCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-950">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Duplicate SIM Prevention Active</p>
                      <p className="text-amber-800">
                        {duplicateCount} rows have SIM numbers that are already registered in your
                        database or duplicated inside the file.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-200/70">
                    <input
                      id="check-skip-dup"
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="check-skip-dup" className="cursor-pointer font-medium">
                      Skip duplicates automatically (ডুপ্লিকেটগুলো বাদ দিয়ে কেবল নতুন {validCount} টি
                      ইমপোর্ট করুন)
                    </label>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2">User Name</th>
                      <th className="p-2">SIM Number</th>
                      <th className="p-2">Branch</th>
                      <th className="p-2">Operator</th>
                      <th className="p-2 text-right">Bill (৳)</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyzedData.slice(0, 50).map((row, idx) => (
                      <tr
                        key={idx}
                        className={row.isDuplicate ? 'bg-rose-50/50 text-rose-950' : 'bg-white'}
                      >
                        <td className="p-2 font-medium">{row.userName || '—'}</td>
                        <td className="p-2 font-mono">{formatSimNumber(row.simNumber)}</td>
                        <td className="p-2">{row.branchCode}</td>
                        <td className="p-2">{row.operatorName}</td>
                        <td className="p-2 text-right font-mono">{row.paymentBill}</td>
                        <td className="p-2 text-center">
                          {row.isDuplicate ? (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800"
                              title={row.duplicateReason}
                            >
                              Duplicate
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {analyzedData.length > 50 && (
                <p className="text-[11px] text-slate-400 text-right">
                  Showing first 50 rows of {analyzedData.length}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            id="btn-confirm-import"
            type="button"
            disabled={parsedData.length === 0 || (skipDuplicates && validCount === 0)}
            onClick={handleExecuteImport}
            className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>
              Import {skipDuplicates ? validCount : parsedData.length} Records (ইমপোর্ট সম্পন্ন করুন)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

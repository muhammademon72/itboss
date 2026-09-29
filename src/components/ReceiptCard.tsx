import React, { useRef, useState } from 'react';
import { Receipt } from '../types';
import { formatCurrency } from '../utils/receiptUtils';
import { Printer, Download, Edit2, Copy, Trash2, X, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ReceiptCardProps {
  receipt: Receipt;
  onEdit?: (receipt: Receipt) => void;
  onDuplicate?: (receipt: Receipt) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ReceiptCard: React.FC<ReceiptCardProps> = ({
  receipt,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
  canEdit = true,
  canDelete = true,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      
      // Keep entire receipt inside the top half of A4 page (<= 138mm)
      const maxAllowedHeight = 135;
      let imgWidth = 190; // 10mm margins left & right
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > maxAllowedHeight) {
        imgHeight = maxAllowedHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }

      const xPos = (pageWidth - imgWidth) / 2;
      const yPos = 8; // Top margin

      pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
      pdf.save(`Money-Receipt-${receipt.receiptNo}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try printing to PDF instead.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden transition-all flex flex-col">
      {/* Card Toolbar */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            {receipt.receiptNo}
          </span>
          <span className="text-xs text-slate-500 font-medium">{receipt.date}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={handlePrint}
            title="Print Receipt"
            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            title="Download PDF"
            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
          </button>
          {canEdit && onEdit && (
            <button
              onClick={() => onEdit(receipt)}
              title="Edit Receipt"
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {canEdit && onDuplicate && (
            <button
              onClick={() => onDuplicate(receipt)}
              title="Duplicate Receipt"
              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(receipt.id)}
              title="Delete Receipt"
              className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close Preview"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors border-l border-slate-200 pl-2 ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Printable Receipt Canvas Area */}
      <div 
        className="receipt-container p-5 md:p-6 print:p-0 flex-1 flex flex-col justify-between" 
        style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'system-ui, sans-serif' }} 
        ref={receiptRef}
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-start pb-3 mb-3" style={{ borderBottom: '2px solid #000000' }}>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase" style={{ color: '#000000' }}>
                {receipt.companyName || 'General Money Receipt'}
              </h1>
              <p className="text-xs font-semibold" style={{ color: '#1e293b' }}>Official Financial Transaction Receipt</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div 
                style={{ 
                  backgroundColor: '#000000', 
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '26px',
                  padding: '0 14px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  marginBottom: '4px',
                  boxSizing: 'border-box'
                }}
              >
                <span style={{ lineHeight: '1', display: 'inline-block' }}>MONEY RECEIPT</span>
              </div>
              <div className="text-xs font-mono font-bold" style={{ color: '#000000' }}>No: {receipt.receiptNo}</div>
              <div className="text-xs font-bold" style={{ color: '#1e293b' }}>Date: {receipt.date}</div>
            </div>
          </div>

          {/* Payer, Method & Paid Due Info */}
          <div className="grid grid-cols-3 gap-3 mb-3 p-2.5 rounded-lg" style={{ backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block mb-0.5" style={{ color: '#1e293b' }}>Received From (Payer)</span>
              <span className="text-sm font-bold" style={{ color: '#000000' }}>{receipt.payerName}</span>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block mb-0.5" style={{ color: '#1e293b' }}>Payment Method</span>
              <span className="text-sm font-bold" style={{ color: '#000000' }}>
                {receipt.paymentMethod}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block mb-0.5" style={{ color: '#1e293b' }}>Paid Due Method</span>
              <span className="text-sm font-bold" style={{ color: '#000000' }}>
                {receipt.status || 'Paid'}
              </span>
            </div>
          </div>

          {/* Main Transaction Table */}
          <table className="w-full mb-3 border-collapse">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider" style={{ borderBottom: '2px solid #000000' }}>
                <th className="py-2 px-3" style={{ backgroundColor: '#e2e8f0', color: '#000000' }}>Particulars / Subject</th>
                <th className="py-2 px-3 text-right" style={{ backgroundColor: '#e2e8f0', color: '#000000' }}>Amount (BDT)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-sm" style={{ color: '#000000' }}>{receipt.subject}</div>
                  {receipt.notes && (
                    <div className="text-xs font-medium mt-0.5" style={{ color: '#1e293b' }}>{receipt.notes}</div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-black text-base" style={{ color: '#000000' }}>
                  {formatCurrency(receipt.amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount In Words Box */}
          <div className="mb-3 p-2.5 rounded-lg" style={{ backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
            <span className="text-xs font-bold uppercase tracking-wider block mb-0.5" style={{ color: '#000000' }}>In Words:</span>
            <span className="text-sm font-bold italic" style={{ color: '#000000' }}>
              "{receipt.amountInWords}"
            </span>
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="pt-3 grid grid-cols-2 gap-8 items-end mt-auto" style={{ borderTop: '1.5px solid #cbd5e1' }}>
          <div className="text-center">
            <div className="h-6 mb-1 flex items-end justify-center">
              <span className="font-serif italic text-base font-bold underline underline-offset-4" style={{ color: '#000000', textDecorationColor: '#475569' }}>
                {receipt.receivedBy}
              </span>
            </div>
            <div className="pt-1" style={{ borderTop: '1.5px solid #000000' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#000000' }}>Received By</p>
            </div>
          </div>

          <div className="text-center">
            <div className="h-6 mb-1 flex items-end justify-center">
              <span className="font-serif italic text-base font-bold underline underline-offset-4" style={{ color: '#000000', textDecorationColor: '#475569' }}>
                {receipt.authorizedBy}
              </span>
            </div>
            <div className="pt-1" style={{ borderTop: '1.5px solid #000000' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#000000' }}>Authorized By</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

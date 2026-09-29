import React, { useState, useEffect } from 'react';
import { ProductQuotation, QuotationItem } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { saveLocalCacheItem, getLocalCache, setLocalCache } from '../utils/localCache';
import { Trash2, Plus, FileDown, Printer, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateCanvasWithOklchFallback } from '../utils/pdfExport';
import { numberToWords } from '../utils';

interface ProductQuotationFormProps {
  onBack: () => void;
  currentUserUid: string;
  currentUserEmail: string;
  initialQuotation?: ProductQuotation;
  readOnly?: boolean;
  isCopy?: boolean;
}

export default function ProductQuotationForm({ onBack, currentUserUid, currentUserEmail, initialQuotation, readOnly, isCopy }: ProductQuotationFormProps) {
  const [formData, setFormData] = useState<Partial<ProductQuotation>>(() => {
    if (initialQuotation) {
      if (isCopy) {
        const { id, quotationNumber, createdAt, updatedAt, ...rest } = initialQuotation;
        return {
          ...rest,
          date: new Date().toISOString().split('T')[0],
          validityDate: '',
        };
      }
      return initialQuotation;
    }
    return {
      quotationNumber: '',
      date: new Date().toISOString().split('T')[0],
      validityDate: '',
      clientCompany: '',
      clientAddress: '',
      clientEmail: '',
      clientContact: '',
      companyName: 'Demo Company Limited',
      companyAddress: 'House #12, Road #05, Dhanmondi, Dhaka-1209',
      companyContact: '+8801712345678',
      companyEmail: 'info@democompany.com',
      companyWebsite: 'www.democompany.com',
      totalAmount: 0,
      amountInWords: '',
      termsAndConditions: [
        'Payment: 50% advance with work order, 50% upon successful completion of work.',
        'Delivery: Within 10 working days after receiving work order and required content.',
        'VAT & Tax: Government VAT & Tax not included in quoted price (will be added separately if applicable).',
        'Proposal Validity: Offer is valid for 15 days from date of issue.'
      ],
    };
  });

   const [items, setItems] = useState<QuotationItem[]>(initialQuotation?.items || []);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Close customer dropdown on outside clicks
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.customer-select-container')) {
        setShowCustomerDropdown(false);
      }
    };
    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showCustomerDropdown]);

  const exportToPDF = async () => {
    const element = document.getElementById('quotation-print-area');
    if (!element) return;

    // Scroll to top temporarily to ensure html2canvas starts from the very beginning of the document
    const originalScrollY = window.scrollY;
    const originalScrollX = window.scrollX;
    window.scrollTo(0, 0);

    // Save original styling to restore later
    const originalWidth = element.style.width;
    const originalMinWidth = element.style.minWidth;
    const originalMaxWidth = element.style.maxWidth;
    const originalPadding = element.style.padding;
    const originalMargin = element.style.margin;
    const originalDisplay = element.style.display;
    const originalVisibility = element.style.visibility;
    const originalPosition = element.style.position;

    // Detect and save scroll wrapper overflows to prevent vertical/horizontal clipping inside html2canvas
    const scrollContainers = element.querySelectorAll('.overflow-x-auto, .overflow-y-auto, .overflow-auto');
    const originalOverflowStyles: Array<{ element: HTMLElement; overflow: string }> = [];
    
    scrollContainers.forEach((wrapper) => {
      const el = wrapper as HTMLElement;
      originalOverflowStyles.push({
        element: el,
        overflow: el.style.overflow || '',
      });
      el.style.overflow = 'visible';
    });

    const inputsSection = document.getElementById('quotation-inputs-section');
    const originalInputDisplay = inputsSection ? inputsSection.style.display : '';
    if (inputsSection) inputsSection.style.display = 'none';

    setIsExporting(true);
    try {
      // standard vertical A4 format resolution (794px width) to align with A4 page dimensions
      element.style.width = '794px';
      element.style.minWidth = '794px';
      element.style.maxWidth = '794px';
      element.style.margin = '0 auto';
      element.style.padding = '8px 24px 8px 24px';

      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Temporarily force visibility to ensure capture
      element.style.display = 'block';
      element.style.visibility = 'visible';
      element.style.position = 'relative';
      element.style.overflow = 'hidden';

      const canvas = await generateCanvasWithOklchFallback(element, {
        scale: 2, // Stable quality for A4
        useCORS: true,
        allowTaint: true,
        logging: true, // Debugging
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        imageTimeout: 0,
        removeContainer: true
      });

      // Restore styling and overflow structures
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.padding = originalPadding;
      element.style.margin = originalMargin;
      element.style.display = originalDisplay;
      element.style.visibility = originalVisibility;
      element.style.position = originalPosition;
      
      if (inputsSection) inputsSection.style.display = originalInputDisplay;

      originalOverflowStyles.forEach(({ element, overflow }) => {
        element.style.overflow = overflow;
      });

      window.scrollTo(originalScrollX, originalScrollY);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8; // 8mm for professional A4 border
      const pWidth = pageWidth - (margin * 2);
      const ratio = pWidth / canvas.width;
      const imgWidth = pWidth;

      let currentY = 0;
      let pageNum = 0;
      const pagePixels = Math.floor((pageHeight - (margin * 2)) * (canvas.width / pWidth));

      while (currentY < canvas.height) {
        if (pageNum > 0) {
          pdf.addPage();
        }

        const sliceHeight = Math.min(pagePixels, Math.floor(canvas.height - currentY));
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, currentY, canvas.width, sliceHeight, 0, 0, sliceCanvas.width, sliceHeight);
        }
        
        const pageImgData = sliceCanvas.toDataURL('image/png', 1.0);

        const sliceImgWidth = imgWidth;
        const sliceImgHeight = sliceHeight * ratio;

        pdf.addImage(pageImgData, 'PNG', margin, margin, sliceImgWidth, sliceImgHeight, undefined, 'FAST');

        // Add page number at bottom of page
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        const pageNumberText = `Page ${pageNum + 1}`;
        pdf.text(pageNumberText, pageWidth / 2, pageHeight - margin + 4, { align: 'center' });

        currentY += pagePixels;
        pageNum++;
      }

      const fileName = `Quotation_${formData.quotationNumber || 'Draft'}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      // Restore styles and scroll dimensions in case of error
      if (element) {
        element.style.width = originalWidth;
        element.style.minWidth = originalMinWidth;
        element.style.maxWidth = originalMaxWidth;
        element.style.padding = originalPadding;
        element.style.margin = originalMargin;
        element.style.display = originalDisplay;
        element.style.visibility = originalVisibility;
        element.style.position = originalPosition;
      }
      
      originalOverflowStyles.forEach(({ element, overflow }) => {
        element.style.overflow = overflow;
      });

      window.scrollTo(originalScrollX, originalScrollY);

      const errMsg = err instanceof Error ? err.message : String(err);
      alert('Failed to generate PDF: ' + errMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const cachedCustomers = getLocalCache<any>('customers') || [];
        if (cachedCustomers.length > 0) {
          setDbCustomers(cachedCustomers);
        }
        const querySnapshot = await getDocs(collection(db, 'customers'));
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (docs.length > 0) {
          setDbCustomers(docs);
          setLocalCache('customers', docs);
        }
      } catch (err) {
        console.error("Error fetching customers for autocomplete: ", err);
      }
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!initialQuotation || isCopy) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'settings', 'companyProfile');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const profile = docSnap.data();
            setFormData(prev => ({
              ...prev,
              companyName: profile.name || prev.companyName,
              companyAddress: profile.address || prev.companyAddress,
              companyContact: profile.contact || prev.companyContact,
              companyEmail: profile.email || prev.companyEmail,
              companyWebsite: profile.website || prev.companyWebsite
            }));
          }
        } catch (err) {
          console.warn('Failed to load company profile from Firestore:', err);
        }
      };
      fetchProfile();
    }
  }, [initialQuotation, isCopy]);

  useEffect(() => {
    if (!initialQuotation || isCopy) {
      const autoGenerateQuotationNumber = async () => {
        try {
          const cached = getLocalCache<ProductQuotation>('quotations') || [];
          let maxNum = 0;
          cached.forEach((q) => {
            if (q.quotationNumber && typeof q.quotationNumber === 'string') {
              const match = q.quotationNumber.match(/QTN-\d+-(\d+)/i) || q.quotationNumber.match(/(\d+)$/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
              }
            }
          });

          const currentYear = new Date().getFullYear();
          let nextSeq = Math.max(maxNum + 1, cached.length + 1);

          try {
            const querySnapshot = await getDocs(collection(db, 'quotations'));
            querySnapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const qNum = data.quotationNumber;
              if (qNum && typeof qNum === 'string') {
                const match = qNum.match(/QTN-\d+-(\d+)/i) || qNum.match(/(\d+)$/);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                  }
                }
              }
            });
            nextSeq = Math.max(maxNum + 1, querySnapshot.size + 1);
          } catch (dbErr) {
            console.warn('Could not query Firestore for quotation numbers, using local count:', dbErr);
          }

          const formattedSeq = String(nextSeq).padStart(3, '0');
          const autoNo = `QTN-${currentYear}-${formattedSeq}`;

          setFormData(prev => {
            if (!prev.quotationNumber) {
              return { ...prev, quotationNumber: autoNo };
            }
            return prev;
          });
        } catch (err) {
          console.error("Error auto-generating quotation number: ", err);
          const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const currentYear = new Date().getFullYear();
          setFormData(prev => {
            if (!prev.quotationNumber) {
              return { ...prev, quotationNumber: `QTN-${currentYear}-${rand}` };
            }
            return prev;
          });
        }
      };
      autoGenerateQuotationNumber();
    }
  }, [initialQuotation, isCopy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const docId = (initialQuotation && !isCopy) ? initialQuotation.id : `quo_${Date.now()}`;
    const payload: ProductQuotation = {
      id: docId,
      ...formData,
      items,
      status: 'Pending',
      createdBy: (initialQuotation && !isCopy) ? (initialQuotation.createdBy || currentUserUid) : currentUserUid,
      createdByEmail: (initialQuotation && !isCopy) ? (initialQuotation.createdByEmail || currentUserEmail) : currentUserEmail,
      createdAt: (initialQuotation && !isCopy) ? initialQuotation.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as ProductQuotation;

    // 1. Immediately save to local cache
    saveLocalCacheItem('quotations', payload);

    // 2. Non-blocking background sync to Firestore
    setDoc(doc(db, 'quotations', docId), payload).catch((err) => {
      console.warn('Firestore setDoc failed/skipped, saved locally.', err);
    });

    // 3. Return immediately
    onBack();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addItem = () => {
    setItems([...items, { sl: items.length + 1, productName: '', description: '', price: 0, qty: 1, total: 0 }]);
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'price' || field === 'qty') {
        newItems[index].total = newItems[index].price * newItems[index].qty;
    }
    setItems(newItems);
    const newTotal = newItems.reduce((acc, item) => acc + item.total, 0);
    setFormData(prev => ({...prev, totalAmount: newTotal, amountInWords: numberToWords(newTotal)}));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen text-slate-800">
      {/* Action Bar (hidden on print) */}
      <div className="no-print flex items-center justify-between gap-4 mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </button>
        <div className="flex items-center gap-2">
          {readOnly && !isEditing && (
            <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Edit
              </button>
          )}

          {(!readOnly || isEditing) ? null : (
            <>
              <button
                type="button"
                onClick={exportToPDF}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" />
                {isExporting ? 'Generating PDF...' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Preview
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print / Save as PDF
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div id="quotation-print-area" className="p-6 border border-slate-100 rounded-2xl shadow-xs bg-white print:p-0 print:border-none print:shadow-none">
          <div className="flex justify-between items-start mb-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{formData.companyName}</h1>
            <p className="text-sm text-slate-600 mt-1">{formData.companyAddress}</p>
            <p className="text-sm text-slate-600">Phone: {formData.companyContact}</p>
            <p className="text-sm text-slate-600">Email: {formData.companyEmail}</p>
            <p className="text-sm text-slate-600">Website: {formData.companyWebsite}</p>
            
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs uppercase tracking-wider text-indigo-700 block">Client Details:</span>
                {!readOnly && dbCustomers.length > 0 && (
                  <div className="flex items-center gap-2 customer-select-container relative">
                    <label className="text-xs font-bold text-indigo-100 bg-indigo-600 px-2 py-0.5 rounded">Select Customer:</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search saved customers..."
                        className="border border-indigo-200 px-2 py-1 text-xs rounded bg-white text-slate-800 font-medium w-48 pr-6 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={formData.searchCustomer || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, searchCustomer: val }));
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">🔍</span>
                      
                      {showCustomerDropdown && (
                        <div className="absolute z-30 top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl w-64 max-h-60 overflow-y-auto divide-y divide-slate-100 py-1">
                          {dbCustomers.filter(c => 
                            (formData.searchCustomer || '').toLowerCase() === '' || 
                            (c.company || '').toLowerCase().includes((formData.searchCustomer || '').toLowerCase()) ||
                            (c.contact || '').toLowerCase().includes((formData.searchCustomer || '').toLowerCase())
                          ).length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">No customers found</div>
                          ) : (
                            dbCustomers
                              .filter(c => 
                                (formData.searchCustomer || '').toLowerCase() === '' || 
                                (c.company || '').toLowerCase().includes((formData.searchCustomer || '').toLowerCase()) ||
                                (c.contact || '').toLowerCase().includes((formData.searchCustomer || '').toLowerCase())
                              )
                              .map(c => (
                                <div
                                  key={c.id}
                                  className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer text-slate-700 transition text-left"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      searchCustomer: c.company || '',
                                      clientCompany: c.company || '',
                                      clientAddress: c.address || '',
                                      clientEmail: c.email || '',
                                      clientContact: c.contact || '',
                                    }));
                                    setShowCustomerDropdown(false);
                                  }}
                                >
                                  <div className="font-semibold text-slate-900">{c.company}</div>
                                  {c.contact && <div className="text-[10px] text-slate-500">Phone: {c.contact}</div>}
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-900 mt-1">{formData.clientCompany || '—'}</p>
              {formData.clientAddress && <p className="text-xs text-slate-600 mt-0.5">{formData.clientAddress}</p>}
              {formData.clientContact && <p className="text-xs text-slate-600">Contact: {formData.clientContact}</p>}
              {formData.clientEmail && <p className="text-xs text-slate-600">Email: {formData.clientEmail}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-light text-slate-900 mb-2">Quotation</h2>
            <p className="text-sm">Quotation No: {formData.quotationNumber}</p>
            <p className="text-sm">Date: {formData.date}</p>
            <p className="text-sm">Validity: {formData.validityDate}</p>
          </div>
        </div>

          <div id="quotation-inputs-section" className="grid grid-cols-3 gap-4 border border-indigo-100 bg-indigo-50/20 p-4 rounded-xl print:hidden">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Number</label>
              <input className="border p-2 w-full text-sm rounded bg-white box-border" name="quotationNumber" value={formData.quotationNumber || ''} onChange={handleChange} required placeholder="e.g. QTN-2026-001" readOnly={readOnly && !isEditing} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input className="border p-2 w-full text-sm rounded bg-white box-border" name="date" type="date" value={formData.date || ''} onChange={handleChange} required readOnly={readOnly && !isEditing} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Validity Date</label>
              <input className="border p-2 w-full text-sm rounded bg-white box-border" name="validityDate" type="date" value={formData.validityDate || ''} onChange={handleChange} required readOnly={readOnly && !isEditing} />
            </div>
          </div>

        <div className="border border-slate-300 rounded overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-2 w-10">SL</th>
                <th className="px-4 py-2">Product Name</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 w-16 text-center">Qty</th>
                <th className="px-4 py-2 w-24 text-right">Price</th>
                <th className="px-4 py-2 w-24 text-right">Total</th>
                {!readOnly && <th className="px-4 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {items.map((item, index) => (
                <tr key={index} className="break-inside-avoid">
                    <td className="px-4 py-3 text-slate-500 font-medium">{index + 1}</td>
                    <td className="px-2 py-2">
                      {(readOnly && !isEditing) ? (
                        <div className="px-2 py-1.5 text-slate-800 text-sm whitespace-pre-wrap break-words min-h-[1.5rem] font-medium leading-relaxed">{item.productName || '—'}</div>
                      ) : (
                        <textarea
                          rows={1}
                          className="w-full p-1.5 border border-slate-200 rounded bg-white text-sm resize-none overflow-hidden h-auto py-1.5"
                          value={item.productName}
                          onChange={e => updateItem(index, 'productName', e.target.value)}
                          onInput={(e) => {
                            const target = e.currentTarget;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                          ref={(el) => {
                            if (el) {
                              el.style.height = 'auto';
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {(readOnly && !isEditing) ? (
                        <div className="px-2 py-1.5 text-slate-600 text-sm whitespace-pre-wrap break-words min-h-[1.5rem] leading-relaxed">{item.description || '—'}</div>
                      ) : (
                        <textarea
                          rows={1}
                          className="w-full p-1.5 border border-slate-200 rounded bg-white text-sm resize-none overflow-hidden h-auto py-1.5"
                          value={item.description}
                          onChange={e => updateItem(index, 'description', e.target.value)}
                          onInput={(e) => {
                            const target = e.currentTarget;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                          ref={(el) => {
                            if (el) {
                              el.style.height = 'auto';
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {(readOnly && !isEditing) ? (
                        <div className="px-2 py-1.5 text-slate-800 text-sm font-medium">{item.qty}</div>
                      ) : (
                        <input className="w-full p-1.5 text-center border border-slate-200 rounded bg-white text-sm" type="number" value={item.qty} onChange={e => updateItem(index, 'qty', Number(e.target.value))} />
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {(readOnly && !isEditing) ? (
                        <div className="px-2 py-1.5 text-slate-800 text-sm font-medium">{item.price.toLocaleString()}</div>
                      ) : (
                        <input className="w-full p-1.5 text-right border border-slate-200 rounded bg-white text-sm" type="number" value={item.price} onChange={e => updateItem(index, 'price', Number(e.target.value))} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-semibold">{item.total.toLocaleString()}</td>
                    {(! (readOnly && !isEditing)) && <td className="px-4 py-1 text-center"><Trash2 className="h-4 w-4 cursor-pointer text-red-500 hover:text-red-650 transition" onClick={() => setItems(items.filter((_, i) => i !== index))} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {! (readOnly && !isEditing) && (
            <button type="button" onClick={addItem} className="flex items-center gap-1 p-2 text-xs text-indigo-600 font-bold">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>

        <div className="flex justify-end p-4 border-b">
          <div className="text-right">
            <p className="text-sm font-bold">Grand Total: ৳{formData.totalAmount?.toLocaleString()}</p>
          </div>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-slate-900">
            Amount in words:{' '}
            <span className="font-normal text-slate-700 italic border-b border-dashed border-slate-300 pb-0.5">{formData.amountInWords || '—'}</span>
          </p>
        </div>
        <div className="flex justify-between mt-12 pt-12 border-t border-slate-300">
          <div className="text-center w-48">
            <div className="border-t border-slate-400 pt-2 text-sm font-semibold">Prepared By</div>
          </div>
          <div className="text-center w-48">
            <div className="border-t border-slate-400 pt-2 text-sm font-semibold">Authorized Signature</div>
          </div>
        </div>
      </div>

      <div className="no-print flex justify-end gap-2 pt-8">
        <button type="button" onClick={onBack} className="bg-slate-200 px-4 py-2 text-xs rounded hover:bg-slate-300 transition cursor-pointer">Cancel</button>
        {(!readOnly || isEditing) && <button type="submit" className="bg-indigo-600 text-white px-4 py-2 text-xs rounded hover:bg-indigo-700 transition cursor-pointer">Save Quotation</button>}
      </div>
      </form>
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Print Preview</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-slate-200 rounded text-xs">Cancel</button>
                <button onClick={handlePrint} className="px-4 py-2 bg-emerald-600 text-white rounded text-xs">Print</button>
              </div>
            </div>
            <div className="border p-4" dangerouslySetInnerHTML={{ __html: document.getElementById('quotation-print-area')?.innerHTML || '' }}>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

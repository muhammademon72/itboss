import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { generateCanvasWithOklchFallback } from '../utils/pdfExport';
import { ReturnChallan, ReturnChallanItem, SignatureState } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, onSnapshot } from 'firebase/firestore';
import { saveLocalCacheItem, getLocalCache } from '../utils/localCache';
import { DEPARTMENT_OPTIONS, BRANCH_OPTIONS, ADDRESS_OPTIONS } from '../data/equipmentTemplates';
import { Printer, ArrowLeft, Save, CheckSquare, Plus, Download, Trash2 } from 'lucide-react';

interface ReturnChallanFormProps {
  returnChallan?: ReturnChallan;
  isEditMode?: boolean;
  onBack: () => void;
  currentUserUid: string;
  currentUserEmail: string;
}

const INITIAL_ROWS_COUNT = 1;

export default function ReturnChallanForm({
  returnChallan,
  isEditMode = false,
  onBack,
  currentUserUid,
  currentUserEmail
}: ReturnChallanFormProps) {
  const isViewMode = !isEditMode && !!returnChallan;

  // Form Fields
  const [date, setDate] = useState('');
  const [userName, setUserName] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [branch, setBranch] = useState('');
  const [address, setAddress] = useState('');

  // Table items state
  const [items, setItems] = useState<ReturnChallanItem[]>([]);

  // Signature state
  const [returnedBySignature, setReturnedBySignature] = useState<SignatureState>({
    signed: false,
    name: '',
    date: ''
  });
  const [receivedBySignature, setReceivedBySignature] = useState<SignatureState>({
    signed: false,
    name: '',
    date: ''
  });

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dynamic Options for Department, Branch, and Address
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(() => {
    const cached = getLocalCache<string>('requisition_departments');
    if (cached && cached.length > 0) {
      return Array.from(new Set([...DEPARTMENT_OPTIONS, ...cached])).sort();
    }
    return DEPARTMENT_OPTIONS;
  });
  const [branchOptions, setBranchOptions] = useState<string[]>(() => {
    const cached = getLocalCache<string>('requisition_branches');
    if (cached && cached.length > 0) {
      return Array.from(new Set([...BRANCH_OPTIONS, ...cached])).sort();
    }
    return BRANCH_OPTIONS;
  });
  const [addressOptions, setAddressOptions] = useState<string[]>(() => {
    const cached = getLocalCache<string>('requisition_addresses');
    if (cached && cached.length > 0) {
      return Array.from(new Set([...ADDRESS_OPTIONS, ...cached])).sort();
    }
    return ADDRESS_OPTIONS;
  });

  useEffect(() => {
    const qDepts = query(collection(db, 'requisition_departments'));
    const unsubDepts = onSnapshot(qDepts, (snapshot) => {
      const customDepts: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name) customDepts.push(data.name);
      });
      const combined = Array.from(new Set([...DEPARTMENT_OPTIONS, ...customDepts])).sort();
      setDepartmentOptions(combined);
    }, () => {});

    const qBranches = query(collection(db, 'requisition_branches'));
    const unsubBranches = onSnapshot(qBranches, (snapshot) => {
      const customBranches: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name) customBranches.push(data.name);
      });
      const combined = Array.from(new Set([...BRANCH_OPTIONS, ...customBranches])).sort();
      setBranchOptions(combined);
    }, () => {});

    const qAddresses = query(collection(db, 'requisition_addresses'));
    const unsubAddresses = onSnapshot(qAddresses, (snapshot) => {
      const customAddresses: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name) customAddresses.push(data.name);
      });
      const combined = Array.from(new Set([...ADDRESS_OPTIONS, ...customAddresses])).sort();
      setAddressOptions(combined);
    }, () => {});

    return () => {
      unsubDepts();
      unsubBranches();
      unsubAddresses();
    };
  }, []);

  // Load from prop if view or edit
  useEffect(() => {
    if (returnChallan) {
      setDate(returnChallan.date || '');
      setUserName(returnChallan.userName || '');
      setDepartment(returnChallan.department || '');
      setEmployeeId(returnChallan.employeeId || '');
      setBranch(returnChallan.branch || '');
      setAddress(returnChallan.address || '');
      setItems(returnChallan.items || []);
      setReturnedBySignature(returnChallan.returnedBySignature || { signed: false, name: '', date: '' });
      setReceivedBySignature(returnChallan.receivedBySignature || { signed: false, name: '', date: '' });
    } else {
      // Create mode
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setUserName('');
      setDepartment('');
      setEmployeeId('');
      setBranch('');
      setAddress('');
      setReturnedBySignature({ signed: false, name: '', date: '' });
      setReceivedBySignature({ signed: false, name: '', date: '' });

      // Initialize empty rows
      const initialItems: ReturnChallanItem[] = Array.from({ length: INITIAL_ROWS_COUNT }, (_, index) => ({
        sl: index + 1,
        productName: '',
        brand: '',
        productModel: '',
        qty: 1,
        serialNumber: '',
        type: '',
        reasonForReturn: '',
        returnDate: today
      }));
      setItems(initialItems);
    }
  }, [returnChallan]);

  const handleFieldChange = (sl: number, field: keyof ReturnChallanItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.sl === sl ? { ...item, [field]: value } : item))
    );
  };

  const addCustomRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setItems((prev) => [
      ...prev,
      {
        sl: prev.length + 1,
        productName: '',
        brand: '',
        productModel: '',
        qty: 1,
        serialNumber: '',
        type: '',
        reasonForReturn: '',
        returnDate: today
      }
    ]);
  };

  const handleAddRowAfter = (afterSl?: number) => {
    const today = new Date().toISOString().split('T')[0];
    const newRow: ReturnChallanItem = {
      sl: (afterSl ?? items.length) + 1,
      productName: '',
      brand: '',
      productModel: '',
      qty: 1,
      serialNumber: '',
      type: '',
      reasonForReturn: '',
      returnDate: today
    };

    setItems((prev) => {
      if (afterSl === undefined) {
        return [...prev, newRow].map((item, idx) => ({ ...item, sl: idx + 1 }));
      }
      const index = prev.findIndex((item) => item.sl === afterSl);
      if (index === -1) {
        return [...prev, newRow].map((item, idx) => ({ ...item, sl: idx + 1 }));
      }
      const updated = [...prev];
      updated.splice(index + 1, 0, newRow);
      return updated.map((item, idx) => ({ ...item, sl: idx + 1 }));
    });
  };

  const handleRemoveRow = (slToRemove: number) => {
    const today = new Date().toISOString().split('T')[0];
    setItems((prev) => {
      if (prev.length <= 1) {
        return [
          {
            sl: 1,
            productName: '',
            brand: '',
            productModel: '',
            qty: 1,
            serialNumber: '',
            type: '',
            reasonForReturn: '',
            returnDate: today
          }
        ];
      }
      return prev
        .filter((item) => item.sl !== slToRemove)
        .map((item, index) => ({
          ...item,
          sl: index + 1
        }));
    });
  };

  const handleSave = async () => {
    if (!userName.trim()) {
      setMessage({ type: 'error', text: 'Employee Name is required.' });
      return;
    }
    if (!employeeId.trim()) {
      setMessage({ type: 'error', text: 'Employee ID is required.' });
      return;
    }

    // Filter items that have a product name
    const validItems = items.filter((item) => item.productName.trim() !== '');
    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in at least one Product Name in the table.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const docId = returnChallan?.id || `ret_${Date.now()}`;
    const collectionPath = 'returnChallans';
    const filePath = `${collectionPath}/${docId}`;

    const newChallan: ReturnChallan = {
      id: docId,
      date,
      userName,
      department,
      employeeId,
      branch,
      address,
      items: items, // Save all rows to keep layout exactly as configured
      returnedBySignature,
      receivedBySignature,
      createdBy: returnChallan?.createdBy || currentUserUid,
      createdByEmail: returnChallan?.createdByEmail || currentUserEmail,
      createdAt: returnChallan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'returnChallans', docId), newChallan);
      saveLocalCacheItem('returnChallans', newChallan);
      setMessage({ type: 'success', text: 'Return Challan saved successfully!' });
      setTimeout(() => {
        setMessage(null);
        onBack();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      saveLocalCacheItem('returnChallans', newChallan);
      handleFirestoreError(err, OperationType.WRITE, filePath);
      setMessage({ type: 'success', text: 'Return Challan saved locally in offline storage!' });
      setTimeout(() => {
        setMessage(null);
        onBack();
      }, 1500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignReturner = () => {
    if (returnedBySignature.signed) {
      setReturnedBySignature({ signed: false, name: '', date: '' });
    } else {
      if (!userName.trim()) {
        setMessage({ type: 'error', text: 'Enter Employee Name before signing.' });
        return;
      }
      setReturnedBySignature({
        signed: true,
        name: userName,
        date: new Date().toLocaleDateString('en-GB')
      });
      setMessage({ type: 'success', text: 'Returned By signed successfully!' });
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const handleSignReceiver = () => {
    if (receivedBySignature.signed) {
      setReceivedBySignature({ signed: false, name: '', date: '' });
    } else {
      setReceivedBySignature({
        signed: true,
        name: 'IT Department Officer',
        date: new Date().toLocaleDateString('en-GB')
      });
      setMessage({ type: 'success', text: 'Received By signed successfully!' });
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const downloadPdf = async () => {
    const cardElement = document.getElementById('return-challan-form-card');
    if (!cardElement) {
      setMessage({ type: 'error', text: 'Error finding document graphic container.' });
      return;
    }

    setIsDownloadingPdf(true);
    setMessage(null);

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    window.scrollTo(0, 0);

    const originalWidth = cardElement.style.width;
    const originalMinWidth = cardElement.style.minWidth;
    const originalMaxWidth = cardElement.style.maxWidth;

    const sections = Array.from(cardElement.querySelectorAll('*'));
    const originalOverflowStyles = sections.map((el) => {
      const htmlEl = el as HTMLElement;
      const computed = window.getComputedStyle(htmlEl);
      return {
        element: htmlEl,
        overflow: htmlEl.style.overflow
      };
    });

    sections.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.overflow = 'visible';
    });

    try {
      setMessage({ type: 'success', text: 'Preparing high-quality vertical A4 PDF...' });

      cardElement.style.width = '794px';
      cardElement.style.minWidth = '794px';
      cardElement.style.maxWidth = '794px';

      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await generateCanvasWithOklchFallback(cardElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1000,
        imageTimeout: 0,
        removeContainer: true
      });

      cardElement.style.width = originalWidth;
      cardElement.style.minWidth = originalMinWidth;
      cardElement.style.maxWidth = originalMaxWidth;
      
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

      const reportName = `return_challan_${userName || 'employee'}.pdf`;
      
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const pWidth = pageWidth - (margin * 2);
      const pHeight = pageHeight - (margin * 2);

      const ratio = pWidth / canvas.width;
      const imgWidth = pWidth;
      const imgHeight = canvas.height * ratio;

      let remainingHeight = imgHeight;
      let pageNum = 0;

      while (remainingHeight > 4) {
        if (pageNum > 0) {
          pdf.addPage();
        }

        const yOffset = margin - (pageNum * pHeight);
        pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight, undefined, 'FAST');

        remainingHeight -= pHeight;
        pageNum++;
      }

      pdf.save(reportName);
      setMessage({ type: 'success', text: 'PDF document downloaded successfully!' });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      if (cardElement) {
        cardElement.style.width = originalWidth;
        cardElement.style.minWidth = originalMinWidth;
        cardElement.style.maxWidth = originalMaxWidth;
      }

      originalOverflowStyles.forEach(({ element, overflow }) => {
        element.style.overflow = overflow;
      });

      window.scrollTo(originalScrollX, originalScrollY);

      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: 'Failed to generate PDF: ' + errMsg });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const triggerDirectPrint = () => {
    setMessage({
      type: 'success',
      text: "প্রিন্ট উইন্ডো খোলার চেষ্টা করা হচ্ছে... নতুন ট্যাবে প্রিন্ট ডায়ালগ সহজে কাজ করে।"
    });
    setTimeout(() => setMessage(null), 8000);

    try {
      window.focus();
      window.print();
    } catch (err) {
      console.error("Print failed:", err);
      setMessage({
        type: 'error',
        text: "সরাসরি প্রিন্ট করা যায়নি। অনুগ্রহ করে 'PDF Download' ব্যবহার করুন।"
      });
      setTimeout(() => setMessage(null), 8000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-8">
      {/* Control Top Action Bar */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-white p-4 rounded-xl border border-slate-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={triggerDirectPrint}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0"
          >
            <Printer className="h-4 w-4" />
            Print Form
          </button>

          <button
            onClick={downloadPdf}
            disabled={isDownloadingPdf}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold cursor-pointer transition disabled:opacity-40 shrink-0"
          >
            <Download className="h-4 w-4" />
            {isDownloadingPdf ? 'Downloading...' : 'PDF Download'}
          </button>

          {!isViewMode && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white border border-amber-700 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm shrink-0"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Filing...' : 'Save Document'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`no-print mb-6 p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-[10px] uppercase tracking-wider font-bold underline bg-transparent border-0 cursor-pointer text-slate-500 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      )}

      {/* --- PRINTABLE / CARD WRAPPER --- */}
      <div
        id="return-challan-form-card"
        className="bg-white border border-gray-400 p-6 pb-6 shadow-md font-sans print-sheet mx-auto"
        style={{ color: '#000000', backgroundColor: '#ffffff' }}
      >
        {/* Document Header */}
        <div className="text-center mb-1 pt-0">
          <h1 className="text-2xl font-black tracking-widest font-serif leading-none mb-1 whitespace-nowrap" style={{ color: '#000000', fontFamily: 'serif' }}>
            RETURN CHALLAN OF IT EQUIPMENT
          </h1>
          <p className="text-sm font-semibold tracking-wide font-sans leading-none" style={{ color: '#1f2937' }}>
            Information and Technology Department
          </p>
          <div className="w-full border-t border-black mt-6 mb-5"></div>
        </div>

        {/* Input Metadata Rows */}
        <div className="space-y-3 mb-6 text-xs text-black max-w-lg">
          {/* Challan Date */}
          <div className="flex items-center">
            <span className="w-32 font-bold uppercase shrink-0">Date</span>
            <span className="mr-2 font-bold">:</span>
            {isViewMode ? (
              <span className="font-semibold underline underline-offset-2">{date || '—'}</span>
            ) : (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 bg-transparent border-b border-gray-300 focus:border-black outline-none font-semibold pb-0.5"
              />
            )}
          </div>

          {/* Employee Name */}
          <div className="flex items-center">
            <span className="w-32 font-bold uppercase shrink-0">Employee Name</span>
            <span className="mr-2 font-bold">:</span>
            {isViewMode ? (
              <span className="font-black underline underline-offset-2 uppercase">{userName || '—'}</span>
            ) : (
              <input
                type="text"
                placeholder="Type Name of Employee"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="flex-1 bg-transparent border-b border-gray-300 focus:border-black outline-none font-black pb-0.5"
              />
            )}
          </div>

          {/* Department */}
          <div className="flex items-center">
            <span className="w-32 font-bold uppercase shrink-0">Department</span>
            <span className="mr-2 font-bold">:</span>
            {isViewMode ? (
              <span className="font-semibold underline underline-offset-2">{department || '—'}</span>
            ) : (
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="flex-1 bg-transparent border-b border-gray-300 focus:border-black outline-none font-semibold pb-0.5"
              >
                <option value="">Choose Department</option>
                {departmentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Employee ID */}
          <div className="flex items-center">
            <span className="w-32 font-bold uppercase shrink-0">Employee ID</span>
            <span className="mr-2 font-bold">:</span>
            {isViewMode ? (
              <span className="font-mono font-bold underline underline-offset-2">{employeeId || '—'}</span>
            ) : (
              <input
                type="text"
                placeholder="Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="flex-1 bg-transparent border-b border-gray-300 focus:border-black outline-none font-mono font-bold pb-0.5"
              />
            )}
          </div>

          {/* Branch */}
          <div className="flex items-center">
            <span className="w-32 font-bold uppercase shrink-0">Branch</span>
            <span className="mr-2 font-bold">:</span>
            {isViewMode ? (
              <span className="font-semibold underline underline-offset-2">{branch || '—'}</span>
            ) : (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="flex-1 bg-transparent border-b border-gray-300 focus:border-black outline-none font-semibold pb-0.5"
              >
                <option value="">SELECT PLEASE</option>
                {branchOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Address */}
          <div className="flex items-center">
            <span className="w-32 font-bold uppercase shrink-0">Address</span>
            <span className="mr-2 font-bold">:</span>
            {isViewMode ? (
              <span className="font-semibold underline underline-offset-2">{address || '—'}</span>
            ) : (
              <select
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex-1 bg-transparent border-b border-gray-300 focus:border-black outline-none font-semibold pb-0.5"
              >
                <option value="">Choose Address</option>
                {addressOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Product Description Table Header */}
        <h3 className="text-xs font-black uppercase text-black mb-2 mt-6 tracking-wide">
          Returned Equipment Description:
        </h3>

        {/* Dynamic Items Table */}
        <div className="select-none border border-black mb-6 w-full">
          <table className="w-full text-left border-collapse table-fixed font-sans text-[10px]">
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="font-extrabold border-b border-black text-center">
                <th className={`${!isViewMode ? 'w-[15%]' : 'w-[15%]'} py-1.5 px-1 border-r border-black break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>PRODUCT NAME</th>
                <th className={`${!isViewMode ? 'w-[10%]' : 'w-[10%]'} py-1.5 px-1 border-r border-black break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>BRAND</th>
                <th className={`${!isViewMode ? 'w-[13%]' : 'w-[14%]'} py-1.5 px-1 border-r border-black break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>PRODUCT MODEL</th>
                <th className={`${!isViewMode ? 'w-[6%]' : 'w-[6%]'} py-1.5 px-1 border-r border-black break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>QTY</th>
                <th className={`${!isViewMode ? 'w-[15%]' : 'w-[15%]'} py-1.5 px-1 border-r border-black break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>SERIAL NUMBER</th>
                <th className={`${!isViewMode ? 'w-[10%]' : 'w-[11%]'} py-1.5 px-1 border-r border-black break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>TYPE</th>
                <th className={`${!isViewMode ? 'w-[14%]' : 'w-[15%]'} py-1.5 px-1 border-r border-black break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>REASON FOR RETURN</th>
                <th className={`${!isViewMode ? 'w-[13%] border-r border-black' : 'w-[14%]'} py-1.5 px-1 break-words`} style={{ color: '#000000', verticalAlign: 'middle' }}>RETURN DATE</th>
                {!isViewMode && (
                  <th className="no-print w-[4%] py-1 px-0.5 text-center break-words font-bold" style={{ color: '#000000', verticalAlign: 'middle' }} data-html2canvas-ignore="true" title="Row Actions (Delete / Add Extra Row)">
                    <span className="sr-only">Actions</span>
                    <span className="text-[8px] font-bold text-slate-500">ACT</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.sl} className="border-b border-black break-words">
                  {/* Product Name */}
                  <td className="p-0 border-r border-black align-middle text-center font-bold text-[11px]">
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span className="block w-full text-center whitespace-normal break-words py-1.5 px-1 leading-tight">{item.productName || '—'}</span>
                      ) : (
                        <textarea
                          rows={1}
                          value={item.productName}
                          onChange={(e) => handleFieldChange(item.sl, 'productName', e.target.value)}
                          placeholder="..."
                          className="w-full bg-transparent outline-none font-bold text-center resize-none overflow-hidden h-auto py-1.5 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
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
                    </div>
                  </td>

                  {/* Brand */}
                  <td className="p-0 border-r border-black align-middle text-center font-semibold text-[11px]">
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span className="block w-full text-center whitespace-normal break-words py-1.5 px-1 leading-tight">{item.brand || '—'}</span>
                      ) : (
                        <textarea
                          rows={1}
                          value={item.brand}
                          onChange={(e) => handleFieldChange(item.sl, 'brand', e.target.value)}
                          placeholder="..."
                          className="w-full bg-transparent text-center outline-none resize-none overflow-hidden h-auto py-1.5 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
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
                    </div>
                  </td>

                  {/* Product Model */}
                  <td className="p-0 border-r border-black align-middle text-center font-semibold text-[11px]">
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span className="block w-full text-center whitespace-normal break-words py-1.5 px-1 leading-tight">{item.productModel || '—'}</span>
                      ) : (
                        <textarea
                          rows={1}
                          value={item.productModel}
                          onChange={(e) => handleFieldChange(item.sl, 'productModel', e.target.value)}
                          placeholder="..."
                          className="w-full bg-transparent text-center outline-none resize-none overflow-hidden h-auto py-1.5 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
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
                    </div>
                  </td>

                  {/* Qty */}
                  <td className="p-0 border-r border-black align-middle text-center font-bold text-[11px]">
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span>{item.qty || '—'}</span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={item.qty || ''}
                          onChange={(e) => handleFieldChange(item.sl, 'qty', Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-transparent text-center outline-none font-bold py-1 px-1 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
                        />
                      )}
                    </div>
                  </td>

                  {/* Serial Number */}
                  <td className="p-0 border-r border-black align-middle text-center font-semibold text-[11px]">
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span className="block w-full font-mono text-center whitespace-normal break-all py-1.5 px-1 leading-tight">{item.serialNumber || '—'}</span>
                      ) : (
                        <textarea
                          rows={1}
                          value={item.serialNumber}
                          onChange={(e) => handleFieldChange(item.sl, 'serialNumber', e.target.value)}
                          placeholder="..."
                          className="w-full bg-transparent text-center font-mono outline-none resize-none overflow-hidden h-auto py-1.5 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
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
                    </div>
                  </td>

                  {/* Type */}
                  <td className="p-0 border-r border-black align-middle text-center font-semibold text-[11px]">
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span className="block w-full text-center whitespace-normal break-words py-1.5 px-1 leading-tight">{item.type || '—'}</span>
                      ) : (
                        <textarea
                          rows={1}
                          value={item.type}
                          onChange={(e) => handleFieldChange(item.sl, 'type', e.target.value)}
                          placeholder="..."
                          className="w-full bg-transparent text-center outline-none resize-none overflow-hidden h-auto py-1.5 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
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
                    </div>
                  </td>

                  {/* Reason for Return */}
                  <td className="p-0 border-r border-black align-middle text-center font-semibold text-[11px]">
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span className="block w-full text-center whitespace-normal break-words py-1.5 px-1 leading-tight">{item.reasonForReturn || '—'}</span>
                      ) : (
                        <textarea
                          rows={1}
                          value={item.reasonForReturn}
                          onChange={(e) => handleFieldChange(item.sl, 'reasonForReturn', e.target.value)}
                          placeholder="..."
                          className="w-full bg-transparent text-center outline-none resize-none overflow-hidden h-auto py-1.5 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
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
                    </div>
                  </td>

                  {/* Return Date */}
                  <td className={`p-0 ${!isViewMode ? 'border-r border-black' : ''} align-middle text-center font-semibold text-[11px]`}>
                    <div className="flex items-center justify-center w-full min-h-[40px] px-1 py-1">
                      {isViewMode ? (
                        <span className="block w-full text-center whitespace-normal break-words py-1.5 px-1 leading-tight">{item.returnDate || '—'}</span>
                      ) : (
                        <textarea
                          rows={1}
                          value={item.returnDate || ''}
                          onChange={(e) => handleFieldChange(item.sl, 'returnDate', e.target.value)}
                          placeholder="e.g. 05/06/2026"
                          className="w-full bg-transparent text-center outline-none text-[11px] resize-none overflow-hidden h-auto py-1.5 focus:bg-slate-50 rounded"
                          style={{ color: '#000000' }}
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
                    </div>
                  </td>

                  {/* Row Actions: Delete & Add Extra Row (Only in Form) */}
                  {!isViewMode && (
                    <td className="no-print p-0 align-middle text-center bg-slate-50/20 hover:bg-slate-50/80 transition-colors" data-html2canvas-ignore="true">
                      <div className="flex flex-col items-center justify-center gap-1 w-full min-h-[44px] px-0.5 py-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(item.sl)}
                          title="Delete this row"
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 active:scale-90 rounded transition cursor-pointer flex items-center justify-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRowAfter(item.sl)}
                          title="Add extra row"
                          className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 active:scale-90 rounded transition cursor-pointer flex items-center justify-center"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Row button in Create Mode */}
        {!isViewMode && (
          <div className="no-print mt-2 mb-6">
            <button
              type="button"
              onClick={addCustomRow}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-1 rounded border border-slate-300 transition cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Add Extra Row
            </button>
          </div>
        )}

        {/* Dual Signatures Box - Row containing both signatures side-by-side */}
        <div className="grid grid-cols-2 gap-8 mt-12 mb-10 px-4">
          {/* Signature Returned By */}
          <div className="text-center text-xs flex flex-col items-center justify-end">
            {returnedBySignature.signed ? (
              <div className="pb-1 text-center font-serif text-sm w-full">
                <p className="italic font-semibold border-b border-black text-indigo-700 min-h-[1.5rem]">
                  {returnedBySignature.name}
                </p>
                <p className="text-[10px] text-gray-500 font-mono pt-1 pb-1">
                  Signed: {returnedBySignature.date}
                </p>
              </div>
            ) : (
              <div className="h-20 mb-1 flex flex-col items-center justify-end w-full">
                {isViewMode ? (
                  <p className="text-gray-400 italic font-medium mb-1.5">Pending Return Sign</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignReturner}
                    className="no-print px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-bold rounded cursor-pointer transition mb-2"
                  >
                    📝 Returned By Sign
                  </button>
                )}
              </div>
            )}
            <div className="w-full border-t border-black pt-1.5">
              <p className="font-bold text-[9.5px] uppercase tracking-wide text-center">
                SIGNATURE OF RETURNER / EMPLOYEE
              </p>
            </div>
          </div>

          {/* Signature Received By */}
          <div className="text-center text-xs flex flex-col items-center justify-end">
            {receivedBySignature.signed ? (
              <div className="pb-1 text-center font-serif text-sm w-full">
                <p className="italic font-semibold border-b border-black text-blue-700 min-h-[1.5rem]">
                  {receivedBySignature.name}
                </p>
                <p className="text-[10px] text-gray-500 font-mono pt-1 pb-1">
                  Signed: {receivedBySignature.date}
                </p>
              </div>
            ) : (
              <div className="h-20 mb-1 flex flex-col items-center justify-end w-full">
                {isViewMode ? (
                  <p className="text-gray-400 italic font-medium mb-1.5">Pending Receipt Sign</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignReceiver}
                    className="no-print px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold rounded cursor-pointer transition mb-2"
                  >
                    📝 Received By Sign
                  </button>
                )}
              </div>
            )}
            <div className="w-full border-t border-black pt-1.5">
              <p className="font-bold text-[9.5px] uppercase tracking-wide text-center">
                SIGNATURE OF RECEIVER / IT OFFICER
              </p>
            </div>
          </div>
        </div>

        {/* Bengali Policy Notice Card */}
        <div className="border-2 border-amber-500 p-3.5 my-8 bg-white text-[11px] leading-relaxed font-sans text-justify text-amber-900 rounded">
          <p className="font-semibold select-all text-amber-800">
            প্রতিষ্ঠানের আইটি নীতিমালা অনুযায়ী ফেরতকৃত তথ্যপ্রযুক্তি সরঞ্জামগুলি সফলভাবে আইটি বিভাগে জমা দেওয়া হয়েছে এবং ডাটাবেজে এন্ট্রি করা হয়েছে। কোনো প্রকার অসঙ্গতি পাওয়া গেলে পরবর্তীতে উভয়পক্ষ আলোচনার মাধ্যমে তা সমাধান করবেন।
          </p>
        </div>

        {/* Footer Text */}
        <div className="text-center pt-2 select-text border-t border-gray-100 mt-6 font-semibold text-[11px] text-gray-600 tracking-wide font-sans">
          Special Note: Return Challan is requested to be signed and filed into the IT Department Directories
        </div>
      </div>
    </div>
  );
}

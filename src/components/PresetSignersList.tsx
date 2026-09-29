import { useState, useEffect, FormEvent } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { getLocalCache, setLocalCache, saveLocalCacheItem, deleteLocalCacheItem } from '../utils/localCache';
import { PresetSigner } from '../types';
import { Sparkles, Trash2, UserPlus, Info, CheckCircle, Database } from 'lucide-react';

interface PresetSignersListProps {
  onBack: () => void;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

const DEFAULT_SEEDS = [
  // Applicants (Step 1)
  { name: 'Mr. Emon (Sr. Software Engineer)', role: 'Applicant' },
  { name: 'Mr. Jamil (QA Engineer)', role: 'Applicant' },
  { name: 'Ms. Nusrat (UI/UX Designer)', role: 'Applicant' },
  // Managers
  { name: 'Mr. Rahman (IT Manager)', role: 'Manager' },
  { name: 'Ms. Sultana (IT Associate Manager)', role: 'Manager' },
  { name: 'Mr. Kamal (Operations Lead)', role: 'Manager' },
  { name: 'Engr. Fahim Ahmed (IT In-Charge)', role: 'Manager' },
  // Recommenders
  { name: 'Mr. Alam (CTO)', role: 'Recommender' },
  { name: 'Mr. Chowdhury (Director Operations)', role: 'Recommender' },
  { name: 'Dr. Khan (Technical Advisor)', role: 'Recommender' },
  { name: 'Major General (Retd.) Rashid (Advisor)', role: 'Recommender' },
  // Authorities
  { name: 'ASR Group Managing Director', role: 'Authority' },
  { name: 'Mr. Karim (Chief Executive Officer)', role: 'Authority' },
  { name: 'Ms. Yeasmin (CFO)', role: 'Authority' },
  { name: 'Chowdhury Abu Taher (Chairman)', role: 'Authority' }
];

export default function PresetSignersList({
  onBack,
  isAdmin = false,
  permissions
}: PresetSignersListProps) {
  const canEdit = isAdmin || (permissions?.edit ?? false);
  const canDelete = isAdmin || (permissions?.delete ?? false);
  const [presets, setPresets] = useState<PresetSigner[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Applicant' | 'Manager' | 'Recommender' | 'Authority'>('Applicant');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fetchError, setFetchError] = useState('');

  // Confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // Real-time Firestore sync
  useEffect(() => {
    // Simplify query by removing orderBy to prevent exclusions of documents missing specific fields
    const q = query(collection(db, 'presetSigners'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: PresetSigner[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            name: data.name || '',
            role: data.role || 'Manager',
            createdAt: data.createdAt || ''
          });
        });
        
        // Sort in memory by Role order, then by createdAt desc
        items.sort((a, b) => {
          const roleOrder = { 'Applicant': 1, 'Manager': 2, 'Recommender': 3, 'Authority': 4 };
          const roleA = roleOrder[a.role as 'Applicant' | 'Manager' | 'Recommender' | 'Authority'] || 5;
          const roleB = roleOrder[b.role as 'Applicant' | 'Manager' | 'Recommender' | 'Authority'] || 5;
          if (roleA !== roleB) {
            return roleA - roleB;
          }
          // Sub-sort by date (newest first)
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        setPresets(items);
        setLocalCache('presetSigners', items);
        setFetchError('');
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching preset signers:', error);
        handleFirestoreError(error, OperationType.LIST, 'presetSigners');
        const cached = getLocalCache<PresetSigner>('presetSigners');
        if (cached && cached.length > 0) {
          setPresets(cached);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!name.trim()) {
      setErrorMsg('Signer Name cannot be blank');
      return;
    }
    
    setSubmitting(true);
    const path = 'presetSigners';
    try {
      const docData = {
        name: name.trim(),
        role,
        createdAt: new Date().toISOString()
      };
      // For create/addDoc we let Firebase handle ID, then update schema
      const docRef = await addDoc(collection(db, path), docData);
      
      // Update ID to be string representation
      setName('');
      setSuccessMsg('Signer successfully entered and saved in Database.');
      
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Failed to add preset signer:", err);
      const errorStr = err instanceof Error ? err.message : String(err);
      setErrorMsg(`ফেইল হয়েছে: ${errorStr}`);
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (e) {
        // Prevent breaking the form rendering loop on throw
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const path = `presetSigners/${id}`;
    try {
      await deleteDoc(doc(db, 'presetSigners', id));
      setSuccessMsg('Signer removed successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error("Failed to delete preset signer:", err);
      const errorStr = err instanceof Error ? err.message : String(err);
      setErrorMsg(`মুছে ফেলতে ব্যর্থ হয়েছে: ${errorStr}`);
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (e) {
        // Prevent breaking the rendering loop on throw
      }
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleAutoSeed = () => {
    setShowSeedConfirm(true);
  };

  const confirmAutoSeed = async () => {
    setSubmitting(true);
    const path = 'presetSigners';
    try {
      for (const item of DEFAULT_SEEDS) {
        await addDoc(collection(db, path), {
          ...item,
          createdAt: new Date().toISOString()
        });
      }
      setSuccessMsg('Defaults seeded successfully!');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      setErrorMsg('Failed to seed presets.');
    } finally {
      setSubmitting(false);
      setShowSeedConfirm(false);
    }
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = async () => {
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    const path = 'presetSigners';
    try {
      for (const preset of presets) {
        await deleteDoc(doc(db, 'presetSigners', preset.id));
      }
      setSuccessMsg('ডাটাবেজ সফলভাবে সম্পূর্ণ খালি করা হয়েছে!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Failed to clear presets:", err);
      const errorStr = err instanceof Error ? err.message : String(err);
      setErrorMsg(`ডাটাবেজ খালি করতে ব্যর্থ: ${errorStr}`);
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (e) {
        // Prevent breaking on throw
      }
    } finally {
      setSubmitting(false);
      setShowClearConfirm(false);
    }
  };

  // Divide signers by group
  const applicants = presets.filter(p => p.role === 'Applicant');
  const managers = presets.filter(p => p.role === 'Manager');
  const recommenders = presets.filter(p => p.role === 'Recommender');
  const authorities = presets.filter(p => p.role === 'Authority');

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans" id="signer-presets-panel">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Database className="h-6 w-6 text-indigo-600" />
            Signer Personas Database (অনুমোদনকারী ডাটাবেজ)
          </h1>
          <p className="text-slate-500 text-xs font-semibold uppercase mt-1 tracking-wider">
            Manage global signatories for IT Requisitions
          </p>
        </div>
        
        <div className="flex gap-3">
          {canEdit && presets.length === 0 && !loading && (
            <button
              onClick={handleAutoSeed}
              className="text-xs font-bold leading-none bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              Load Default Personnel
            </button>
          )}
          {canDelete && presets.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={submitting}
              className="text-xs font-bold leading-none bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear Database (সব মুছুন)
            </button>
          )}
          <button
            onClick={onBack}
            className="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 px-4 py-3 rounded-xl shadow-xs transition leading-none text-slate-700 cursor-pointer"
          >
            ← Back to Requisitions Log
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 mb-8 flex gap-3 text-slate-700 text-xs leading-relaxed">
        <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-indigo-950">কিভাবে কাজ করে?</p>
          <p className="text-slate-600 mt-0.5 font-medium">
            এখানে এন্ট্রি করা নামগুলো সরাসরি সমস্ত রিকুইজিশন ফর্মের সিগনেচার ট্র্যাকে স্লাইড করার জন্য যুক্ত হয়ে যাবে। 
            <strong> শিমুলেট রোল</strong> অপশন থেকে অনুমোদনকারী ব্যক্তি জাস্ট তার নির্দিষ্ট নাম সিলেক্ট করে <strong>"Authorize & Sign"</strong> বাটনে ক্লিক করলেই সিগনেচারটি সেই নামের অধীনে ফায়ারবেসে চিরস্থায়ীভাবে সেভ হবে। নতুন কোনো নাম যুক্ত করতে চাইলে নিচের ফরমটি ব্যবহার করুন।
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${canEdit ? 'lg:grid-cols-3' : ''} gap-8`}>
        
        {/* Left Side Add Signatory Form Container */}
        {canEdit && (
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
            <h2 className="text-slate-900 font-bold text-sm tracking-tight mb-4 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-indigo-600" />
              Add New Signatory (নতুন অনুমোদনকারী যুক্ত করুন)
            </h2>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Full Name (পদবীসহ নাম)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mr. S. Alam (CIO)"
                  className="w-full text-xs font-medium border border-slate-200 focus:border-indigo-600 outline-none px-3.5 py-2.5 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Workflow Role (সিগনেচার লেভেল)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full text-xs font-medium border border-slate-200 focus:border-indigo-600 outline-none px-3 py-2.5 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800"
                >
                  <option value="Applicant">Applicant / Sign-off (Step 1)</option>
                  <option value="Manager">IT Manager / In-Charge (Step 2)</option>
                  <option value="Recommender">CTO / Recommend By (Step 3)</option>
                  <option value="Authority">Managing Director / Authority (Step 4)</option>
                </select>
              </div>

              {errorMsg && (
                <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 py-3 rounded-xl text-white shadow-sm transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving to Cloud...' : 'Add Signer to Database'}
              </button>
            </form>
          </div>
        )}

        {/* Right Side Database Listings */}
        <div className={`${canEdit ? 'lg:col-span-2' : 'w-full'} space-y-6`}>
          {fetchError && (
            <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 p-4 rounded-2xl">
              {fetchError}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl">
              <div className="w-8 h-8 border-2 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-[11px] font-semibold text-slate-500 mt-3 animate-pulse">Syncing signer repository...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              
              {/* Category 1: Applicants */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <span className="text-[9px] uppercase font-bold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">Step 1</span>
                  <h3 className="text-xs font-bold text-slate-900 mt-1">Applicants / Sign-offs</h3>
                  <span className="text-[10px] text-slate-400 font-medium">{applicants.length} signed personas</span>
                </div>
                
                {applicants.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-4 text-center">No Applicants added yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {applicants.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/80 rounded-lg group text-slate-800 text-[11px] font-medium border border-slate-100 transition-colors">
                        <span className="truncate pr-2 select-all" title={p.name}>{p.name}</span>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Remove persona"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category 2: Managers */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <span className="text-[9px] uppercase font-bold text-indigo-500 px-1.5 py-0.5 bg-indigo-50 rounded">Step 2</span>
                  <h3 className="text-xs font-bold text-slate-900 mt-1">IT In-Charge / Managers</h3>
                  <span className="text-[10px] text-slate-400 font-medium">{managers.length} signed personas</span>
                </div>
                
                {managers.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-4 text-center">No Managers added yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {managers.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/80 rounded-lg group text-slate-800 text-[11px] font-medium border border-slate-100 transition-colors">
                        <span className="truncate pr-2 select-all" title={p.name}>{p.name}</span>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Remove persona"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category 3: Recommenders */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <span className="text-[9px] uppercase font-bold text-teal-600 px-1.5 py-0.5 bg-teal-50 rounded">Step 3</span>
                  <h3 className="text-xs font-bold text-slate-900 mt-1">Recommend Officers</h3>
                  <span className="text-[10px] text-slate-400 font-medium">{recommenders.length} signed personas</span>
                </div>
                
                {recommenders.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-4 text-center">No Recommenders added yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {recommenders.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/80 rounded-lg group text-slate-800 text-[11px] font-medium border border-slate-100 transition-colors">
                        <span className="truncate pr-2 select-all" title={p.name}>{p.name}</span>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Remove persona"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category 4: Authority */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <span className="text-[9px] uppercase font-bold text-violet-600 px-1.5 py-0.5 bg-violet-50 rounded">Step 4</span>
                  <h3 className="text-xs font-bold text-slate-900 mt-1">Approving Authorities</h3>
                  <span className="text-[10px] text-slate-400 font-medium">{authorities.length} signed personas</span>
                </div>
                
                {authorities.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic py-4 text-center">No Authorities added yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {authorities.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/80 rounded-lg group text-slate-800 text-[11px] font-medium border border-slate-100 transition-colors">
                        <span className="truncate pr-2 select-all" title={p.name}>{p.name}</span>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Remove persona"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Custom Confirmation Modals block */}
      {deleteConfirmId && (() => {
        const signerToDelete = presets.find(p => p.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="delete-confirm-modal">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl text-left">
              <h3 className="text-sm font-black text-slate-900">আপনি কি নিশ্চিত? (Confirm Delete)</h3>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                আপনি কি নিশ্চিতভাবে <strong className="text-slate-800">"{signerToDelete?.name || 'this signer'}"</strong> কে ডাটাবেজ থেকে মুছে ফেলতে চান? এটি পুনরায় ফিরিয়ে আনা সম্ভব নয়।
              </p>
              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-slate-100 transition hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancel (বাতিল)
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(deleteConfirmId)}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 transition text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm cursor-pointer"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="clear-confirm-modal">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl text-left">
            <h3 className="text-sm font-black text-slate-900 text-rose-600">আপনি কি সম্পূর্ণ ডাটাবেজ খালি করতে চান?</h3>
            <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
              আপনি কি নিশ্চিত যে ডাটাবেজের সমস্ত অনুমোদনকারী ডিলিট করতে চান? নতুন করে নাম এন্ট্রি করার জন্য এটি সব খালি করে দেবে।
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-slate-100 transition hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Cancel (বাতিল)
              </button>
              <button
                type="button"
                onClick={confirmClearAll}
                className="flex-1 bg-rose-600 hover:bg-rose-700 transition text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm cursor-pointer"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {showSeedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="seed-confirm-modal">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl text-left">
            <h3 className="text-sm font-black text-slate-900">ডিফল্ট অনুমোদনকারী লোড করতে চান?</h3>
            <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
              এটি ডাটাবেজে ১২ জন ডিফল্ট কর্মকর্তা যুক্ত করবে যেন আপনি দ্রুত রিকুইজিশন টেস্ট করতে পারেন।
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowSeedConfirm(false)}
                className="flex-1 bg-slate-100 transition hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Cancel (বাতিল)
              </button>
              <button
                type="button"
                onClick={confirmAutoSeed}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 transition text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm cursor-pointer"
              >
                Yes, Load Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

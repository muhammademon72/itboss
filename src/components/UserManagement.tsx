import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Shield, Users, Settings, ChevronDown, ChevronUp, Lock, RefreshCw, Key, Plus, Trash2, X, Eye, EyeOff, Clock, CheckCircle2, XCircle, ShieldCheck, Copy, Check, KeyRound, User as UserIcon, Sparkles, AlertCircle } from 'lucide-react';

const LEDGERS = [
  { key: 'requisitions', label: 'Requisitions Ledger' },
  { key: 'acknowledgements', label: 'Acknowledgements Ledger' },
  { key: 'returnChallans', label: 'Return Challans Ledger' },
  { key: 'quotations', label: 'Quotations Ledger' },
  { key: 'purchaseBills', label: 'Purchase Bills Ledger' },
  { key: 'moneyReceipts', label: 'Money Receipt Generator Ledger' },
  { key: 'monitorTargets', label: 'Target Monitor Ledger' },
  { key: 'remoteCredentials', label: 'Remote Credentials' },
  { key: 'notebookLedger', label: 'Website Credentials' },
  { key: 'notesLedger', label: 'Note Book Ledger' },
  { key: 'hotspotLedger', label: 'Hotspot Information Ledger' },
  { key: 'ispInformation', label: 'ISP Information Ledger' },
  { key: 'ipPhoneLedger', label: 'IP Phone Info Ledger' },
  { key: 'simManagement', label: 'Sim Management Ledger' },
  { key: 'damagedStockProposals', label: 'Damaged Stock Disposal Proposals' },
  { key: 'servers', label: 'Server & Host Monitoring' },
  { key: 'userManagement', label: 'User Management (Admin Panel)' },
  { key: 'presetSigners', label: 'Signers Database' }
] as const;

interface UserManagementProps {
  currentUserEmail?: string;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export default function UserManagement({
  currentUserEmail = '',
  isAdmin = false,
  permissions
}: UserManagementProps = {}) {
  const isCurrentRoot = currentUserEmail === 'muhammademon72@gmail.com';
  const canEdit = isAdmin || isCurrentRoot || (permissions?.edit ?? true);
  const canDelete = isAdmin || isCurrentRoot || (permissions?.delete ?? true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [savingUserUid, setSavingUserUid] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ uid: string; email: string } | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // User Creation States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUserId, setCreateUserId] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createRole, setCreateRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Created Credentials Summary Modal
  const [createdAccountSummary, setCreatedAccountSummary] = useState<{
    userId: string;
    displayName: string;
    email: string;
    password?: string;
    role: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Password Reset Modal
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ uid: string; email: string; userId?: string } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Creation Custom Ledger Permissions
  const [customPerms, setCustomPerms] = useState<Record<string, { view: boolean; edit: boolean; delete: boolean }>>({
    requisitions: { view: false, edit: false, delete: false },
    acknowledgements: { view: false, edit: false, delete: false },
    returnChallans: { view: false, edit: false, delete: false },
    quotations: { view: false, edit: false, delete: false },
    purchaseBills: { view: false, edit: false, delete: false },
    moneyReceipts: { view: false, edit: false, delete: false },
    monitorTargets: { view: false, edit: false, delete: false },
    remoteCredentials: { view: false, edit: false, delete: false },
    notebookLedger: { view: false, edit: false, delete: false },
    notesLedger: { view: false, edit: false, delete: false },
    hotspotLedger: { view: false, edit: false, delete: false },
    ispInformation: { view: false, edit: false, delete: false },
    ipPhoneLedger: { view: false, edit: false, delete: false },
    damagedStockProposals: { view: false, edit: false, delete: false },
    servers: { view: false, edit: false, delete: false },
    userManagement: { view: false, edit: false, delete: false },
    presetSigners: { view: false, edit: false, delete: false }
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList: UserProfile[] = querySnapshot.docs
        .filter(doc => {
          const data = doc.data();
          if (doc.id === 'XfqOFo5s0heTTfENsE9LeWFNrn33' || doc.id === 'admin_admin') return false;
          if (data.email === 'admin@asrgroup.com') return false;
          return true;
        })
        .map(doc => {
        const data = doc.data();
        const defaultPerms = {
          requisitions: { view: true, edit: true, delete: true },
          acknowledgements: { view: false, edit: false, delete: false },
          returnChallans: { view: false, edit: false, delete: false },
          quotations: { view: false, edit: false, delete: false },
          purchaseBills: { view: false, edit: false, delete: false },
          moneyReceipts: { view: false, edit: false, delete: false },
          monitorTargets: { view: false, edit: false, delete: false },
          remoteCredentials: { view: false, edit: false, delete: false },
          notebookLedger: { view: false, edit: false, delete: false },
          notesLedger: { view: false, edit: false, delete: false },
          hotspotLedger: { view: false, edit: false, delete: false },
          ispInformation: { view: false, edit: false, delete: false },
          ipPhoneLedger: { view: false, edit: false, delete: false },
          damagedStockProposals: { view: false, edit: false, delete: false },
          servers: { view: false, edit: false, delete: false },
          userManagement: { view: false, edit: false, delete: false },
          presetSigners: { view: false, edit: false, delete: false }
        };
        const isRootAccount = doc.id === 'admin_root' || (data.email === 'muhammademon72@gmail.com' && data.displayName === 'Super Administrator');
        const userStatus = (isRootAccount || data.role === 'admin') ? 'approved' : (data.status || 'pending');

        return {
          uid: doc.id,
          userId: data.userId || data.username || '',
          username: data.username || data.userId || '',
          displayName: data.displayName || data.name || '',
          email: data.email || '',
          role: data.role || 'viewer',
          status: userStatus,
          permissions: data.permissions || defaultPerms,
          createdAt: data.createdAt || new Date().toISOString()
        } as UserProfile;
      });
      setUsers(usersList);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCreatePassword(pwd);
    setShowPassword(true);
  };

  const handleGenerateResetPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetPasswordValue(pwd);
    setShowResetPassword(true);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = async (uid: string, newStatus: 'approved' | 'pending' | 'rejected') => {
    setSavingUserUid(uid);
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { status: newStatus });
      
      setUsers(users.map(user => 
        user.uid === uid 
          ? { ...user, status: newStatus } 
          : user
      ));
      setStatusNotice({ type: 'success', message: 'User status successfully updated.' });
    } catch (err) {
      console.error("Error updating status:", err);
      setStatusNotice({ type: 'error', message: 'Failed to update user status.' });
    } finally {
      setSavingUserUid(null);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'viewer' | 'editor' | 'admin') => {
    setSavingUserUid(uid);
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role: newRole });
      
      setUsers(users.map(user => 
        user.uid === uid 
          ? { ...user, role: newRole } 
          : user
      ));
      setStatusNotice({ type: 'success', message: 'User role updated.' });
    } catch (err) {
      console.error("Error updating role:", err);
      setStatusNotice({ type: 'error', message: 'Failed to update user role.' });
    } finally {
      setSavingUserUid(null);
    }
  };

  const handlePermissionToggle = async (uid: string, ledgerKey: string, permType: 'view' | 'edit' | 'delete') => {
    const targetUser = users.find(u => u.uid === uid);
    if (!targetUser) return;

    const currentLedgerPerms = (targetUser.permissions && (targetUser.permissions as any)[ledgerKey]) || { view: false, edit: false, delete: false };
    const updatedPerms = {
      ...targetUser.permissions,
      [ledgerKey]: {
        ...currentLedgerPerms,
        [permType]: !currentLedgerPerms[permType]
      }
    };

    setSavingUserUid(uid);
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { permissions: updatedPerms });

      setUsers(users.map(user => 
        user.uid === uid 
          ? { ...user, permissions: updatedPerms as any } 
          : user
      ));
    } catch (err) {
      console.error("Error updating permissions:", err);
      setStatusNotice({ type: 'error', message: 'Failed to update permissions.' });
    } finally {
      setSavingUserUid(null);
    }
  };

  const handleSelectAllForLedger = async (uid: string, ledgerKey: string, enable: boolean) => {
    const targetUser = users.find(u => u.uid === uid);
    if (!targetUser) return;

    const updatedPerms = {
      ...targetUser.permissions,
      [ledgerKey]: { view: enable, edit: enable, delete: enable }
    };

    setSavingUserUid(uid);
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { permissions: updatedPerms });

      setUsers(users.map(user => 
        user.uid === uid 
          ? { ...user, permissions: updatedPerms as any } 
          : user
      ));
    } catch (err) {
      console.error("Error batch updating permissions:", err);
    } finally {
      setSavingUserUid(null);
    }
  };

  const handleModalPermissionToggle = (ledgerKey: string, permType: 'view' | 'edit' | 'delete') => {
    setCustomPerms(prev => {
      const current = prev[ledgerKey] || { view: false, edit: false, delete: false };
      return {
        ...prev,
        [ledgerKey]: {
          ...current,
          [permType]: !current[permType]
        }
      };
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUserId = createUserId.trim();
    const rawEmail = createEmail.trim().toLowerCase();
    
    if (!rawUserId && !rawEmail) {
      setCreateError('Please enter a User ID or Email address.');
      return;
    }

    // Determine final login email
    let finalEmail = rawEmail;
    if (!finalEmail) {
      const cleanId = rawUserId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      finalEmail = `${cleanId}@itmanager.local`;
    }

    if (!createPassword || createPassword.length < 6) {
      setCreateError('Password must be at least 6 characters long.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const finalPerms = createRole === 'admin' ? {
        requisitions: { view: true, edit: true, delete: true },
        acknowledgements: { view: true, edit: true, delete: true },
        returnChallans: { view: true, edit: true, delete: true },
        quotations: { view: true, edit: true, delete: true },
        purchaseBills: { view: true, edit: true, delete: true },
        moneyReceipts: { view: true, edit: true, delete: true },
        monitorTargets: { view: true, edit: true, delete: true },
        remoteCredentials: { view: true, edit: true, delete: true },
        notebookLedger: { view: true, edit: true, delete: true },
        hotspotLedger: { view: true, edit: true, delete: true },
        damagedStockProposals: { view: true, edit: true, delete: true },
        userManagement: { view: true, edit: true, delete: true },
        presetSigners: { view: true, edit: true, delete: true }
      } : customPerms;

      const { setDoc, doc: fsDoc, collection: fsCollection, getDocs: fsGetDocs } = await import('firebase/firestore');

      // Check for duplicate userId or email
      try {
        const checkSnap = await fsGetDocs(fsCollection(db, 'users'));
        const cleanUserId = rawUserId.toLowerCase();
        const cleanEmail = finalEmail.toLowerCase();
        const duplicate = checkSnap.docs.some(d => {
          const u = d.data();
          return (
            (u.userId && u.userId.toLowerCase() === cleanUserId) ||
            (u.email && u.email.toLowerCase() === cleanEmail) ||
            (d.id.toLowerCase() === cleanUserId)
          );
        });
        if (duplicate) {
          setCreateError(`A user account with User ID "${rawUserId}" or Email "${finalEmail}" already exists.`);
          setIsCreating(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Duplicate check warning:', checkErr);
      }

      let uid = '';

      // Attempt Firebase Auth creation if available
      try {
        const { getApp, initializeApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword, signOut: secondarySignOut } = await import('firebase/auth');

        let secondaryApp;
        try {
          secondaryApp = getApp('secondary_user_creator');
        } catch {
          secondaryApp = initializeApp(auth.app.options, 'secondary_user_creator');
        }
        
        const secondaryAuth = getAuth(secondaryApp);
        const credential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, createPassword);
        uid = credential.user.uid;
        await secondarySignOut(secondaryAuth);
      } catch (authErr: any) {
        console.info('Firebase Auth operation note (using resilient Firestore credentials):', authErr?.code || authErr?.message);
        // Fallback: Generate dedicated Firestore UID
        const cleanSafeId = (rawUserId || rawEmail.split('@')[0]).toLowerCase().replace(/[^a-z0-9_-]/g, '');
        uid = `usr_${cleanSafeId}_${Date.now().toString(36)}`;
      }

      // Write profile to Firestore with direct login support
      const profile: UserProfile = {
        uid,
        userId: rawUserId || rawEmail.split('@')[0],
        username: rawUserId || rawEmail.split('@')[0],
        displayName: createDisplayName.trim() || rawUserId || rawEmail.split('@')[0],
        email: finalEmail,
        password: createPassword,
        role: createRole,
        status: 'approved',
        permissions: finalPerms as any,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(fsDoc(db, 'users', uid), profile);
      
      setUsers(prev => [profile, ...prev.filter(u => u.uid !== uid)]);
      setCreatedAccountSummary({
        userId: profile.userId || '',
        displayName: profile.displayName || profile.userId || '',
        email: finalEmail,
        password: createPassword,
        role: createRole
      });

      // Reset form
      setCreateUserId('');
      setCreateDisplayName('');
      setCreateEmail('');
      setCreatePassword('');
      setShowCreateModal(false);
    } catch (err: any) {
      console.error('Error creating user: ', err);
      setCreateError(err?.message || 'Failed to create user account. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting to reset password for:", resetPasswordTarget);
    if (!resetPasswordTarget || !resetPasswordValue || resetPasswordValue.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const userRef = doc(db, 'users', resetPasswordTarget.uid);
      console.log("Updating document in Firestore...");
      await updateDoc(userRef, {
        password: resetPasswordValue,
        updatedAt: new Date().toISOString()
      });
      console.log("Document updated successfully");

      setUsers(prev => prev.map(u => 
        u.uid === resetPasswordTarget.uid ? { ...u, password: resetPasswordValue } : u
      ));

      setStatusNotice({
        type: 'success',
        message: `Password updated for ${resetPasswordTarget.userId || resetPasswordTarget.email}. New credentials are active.`
      });
      setResetPasswordTarget(null);
      setResetPasswordValue('');
      setShowResetPassword(false);
    } catch (err) {
      console.error('Password reset failed:', err);
      alert('Failed to update password. Check console for details.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const executeDeleteUserProfile = async (uid: string, email: string) => {
    const isSystemRoot = uid === 'admin_root';
    if (isSystemRoot) {
      setStatusNotice({ type: 'error', message: "Cannot delete the primary root administrator account." });
      return;
    }

    setSavingUserUid(uid);
    setStatusNotice(null);
    try {
      await deleteDoc(doc(db, 'users', uid));

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const preDocId = 'pre_' + cleanEmail;
        if (preDocId !== uid) {
          try {
            await deleteDoc(doc(db, 'users', preDocId));
          } catch (_) {
            // ignore if not present
          }
        }

        try {
          const querySnapshot = await getDocs(collection(db, 'users'));
          for (const uDoc of querySnapshot.docs) {
            const uData = uDoc.data();
            if (uData?.email && uData.email.trim().toLowerCase() === cleanEmail) {
              await deleteDoc(doc(db, 'users', uDoc.id));
            }
          }
        } catch (e) {
          console.warn("Clean sweep warning:", e);
        }
      }

      setUsers(prev => prev.filter(u => u.uid !== uid && u.email.trim().toLowerCase() !== email.trim().toLowerCase()));
      if (expandedUser === uid) {
        setExpandedUser(null);
      }
      setStatusNotice({ type: 'success', message: `User account "${email}" was deleted successfully.` });
    } catch (err: any) {
      console.error("Error deleting user profile: ", err);
      setStatusNotice({ type: 'error', message: `Failed to delete user profile: ${err?.message || 'Permission denied or network error'}` });
    } finally {
      setSavingUserUid(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-semibold font-mono uppercase tracking-wider">Syncing User Directory...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            User Management & Access Control
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage authorized portal users, assign overall roles, and customize granular ledger permissions (ABAC).
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add New User
            </button>
          )}
          
          <button
            onClick={fetchUsers}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 text-xs font-bold rounded-lg border border-slate-300 shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Directory
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusNotice && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
          statusNotice.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            {statusNotice.type === 'success' ? (
              <span className="p-1 bg-emerald-100 rounded-full text-emerald-700">✓</span>
            ) : (
              <span className="p-1 bg-rose-100 rounded-full text-rose-700">✕</span>
            )}
            <span>{statusNotice.message}</span>
          </div>
          <button 
            onClick={() => setStatusNotice(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {(() => {
        const pendingUsers = users.filter(u => u.status === 'pending');
        if (pendingUsers.length === 0) return null;
        return (
          <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                    <span>Pending Gmail Access Requests</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-black">
                      {pendingUsers.length}
                    </span>
                  </h2>
                  <p className="text-xs text-amber-800/90 mt-0.5">
                    The following users signed in via Google and are awaiting Super Admin live access privilege approval.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingUsers.map(pUser => (
                <div key={pUser.uid} className="bg-white border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span className="text-xs font-bold text-slate-900 truncate">{pUser.email}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Requested: {pUser.createdAt ? new Date(pUser.createdAt).toLocaleDateString() : 'Just now'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleStatusChange(pUser.uid, 'approved')}
                      disabled={savingUserUid === pUser.uid || !canEdit}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve Access
                    </button>
                    <button
                      onClick={() => handleStatusChange(pUser.uid, 'rejected')}
                      disabled={savingUserUid === pUser.uid || !canEdit}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setDeleteConfirmTarget({ uid: pUser.uid, email: pUser.email })}
                      disabled={savingUserUid === pUser.uid || !canDelete}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition cursor-pointer disabled:opacity-50"
                      title="Delete Access Request"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Main Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">User Account / ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Global Role</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Access Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Permissions</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isExpanded = expandedUser === user.uid;
                const isSystemRoot = user.uid === 'admin_root';
                const hasCustomPermissions = user.permissions && Object.values(user.permissions).some((p: any) => p.view || p.edit || p.delete);

                return (
                  <tr key={user.uid} className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-indigo-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
                          isSystemRoot ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {(user.displayName || user.userId || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {user.displayName || user.userId || user.email}
                            </span>
                            {user.userId && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                ID: {user.userId}
                              </span>
                            )}
                            {isSystemRoot && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                                ROOT
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          disabled={!canEdit || isSystemRoot || savingUserUid === user.uid}
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.uid, e.target.value as any)}
                          className="text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          <option value="admin">Administrator</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {user.role === 'admin' && <Shield className="h-4 w-4 text-indigo-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        disabled={!canEdit || isSystemRoot || savingUserUid === user.uid}
                        value={user.status || 'pending'}
                        onChange={(e) => handleStatusChange(user.uid, e.target.value as any)}
                        className={`text-xs font-bold rounded-lg px-2.5 py-1 outline-none border cursor-pointer transition disabled:opacity-70 ${
                          user.status === 'approved' || isSystemRoot
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : user.status === 'rejected'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200 font-extrabold'
                        }`}
                      >
                        <option value="approved">🟢 Approved</option>
                        <option value="pending">⏳ Pending</option>
                        <option value="rejected">🔴 Revoked</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          user.role === 'admin' || isSystemRoot
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            : hasCustomPermissions
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {user.role === 'admin' || isSystemRoot ? (
                            <>
                              <Shield className="h-3 w-3" /> Full System Privileges
                            </>
                          ) : hasCustomPermissions ? (
                            <>
                              <Key className="h-3 w-3" /> Custom Ledger Access
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" /> Read Only
                            </>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Password Reset Button */}
                        {!isSystemRoot && canEdit && (
                          <button
                            onClick={() => {
                              setResetPasswordTarget({ uid: user.uid, email: user.email, userId: user.userId });
                              setResetPasswordValue('');
                              setShowResetPassword(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                            title="Reset User Password"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Password</span>
                          </button>
                        )}
                        {/* Always show for Super Admin ROOT account if needed */}
                        {isSystemRoot && canEdit && (
                          <button
                            onClick={() => {
                              setResetPasswordTarget({ uid: user.uid, email: user.email, userId: user.userId });
                              setResetPasswordValue('');
                              setShowResetPassword(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                            title="Reset Root Password"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Password</span>
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : user.uid)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            isExpanded 
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
                          }`}
                        >
                          <Settings className="h-3.5 w-3.5" />
                          <span>Permissions</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>

                        {!isSystemRoot && canDelete && (
                          <button
                            onClick={() => setDeleteConfirmTarget({ uid: user.uid, email: user.email })}
                            disabled={savingUserUid === user.uid}
                            className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition cursor-pointer shadow-2xs disabled:opacity-50"
                            title="Delete User Profile"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Permissions Panel */}
      {expandedUser && (() => {
        const user = users.find(u => u.uid === expandedUser);
        if (!user) return null;
        
        const isSystemRoot = user.uid === 'admin_root';
        const isUserAdmin = user.role === 'admin' || isSystemRoot;

        return (
          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-md animate-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Custom Permissions Workspace: {user.displayName || user.userId || user.email}</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Toggle reading, creation, modification and removal policies for each distinct ledger.</p>
                </div>
              </div>
              
              {savingUserUid === user.uid && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold font-mono uppercase tracking-wider">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Auto-Saving to Cloud...
                </div>
              )}
            </div>

            {isUserAdmin ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
                <Shield className="h-5 w-5 text-indigo-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-extrabold text-indigo-900">Full Access Enforced by Administrator Role</p>
                  <p className="text-indigo-700/80 font-medium mt-0.5">
                    This account is an Administrator or Root account, which globally overrides all granular ledger permission rules to grant complete read/write/delete permissions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {LEDGERS.map((ledger) => {
                  const perms = user.permissions?.[ledger.key] || { view: false, edit: false, delete: false };
                  
                  return (
                    <div key={ledger.key} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                        <span className="text-xs font-black text-slate-800">{ledger.label}</span>
                        <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest">
                          LEDGER MODULE
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-150">
                        {/* VIEW */}
                        <label className="flex-1 flex flex-col items-center justify-center p-2 rounded-md hover:bg-slate-50 cursor-pointer transition select-none">
                          <input
                            type="checkbox"
                            checked={perms.view}
                            onChange={() => handlePermissionToggle(user.uid, ledger.key, 'view')}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-opacity-25"
                          />
                          <span className="text-[10px] font-black text-slate-700 mt-1.5 uppercase">VIEW</span>
                          <span className="text-[8px] text-slate-400 font-semibold mt-0.5">Read ledger</span>
                        </label>

                        {/* EDIT */}
                        <label className="flex-1 flex flex-col items-center justify-center p-2 rounded-md hover:bg-slate-50 cursor-pointer transition select-none">
                          <input
                            type="checkbox"
                            checked={perms.edit}
                            onChange={() => handlePermissionToggle(user.uid, ledger.key, 'edit')}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-opacity-25"
                          />
                          <span className="text-[10px] font-black text-slate-700 mt-1.5 uppercase">EDIT</span>
                          <span className="text-[8px] text-slate-400 font-semibold mt-0.5">Add / Update</span>
                        </label>

                        {/* DELETE */}
                        <label className="flex-1 flex flex-col items-center justify-center p-2 rounded-md hover:bg-slate-50 cursor-pointer transition select-none">
                          <input
                            type="checkbox"
                            checked={perms.delete}
                            onChange={() => handlePermissionToggle(user.uid, ledger.key, 'delete')}
                            className="w-4 h-4 text-rose-500 border-slate-300 rounded focus:ring-rose-500 focus:ring-opacity-25"
                          />
                          <span className="text-[10px] font-black text-rose-650 mt-1.5 uppercase">DELETE</span>
                          <span className="text-[8px] text-slate-400 font-semibold mt-0.5">Remove logs</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* CREATE NEW USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Create Staff User Account</h2>
                  <p className="text-[10px] text-slate-500 font-medium">Assign User ID, password, and portal permissions for staff members.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-full transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-6 space-y-5">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-750 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0"></span>
                  {createError}
                </div>
              )}

              {/* User ID & Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 tracking-wide uppercase flex items-center justify-between">
                    <span>User ID / Username *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createUserId}
                    onChange={(e) => setCreateUserId(e.target.value)}
                    placeholder="e.g. IT-101 or emon_admin"
                    className="w-full text-xs font-bold px-3 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 tracking-wide uppercase">Staff Full Name</label>
                  <input
                    type="text"
                    value={createDisplayName}
                    onChange={(e) => setCreateDisplayName(e.target.value)}
                    placeholder="e.g. Muhammad Emon"
                    className="w-full text-xs font-bold px-3 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Email & Role Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 tracking-wide uppercase">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder={createUserId ? `${createUserId.toLowerCase().replace(/[^a-z0-9_-]/g, '')}@itmanager.local` : 'employee@asrgroup.com'}
                    className="w-full text-xs font-bold px-3 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 tracking-wide uppercase">Global User Role</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as any)}
                    className="w-full text-xs font-bold px-3 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="viewer">Viewer (Read-only by default)</option>
                    <option value="editor">Editor (Author/Contributor)</option>
                    <option value="admin">Administrator (Full global privileges)</option>
                  </select>
                </div>
              </div>

              {/* Password Setup */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 tracking-wide uppercase">Portal Login Password *</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full text-xs font-mono font-bold px-3 pr-10 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Granular Ledger Permission setup (Only for Editor/Viewer) */}
              {createRole !== 'admin' && (
                <div className="space-y-3.5 border-t border-slate-100 pt-4">
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 tracking-wide uppercase">Granular Access Permissions</label>
                    <p className="text-[10px] text-slate-400 font-semibold">Assign permissions for each distinct business document ledger.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {LEDGERS.map((ledger) => {
                      const perms = customPerms[ledger.key] || { view: false, edit: false, delete: false };
                      return (
                        <div key={ledger.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                          <span className="text-[11px] font-bold text-slate-700 border-b border-slate-250 pb-1 mb-2">{ledger.label}</span>
                          <div className="flex items-center justify-between gap-1.5 bg-white p-1.5 rounded-lg border border-slate-150">
                            
                            <label className="flex-1 flex flex-col items-center justify-center p-1 rounded-md hover:bg-slate-50 cursor-pointer transition select-none">
                              <input
                                type="checkbox"
                                checked={perms.view}
                                onChange={() => handleModalPermissionToggle(ledger.key, 'view')}
                                className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded"
                              />
                              <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase">View</span>
                            </label>

                            <label className="flex-1 flex flex-col items-center justify-center p-1 rounded-md hover:bg-slate-50 cursor-pointer transition select-none">
                              <input
                                type="checkbox"
                                checked={perms.edit}
                                onChange={() => handleModalPermissionToggle(ledger.key, 'edit')}
                                className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded"
                              />
                              <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase">Edit</span>
                            </label>

                            <label className="flex-1 flex flex-col items-center justify-center p-1 rounded-md hover:bg-slate-50 cursor-pointer transition select-none">
                              <input
                                type="checkbox"
                                checked={perms.delete}
                                onChange={() => handleModalPermissionToggle(ledger.key, 'delete')}
                                className="w-3.5 h-3.5 text-rose-500 border-slate-300 rounded"
                              />
                              <span className="text-[9px] font-bold text-rose-650 mt-1 uppercase">Del</span>
                            </label>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin Warning Callout */}
              {createRole === 'admin' && (
                <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[10px]">
                    <p className="font-extrabold text-amber-900">Elevated Administrator Authorization</p>
                    <p className="text-amber-700 mt-0.5 leading-normal">
                      The Administrator role bypasses all granular permissions checks to grant full read, write, update, and delete access globally across every ledger module.
                    </p>
                  </div>
                </div>
              )}

              {/* Modal Footer / Form Actions */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 bg-white">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:bg-indigo-400"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Create User Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATED ACCOUNT CREDENTIALS SUMMARY MODAL */}
      {createdAccountSummary && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <div className="p-3 bg-emerald-100 rounded-2xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">User Account Created!</h3>
                <p className="text-xs text-slate-500 font-medium">Please copy these credentials and share them with the user.</p>
              </div>
            </div>

            <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
              {/* User ID */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">User ID / Username:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {createdAccountSummary.userId}
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdAccountSummary.userId, 'uid')}
                    className="text-slate-400 hover:text-indigo-600 cursor-pointer p-1"
                    title="Copy User ID"
                  >
                    {copiedField === 'uid' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Full Name */}
              {createdAccountSummary.displayName && (
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-[11px] font-bold text-slate-500">Full Name:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {createdAccountSummary.displayName}
                  </span>
                </div>
              )}

              {/* Email */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-[11px] font-bold text-slate-500">Login Email:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {createdAccountSummary.email}
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdAccountSummary.email, 'email')}
                    className="text-slate-400 hover:text-indigo-600 cursor-pointer p-1"
                    title="Copy Email"
                  >
                    {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Password */}
              {createdAccountSummary.password && (
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-[11px] font-bold text-slate-500">Password:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {createdAccountSummary.password}
                    </span>
                    <button
                      onClick={() => copyToClipboard(createdAccountSummary.password || '', 'pwd')}
                      className="text-slate-400 hover:text-indigo-600 cursor-pointer p-1"
                      title="Copy Password"
                    >
                      {copiedField === 'pwd' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Role */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-[11px] font-bold text-slate-500">Assigned Role:</span>
                <span className="text-xs font-bold uppercase text-indigo-600">
                  {createdAccountSummary.role}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const info = `IT MANAGER PORTAL CREDENTIALS:\nUser ID: ${createdAccountSummary.userId}\nEmail: ${createdAccountSummary.email}\nPassword: ${createdAccountSummary.password || 'N/A'}\nRole: ${createdAccountSummary.role}`;
                  copyToClipboard(info, 'all');
                }}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Copied All!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy All Details</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCreatedAccountSummary(null)}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordTarget && (
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-indigo-600 mb-3">
              <div className="p-3 bg-indigo-100 rounded-2xl">
                <KeyRound className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Set New Password</h3>
                <p className="text-xs text-slate-500 font-medium">User: {resetPasswordTarget.userId || resetPasswordTarget.email}</p>
              </div>
            </div>

            <form onSubmit={handleExecuteResetPassword} className="space-y-4 my-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-slate-800 tracking-wide uppercase">New Password</label>
                  <button
                    type="button"
                    onClick={handleGenerateResetPassword}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    required
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    className="w-full text-xs font-mono font-bold px-3 pr-10 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isResettingPassword ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-3 bg-rose-100 rounded-full">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete User Account?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Are you sure you want to delete user profile for <strong className="text-slate-900">{deleteConfirmTarget.email}</strong>? This will immediately revoke all portal access rights and remove their record from the database.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = deleteConfirmTarget;
                  setDeleteConfirmTarget(null);
                  executeDeleteUserProfile(target.uid, target.email);
                }}
                disabled={savingUserUid === deleteConfirmTarget.uid}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingUserUid === deleteConfirmTarget.uid ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Yes, Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

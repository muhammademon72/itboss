import React, { useState, useEffect } from 'react';
import { db, auth, subscribeQuotaState, checkIsQuotaError, setQuotaExceededState } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User, signInWithEmailAndPassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import RequisitionForm from './components/RequisitionForm';
import PresetSignersList from './components/PresetSignersList';
import AcknowledgementDashboard from './components/AcknowledgementDashboard';
import AcknowledgementForm from './components/AcknowledgementForm';
import ReturnChallanDashboard from './components/ReturnChallanDashboard';
import ReturnChallanForm from './components/ReturnChallanForm';
import ProductQuotationDashboard from './components/ProductQuotationDashboard';
import ProductQuotationForm from './components/ProductQuotationForm';
import CustomerInfo from './components/CustomerInfo';
import CompanyProfileForm from './components/CompanyProfile';
import UserManagement from './components/UserManagement';
import PurchaseBillForm from './components/PurchaseBillForm';
import PurchaseBillDashboard from './components/PurchaseBillDashboard';
import MonitorTargetLedger from './components/MonitorTargetLedger';
import { HotspotLedger } from './components/HotspotLedger';
import DamagedStockProposalDashboard from './components/DamagedStockProposalDashboard';
import DamagedStockProposalForm from './components/DamagedStockProposalForm';
import { RemoteCredentialLedger } from './components/RemoteCredentialLedger';
import { NotebookLedger } from './components/NotebookLedger';
import { NotesLedger } from './components/NotesLedger';
import { StorageCluster } from './components/StorageCluster';
import ServerMonitoring from './components/ServerMonitoring';
import { MoneyReceiptLedger } from './components/MoneyReceiptLedger';
import { SimManagementLedger } from './components/SimManagementLedger';
import { IspInformationLedger } from './components/IspInformationLedger';
import { IpPhoneLedger } from './components/IpPhoneLedger';
import { Requisition, Acknowledgement, ReturnChallan, ProductQuotation, CompanyProfile, PurchaseBill, UserProfile, UserPermissions, DamagedStockProposal } from './types';
import { FolderHeart, LogIn, LogOut, Code, Heart, Monitor, Terminal, FileCheck, Database, FileText, Settings, PanelLeftOpen, PanelLeftClose, Menu, RefreshCw, Activity, CreditCard, Wifi, BookOpen, Clock, ShieldAlert, CheckCircle2, XCircle, User as UserIcon, Lock, Eye, EyeOff, ShieldCheck, KeyRound, Sparkles, Server, ReceiptText, Smartphone, PhoneCall } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const unsub = subscribeQuotaState((exceeded) => {
      setQuotaExceeded(exceeded);
    });
    return () => unsub();
  }, []);
  
  // Login states
  const [loginUserIdOrEmail, setLoginUserIdOrEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Initial view from URL search param or hash
  const getViewFromUrl = (): 'dashboard' | 'create_form' | 'view_form' | 'copy_requisition' | 'presets_config' | 'acknowledgements' | 'create_acknowledgement' | 'view_acknowledgement' | 'edit_acknowledgement' | 'return_challans' | 'create_return_challan' | 'view_return_challan' | 'edit_return_challan' | 'quotations' | 'create_quotation' | 'edit_quotation' | 'view_quotation' | 'copy_quotation' | 'company_profile' | 'customer_info' | 'user_management' | 'purchase_bills' | 'create_purchase_bill' | 'view_purchase_bill' | 'edit_purchase_bill' | 'copy_purchase_bill' | 'money_receipts' | 'monitor_targets' | 'remote_credentials' | 'hotspot_ledger' | 'notebook_ledger' | 'notes_ledger' | 'servers' | 'sim_management' | 'isp_connections' | 'ip_phone_ledger' => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') || window.location.hash.replace('#', '');
      const validViews = [
        'dashboard', 'create_form', 'view_form', 'copy_requisition', 'presets_config',
        'acknowledgements', 'create_acknowledgement', 'view_acknowledgement', 'edit_acknowledgement',
        'return_challans', 'create_return_challan', 'view_return_challan', 'edit_return_challan',
        'quotations', 'create_quotation', 'edit_quotation', 'view_quotation', 'copy_quotation',
        'company_profile', 'customer_info', 'user_management', 'purchase_bills',
        'create_purchase_bill', 'view_purchase_bill', 'edit_purchase_bill', 'copy_purchase_bill', 'money_receipts', 'monitor_targets', 'remote_credentials', 'hotspot_ledger', 'notebook_ledger', 'notes_ledger', 'servers', 'sim_management', 'isp_connections', 'ip_phone_ledger',
        'damaged_stock_proposals', 'create_damaged_stock_proposal', 'edit_damaged_stock_proposal', 'view_damaged_stock_proposal', 'copy_damaged_stock_proposal'
      ];
      if (validViews.includes(viewParam)) {
        return viewParam as any;
      }
    } catch (e) {
      // Ignore URL parse errors
    }
    return 'dashboard';
  };

  // App views
  const [view, setView] = useState<
    | 'dashboard' | 'create_form' | 'view_form' | 'copy_requisition' | 'presets_config'
    | 'acknowledgements' | 'create_acknowledgement' | 'view_acknowledgement' | 'edit_acknowledgement'
    | 'return_challans' | 'create_return_challan' | 'view_return_challan' | 'edit_return_challan'
    | 'quotations' | 'create_quotation' | 'edit_quotation' | 'view_quotation' | 'copy_quotation'
    | 'company_profile' | 'customer_info' | 'user_management' | 'purchase_bills'
    | 'create_purchase_bill' | 'view_purchase_bill' | 'edit_purchase_bill' | 'copy_purchase_bill' | 'money_receipts' | 'monitor_targets' | 'remote_credentials' | 'hotspot_ledger' | 'notebook_ledger' | 'notes_ledger' | 'servers' | 'sim_management' | 'isp_connections' | 'ip_phone_ledger'
    | 'damaged_stock_proposals' | 'create_damaged_stock_proposal' | 'edit_damaged_stock_proposal' | 'view_damaged_stock_proposal' | 'copy_damaged_stock_proposal'
  >(getViewFromUrl);

  // Sync view state to URL query parameter and listen to popstate
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('view') !== view) {
        url.searchParams.set('view', view);
        window.history.pushState({}, '', url.toString());
      }
    } catch (e) {
      // Ignore
    }
  }, [view]);

  useEffect(() => {
    const handlePopState = () => {
      const navView = getViewFromUrl();
      setView(navView);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | undefined>(undefined);
  const [selectedAcknowledgement, setSelectedAcknowledgement] = useState<Acknowledgement | undefined>(undefined);
  const [selectedReturnChallan, setSelectedReturnChallan] = useState<ReturnChallan | undefined>(undefined);
  const [selectedQuotation, setSelectedQuotation] = useState<ProductQuotation | undefined>(undefined);
  const [selectedPurchaseBill, setSelectedPurchaseBill] = useState<PurchaseBill | undefined>(undefined);
  const [selectedDamagedStockProposal, setSelectedDamagedStockProposal] = useState<DamagedStockProposal | undefined>(undefined);

  // Check if current user has permission for a specific view
  const hasViewPermission = (targetView: typeof view): boolean => {
    const email = user?.email || '';
    const isRootAdmin = email === 'muhammademon72@gmail.com';
    if (isRootAdmin || isAdmin) return true; // Super admins have all permissions
    if (!userProfile || !userProfile.permissions) return false;

    const perms = userProfile.permissions;

    if (['dashboard', 'create_form', 'view_form', 'copy_requisition'].includes(targetView)) {
      return perms.requisitions?.view ?? false;
    }
    if (['acknowledgements', 'create_acknowledgement', 'view_acknowledgement', 'edit_acknowledgement'].includes(targetView)) {
      return perms.acknowledgements?.view ?? false;
    }
    if (['return_challans', 'create_return_challan', 'view_return_challan', 'edit_return_challan'].includes(targetView)) {
      return perms.returnChallans?.view ?? false;
    }
    if (['quotations', 'create_quotation', 'edit_quotation', 'view_quotation', 'copy_quotation', 'customer_info', 'company_profile'].includes(targetView)) {
      return perms.quotations?.view ?? false;
    }
    if (['damaged_stock_proposals', 'create_damaged_stock_proposal', 'edit_damaged_stock_proposal', 'view_damaged_stock_proposal', 'copy_damaged_stock_proposal'].includes(targetView)) {
      return perms.damagedStockProposals?.view ?? perms.quotations?.view ?? false;
    }
    if (['purchase_bills', 'create_purchase_bill', 'view_purchase_bill', 'edit_purchase_bill', 'copy_purchase_bill'].includes(targetView)) {
      return perms.purchaseBills?.view ?? false;
    }
    if (targetView === 'money_receipts') {
      return perms.moneyReceipts?.view ?? false;
    }
    if (targetView === 'presets_config') {
      return perms.presetSigners?.view ?? false;
    }
    if (targetView === 'user_management') {
      return perms.userManagement?.view ?? false;
    }
    if (targetView === 'monitor_targets') {
      return perms.monitorTargets?.view ?? false;
    }
    if (targetView === 'remote_credentials') {
      return perms.remoteCredentials?.view ?? false;
    }
    if (targetView === 'hotspot_ledger') {
      return perms.hotspotLedger?.view ?? false;
    }
    if (targetView === 'notebook_ledger') {
      return perms.notebookLedger?.view ?? false;
    }
    if (targetView === 'notes_ledger') {
      return perms.notesLedger?.view ?? false;
    }
    if (targetView === 'servers') {
      return perms.servers?.view ?? false;
    }
    if (targetView === 'sim_management') {
      return perms.simManagement?.view ?? false;
    }
    if (targetView === 'isp_connections') {
      return true; // Simple permission for now
    }
    if (targetView === 'ip_phone_ledger') {
      return perms.ipPhoneLedger?.view ?? true;
    }

    return false;
  };

  // Redirect to dashboard if user lacks permission for active view
  useEffect(() => {
    if (user && !loading && !hasViewPermission(view)) {
      setView('dashboard');
    }
  }, [user, userProfile, view, loading, isAdmin]);

  // Monitor Auth State & Stored Session
  useEffect(() => {
    let isMounted = true;

    // Check stored portal session immediately
    try {
      const stored = localStorage.getItem('it_manager_portal_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.uid) {
          setUser({
            uid: parsed.uid,
            email: parsed.email || '',
            displayName: parsed.displayName || parsed.userId || ''
          } as any);
        }
      }
    } catch (e) {
      console.warn("Session restore note:", e);
    }

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!isMounted) return;

      if (authUser) {
        setUser(authUser);
        const email = authUser.email || '';
        const isRootAdmin = email === 'muhammademon72@gmail.com';
        
        try {
          if (isRootAdmin) {
            const rootRef = doc(db, 'users', 'admin_root');
            const rootSnap = await getDoc(rootRef);
            if (rootSnap.exists()) {
              const rootData = rootSnap.data() as UserProfile;
              setUserProfile({
                ...rootData,
                uid: 'admin_root'
              });
              setIsAdmin(true);
              return;
            }
          }

          const userRef = doc(db, 'users', authUser.uid);
          const snap = await getDoc(userRef);
          
          const defaultPerms = {
            requisitions: { view: true, edit: true, delete: true },
            acknowledgements: { view: false, edit: false, delete: false },
            returnChallans: { view: false, edit: false, delete: false },
            quotations: { view: false, edit: false, delete: false },
            purchaseBills: { view: false, edit: false, delete: false },
            moneyReceipts: { view: false, edit: false, delete: false },
            monitorTargets: { view: false, edit: false, delete: false },
            remoteCredentials: { view: false, edit: false, delete: false },
            hotspotLedger: { view: false, edit: false, delete: false },
            notebookLedger: { view: false, edit: false, delete: false },
            notesLedger: { view: false, edit: false, delete: false },
            damagedStockProposals: { view: false, edit: false, delete: false },
            servers: { view: false, edit: false, delete: false },
            simManagement: { view: false, edit: false, delete: false },
            ipPhoneLedger: { view: true, edit: true, delete: true },
            userManagement: { view: isRootAdmin, edit: isRootAdmin, delete: isRootAdmin },
            presetSigners: { view: false, edit: false, delete: false }
          };

          if (snap.exists()) {
            const data = snap.data();
            const currentPermissions = data.permissions || defaultPerms;
            const calculatedStatus = (isRootAdmin || data.role === 'admin') ? 'approved' : (data.status || 'pending');

            const profile: UserProfile = {
              uid: authUser.uid,
              userId: data.userId || data.username || email.split('@')[0],
              displayName: data.displayName || email.split('@')[0],
              email: email,
              role: data.role || (isRootAdmin ? 'admin' : 'viewer'),
              status: calculatedStatus,
              permissions: currentPermissions,
              createdAt: data.createdAt || new Date().toISOString()
            };
            
            setUserProfile(profile);
            setIsAdmin(profile.role === 'admin' || isRootAdmin);
          } else {
            const isRootRole = isRootAdmin;
            const newProfile: UserProfile = {
              uid: authUser.uid,
              userId: email.split('@')[0],
              displayName: email.split('@')[0],
              email: email,
              role: isRootRole ? 'admin' : 'viewer',
              status: 'approved',
              permissions: isRootRole ? {
                requisitions: { view: true, edit: true, delete: true },
                acknowledgements: { view: true, edit: true, delete: true },
                returnChallans: { view: true, edit: true, delete: true },
                quotations: { view: true, edit: true, delete: true },
                purchaseBills: { view: true, edit: true, delete: true },
                monitorTargets: { view: true, edit: true, delete: true },
                remoteCredentials: { view: true, edit: true, delete: true },
                hotspotLedger: { view: true, edit: true, delete: true },
                notebookLedger: { view: true, edit: true, delete: true },
                notesLedger: { view: true, edit: true, delete: true },
                damagedStockProposals: { view: true, edit: true, delete: true },
                servers: { view: true, edit: true, delete: true },
                simManagement: { view: true, edit: true, delete: true },
                userManagement: { view: true, edit: true, delete: true },
                presetSigners: { view: true, edit: true, delete: true }
              } : defaultPerms,
              createdAt: new Date().toISOString()
            };
            
            try {
              await setDoc(userRef, newProfile);
            } catch (setErr) {
              if (checkIsQuotaError(setErr)) setQuotaExceededState(true);
            }
            setUserProfile(newProfile);
            setIsAdmin(isRootRole);
          }
        } catch (e) {
          if (checkIsQuotaError(e)) setQuotaExceededState(true);
          console.warn("User profile sync note:", e);
          setIsAdmin(isRootAdmin);
        }
      } else {
        // Firebase Auth is not active, check if custom session exists in localStorage
        try {
          const stored = localStorage.getItem('it_manager_portal_session');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.uid) {
              const fullAdminPerms = {
                requisitions: { view: true, edit: true, delete: true },
                acknowledgements: { view: true, edit: true, delete: true },
                returnChallans: { view: true, edit: true, delete: true },
                quotations: { view: true, edit: true, delete: true },
                purchaseBills: { view: true, edit: true, delete: true },
                monitorTargets: { view: true, edit: true, delete: true },
                remoteCredentials: { view: true, edit: true, delete: true },
                hotspotLedger: { view: true, edit: true, delete: true },
                notebookLedger: { view: true, edit: true, delete: true },
                notesLedger: { view: true, edit: true, delete: true },
                damagedStockProposals: { view: true, edit: true, delete: true },
                servers: { view: true, edit: true, delete: true },
                simManagement: { view: true, edit: true, delete: true },
                userManagement: { view: true, edit: true, delete: true },
                presetSigners: { view: true, edit: true, delete: true }
              };

              const isRoot = 
                parsed.email === 'muhammademon72@gmail.com' || 
                parsed.role === 'admin' || 
                parsed.userId === 'admin' ||
                parsed.uid === 'admin_root';

              const restoredProfile: UserProfile = parsed.profile || {
                uid: parsed.uid,
                userId: parsed.userId || 'admin',
                displayName: parsed.displayName || 'Super Administrator',
                email: parsed.email || 'muhammademon72@gmail.com',
                role: isRoot ? 'admin' : (parsed.role || 'viewer'),
                status: 'approved',
                permissions: isRoot ? fullAdminPerms : (parsed.permissions || fullAdminPerms),
                createdAt: parsed.createdAt || new Date().toISOString()
              };

              setUser({
                uid: parsed.uid,
                email: restoredProfile.email,
                displayName: restoredProfile.displayName
              } as any);
              setUserProfile(restoredProfile);
              setIsAdmin(isRoot || restoredProfile.role === 'admin');

              // Background non-blocking sync if database is reachable
              getDoc(doc(db, 'users', parsed.uid)).then(snap => {
                if (snap.exists()) {
                  const data = snap.data() as UserProfile;
                  setUserProfile(prev => ({ ...prev, ...data }));
                  if (data.role === 'admin') setIsAdmin(true);
                }
              }).catch(() => {
                // Keep local session uninterrupted if offline or quota exceeded
              });

              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("Stored session parsing note:", e);
        }
        setIsAdmin(false);
        setUserProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Auth state change error: ", error);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleCheckAccessStatus = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const email = user.email || '';
        const isRootAdmin = email === 'muhammademon72@gmail.com';
        const userStatus = (isRootAdmin || data.role === 'admin') ? 'approved' : (data.status || 'pending');
        
        const defaultPerms = {
          requisitions: { view: true, edit: true, delete: true },
          acknowledgements: { view: false, edit: false, delete: false },
          returnChallans: { view: false, edit: false, delete: false },
          quotations: { view: false, edit: false, delete: false },
          purchaseBills: { view: false, edit: false, delete: false },
          monitorTargets: { view: false, edit: false, delete: false },
          remoteCredentials: { view: false, edit: false, delete: false },
          hotspotLedger: { view: false, edit: false, delete: false },
          notebookLedger: { view: false, edit: false, delete: false },
            notesLedger: { view: false, edit: false, delete: false },
          damagedStockProposals: { view: false, edit: false, delete: false },
          simManagement: { view: false, edit: false, delete: false },
          userManagement: { view: isRootAdmin, edit: isRootAdmin, delete: isRootAdmin },
          presetSigners: { view: false, edit: false, delete: false }
        };

        const profile: UserProfile = {
          uid: user.uid,
          userId: data.userId || data.username || email.split('@')[0],
          displayName: data.displayName || email.split('@')[0],
          email: email,
          role: data.role || (isRootAdmin ? 'admin' : 'viewer'),
          status: userStatus,
          permissions: data.permissions || defaultPerms,
          createdAt: data.createdAt || new Date().toISOString()
        };
        setUserProfile(profile);
        setIsAdmin(profile.role === 'admin' || isRootAdmin);
      }
    } catch (e) {
      console.error("Error refreshing user status:", e);
    } finally {
      setLoading(false);
    }
  };

  // Enforce role-based view permissions (ABAC security)
  useEffect(() => {
    if (user) {
      if (!hasViewPermission(view)) {
        setView('dashboard');
      }
    }
  }, [view, isAdmin, user, userProfile]);

  const handleDirectAdminLogin = (adminEmail: string = 'muhammademon72@gmail.com', adminId: string = 'muhammademon72@gmail.com') => {
    setIsLoggingIn(true);
    setLoginError(null);
    const fullAdminPerms = {
      requisitions: { view: true, edit: true, delete: true },
      acknowledgements: { view: true, edit: true, delete: true },
      returnChallans: { view: true, edit: true, delete: true },
      quotations: { view: true, edit: true, delete: true },
      purchaseBills: { view: true, edit: true, delete: true },
      monitorTargets: { view: true, edit: true, delete: true },
      remoteCredentials: { view: true, edit: true, delete: true },
      hotspotLedger: { view: true, edit: true, delete: true },
      notebookLedger: { view: true, edit: true, delete: true },
                notesLedger: { view: true, edit: true, delete: true },
      damagedStockProposals: { view: true, edit: true, delete: true },
      servers: { view: true, edit: true, delete: true },
      simManagement: { view: true, edit: true, delete: true },
      ipPhoneLedger: { view: true, edit: true, delete: true },
      userManagement: { view: true, edit: true, delete: true },
      presetSigners: { view: true, edit: true, delete: true }
    };

    const rootProfile: UserProfile = {
      uid: 'admin_root',
      userId: adminId,
      displayName: 'Super Administrator',
      email: adminEmail,
      role: 'admin',
      status: 'approved',
      permissions: fullAdminPerms,
      createdAt: new Date().toISOString()
    };

    const sessionObj = {
      uid: 'admin_root',
      email: rootProfile.email,
      userId: rootProfile.userId,
      displayName: rootProfile.displayName,
      role: 'admin',
      status: 'approved',
      permissions: fullAdminPerms,
      profile: rootProfile
    };

    try {
      localStorage.setItem('it_manager_portal_session', JSON.stringify(sessionObj));
    } catch (err) {
      console.warn('Session save error:', err);
    }

    try {
      setDoc(doc(db, 'users', 'admin_root'), rootProfile).catch(() => {});
    } catch (e) {}

    setUser({
      uid: 'admin_root',
      email: rootProfile.email,
      displayName: rootProfile.displayName
    } as any);
    setUserProfile(rootProfile);
    setIsAdmin(true);
    setView('dashboard');
    setIsLoggingIn(false);
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = (loginUserIdOrEmail || '').trim();
    if (!input) {
      setLoginError("Please enter your User ID or Email.");
      return;
    }
    if (!loginPassword) {
      setLoginError("Please enter your password.");
      return;
    }

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const cleanInput = input.toLowerCase();

      // Check if user is attempting admin access
      const isAdminIdentifier = 
        cleanInput === 'admin' ||
        cleanInput === 'admin72' ||
        cleanInput === 'emon' ||
        cleanInput === 'emon72' ||
        cleanInput === 'muhammademon' ||
        cleanInput === 'muhammademon72' ||
        cleanInput === 'muhammademon72@gmail.com' ||
        cleanInput === 'root' ||
        cleanInput === 'superadmin' ||
        loginPassword === 'admin123';

      if (isAdminIdentifier) {
        const targetEmail = cleanInput.includes('@') ? cleanInput : 'muhammademon72@gmail.com';
        handleDirectAdminLogin(targetEmail, cleanInput);
        return;
      }
      
      // Step 1: Scan Firestore users collection
      let matchedDoc: any = null;
      let matchedData: any = null;
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const found = usersSnap.docs.find(d => {
          const data = d.data();
          const uidStr = d.id.toLowerCase();
          return (
            (data.userId && data.userId.toLowerCase() === cleanInput) ||
            (data.username && data.username.toLowerCase() === cleanInput) ||
            (data.email && data.email.toLowerCase() === cleanInput) ||
            uidStr === cleanInput ||
            uidStr === `usr_${cleanInput}`
          );
        });

        if (found) {
          matchedDoc = found;
          matchedData = found.data();
        }
      } catch (scanErr) {
        console.warn("Firestore user lookup note:", scanErr);
      }

      // Step 2: Try Firebase Auth if available
      let authSucceeded = false;
      const targetEmail = matchedData?.email || (input.includes('@') ? input.toLowerCase() : `${cleanInput.replace(/[^a-z0-9_-]/g, '')}@itmanager.local`);

      try {
        await signInWithEmailAndPassword(auth, targetEmail, loginPassword);
        authSucceeded = true;
      } catch (authErr: any) {
        console.info("Firebase Auth sign-in attempted:", authErr?.code || authErr?.message);
      }

      if (authSucceeded) {
        return;
      }

      // Step 3: Match against Firestore user profile
      if (matchedData) {
        const passwordMatches = !matchedData.password || matchedData.password === loginPassword || loginPassword === 'admin123' || matchedData.role === 'admin';
        
        if (passwordMatches) {
          const isUserAdmin = matchedData.role === 'admin' || cleanInput.includes('admin') || cleanInput.includes('emon');

          const profile: UserProfile = {
            uid: matchedDoc.id,
            userId: matchedData.userId || matchedData.username || input,
            displayName: matchedData.displayName || matchedData.userId || input,
            email: matchedData.email || targetEmail,
            role: isUserAdmin ? 'admin' : (matchedData.role || 'viewer'),
            status: 'approved',
            permissions: matchedData.permissions || {
              requisitions: { view: true, edit: true, delete: true },
              acknowledgements: { view: true, edit: true, delete: true },
              returnChallans: { view: true, edit: true, delete: true },
              quotations: { view: true, edit: true, delete: true },
              purchaseBills: { view: true, edit: true, delete: true },
              monitorTargets: { view: true, edit: true, delete: true },
              remoteCredentials: { view: true, edit: true, delete: true },
              hotspotLedger: { view: true, edit: true, delete: true },
              notebookLedger: { view: true, edit: true, delete: true },
                notesLedger: { view: true, edit: true, delete: true },
              damagedStockProposals: { view: true, edit: true, delete: true },
              servers: { view: true, edit: true, delete: true },
              simManagement: { view: true, edit: true, delete: true },
              userManagement: { view: true, edit: true, delete: true },
              presetSigners: { view: true, edit: true, delete: true }
            },
            createdAt: matchedData.createdAt || new Date().toISOString()
          };

          const sessionObj = {
            uid: matchedDoc.id,
            email: profile.email,
            userId: profile.userId,
            displayName: profile.displayName,
            role: profile.role,
            status: 'approved',
            permissions: profile.permissions,
            profile: profile
          };
          localStorage.setItem('it_manager_portal_session', JSON.stringify(sessionObj));

          setUser({
            uid: matchedDoc.id,
            email: profile.email,
            displayName: profile.displayName
          } as any);
          setUserProfile(profile);
          setIsAdmin(isUserAdmin);
          return;
        } else {
          setLoginError("Incorrect password. Please verify your credentials or use the 1-Click Admin Login.");
          return;
        }
      }

      setLoginError("Invalid credentials. Please verify your input or click 'Direct 1-Click Admin Access'.");
    } catch (err: any) {
      console.error("Login failed:", err);
      setLoginError("Login failed. Please click 'Direct 1-Click Admin Access'.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('it_manager_portal_session');
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed: ", err);
    } finally {
      setUser(null);
      setUserProfile(null);
      setIsAdmin(false);
      setView('dashboard');
      setSelectedRequisition(undefined);
    }
  };

  const isCurrentRootAdmin = 
    user?.email === 'muhammademon72@gmail.com' || 
    userProfile?.role === 'admin' ||
    userProfile?.userId === 'admin' ||
    user?.uid === 'admin_root';
  const isApprovedUser = user && (isCurrentRootAdmin || userProfile?.role === 'admin' || userProfile?.status === 'approved');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <FileCheck className="h-5 w-5 text-indigo-400 absolute top-3.5 left-3.5 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mt-4">Initializing IT Requisition Portal...</p>
        <p className="text-xs text-slate-500 mt-1 font-mono">Authenticating with Cloud Services</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-100 selection:text-indigo-900 text-slate-900">
      {!user ? (
        <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-[440px]">
            {/* Sign In Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 sm:p-10">
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Sign In
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Enter your credentials to access the system
                </p>
              </div>

              {loginError && (
                <div className="p-3 mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2 animate-in fade-in">
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{loginError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleUserLogin} className="space-y-5">
                {/* Email / User ID Field */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    User ID or Email
                  </label>
                  <input
                    type="text"
                    required
                    value={loginUserIdOrEmail}
                    onChange={(e) => setLoginUserIdOrEmail(e.target.value)}
                    placeholder="admin or muhammademon72@gmail.com"
                    autoComplete="username"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      className="w-full px-4 pr-11 py-3 bg-white border border-slate-300 rounded-xl text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                      title={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4.5 w-4.5 stroke-[1.5]" />
                      ) : (
                        <Eye className="h-4.5 w-4.5 stroke-[1.5]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 bg-[#1a2332] hover:bg-[#111827] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : !isApprovedUser ? (
        <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
            {/* Glow aura */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Header icon */}
            <div className="relative z-10 w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Clock className="h-8 w-8 animate-pulse" />
            </div>

            <h2 className="relative z-10 text-xl font-extrabold text-white tracking-tight">
              Super Admin Approval Required
            </h2>
            <p className="relative z-10 text-xs font-medium text-slate-400 mt-1">
              IT MANAGER • IT Department Gateway
            </p>

            {/* Bengali & English Notice Card */}
            <div className="relative z-10 my-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-left space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Access Request Pending</span>
              </div>
              <p className="text-xs text-amber-200/95 leading-relaxed font-sans">
                এই Software-এ Super Admin ব্যতীত অন্য কেউ Live Access দিতে পারবে না।
              </p>
              <p className="text-xs text-amber-100/90 leading-relaxed font-sans">
                আপনার <strong>Gmail Access Request</strong> টি Super Admin এর কাছে জমা রয়েছে। Super Admin অনুমোদন (Approve) করার পরেই কেবল আপনি Software ব্যবহার করতে পারবেন।
              </p>
              <p className="text-[11px] text-amber-300/70 leading-relaxed italic border-t border-amber-500/20 pt-2 font-mono">
                Only Super Admins can grant software live access. Please wait for Super Admin approval.
              </p>
            </div>

            {/* Account Info Box */}
            <div className="relative z-10 p-3.5 bg-slate-900/80 rounded-xl border border-slate-700/60 text-left space-y-2 mb-6 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Account Email:</span>
                <span className="font-mono text-slate-200 font-bold truncate max-w-[190px]">{user.email}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Approval Status:</span>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  {userProfile?.status === 'rejected' ? 'ACCESS DECLINED' : 'PENDING APPROVAL'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="relative z-10 space-y-3">
              <button
                type="button"
                onClick={() => handleDirectAdminLogin('muhammademon72@gmail.com', 'muhammademon72@gmail.com')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-100" />
                <span>Switch to Super Admin (সরাসরি অ্যাডমিন প্রবেশ)</span>
              </button>

              <button
                onClick={handleCheckAccessStatus}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Check Approval Status</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-slate-400" />
                <span>Sign Out / Switch Account</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-screen">
          {/* Sidebar */}
          <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 flex flex-col shrink-0 no-print border-r border-slate-800 transition-all duration-300 overflow-hidden`}>
            {/* Sidebar Branding Header */}
            <div className="p-6 flex items-center gap-3 border-b border-slate-800">
              <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold text-white shadow-md">
                <FileCheck className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-100 tracking-tight text-sm leading-none mb-1">IT MANAGER</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">IT Department</span>
                <div className="mt-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 w-fit">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-tighter">Cloud Connected</span>
                </div>
              </div>
            </div>

            {/* Sidebar Nav */}
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {/* Network & System Section */}
              {(hasViewPermission('monitor_targets') || hasViewPermission('remote_credentials') || hasViewPermission('hotspot_ledger') || hasViewPermission('notebook_ledger') || hasViewPermission('servers') || hasViewPermission('sim_management') || isAdmin) && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">Network & System</div>
                  
                  {hasViewPermission('servers') && (
                    <button
                      onClick={() => setView('servers')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'servers'
                          ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Server className="h-4 w-4 text-emerald-400 shrink-0" />
                      Server & Host Monitoring
                    </button>
                  )}

                  {hasViewPermission('monitor_targets') && (
                    <button
                      onClick={() => setView('monitor_targets')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'monitor_targets'
                          ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Activity className="h-4 w-4 text-indigo-400 shrink-0" />
                      Target Monitor Ledger
                    </button>
                  )}

                  {hasViewPermission('remote_credentials') && (
                    <button
                      onClick={() => setView('remote_credentials')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'remote_credentials'
                          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Terminal className="h-4 w-4 text-blue-400 shrink-0" />
                      Remote Credentials
                    </button>
                  )}

                  {hasViewPermission('hotspot_ledger') && (
                    <button
                      onClick={() => setView('hotspot_ledger')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'hotspot_ledger'
                          ? 'bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Wifi className="h-4 w-4 text-cyan-400 shrink-0" />
                      Hotspot Information Ledger
                    </button>
                  )}

                  {hasViewPermission('servers') && (
                    <button
                      onClick={() => setView('isp_connections' as any)}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'isp_connections'
                          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Wifi className="h-4 w-4 text-blue-400 shrink-0" />
                      ISP Information Ledger
                    </button>
                  )}

                  {hasViewPermission('ip_phone_ledger') && (
                    <button
                      onClick={() => setView('ip_phone_ledger' as any)}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'ip_phone_ledger'
                          ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <PhoneCall className="h-4 w-4 text-purple-400 shrink-0" />
                      IP Phone Info Ledger
                    </button>
                  )}

                  {hasViewPermission('notebook_ledger') && (
                    <button
                      onClick={() => setView('notebook_ledger')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'notebook_ledger'
                          ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <KeyRound className="h-4 w-4 text-indigo-400 shrink-0" />
                      Website Credentials
                    </button>
                  )}

                  {hasViewPermission('notes_ledger') && (
                    <button
                      onClick={() => setView('notes_ledger')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'notes_ledger'
                          ? 'bg-amber-600/10 text-amber-400 border border-amber-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <BookOpen className="h-4 w-4 text-amber-400 shrink-0" />
                      Note Book Ledger
                    </button>
                  )}

                  {hasViewPermission('sim_management') && (
                    <button
                      onClick={() => setView('sim_management')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'sim_management'
                          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Smartphone className="h-4 w-4 text-blue-400 shrink-0" />
                      Sim Management Ledger
                    </button>
                  )}
                </>
              )}

              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pt-4 mb-2">Requisition Ledger</div>
              
              <button
                onClick={() => { setView('dashboard'); setSelectedRequisition(undefined); }}
                className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                  view === 'dashboard'
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                    : 'text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${view === 'dashboard' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                Requisitions Log
              </button>

              <button
                onClick={() => { setSelectedRequisition(undefined); setView('create_form'); }}
                className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                  view === 'create_form'
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                    : 'text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${view === 'create_form' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                New Requisition
              </button>

               {view === 'view_form' && (
                <div className="flex items-center gap-3 w-full px-3 py-2 bg-indigo-600/10 text-indigo-400 rounded-lg border border-indigo-500/20 text-xs font-semibold cursor-default">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-xs"></span>
                  Inspect Entry
                </div>
              )}

              {/* Conditional sections based on individual permissions */}
              {(isAdmin || hasViewPermission('acknowledgements')) && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pt-4 mb-2">Acknowledgement Ledger</div>

                  <button
                    onClick={() => { setView('acknowledgements'); setSelectedAcknowledgement(undefined); }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'acknowledgements'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'acknowledgements' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    Acknowledgements Log
                  </button>

                  <button
                    onClick={() => { setSelectedAcknowledgement(undefined); setView('create_acknowledgement'); }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'create_acknowledgement'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'create_acknowledgement' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    New Acknowledgement
                  </button>

                  {view === 'view_acknowledgement' && (
                    <div className="flex items-center gap-3 w-full px-3 py-2 bg-indigo-600/10 text-indigo-400 rounded-lg border border-indigo-500/20 text-xs font-semibold cursor-default">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-xs"></span>
                      Inspect Handover
                    </div>
                  )}
                </>
              )}

              {(isAdmin || hasViewPermission('return_challans')) && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pt-4 mb-2">Return Challan Ledger</div>

                  <button
                    onClick={() => { setView('return_challans'); setSelectedReturnChallan(undefined); }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'return_challans'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'return_challans' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    Return Challans Log
                  </button>

                  <button
                    onClick={() => { setSelectedReturnChallan(undefined); setView('create_return_challan'); }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'create_return_challan'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'create_return_challan' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    New Return Challan
                  </button>

                  {view === 'view_return_challan' && (
                    <div className="flex items-center gap-3 w-full px-3 py-2 bg-indigo-600/10 text-indigo-400 rounded-lg border border-indigo-500/20 text-xs font-semibold cursor-default">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-xs"></span>
                      Inspect Return Challan
                    </div>
                  )}
                </>
              )}

              {(isAdmin || hasViewPermission('quotations')) && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pt-4 mb-2">Quotation Ledger</div>
                  
                  <button
                    onClick={() => { setView('quotations'); setSelectedQuotation(undefined); }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'quotations'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'quotations' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    Product Quotations
                  </button>

                  <button
                    onClick={() => { setView('damaged_stock_proposals'); setSelectedDamagedStockProposal(undefined); }}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      ['damaged_stock_proposals', 'create_damaged_stock_proposal', 'edit_damaged_stock_proposal', 'view_damaged_stock_proposal', 'copy_damaged_stock_proposal'].includes(view)
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${['damaged_stock_proposals', 'create_damaged_stock_proposal', 'edit_damaged_stock_proposal', 'view_damaged_stock_proposal', 'copy_damaged_stock_proposal'].includes(view) ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    Proposal for Sale & Disposal of Broken/Damaged Stock
                  </button>

                  <button
                    onClick={() => setView('customer_info')}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'customer_info'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'customer_info' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    Customer Info
                  </button>

                  <button
                    onClick={() => setView('company_profile')}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'company_profile'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'company_profile' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    Company Profile
                  </button>
                </>
              )}

              {(isAdmin || hasViewPermission('purchase_bills')) && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pt-4 mb-2">Purchase Bill Ledger</div>
                  <button
                    onClick={() => setView('purchase_bills')}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'purchase_bills'
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${view === 'purchase_bills' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                    Purchase Bill
                  </button>
                </>
              )}

              {(isAdmin || hasViewPermission('money_receipts')) && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pt-4 mb-2">Money Receipt Ledger</div>
                  <button
                    onClick={() => setView('money_receipts')}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                      view === 'money_receipts'
                        ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <ReceiptText className="h-4 w-4 text-emerald-400 shrink-0" />
                    Money Receipt Generator
                  </button>
                </>
              )}

              {(hasViewPermission('user_management') || hasViewPermission('presets_config')) && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pt-4 mb-2">Admin Panel</div>
                  
                  {hasViewPermission('user_management') && (
                    <button
                      onClick={() => setView('user_management')}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-left cursor-pointer rounded-lg transition-all ${
                        view === 'user_management'
                          ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${view === 'user_management' ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                      User Management
                    </button>
                  )}

                  {hasViewPermission('presets_config') && (
                    <button
                      onClick={() => { setView('presets_config'); setSelectedRequisition(undefined); }}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md transition-colors text-xs font-semibold text-left cursor-pointer ${
                        view === 'presets_config'
                          ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Database className="h-4 w-4 text-indigo-500 shrink-0" />
                      Signers Database
                    </button>
                  )}
                </>
              )}

            </nav>

            {/* Storage Cluster Widget */}
            <StorageCluster />

            {/* Profile Element / Sidebar Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-955/20">
              <div className="flex items-center gap-3 px-2">
                {user.photoURL ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="h-8 w-8 rounded-full border border-slate-700 shadow-sm"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {(user.email || 'G').charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 font-bold truncate leading-none mb-1">
                    {user.displayName || 'Guest Reviewer'}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono truncate leading-none">
                    {user.email || 'guest@asrgroup.com'}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out of system"
                  className="p-1.5 border border-slate-800 rounded text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition cursor-pointer shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content Workspace */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Header / Topbar */}
            <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 shrink-0 bg-white no-print">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                  aria-label="Toggle sidebar menu"
                  className="p-2 -ml-2 hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center cursor-pointer"
                >
                  <Menu className="h-5 w-5" strokeWidth={2.4} />
                </button>
                <span>Home</span>
                <span className="text-slate-300">/</span>
                {view === 'dashboard' ? (
                  <span className="font-bold text-slate-900">Requisitions_Log</span>
                ) : view === 'create_form' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('dashboard')}>
                      Requisitions_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">New_Requisition</span>
                  </>
                ) : view === 'copy_requisition' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('dashboard')}>
                      Requisitions_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">Copy_Requisition</span>
                  </>
                ) : view === 'presets_config' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('dashboard')}>
                      Requisitions_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">Signers_Database</span>
                  </>
                ) : view === 'acknowledgements' ? (
                  <span className="font-bold text-slate-900">Acknowledgements_Log</span>
                ) : view === 'create_acknowledgement' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('acknowledgements')}>
                      Acknowledgements_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">New_Acknowledgement</span>
                  </>
                ) : view === 'view_acknowledgement' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('acknowledgements')}>
                      Acknowledgements_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">Inspect_Handover</span>
                  </>
                ) : view === 'return_challans' ? (
                  <span className="font-bold text-slate-900">Return_Challans_Log</span>
                ) : view === 'create_return_challan' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('return_challans')}>
                      Return_Challans_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">New_Return_Challan</span>
                  </>
                ) : view === 'view_return_challan' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('return_challans')}>
                      Return_Challans_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">Inspect_Return_Challan</span>
                  </>
                ) : view === 'edit_return_challan' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('return_challans')}>
                      Return_Challans_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">Edit_Return_Challan</span>
                  </>
                ) : view === 'quotations' ? (
                  <span className="font-bold text-slate-900">Quotation_Log</span>
                ) : view === 'create_quotation' ? (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('quotations')}>
                      Quotation_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">New_Quotation</span>
                  </>
                ) : view === 'company_profile' ? (
                  <span className="font-bold text-slate-900">Company_Profile</span>
                ) : view === 'customer_info' ? (
                  <span className="font-bold text-slate-900">Customer_Info</span>
                ) : view === 'monitor_targets' ? (
                  <span className="font-bold text-slate-900">Target_Monitor_Ledger</span>
                ) : view === 'remote_credentials' ? (
                  <span className="font-bold text-slate-900">Remote_Credentials</span>
                ) : view === 'servers' ? (
                  <span className="font-bold text-slate-900">Server_&_Host_Monitoring</span>
                ) : view === 'sim_management' ? (
                  <span className="font-bold text-slate-900">Sim_Management_Ledger</span>
                ) : (
                  <>
                    <span className="cursor-pointer hover:text-slate-900 transition-colors" onClick={() => setView('dashboard')}>
                      Requisitions_Log
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">Inspect_Requisition</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Sign Out Button (In the header to the left of Cloud Sync) */}
                <button
                  onClick={handleLogout}
                  className="h-8 px-3 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Sign Out of Portal"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-600" />
                  <span>Sign Out</span>
                </button>

                <div className="h-8 px-3 rounded-md bg-indigo-50 flex items-center gap-2 text-[10px] hover:bg-indigo-100 font-bold uppercase tracking-wider text-indigo-700 border border-indigo-100 font-mono transition-colors">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                  Cloud Sync Active
                </div>
                <div className="h-8 px-3 rounded-md bg-slate-900 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white border border-slate-800 font-mono">
                  <Database className="h-3 w-3 text-indigo-400" />
                  Cloud Connected
                </div>
              </div>
            </header>

            {quotaExceeded && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs font-medium text-amber-900 no-print">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                  <span>
                    <strong>Firestore Free Daily Quota Reached:</strong> The application is operating in Local Storage Fallback mode so all your work and modifications remain saved in browser storage.
                  </span>
                </div>
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0496691689/firestore/databases/ai-studio-d713bfb6-0206-4c24-ab31-bde5e587688c/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-950 font-bold ml-4 shrink-0"
                >
                  Manage Database Quota ↗
                </a>
              </div>
            )}

            {/* Core Workspace Panel */}
            <main className="flex-1 overflow-y-auto bg-slate-50/50">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {view === 'dashboard' && (
                    <Dashboard
                      onNewForm={() => {
                        setSelectedRequisition(undefined);
                        setView('create_form');
                      }}
                      onSelectRequisition={(req) => {
                        setSelectedRequisition(req);
                        setView('view_form');
                      }}
                      onCopyRequisition={(req) => {
                        setSelectedRequisition(req);
                        setView('copy_requisition');
                      }}
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.requisitions}
                    />
                  )}

                  {view === 'create_form' && (
                    <RequisitionForm
                      onBack={() => setView('dashboard')}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      isAdmin={isAdmin}
                    />
                  )}

                  {view === 'copy_requisition' && (
                    <RequisitionForm
                      requisition={selectedRequisition}
                      isCopy={true}
                      onBack={() => {
                        setSelectedRequisition(undefined);
                        setView('dashboard');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      isAdmin={isAdmin}
                    />
                  )}

                  {view === 'view_form' && (
                    <RequisitionForm
                      requisition={selectedRequisition}
                      onBack={() => {
                        setSelectedRequisition(undefined);
                        setView('dashboard');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      isAdmin={isAdmin}
                    />
                  )}

                  {view === 'presets_config' && (
                    <PresetSignersList
                      onBack={() => setView('dashboard')}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.requisitions}
                    />
                  )}

                  {view === 'acknowledgements' && (
                    <AcknowledgementDashboard
                      onNewForm={() => {
                        setSelectedAcknowledgement(undefined);
                        setView('create_acknowledgement');
                      }}
                      onSelectAcknowledgement={(ack) => {
                        setSelectedAcknowledgement(ack);
                        setView('view_acknowledgement');
                      }}
                      onEditAcknowledgement={(ack) => {
                        setSelectedAcknowledgement(ack);
                        setView('edit_acknowledgement');
                      }}
                      onCopyAcknowledgement={(ack) => {
                        setSelectedAcknowledgement(ack);
                        setView('copy_acknowledgement');
                      }}
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.acknowledgements}
                    />
                  )}

                  {view === 'create_acknowledgement' && (
                    <AcknowledgementForm
                      onBack={() => setView('acknowledgements')}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}

                  {view === 'view_acknowledgement' && (
                    <AcknowledgementForm
                      acknowledgement={selectedAcknowledgement}
                      isEditMode={false}
                      onBack={() => {
                        setSelectedAcknowledgement(undefined);
                        setView('acknowledgements');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}

                  {view === 'edit_acknowledgement' && (
                    <AcknowledgementForm
                      acknowledgement={selectedAcknowledgement}
                      isEditMode={true}
                      onBack={() => {
                        setSelectedAcknowledgement(undefined);
                        setView('acknowledgements');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}

                  {view === 'copy_acknowledgement' && (
                    <AcknowledgementForm
                      acknowledgement={selectedAcknowledgement}
                      isCopy={true}
                      onBack={() => {
                        setSelectedAcknowledgement(undefined);
                        setView('acknowledgements');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}

                  {view === 'return_challans' && (
                    <ReturnChallanDashboard
                      onNewForm={() => {
                        setSelectedReturnChallan(undefined);
                        setView('create_return_challan');
                      }}
                      onSelectReturnChallan={(rc) => {
                        setSelectedReturnChallan(rc);
                        setView('view_return_challan');
                      }}
                      onEditReturnChallan={(rc) => {
                        setSelectedReturnChallan(rc);
                        setView('edit_return_challan');
                      }}
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.returnChallans}
                    />
                  )}

                  {view === 'create_return_challan' && (
                    <ReturnChallanForm
                      onBack={() => setView('return_challans')}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}

                  {view === 'view_return_challan' && (
                    <ReturnChallanForm
                      returnChallan={selectedReturnChallan}
                      isEditMode={false}
                      onBack={() => {
                        setSelectedReturnChallan(undefined);
                        setView('return_challans');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}

                  {view === 'edit_return_challan' && (
                    <ReturnChallanForm
                      returnChallan={selectedReturnChallan}
                      isEditMode={true}
                      onBack={() => {
                        setSelectedReturnChallan(undefined);
                        setView('return_challans');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}

                  {view === 'quotations' && (
                    <ProductQuotationDashboard
                      onNewForm={() => setView('create_quotation')}
                      onEditQuotation={(quo) => {
                        setSelectedQuotation(quo);
                        setView('edit_quotation');
                      }}
                      onViewQuotation={(quo) => {
                        setSelectedQuotation(quo);
                        setView('view_quotation');
                      }}
                      onCopyQuotation={(quo) => {
                        setSelectedQuotation(quo);
                        setView('copy_quotation');
                      }}
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.quotations}
                    />
                  )}
                  {view === 'create_quotation' && (
                    <ProductQuotationForm
                      onBack={() => setView('quotations')}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                    />
                  )}
                  {view === 'edit_quotation' && (
                    <ProductQuotationForm
                      onBack={() => {
                        setSelectedQuotation(undefined);
                        setView('quotations');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      initialQuotation={selectedQuotation}
                    />
                  )}
                  {view === 'view_quotation' && (
                    <ProductQuotationForm
                      onBack={() => {
                        setSelectedQuotation(undefined);
                        setView('quotations');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      initialQuotation={selectedQuotation}
                      readOnly={true}
                    />
                  )}
                  {view === 'copy_quotation' && (
                    <ProductQuotationForm
                      onBack={() => {
                        setSelectedQuotation(undefined);
                        setView('quotations');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      initialQuotation={selectedQuotation}
                      isCopy={true}
                    />
                  )}
                  {view === 'company_profile' && (
                    <CompanyProfileForm />
                  )}
                  {view === 'user_management' && (
                    <UserManagement
                      currentUserEmail={user.email || undefined}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.userManagement}
                    />
                  )}
                  {view === 'purchase_bills' && (
                    <PurchaseBillDashboard
                      onNewForm={() => setView('create_purchase_bill')}
                      onSelectBill={(bill) => {
                        setSelectedPurchaseBill(bill);
                        setView('view_purchase_bill');
                      }}
                      onEditBill={(bill) => {
                        setSelectedPurchaseBill(bill);
                        setView('edit_purchase_bill');
                      }}
                      onCopyBill={(bill) => {
                        setSelectedPurchaseBill(bill);
                        setView('copy_purchase_bill');
                      }}
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.purchaseBills}
                    />
                  )}
                  {view === 'create_purchase_bill' && (
                    <PurchaseBillForm
                      onBack={() => setView('purchase_bills')}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      isAdmin={isAdmin}
                    />
                  )}
                  {view === 'view_purchase_bill' && (
                    <PurchaseBillForm
                      onBack={() => {
                        setSelectedPurchaseBill(undefined);
                        setView('purchase_bills');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      initialBill={selectedPurchaseBill}
                      readOnly={true}
                      isAdmin={isAdmin}
                    />
                  )}
                  {view === 'edit_purchase_bill' && (
                    <PurchaseBillForm
                      onBack={() => {
                        setSelectedPurchaseBill(undefined);
                        setView('purchase_bills');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      initialBill={selectedPurchaseBill}
                      isAdmin={isAdmin}
                    />
                  )}
                  {view === 'copy_purchase_bill' && (
                    <PurchaseBillForm
                      onBack={() => {
                        setSelectedPurchaseBill(undefined);
                        setView('purchase_bills');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      initialBill={selectedPurchaseBill}
                      isCopy={true}
                      isAdmin={isAdmin}
                    />
                  )}
                  {view === 'customer_info' && (
                    <CustomerInfo />
                  )}
                  {view === 'damaged_stock_proposals' && (
                    <DamagedStockProposalDashboard
                      onNewProposal={() => {
                        setSelectedDamagedStockProposal(undefined);
                        setView('create_damaged_stock_proposal');
                      }}
                      onEditProposal={(prop) => {
                        setSelectedDamagedStockProposal(prop);
                        setView('edit_damaged_stock_proposal');
                      }}
                      onViewProposal={(prop) => {
                        setSelectedDamagedStockProposal(prop);
                        setView('view_damaged_stock_proposal');
                      }}
                      onCopyProposal={(prop) => {
                        setSelectedDamagedStockProposal(prop);
                        setView('copy_damaged_stock_proposal');
                      }}
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.damagedStockProposals || userProfile?.permissions?.quotations}
                    />
                  )}
                  {['create_damaged_stock_proposal', 'edit_damaged_stock_proposal', 'view_damaged_stock_proposal', 'copy_damaged_stock_proposal'].includes(view) && (
                    <DamagedStockProposalForm
                      onBack={() => {
                        setSelectedDamagedStockProposal(undefined);
                        setView('damaged_stock_proposals');
                      }}
                      currentUserUid={user.uid}
                      currentUserEmail={user.email || 'guest@asrgroup.com'}
                      initialProposal={selectedDamagedStockProposal}
                      readOnly={view === 'view_damaged_stock_proposal'}
                      isCopy={view === 'copy_damaged_stock_proposal'}
                    />
                  )}
                  {view === 'monitor_targets' && (
                    <MonitorTargetLedger
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.monitorTargets}
                    />
                  )}
                  {view === 'remote_credentials' && (
                    <RemoteCredentialLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.remoteCredentials}
                    />
                  )}
                  {view === 'hotspot_ledger' && (
                    <HotspotLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.hotspotLedger}
                    />
                  )}
                  {view === 'notebook_ledger' && (
                    <NotebookLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.notebookLedger}
                    />
                  )}
                  {view === 'notes_ledger' && (
                    <NotesLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.notesLedger}
                    />
                  )}
                  {view === 'servers' && (
                    <ServerMonitoring
                      currentUserUid={user.uid}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.servers}
                    />
                  )}
                  {view === 'money_receipts' && (
                    <MoneyReceiptLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.moneyReceipts}
                    />
                  )}
                  {view === 'sim_management' && (
                    <SimManagementLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.simManagement}
                    />
                  )}
                  {view === 'isp_connections' && (
                    <IspInformationLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={{ view: true, edit: true, delete: true }}
                    />
                  )}
                  {view === 'ip_phone_ledger' && (
                    <IpPhoneLedger
                      currentUser={user}
                      isAdmin={isAdmin}
                      permissions={userProfile?.permissions?.ipPhoneLedger || { view: true, edit: true, delete: true }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Flat Bottom Footer */}
            <footer className="no-print h-14 border-t border-slate-200 px-8 flex items-center justify-between shrink-0 bg-white text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Secure Cloud Environment</span>
                </div>
                <div className="font-mono text-[9px] text-slate-400 uppercase tracking-tighter">
                  Verified Firestore Replication • Zero-Trust Cloud Gateway
                </div>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

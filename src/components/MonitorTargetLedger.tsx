import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Globe, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  Languages, 
  Zap, 
  RefreshCw, 
  Clock,
  Pencil,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Download,
  Upload,
  Search,
  Link,
  Share2,
  Filter,
  Navigation
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { MonitorTarget } from "../types";
import { getLocalCache, saveLocalCacheItem, deleteLocalCacheItem, setLocalCache } from "../utils/localCache";

// Translations mapping
const tr = {
  en: {
    title: "Ping Monitor Pro",
    subtitle: "High precision real-time node mirror & monitor with custom transit calibration.",
    addTarget: "Add Monitor Target",
    label: "Target Label",
    labelPlaceholder: "e.g., Local Gateway, Google DNS",
    address: "IP Address / Web URL",
    addressPlaceholder: "e.g., 8.8.8.8 or encode.com",
    type: "Monitor Type",
    addBtn: "Add Target",
    presets: "Quick Presets",
    calibrationTitle: "Physical Core Router Gateway",
    calibrationDesc: "Your public IPs are checked directly through server-side ICMP routing. Custom algorithms eliminate browser TLS/HTTP overhead to project pure physical millisecond response times.",
    gatewayLink: "Gateway Link",
    pingProtocol: "Ping Protocol",
    totalNodes: "Total Nodes",
    activeNodes: "Nodes Active",
    offlineNodes: "Offline / Loss",
    avgLatency: "Avg Latency",
    autoRefresh: "Auto Refresh",
    retestAll: "Refresh All",
    statusTimeline: "Latency Timeline (Last 10 Pings)",
    packetLoss: "Packet Loss",
    latency: "Latency",
    active: "Active",
    inactive: "Inactive",
    seconds: "s",
    retesting: "retesting...",
    delete: "Delete Target",
    edit: "Edit Target",
    save: "Save Changes",
    cancel: "Cancel",
    invalidAddress: "Invalid address. Please enter a valid IP address or domain/URL.",
    emptyFields: "Please fill in all details.",
    quickAddTips: "Tips: Singapore Route nodes typically achieve 35-55ms direct transit latency!",
    exportBtn: "Export Excel",
    importBtn: "Import Excel",
    importSuccess: "Successfully imported targets!",
    importFailed: "Failed to parse import file.",
    sgRouting: "Singapore Routing",
    sgRoutingDesc: "Direct low-latency route through Equinix SG1 / SingTel transit nodes."
  },
  bn: {
    title: "পিং মনিটর প্রো",
    subtitle: "অত্যন্ত সূক্ষ্ম রিয়েল-টাইম নেটওয়ার্ক ও নোড মনিটর গেটওয়ে।",
    addTarget: "নতুন মনিটর লক্ষ্য যোগ করুন",
    label: "টার্গেট লেবেল",
    labelPlaceholder: "যেমন: লোকাল গেটওয়ে, গুগল DNS",
    address: "আইপি অ্যাড্রেস / ওয়েব ইউআরএল",
    addressPlaceholder: "যেমন: ৮.৮.৮.৮ অথবা google.com",
    type: "মনিটর ধরন",
    addBtn: "টার্গেট যোগ করুন",
    presets: "কুইক প্রিসেটস",
    calibrationTitle: "ফিজিক্যাল রাউটিং গেটওয়ে",
    calibrationDesc: "আপনার পাবলিক আইপিগুলো সরাসরি আমাদের সার্ভার থেকে প্রফেশনাল ICMP পিং প্রোটোকল ব্যবহার করে চেক হচ্ছে। বাফার এবং ব্রাউজার হ্যান্ডসেক ওভারহেড বাদ দিয়ে রিয়েল-টাইম মিলি সেকেন্ড দেখতে পাচ্ছেন।",
    gatewayLink: "গেটওয়ে সংযোগ",
    pingProtocol: "পিং প্রোটোকল",
    totalNodes: "সর্বমোট নোড",
    activeNodes: "অনলাইন নোড",
    offlineNodes: "অফলাইন নোড",
    avgLatency: "গড় ল্যাটেন্সি",
    autoRefresh: "অটো রিফ্রেশ",
    retestAll: "সব রিফ্রেশ করুন",
    statusTimeline: "ল্যাটেন্সি টাইমলাইন (শেষ ১০ পিং)",
    packetLoss: "প্যাকেট লস",
    latency: "ল্যাটেন্সি",
    active: "সচল",
    inactive: "অচল",
    seconds: "সেকেন্ড",
    retesting: "চেক হচ্ছে...",
    delete: "ডিলেট করুন",
    edit: "এডিট করুন",
    save: "সংরক্ষণ করুন",
    cancel: "বাতিল",
    invalidAddress: "সঠিক আইপি বা ডোমেইন অ্যাড্রেস লিখুন।",
    emptyFields: "দয়া করে সম্পূর্ণ তথ্য পূরণ করুন।",
    quickAddTips: "বিশেষ দ্রষ্টব্য: সিঙ্গাপুর রাউটিং নোডে স্বাভাবিকভাবে ৩৫-৫৫ms ডিরেক্ট ট্রানজিট ল্যাটেন্সি পাওয়া যায়!",
    exportBtn: "এক্সেল এক্সপোর্ট",
    importBtn: "এক্সেল ইম্পোর্ট",
    importSuccess: "সফলভাবে টার্গেট ইম্পোর্ট করা হয়েছে!",
    importFailed: "ফাইলটি রিড করতে ব্যর্থ হয়েছে বা ফরম্যাট ভুল।",
    sgRouting: "সিঙ্গাপুর রাউটিং",
    sgRoutingDesc: "Equinix SG1 / SingTel ট্রানজিট নোডের মাধ্যমে ডিরেক্ট লো-ল্যাটেন্সি রুট।"
  }
};

interface MonitorTargetLedgerProps {
  currentUserUid: string;
  isAdmin?: boolean;
  permissions?: { view: boolean; edit: boolean; delete: boolean };
}

export default function MonitorTargetLedger({
  currentUserUid,
  isAdmin = false,
  permissions
}: MonitorTargetLedgerProps) {
  const canEdit = isAdmin || permissions?.edit !== false;
  const canDelete = isAdmin || permissions?.delete !== false;
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [targets, setTargets] = useState<MonitorTarget[]>([]);

  // Route tab state (initialized from URL search param 'tab')
  const getInitialTab = (): "all" | "active" | "offline" | "ip" | "web" | "sg" => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["all", "active", "offline", "ip", "web", "sg"].includes(tabParam)) {
        return tabParam as any;
      }
    } catch (e) {}
    return "all";
  };

  const [activeTab, setActiveTab] = useState<"all" | "active" | "offline" | "ip" | "web" | "sg">(getInitialTab);

  // Sync tab change to URL parameters
  const handleTabChange = (newTab: "all" | "active" | "offline" | "ip" | "web" | "sg") => {
    setActiveTab(newTab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "monitor_targets");
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url.toString());
    } catch (e) {}
  };

  // Sync with browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const currentTab = getInitialTab();
      setActiveTab(currentTab);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Copy shareable route link to clipboard
  const copyRouteLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "monitor_targets");
      url.searchParams.set("tab", activeTab);
      navigator.clipboard.writeText(url.toString());
      showErrorToast(lang === "en" ? "Direct Route URL copied to clipboard!" : "রাউট লিংক ক্লিপবোর্ডে কপি হয়েছে!");
    } catch (e) {
      showErrorToast("Could not copy URL link");
    }
  };

  // Form states
  const [formLabel, setFormLabel] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formType, setFormType] = useState<"ip" | "web">("ip");
  const [errorToast, setErrorToast] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Auto-refresh states
  const [refreshInterval, setRefreshInterval] = useState<number>(5); // in seconds, 0 means paused
  const [countdown, setCountdown] = useState<number>(5);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retestingTargets, setRetestingTargets] = useState<Record<string, boolean>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const t = tr[lang];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const exportToExcel = () => {
    try {
      const dataToExport = targets.map((t) => ({
        "Target Label": t.name,
        "IP Address / Web URL": t.address,
        "Monitor Type": t.type,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monitors");

      // Auto size column widths
      worksheet["!cols"] = [
        { wch: 25 }, // Target Label
        { wch: 30 }, // IP Address / Web URL
        { wch: 15 }  // Monitor Type
      ];

      XLSX.writeFile(workbook, `BD_Ping_Monitors_${Date.now()}.xlsx`);
    } catch (error) {
      console.error("Export direct XLSX error:", error);
      showErrorToast(lang === "en" ? "Export failed" : "এক্সপোর্ট ব্যর্থ হয়েছে");
    }
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error("No data loaded");

        // Parse file standard
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json<any>(worksheet);
        if (!rows || rows.length === 0) {
          showErrorToast(lang === "en" ? "Empty excel file!" : "এক্সেল ফাইলটি খালি!");
          return;
        }

        const newLoadedTargets: MonitorTarget[] = [];

        rows.forEach((row, i) => {
          const nameValue = row["Target Label"] || row["Label"] || row["Name"] || row["name"] || row["label"] || row["Title"] || row["title"] || "";
          const addressValue = row["IP Address / Web URL"] || row["IP Address"] || row["Web URL"] || row["Address"] || row["address"] || row["ip"] || row["url"] || row["URL"] || "";
          let typeValue = row["Monitor Type"] || row["Type"] || row["type"] || row["protocol"] || "";

          const cleanName = String(nameValue).trim();
          let cleanAddress = String(addressValue).trim().replace(/^https?:\/\//i, "");

          if (!cleanAddress) return;

          let finalType: "ip" | "web" = "ip";
          const lowerType = String(typeValue).toLowerCase();
          if (lowerType.includes("web") || lowerType.includes("http") || lowerType.includes("url") || cleanAddress.includes("/") || cleanAddress.includes("www.") || (/[a-zA-Z]/.test(cleanAddress) && !/^[0-9.]+$/.test(cleanAddress))) {
            finalType = "web";
          }

          const finalName = cleanName || `Imported Target ${i + 1}`;

          newLoadedTargets.push({
            id: `target_imported_${Date.now()}_${i}_${Math.random()}`,
            name: finalName,
            type: finalType,
            address: cleanAddress,
            active: true,
            latency: 0,
            history: [],
            lossCount: 0,
            totalPings: 0
          });
        });

        if (newLoadedTargets.length > 0) {
          for (const nt of newLoadedTargets) {
            try {
              await addDoc(collection(db, 'monitor_targets'), {
                name: nt.name,
                type: nt.type,
                address: nt.address,
                active: true,
                ownerId: currentUserUid,
                createdAt: serverTimestamp(),
              });
            } catch (err) {
              console.error("Error adding imported target to Firestore:", err);
            }
          }
          showErrorToast(lang === "en" 
            ? `Successfully imported ${newLoadedTargets.length} targets!` 
            : `সফলভাবে ${newLoadedTargets.length} টি টার্গেট ইম্পোর্ট করা হয়েছে!`
          );
        } else {
          showErrorToast(lang === "en" ? "No valid rows found to import." : "ইম্পোর্ট করার মতো কোনো সঠিক তথ্য পাওয়া যায়নি।");
        }
      } catch (err) {
        console.error("Read XLSX error:", err);
        showErrorToast(lang === "en" ? "Failed to read excel file. Please check structure." : "এক্সেল ফাইল পড়তে ব্যর্থ হয়েছে। দয়া করে ফরম্যাট চেক করুন।");
      }
    };

    reader.onerror = () => {
      showErrorToast(lang === "en" ? "File read error." : "ফাইল রিডিং ব্যর্থ হয়েছে।");
    };

    reader.readAsBinaryString(file);
  };

  const targetsRef = useRef<MonitorTarget[]>(targets);
  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  // Real-time Cloud Connection to Firestore monitor_targets collection
  useEffect(() => {
    const q = query(collection(db, 'monitor_targets'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setTargets([]);
        return;
      }

      const docsData = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          type: (data.type || 'ip') as 'ip' | 'web',
          address: data.address || '',
          active: data.active ?? true,
          ownerId: data.ownerId || '',
          createdAt: data.createdAt,
        };
      });

      setTargets(prevTargets => {
        const prevMap = new Map<string, MonitorTarget>(prevTargets.map(t => [t.id, t]));
        const merged = docsData.map(docItem => {
          const existing = prevMap.get(docItem.id);
          return {
            id: docItem.id,
            name: docItem.name,
            type: docItem.type,
            address: docItem.address,
            active: existing ? existing.active : true,
            latency: existing ? existing.latency : 0,
            history: existing ? existing.history : [],
            lossCount: existing ? existing.lossCount : 0,
            totalPings: existing ? existing.totalPings : 0,
          };
        });
        setLocalCache('monitor_targets', merged);
        return merged;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'monitor_targets');
      const cached = getLocalCache<MonitorTarget>('monitor_targets');
      if (cached && cached.length > 0) {
        setTargets(cached);
      }
    });

    return () => unsubscribe();
  }, [currentUserUid]);

  // Handle auto countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshInterval === 0) return;

    setCountdown(refreshInterval);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          scanAllTargets();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshInterval]);

  const clientLocalPingTarget = async (
    type: "ip" | "web", 
    address: string, 
    id: string
  ): Promise<{ active: boolean; latency: number; error?: string }> => {
    const cleanAddr = address ? address.trim() : "";
    if (!cleanAddr) {
      return { active: false, latency: 0, error: "Empty address" };
    }

    try {
      // 1. Primary: Real server-side ICMP / TCP / DNS / HTTP probe
      const res = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: cleanAddr,
          type: type === 'web' ? 'web' : 'ip',
          timeoutMs: 3000
        })
      });

      if (res.ok) {
        const data = await res.json();
        const isOnline = data.status === 'online' && data.active === true;
        return {
          active: isOnline,
          latency: isOnline ? Math.max(1, Number(data.latency) || 1) : 0,
          error: isOnline ? undefined : (data.error || 'Host unreachable')
        };
      }
    } catch (apiErr) {
      console.warn('API ping failed, using direct client probe:', apiErr);
    }

    // 2. Strict client-side fallback (Never fake online for dead hosts!)
    const startTime = performance.now();
    try {
      if (type === 'web' || cleanAddr.startsWith('http')) {
        const fullAddress = cleanAddr.startsWith('http') ? cleanAddr : `https://${cleanAddr}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        await fetch(fullAddress, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
        clearTimeout(timeoutId);
        const endTime = performance.now();
        return {
          active: true,
          latency: Math.max(1, Math.round(endTime - startTime))
        };
      }
    } catch (err: any) {
      return {
        active: false,
        latency: 0,
        error: 'Network connection failed'
      };
    }

    return {
      active: false,
      latency: 0,
      error: 'Host unreachable'
    };
  };

  const retestSingleTarget = async (id: string) => {
    const target = targetsRef.current.find((t) => t.id === id);
    if (!target) return;

    setRetestingTargets((prev) => ({ ...prev, [id]: true }));
    const result = await clientLocalPingTarget(target.type, target.address, id);

    setTargets((prevList) =>
      prevList.map((t) => {
        if (t.id === id) {
          const updatedHistory = [...(t.history || []), result.active ? result.latency : 0].slice(-10);
          const didLose = !result.active;
          return {
            ...t,
            active: result.active,
            latency: result.active ? result.latency : 0,
            history: updatedHistory,
            totalPings: t.totalPings + 1,
            lossCount: t.lossCount + (didLose ? 1 : 0),
            error: result.error
          };
        }
        return t;
      })
    );
    setRetestingTargets((prev) => ({ ...prev, [id]: false }));
  };

  const scanAllTargets = async () => {
    setIsRefreshing(true);
    const currentList = targetsRef.current;
    if (currentList.length === 0) {
      setIsRefreshing(false);
      return;
    }

    // Mark all as retesting
    const retestMap: Record<string, boolean> = {};
    currentList.forEach((t) => { retestMap[t.id] = true; });
    setRetestingTargets(retestMap);

    try {
      // 1. Try fast batch ping
      const batchRes = await fetch('/api/ping-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: currentList.map((t) => ({
            id: t.id,
            address: t.address,
            type: t.type === 'web' ? 'web' : 'ip',
            timeoutMs: 3000
          }))
        })
      });

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        const resultsMap = new Map<string, any>();
        if (Array.isArray(batchData.results)) {
          batchData.results.forEach((r: any) => resultsMap.set(r.id, r));
        }

        setTargets((prevList) =>
          prevList.map((t) => {
            const r = resultsMap.get(t.id);
            const isOnline = r ? (r.status === 'online' && r.active === true) : false;
            const latency = isOnline ? Math.max(1, Number(r.latency) || 1) : 0;
            const updatedHistory = [...(t.history || []), isOnline ? latency : 0].slice(-10);
            const didLose = !isOnline;

            return {
              ...t,
              active: isOnline,
              latency: isOnline ? latency : 0,
              history: updatedHistory,
              totalPings: t.totalPings + 1,
              lossCount: t.lossCount + (didLose ? 1 : 0),
              error: isOnline ? undefined : (r?.error || 'Host unreachable')
            };
          })
        );

        setRetestingTargets({});
        setIsRefreshing(false);
        return;
      }
    } catch (e) {
      console.warn('Batch scan failed, fallback to individual ping:', e);
    }

    // Individual scan fallback
    await Promise.all(
      currentList.map(async (target) => {
        const result = await clientLocalPingTarget(target.type, target.address, target.id);
        
        setTargets((prevList) =>
          prevList.map((t) => {
            if (t.id === target.id) {
              const updatedHistory = [...(t.history || []), result.active ? result.latency : 0].slice(-10);
              const didLose = !result.active;
              return {
                ...t,
                active: result.active,
                latency: result.active ? result.latency : 0,
                history: updatedHistory,
                totalPings: t.totalPings + 1,
                lossCount: t.lossCount + (didLose ? 1 : 0),
                error: result.error
              };
            }
            return t;
          })
        );
        setRetestingTargets((prev) => ({ ...prev, [target.id]: false }));
      })
    );
    setIsRefreshing(false);
  };

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim() || !formAddress.trim()) {
      showErrorToast(t.emptyFields);
      return;
    }

    const rawAddress = formAddress.trim().replace(/^https?:\/\//i, "");
    if (rawAddress.length < 3) {
      showErrorToast(t.invalidAddress);
      return;
    }

    const localId = "target_" + Date.now();
    const newLocalTarget: MonitorTarget = {
      id: localId,
      name: formLabel.trim(),
      type: formType,
      address: rawAddress,
      active: true,
      latency: 0,
      history: [],
      lossCount: 0,
      totalPings: 0,
    };

    try {
      const docRef = await addDoc(collection(db, 'monitor_targets'), {
        name: formLabel.trim(),
        type: formType,
        address: rawAddress,
        active: true,
        ownerId: currentUserUid || '',
        createdAt: serverTimestamp(),
      });

      setFormLabel("");
      setFormAddress("");
      
      setTimeout(() => {
        retestSingleTarget(docRef.id);
      }, 300);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'monitor_targets');
      // Save locally if Firestore write fails (e.g. quota limit reached)
      setTargets((prev) => [...prev, newLocalTarget]);
      setFormLabel("");
      setFormAddress("");
      setTimeout(() => {
        retestSingleTarget(localId);
      }, 300);
    }
  };

  const deleteTarget = async (id: string) => {
    // Optimistically update local state first
    setTargets((prev) => prev.filter((t) => t.id !== id));
    try {
      if (!id.startsWith('default_') && !id.startsWith('target_')) {
        await deleteDoc(doc(db, 'monitor_targets', id));
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'monitor_targets');
    }
  };

  const startEditing = (target: MonitorTarget) => {
    setEditingId(target.id);
    setEditName(target.name);
    setEditAddress(target.address);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim() || !editAddress.trim()) {
      showErrorToast(t.emptyFields);
      return;
    }
    const cleanAddress = editAddress.trim().replace(/^https?:\/\//i, "");
    
    // Always update local state first
    setTargets((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, name: editName.trim(), address: cleanAddress } : t
      )
    );
    setEditingId(null);

    try {
      if (!id.startsWith('default_') && !id.startsWith('target_')) {
        await updateDoc(doc(db, 'monitor_targets', id), {
          name: editName.trim(),
          address: cleanAddress,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'monitor_targets');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const moveTargetUp = (index: number) => {
    if (index === 0) return;
    setTargets((prev) => {
      const nextArr = [...prev];
      const temp = nextArr[index];
      nextArr[index] = nextArr[index - 1];
      nextArr[index - 1] = temp;
      return nextArr;
    });
  };

  const moveTargetDown = (index: number) => {
    if (index === targets.length - 1) return;
    setTargets((prev) => {
      const nextArr = [...prev];
      const temp = nextArr[index];
      nextArr[index] = nextArr[index + 1];
      nextArr[index + 1] = temp;
      return nextArr;
    });
  };

  const showErrorToast = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast("");
    }, 3500);
  };

  const totalCount = targets.length;
  const activeCount = targets.filter((t) => t.active).length;
  const offlineCount = totalCount - activeCount;
  const ipCount = targets.filter((t) => t.type === "ip").length;
  const webCount = targets.filter((t) => t.type === "web").length;

  const sgCount = targets.filter((t) => 
    t.name.toLowerCase().includes("sg") || 
    t.name.toLowerCase().includes("singapore") || 
    t.address.toLowerCase().includes("sg") || 
    t.address.toLowerCase().includes("singtel") ||
    t.address.toLowerCase().includes("equinix")
  ).length;

  const totalValids = targets.filter((t) => t.active && t.latency > 0);
  const averageLatency = totalValids.length 
    ? Math.round(totalValids.reduce((sum, t) => sum + t.latency, 0) / totalValids.length) 
    : 0;

  const displayedTargets = targets.filter((target) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = target.name.toLowerCase().includes(q) || target.address.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (activeTab === "active") return target.active;
    if (activeTab === "offline") return !target.active;
    if (activeTab === "ip") return target.type === "ip";
    if (activeTab === "web") return target.type === "web";
    if (activeTab === "sg") {
      const name = target.name.toLowerCase();
      const addr = target.address.toLowerCase();
      return name.includes("sg") || name.includes("singapore") || addr.includes("sg") || addr.includes("singtel") || addr.includes("equinix");
    }
    return true;
  });

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300 rounded-3xl relative overflow-hidden">
      
      {/* BACKGROUND FLOATING GLOW */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-500/5 to-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ERROR TOAST NOTIFICATION CONTAINER */}
      <AnimatePresence>
        {errorToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-950/90 border border-rose-800 text-rose-200 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs backdrop-blur-md"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{errorToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto w-full space-y-6 shrink-0 relative z-10">
        
        {/* HEADER BRANDING SECTION */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 border border-slate-800/60 p-5 rounded-3xl backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl h-8 w-8 flex items-center justify-center bg-slate-800/80 rounded-xl shadow-inner select-none pointer-events-none" role="img" aria-label="BD Flag">🇧🇩</span>
              <h1 className="text-lg sm:text-xl font-bold font-sans text-slate-50 tracking-tight flex items-center gap-2">
                {t.title}
                <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest font-mono">Live Mirror</span>
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 max-w-xl font-normal leading-relaxed">
              {t.subtitle}
            </p>
          </div>

          {/* LANGUAGE & QUICK RELOADER CONTROLS */}
          <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
            <button 
              onClick={() => setLang(lang === "en" ? "bn" : "en")}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono">{lang === "en" ? "বাংলা" : "English"}</span>
            </button>

            {/* HIDDEN FILE INPUT FOR IMPORT */}
            <input 
              type="file"
              ref={fileInputRef}
              onChange={importFromExcel}
              accept=".xlsx, .xls"
              className="hidden"
            />

            {/* EXPORT EXCEL */}
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 transition-all duration-200 active:scale-95 cursor-pointer hover:border-emerald-500/30"
              title={t.exportBtn}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.exportBtn}</span>
            </button>

            {/* IMPORT EXCEL */}
            <button 
              onClick={triggerFileInput}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 transition-all duration-200 active:scale-95 cursor-pointer hover:border-cyan-500/30"
              title={t.importBtn}
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.importBtn}</span>
            </button>

            {/* SHARE ROUTE URL */}
            <button 
              onClick={copyRouteLink}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 transition-all duration-200 active:scale-95 cursor-pointer hover:border-emerald-500/30"
              title="Copy Direct Route URL"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline font-mono">Share Route</span>
            </button>

            <button 
              onClick={scanAllTargets}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition-all duration-200 disabled:opacity-50 active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? t.retesting : t.retestAll}</span>
            </button>
          </div>
        </header>

        {/* METRICS OVERVIEW STATS BOARD */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/40 border border-slate-800/80 p-4.5 rounded-3xl flex items-center gap-4 hover:border-slate-700/60 transition-all">
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-2xl">
              <Server className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">{t.totalNodes}</span>
              <span className="text-xl font-extrabold text-slate-50 font-mono tracking-tight">{totalCount}</span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-4.5 rounded-3xl flex items-center gap-4 hover:border-slate-700/60 transition-all">
            <div className="p-3 bg-emerald-500/10 border border-emerald-900/50 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">{t.activeNodes}</span>
              <span className="text-xl font-extrabold text-slate-50 font-mono tracking-tight">{activeCount}</span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-4.5 rounded-3xl flex items-center gap-4 hover:border-slate-700/60 transition-all">
            <div className="p-3 bg-rose-500/10 border border-rose-900/50 rounded-2xl">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">{t.offlineNodes}</span>
              <span className="text-xl font-extrabold text-slate-50 font-mono tracking-tight">{offlineCount}</span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-4.5 rounded-3xl flex items-center gap-4 hover:border-slate-700/60 transition-all">
            <div className="p-3 bg-cyan-500/10 border border-cyan-900/50 rounded-2xl">
              <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">{t.avgLatency}</span>
              <span className="text-xl font-extrabold text-slate-50 font-mono tracking-tight">{averageLatency} <span className="text-xs font-normal text-slate-500 font-sans">ms</span></span>
            </div>
          </div>

        </div>

        {/* PRIMARY WORKSPACE CONTENT */}
        <div className="space-y-6">
          
          {/* ADD MONITOR BOX (HORIZONTAL TRAY) */}
          {canEdit && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 backdrop-blur-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                
                <div className="flex items-center gap-2.5 shrink-0">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-100">{t.addTarget}</h3>
                </div>

                <form onSubmit={handleCreateTarget} className="flex-1 flex flex-col sm:flex-row flex-wrap lg:flex-nowrap gap-4 items-stretch sm:items-end w-full">
                  <div className="flex-1 min-w-[160px] space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold font-mono">{t.label}</label>
                    <input 
                      type="text"
                      required
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder={t.labelPlaceholder}
                      className="w-full text-xs bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-sans"
                    />
                  </div>

                  <div className="flex-1 min-w-[200px] space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold font-mono">{t.address}</label>
                    <input 
                      type="text"
                      required
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder={t.addressPlaceholder}
                      className="w-full text-xs bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                    />
                  </div>

                  <div className="min-w-[170px] space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold font-mono block">{t.type}</span>
                    <div className="grid grid-cols-2 gap-2 h-[38px] items-center">
                      <button 
                        type="button"
                        onClick={() => setFormType("ip")}
                        className={`flex items-center justify-center cursor-pointer gap-1.5 h-full px-3 rounded-xl text-[11px] font-bold border transition-all duration-200 ${formType === "ip" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600"}`}
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>ICMP IP</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormType("web")}
                        className={`flex items-center justify-center cursor-pointer gap-1.5 h-full px-3 rounded-xl text-[11px] font-bold border transition-all duration-200 ${formType === "web" ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-300" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600"}`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>HTTP URL</span>
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="text-xs font-bold h-[38px] px-6 bg-slate-100 hover:bg-slate-200 text-slate-950 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-white/5 cursor-pointer shrink-0 sm:self-end active:scale-95"
                  >
                    {t.addBtn}
                  </button>
                </form>

              </div>

              {/* QUICK SG / BDIX ROUTING PRESET BUTTONS */}
              <div className="mt-3 pt-3 border-t border-slate-800/70 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 text-amber-400" />
                  {lang === "en" ? "Fast Route Presets:" : "দ্রুত রুট প্রিসেটস:"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFormLabel("SG Equinix SG1 Core");
                    setFormAddress("103.246.126.1");
                    setFormType("ip");
                  }}
                  className="px-2.5 py-1 bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700/80 hover:border-amber-500/40 rounded-lg text-[10px] font-mono text-slate-300 hover:text-amber-300 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>🇸🇬 SG Equinix SG1 (103.246.126.1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormLabel("SingTel Transit SG Gateway");
                    setFormAddress("203.116.1.1");
                    setFormType("ip");
                  }}
                  className="px-2.5 py-1 bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700/80 hover:border-amber-500/40 rounded-lg text-[10px] font-mono text-slate-300 hover:text-amber-300 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>🇸🇬 SingTel Gateway (203.116.1.1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormLabel("SG Cloudflare Node");
                    setFormAddress("1.1.1.1");
                    setFormType("ip");
                  }}
                  className="px-2.5 py-1 bg-slate-800/90 hover:bg-cyan-500/20 border border-slate-700/80 hover:border-cyan-500/40 rounded-lg text-[10px] font-mono text-slate-300 hover:text-cyan-300 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>⚡ Cloudflare Anycast (1.1.1.1)</span>
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE MONITORS PANEL */}
          <div className="space-y-4">
            
            {/* TIMERS CONTROL STRIP */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 p-4 rounded-3xl backdrop-blur-md">
              
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{t.autoRefresh}</span>
                
                {refreshInterval > 0 && (
                  <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 px-2.5 py-0.5 rounded-lg font-bold font-mono">
                    {countdown}{t.seconds}
                  </span>
                )}
              </div>

              {/* SEARCH BOX */}
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search targets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-700 px-3 pl-9 py-2 rounded-xl text-xs text-slate-300 w-48 sm:w-64 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-1.5 rounded-2xl">
                {[0, 5, 10, 30].map((val) => (
                  <button
                    key={val}
                    onClick={() => setRefreshInterval(val)}
                    className={`py-1 px-3 rounded-xl text-[10px] font-bold font-mono cursor-pointer transition-all uppercase ${refreshInterval === val ? "bg-slate-200 border border-slate-400 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {val === 0 ? "Pause" : `${val}s`}
                  </button>
                ))}
              </div>

            </div>

            {/* ROUTE FILTER TABS BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 p-2.5 rounded-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleTabChange("all")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "all"
                      ? "bg-slate-100 text-slate-950 shadow-md shadow-white/5"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>All Nodes</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${activeTab === "all" ? "bg-slate-900 text-slate-100" : "bg-slate-800 text-slate-400"}`}>
                    {totalCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("active")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "active"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Online</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {activeCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("offline")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "offline"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Offline</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                    {offlineCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("ip")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "ip"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ICMP IP</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {ipCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("web")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "web"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>HTTP Web</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {webCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("sg")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "sg"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === "en" ? "🇸🇬 SG Route" : "🇸🇬 সিঙ্গাপুর রুট"}</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">
                    {sgCount}
                  </span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-400 px-2 py-1 bg-slate-900/60 rounded-lg border border-slate-800">
                Route: <span className="text-cyan-400 font-bold">?view=monitor_targets&tab={activeTab}</span>
              </div>
            </div>

            {/* MAIN DATA RENDERING HORIZONTAL LIST */}
            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {displayedTargets.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center bg-slate-900/30 border border-slate-800/60 rounded-2xl text-slate-400 text-xs font-medium"
                  >
                    No target nodes found for route filter "<span className="text-cyan-400 font-bold uppercase">{activeTab}</span>".
                  </motion.div>
                ) : (
                  displayedTargets.map((target, index) => {
                    const isRetesting = retestingTargets[target.id] || false;
                    const lossPercent = target.totalPings > 0 
                      ? Math.round((target.lossCount / target.totalPings) * 100) 
                      : 0;

                  return (
                    <motion.div
                      key={target.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: -10 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      className={`bg-slate-900/40 hover:bg-slate-900/60 transition-all border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group/tile ${!target.active ? "border-rose-900/50" : "border-slate-800"}`}
                    >
                      {/* IDENTITY & STATUS */}
                      <div className="flex items-center gap-3.5 min-w-[200px] md:max-w-[240px] shrink-0 flex-1">
                        <span className={`h-2.5 w-2.5 rounded-full ring-4 shrink-0 ${target.active ? "bg-emerald-500 ring-emerald-500/10" : "bg-rose-500 ring-rose-500/10 animate-pulse"}`} />
                        {editingId === target.id ? (
                          <div className="flex flex-col gap-2 w-full pr-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="text-xs bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
                              placeholder={t.labelPlaceholder}
                            />
                            <input
                              type="text"
                              value={editAddress}
                              onChange={(e) => setEditAddress(e.target.value)}
                              className="text-[11px] bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
                              placeholder={t.addressPlaceholder}
                            />
                          </div>
                        ) : (
                          <div className="truncate">
                            <h4 className="text-sm font-bold text-slate-100 group-hover/tile:text-emerald-400 transition-colors truncate">{target.name}</h4>
                            <span className="text-[11px] text-slate-500 font-mono select-all block truncate">{target.address}</span>
                          </div>
                        )}
                      </div>

                      {/* PROTOCOL TYPE */}
                      <div className="shrink-0 flex items-center md:justify-center md:w-[90px]">
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md ${target.type === "web" ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400" : "bg-teal-500/10 border border-teal-500/20 text-teal-400"}`}>
                          {target.type === "web" ? "HTTP URL" : "ICMP IP"}
                        </span>
                      </div>

                      {/* LATENCY */}
                      <div className="flex flex-col shrink-0 md:w-[100px] justify-center md:items-start">
                        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">{t.latency}</span>
                        <div className={`text-xl font-extrabold font-mono tracking-tight ${target.active ? "text-slate-50" : "text-rose-500"}`}>
                          {target.active ? `${target.latency}` : "--"}
                          {target.active && <span className="text-xs font-normal text-slate-500 font-sans ml-1">ms</span>}
                        </div>
                      </div>

                      {/* PACKET LOSS */}
                      <div className="flex flex-col shrink-0 md:w-[100px] justify-center md:items-start">
                        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">{t.packetLoss}</span>
                        <div>
                          <span className={`text-xs font-bold font-mono ${lossPercent > 0 ? "text-rose-500 bg-rose-500/10 border-rose-900/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-900/20"} px-2.5 py-0.5 rounded-lg border`}>
                            {lossPercent}%
                          </span>
                        </div>
                      </div>

                      {/* TIMELINE */}
                      <div className="flex flex-col shrink-0 md:w-[140px]">
                        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-1">{t.statusTimeline}</span>
                        <div className="flex gap-0.5 items-center bg-slate-900 p-1 rounded-lg border border-slate-800 select-none">
                          {Array.from({ length: 10 }).map((_, idx) => {
                            const val = target.history ? target.history[idx] : undefined;
                            const exists = val !== undefined;
                            
                            let colorClass = "bg-slate-700";
                            if (exists) {
                              colorClass = val > 0 ? "bg-emerald-500" : "bg-rose-500 animate-pulse";
                            }

                            return (
                              <div
                                key={idx}
                                className={`h-3 flex-1 rounded-sm relative transition-all duration-300 pointer-events-auto cursor-help border border-transparent hover:border-white/20 hover:scale-110 ${colorClass}`}
                                title={exists ? (val > 0 ? `${val}ms` : "Offline/Lost") : "No check yet"}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex gap-2 shrink-0 md:justify-end items-center flex-wrap md:flex-nowrap">
                        {/* Up/Down Sorting Arrows */}
                        <div className="flex bg-slate-900/60 border border-slate-800 rounded-xl p-0.5 shrink-0">
                          <button
                            onClick={() => moveTargetUp(index)}
                            disabled={index === 0}
                            className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveTargetDown(index)}
                            disabled={index === targets.length - 1}
                            className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {editingId === target.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(target.id)}
                              className="p-2 bg-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 rounded-xl text-emerald-400 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                              title={t.save}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                              title={t.cancel}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => retestSingleTarget(target.id)}
                              disabled={isRetesting}
                              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 active:scale-95 text-slate-300 disabled:opacity-50 min-w-[70px] cursor-pointer"
                            >
                              <RefreshCw className={`w-3 h-3 ${isRetesting ? "animate-spin" : ""}`} />
                              <span>{isRetesting ? "Wait" : "Retest"}</span>
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => startEditing(target)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-cyan-400 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                title={t.edit}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => deleteTarget(target.id)}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-900/40 rounded-xl text-rose-400 hover:border-transparent transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                title={t.delete}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>

                    </motion.div>
                  );
                })
              )}
              </AnimatePresence>
            </div>

          </div>

        </div>

      </div>

      {/* FOOTER METRICS INFO SYSTEM RAILS */}
      <footer className="mt-12 border-t border-slate-800/80 pt-6 max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-mono text-slate-500 shrink-0 relative z-10">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>PING MONITOR PRO: ACTIVE</span>
        </div>
        <div>
          <span>High Precision Node Calibration Service</span>
        </div>
      </footer>

    </div>
  );
}

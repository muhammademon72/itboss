import React, { useState, useEffect, useRef } from 'react';
import {
  Server as ServerIcon,
  Globe,
  Radio,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Upload,
  BarChart3,
  Sliders,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Zap,
  Shield,
  Layers,
  Check,
  X,
  History,
  TrendingUp,
  Cpu,
  Wifi,
  ExternalLink,
  LayoutGrid,
  Table as TableIcon,
  Terminal,
  Copy,
  Play,
  Pause,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { Server, PingRecord, LedgerPermissions } from '../types';

interface ServerMonitoringProps {
  currentUserUid: string;
  isAdmin?: boolean;
  permissions?: LedgerPermissions;
}

export default function ServerMonitoring({
  currentUserUid,
  isAdmin = false,
  permissions
}: ServerMonitoringProps) {
  const canEdit = isAdmin || (permissions?.edit ?? true);
  const canDelete = isAdmin || (permissions?.delete ?? true);

  // Core Data States
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const serversRef = useRef<Server[]>([]);
  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  const [activeTab, setActiveTab] = useState<'all' | 'online' | 'offline'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'web' | 'server' | 'ping'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<'name' | 'address' | 'status' | 'avgResponseTime' | 'lastChecked'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Ping Operation States
  const [pingingServerId, setPingingServerId] = useState<string | null>(null);
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(5);
  const [countdown, setCountdown] = useState<number>(5);
  const autoPingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredInitialPing = useRef(false);

  // Live seconds ticker to update "Xs ago" in real-time
  const [secondTick, setSecondTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSecondTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Terminal Stream Console States
  const [terminalServer, setTerminalServer] = useState<Server | null>(null);
  const [terminalLines, setTerminalLines] = useState<{ seq: number; text: string; success: boolean; latency: number; ttl?: number }[]>([]);
  const [isTerminalStreaming, setIsTerminalStreaming] = useState(true);
  const [terminalPacketSize, setTerminalPacketSize] = useState<number>(64);
  const [terminalCopied, setTerminalCopied] = useState(false);
  const terminalEventSourceRef = useRef<EventSource | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Format dynamic relative time ago (updating every second)
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Never';
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
    if (diffSec === 0) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return new Date(isoString).toLocaleTimeString();
  };

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<Server | null>(null);
  const [historyModalServer, setHistoryModalServer] = useState<Server | null>(null);
  const [serverHistoryRecords, setServerHistoryRecords] = useState<PingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPort, setFormPort] = useState('');
  const [formMonitoringType, setFormMonitoringType] = useState<'web' | 'server' | 'ping'>('ping');
  const [formPacketSize, setFormPacketSize] = useState<number>(64);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback Notification
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3500);
  };

  // 1. Subscribe to Live Servers Collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'servers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Server[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            address: data.address || '',
            monitoringType: data.monitoringType || 'ping',
            port: data.port || undefined,
            packetSize: data.packetSize ?? 64,
            status: data.status || 'offline',
            lastChecked: data.lastChecked || '',
            avgResponseTime: data.avgResponseTime ?? 0,
            lastLatency: data.lastLatency ?? data.avgResponseTime ?? 0,
            ttl: data.ttl,
            packetLoss: data.packetLoss,
            method: data.method,
            recentLatencies: data.recentLatencies || [],
            createdAt: data.createdAt || ''
          };
        });
        setServers(list);
        setLoading(false);
      },
      (err) => {
        console.error('Servers subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Trigger immediate initial live ping on load
  useEffect(() => {
    if (!hasTriggeredInitialPing.current && servers.length > 0 && !loading) {
      hasTriggeredInitialPing.current = true;
      runPingAll(false);
    }
  }, [servers.length, loading]);

  // Live Terminal Streaming via Server-Sent Events (SSE)
  useEffect(() => {
    if (!terminalServer || !isTerminalStreaming) {
      if (terminalEventSourceRef.current) {
        terminalEventSourceRef.current.close();
        terminalEventSourceRef.current = null;
      }
      return;
    }

    const s = terminalServer;
    const pSize = terminalPacketSize || s.packetSize || 64;
    const url = `/api/ping-stream?address=${encodeURIComponent(s.address)}&packetSize=${pSize}`;
    const es = new EventSource(url);
    terminalEventSourceRef.current = es;

    setTerminalLines((prev) => [
      ...prev,
      { seq: 0, text: `--- PING ${s.address} (${pSize} bytes payload) ---`, success: true, latency: 0 }
    ]);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'start') {
          // Started
        } else if (data.type === 'packet') {
          const lineText = data.success
            ? `${data.packetSize} bytes from ${data.host}: icmp_seq=${data.seq} ttl=${data.ttl || 49} time=${data.latency} ms`
            : `Request timeout for icmp_seq ${data.seq} (100% loss)`;

          setTerminalLines((prev) => [
            ...prev.slice(-99),
            {
              seq: data.seq,
              text: lineText,
              success: data.success,
              latency: data.latency,
              ttl: data.ttl
            }
          ]);
        }
      } catch (err) {
        console.warn('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [terminalServer, isTerminalStreaming, terminalPacketSize]);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines]);

  // 2. Fetch History when history modal is opened
  useEffect(() => {
    if (!historyModalServer) {
      setServerHistoryRecords([]);
      return;
    }

    setLoadingHistory(true);
    const historyQuery = query(
      collection(db, 'history'),
      where('serverId', '==', historyModalServer.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubHistory = onSnapshot(
      historyQuery,
      (snap) => {
        const recs: PingRecord[] = snap.docs.map((d) => ({
          id: d.id,
          serverId: d.data().serverId,
          timestamp: d.data().timestamp,
          status: d.data().status,
          responseTime: d.data().responseTime
        }));
        setServerHistoryRecords(recs);
        setLoadingHistory(false);
      },
      (err) => {
        console.warn('History subscription fallback:', err);
        setLoadingHistory(false);
      }
    );

    return () => unsubHistory();
  }, [historyModalServer]);

  // 3. Automated Ping Cycle with stable countdown
  useEffect(() => {
    if (!autoRefresh) {
      if (autoPingTimerRef.current) clearInterval(autoPingTimerRef.current);
      return;
    }

    setCountdown(refreshIntervalSec);
    autoPingTimerRef.current = setInterval(() => {
      runPingAll(false);
      setCountdown(refreshIntervalSec);
    }, refreshIntervalSec * 1000);

    const countInterval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? refreshIntervalSec : prev - 1));
    }, 1000);

    return () => {
      if (autoPingTimerRef.current) clearInterval(autoPingTimerRef.current);
      clearInterval(countInterval);
    };
  }, [autoRefresh, refreshIntervalSec]);

  // Actual Real Ping Engine (ICMP, TCP, DNS, HTTP)
  const executePing = async (server: Server): Promise<{
    status: 'online' | 'offline';
    responseTime: number;
    ttl?: number;
    packetLoss?: number;
    method?: string;
    rawOutput?: string;
  }> => {
    const cleanAddress = server.address.trim();
    if (!cleanAddress) {
      return { status: 'offline', responseTime: 0, packetLoss: 100 };
    }

    try {
      // Real backend ping endpoint
      const res = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: cleanAddress,
          type: server.monitoringType === 'web' ? 'web' : 'ip',
          port: server.port,
          packetSize: server.packetSize ?? 64,
          timeoutMs: 2500
        })
      });

      if (res.ok) {
        const data = await res.json();
        const isOnline = data.status === 'online' && data.active === true;
        return {
          status: isOnline ? 'online' : 'offline',
          responseTime: isOnline ? Math.max(1, Number(data.latency) || 1) : 0,
          ttl: data.ttl,
          packetLoss: data.packetLoss ?? (isOnline ? 0 : 100),
          method: data.method,
          rawOutput: data.rawOutput
        };
      }
    } catch (apiErr) {
      console.warn('API ping fallback to client probe:', apiErr);
    }

    // Client-side fallback for Web URL checks
    const startTime = performance.now();
    try {
      if (server.monitoringType === 'web' || cleanAddress.startsWith('http://') || cleanAddress.startsWith('https://')) {
        const targetUrl = cleanAddress.startsWith('http') ? cleanAddress : `https://${cleanAddress}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        await fetch(targetUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const latency = Math.max(1, Math.round(performance.now() - startTime));
        return { status: 'online', responseTime: latency, packetLoss: 0, method: 'http' };
      }
    } catch {
      return { status: 'offline', responseTime: 0, packetLoss: 100 };
    }

    return { status: 'offline', responseTime: 0, packetLoss: 100 };
  };

  const handleSinglePing = async (server: Server) => {
    if (pingingServerId) return;
    setPingingServerId(server.id);

    try {
      const result = await executePing(server);
      const nowIso = new Date().toISOString();

      const prevRecent = server.recentLatencies || (server.avgResponseTime ? [server.avgResponseTime] : []);
      const newRecent = result.status === 'online'
        ? [...prevRecent.slice(-5), result.responseTime]
        : [...prevRecent.slice(-5), 0];

      // 1. Immediately update UI state with real-time latency
      setServers((prev) =>
        prev.map((s) =>
          s.id === server.id
            ? {
                ...s,
                status: result.status,
                lastChecked: nowIso,
                lastLatency: result.status === 'online' ? result.responseTime : 0,
                avgResponseTime: result.status === 'online' ? result.responseTime : 0,
                ttl: result.ttl,
                packetLoss: result.packetLoss,
                method: result.method,
                recentLatencies: newRecent
              }
            : s
        )
      );

      if (result.status === 'online') {
        const ttlInfo = result.ttl ? ` [TTL: ${result.ttl}]` : '';
        const methodBadge = result.method ? ` via ${result.method.toUpperCase()}` : '';
        showNotification('success', `Pinged ${server.name}: ONLINE (${result.responseTime}ms)${ttlInfo}${methodBadge}`);
      } else {
        showNotification('error', `Pinged ${server.name}: OFFLINE (Host unreachable / 100% loss)`);
      }

      // 2. Persist to Firestore asynchronously
      const serverRef = doc(db, 'servers', server.id);
      updateDoc(serverRef, {
        status: result.status,
        lastChecked: nowIso,
        lastLatency: result.status === 'online' ? result.responseTime : 0,
        avgResponseTime: result.status === 'online' ? result.responseTime : 0,
        ttl: result.ttl || null,
        packetLoss: result.packetLoss ?? (result.status === 'online' ? 0 : 100),
        method: result.method || 'icmp'
      }).catch((dbErr) => console.warn('Firestore server update warning:', dbErr));

      addDoc(collection(db, 'history'), {
        serverId: server.id,
        timestamp: nowIso,
        status: result.status,
        responseTime: result.responseTime
      }).catch((dbErr) => console.warn('Firestore history add warning:', dbErr));

    } catch (err) {
      console.error('Single ping failed:', err);
      showNotification('error', 'Ping test encountered an error.');
    } finally {
      setPingingServerId(null);
    }
  };

  const runPingAll = async (manualNotice = true) => {
    const currentServers = serversRef.current;
    if (currentServers.length === 0 || isPingingAll) return;
    setIsPingingAll(true);

    let onlineCount = 0;
    const nowIso = new Date().toISOString();

    // Fast batch ping using /api/ping-batch
    try {
      const batchRes = await fetch('/api/ping-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: currentServers.map((s) => ({
            id: s.id,
            address: s.address,
            type: s.monitoringType === 'web' ? 'web' : 'ip',
            port: s.port,
            packetSize: s.packetSize ?? 64,
            timeoutMs: 2500
          }))
        })
      });

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        const resultsMap = new Map<string, any>();
        if (Array.isArray(batchData.results)) {
          batchData.results.forEach((r: any) => resultsMap.set(r.id, r));
        }

        const updatedList: Server[] = [];
        const rawResults: { id: string; status: 'online' | 'offline'; responseTime: number; ttl?: number; packetLoss?: number; method?: string }[] = [];

        for (const s of currentServers) {
          const r = resultsMap.get(s.id);
          const isOnline = r ? (r.status === 'online' && r.active === true) : false;
          const respTime = isOnline ? Math.max(1, Number(r.latency) || 1) : 0;
          const status: 'online' | 'offline' = isOnline ? 'online' : 'offline';

          if (isOnline) onlineCount++;

          const prevRecent = s.recentLatencies || (s.avgResponseTime ? [s.avgResponseTime] : []);
          const newRecent = isOnline
            ? [...prevRecent.slice(-5), respTime]
            : [...prevRecent.slice(-5), 0];

          updatedList.push({
            ...s,
            status,
            lastChecked: nowIso,
            lastLatency: isOnline ? respTime : 0,
            avgResponseTime: isOnline ? respTime : 0,
            ttl: r?.ttl,
            packetLoss: r?.packetLoss ?? (isOnline ? 0 : 100),
            method: r?.method,
            recentLatencies: newRecent
          });

          rawResults.push({
            id: s.id,
            status,
            responseTime: respTime,
            ttl: r?.ttl,
            packetLoss: r?.packetLoss ?? (isOnline ? 0 : 100),
            method: r?.method
          });
        }

        // 1. Immediately update UI state!
        setServers(updatedList);
        setIsPingingAll(false);

        if (manualNotice) {
          showNotification(
            onlineCount > 0 ? 'success' : 'warning',
            `Ping completed: ${onlineCount}/${currentServers.length} servers ONLINE, ${currentServers.length - onlineCount} OFFLINE.`
          );
        }

        // 2. Persist in parallel to Firestore without blocking the UI
        Promise.allSettled(
          rawResults.map(async (item) => {
            const serverRef = doc(db, 'servers', item.id);
            await updateDoc(serverRef, {
              status: item.status,
              lastChecked: nowIso,
              lastLatency: item.responseTime,
              avgResponseTime: item.responseTime,
              ttl: item.ttl || null,
              packetLoss: item.packetLoss ?? (item.status === 'online' ? 0 : 100),
              method: item.method || 'icmp'
            });
            await addDoc(collection(db, 'history'), {
              serverId: item.id,
              timestamp: nowIso,
              status: item.status,
              responseTime: item.responseTime
            });
          })
        ).catch((syncErr) => console.warn('Background Firestore sync warning:', syncErr));

        return;
      }
    } catch (batchErr) {
      console.warn('Batch ping failed, falling back to sequential ping:', batchErr);
    }

    // Sequential fallback
    const fallbackList: Server[] = [];
    for (const s of currentServers) {
      try {
        const result = await executePing(s);
        const isOnline = result.status === 'online';
        if (isOnline) onlineCount++;

        const prevRecent = s.recentLatencies || (s.avgResponseTime ? [s.avgResponseTime] : []);
        const newRecent = isOnline
          ? [...prevRecent.slice(-5), result.responseTime]
          : [...prevRecent.slice(-5), 0];

        fallbackList.push({
          ...s,
          status: result.status,
          lastChecked: nowIso,
          lastLatency: isOnline ? result.responseTime : 0,
          avgResponseTime: isOnline ? result.responseTime : 0,
          ttl: result.ttl,
          packetLoss: result.packetLoss,
          method: result.method,
          recentLatencies: newRecent
        });

        // Fire-and-forget DB update
        updateDoc(doc(db, 'servers', s.id), {
          status: result.status,
          lastChecked: nowIso,
          lastLatency: isOnline ? result.responseTime : 0,
          avgResponseTime: isOnline ? result.responseTime : 0,
          ttl: result.ttl || null,
          packetLoss: result.packetLoss ?? (isOnline ? 0 : 100),
          method: result.method || 'icmp'
        }).catch(() => {});

        addDoc(collection(db, 'history'), {
          serverId: s.id,
          timestamp: nowIso,
          status: result.status,
          responseTime: result.responseTime
        }).catch(() => {});
      } catch (e) {
        console.warn(`Ping failed for ${s.name}:`, e);
      }
    }

    if (fallbackList.length > 0) {
      setServers(fallbackList);
    }
    setIsPingingAll(false);
    if (manualNotice) {
      showNotification('success', `Ping test finished: ${onlineCount}/${currentServers.length} servers online.`);
    }
  };

  // Preset quick fill
  const applyPreset = (name: string, address: string, type: 'web' | 'server' | 'ping', packetSize = 64, port = '') => {
    setFormName(name);
    setFormAddress(address);
    setFormMonitoringType(type);
    setFormPacketSize(packetSize);
    setFormPort(port);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingServer(null);
    setFormName('');
    setFormAddress('');
    setFormPort('');
    setFormMonitoringType('ping');
    setFormPacketSize(64);
    setFormError(null);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (server: Server) => {
    setEditingServer(server);
    setFormName(server.name);
    setFormAddress(server.address);
    setFormPort(server.port ? server.port.toString() : '');
    setFormMonitoringType(server.monitoringType);
    setFormPacketSize(server.packetSize ?? 64);
    setFormError(null);
    setShowAddModal(true);
  };

  // Handle Save / Update Server
  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      setFormError('Please enter both server name and host address.');
      return;
    }

    if (formName.length > 100) {
      setFormError('Server name must be 100 characters or less.');
      return;
    }

    if (formAddress.length > 255) {
      setFormError('Address must be 255 characters or less.');
      return;
    }

    const parsedPort = formPort.trim() ? parseInt(formPort.trim(), 10) : undefined;
    const validPort = (parsedPort && !isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) ? parsedPort : undefined;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const nowIso = new Date().toISOString();

      if (editingServer) {
        // Update existing server
        const serverRef = doc(db, 'servers', editingServer.id);
        await updateDoc(serverRef, {
          name: formName.trim(),
          address: formAddress.trim(),
          monitoringType: formMonitoringType,
          packetSize: Number(formPacketSize) || 64,
          port: validPort || null
        });
        showNotification('success', `Updated server "${formName.trim()}"`);
      } else {
        // Probe right away to get initial real status
        const initialProbe = await executePing({
          id: 'temp',
          name: formName.trim(),
          address: formAddress.trim(),
          monitoringType: formMonitoringType,
          packetSize: Number(formPacketSize) || 64,
          port: validPort,
          status: 'offline'
        });

        // Create new server
        const newServerData = {
          name: formName.trim(),
          address: formAddress.trim(),
          monitoringType: formMonitoringType,
          packetSize: Number(formPacketSize) || 64,
          port: validPort || null,
          status: initialProbe.status,
          lastChecked: nowIso,
          avgResponseTime: initialProbe.responseTime,
          createdAt: nowIso
        };

        const addedDoc = await addDoc(collection(db, 'servers'), newServerData);

        // Add initial history record
        await addDoc(collection(db, 'history'), {
          serverId: addedDoc.id,
          timestamp: nowIso,
          status: initialProbe.status,
          responseTime: initialProbe.responseTime
        });

        showNotification('success', `Added server "${formName.trim()}" (Status: ${initialProbe.status.toUpperCase()})`);
      }

      setShowAddModal(false);
      setEditingServer(null);
    } catch (err: any) {
      console.error('Error saving server:', err);
      setFormError(err.message || 'Failed to save server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Server
  const handleDeleteServer = async () => {
    if (!deleteConfirmServer) return;
    try {
      await deleteDoc(doc(db, 'servers', deleteConfirmServer.id));
      showNotification('success', `Removed server "${deleteConfirmServer.name}"`);
      setDeleteConfirmServer(null);
    } catch (err) {
      console.error('Error deleting server:', err);
      showNotification('error', 'Failed to delete server.');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (servers.length === 0) {
      showNotification('error', 'No server records to export.');
      return;
    }

    const data = servers.map((s, idx) => ({
      SL: idx + 1,
      'Server Name': s.name,
      'Host Address': s.address,
      'Monitoring Type': s.monitoringType.toUpperCase(),
      'Packet Size (Bytes)': s.packetSize ?? 64,
      Status: s.status.toUpperCase(),
      'Avg Latency (ms)': s.avgResponseTime || 0,
      'Last Checked': s.lastChecked ? new Date(s.lastChecked).toLocaleString() : 'N/A',
      'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monitored_Servers');
    XLSX.writeFile(wb, `Servers_Monitor_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotification('success', 'Servers exported to Excel.');
  };

  // Import from Excel / CSV
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          showNotification('error', 'No rows found in file.');
          return;
        }

        let importCount = 0;
        const nowIso = new Date().toISOString();

        for (const row of rows) {
          const name = row['Server Name'] || row['name'] || row['Name'] || row['Server'] || row['Hostname'];
          const address = row['Host Address'] || row['address'] || row['Address'] || row['IP'] || row['URL'];
          if (name && address) {
            const mTypeRaw = String(row['Monitoring Type'] || row['monitoringType'] || row['Type'] || 'ping').toLowerCase();
            const monitoringType: 'web' | 'server' | 'ping' = mTypeRaw.includes('web') ? 'web' : mTypeRaw.includes('server') ? 'server' : 'ping';
            const packetSize = Number(row['Packet Size (Bytes)'] || row['packetSize'] || 64);

            await addDoc(collection(db, 'servers'), {
              name: String(name).slice(0, 100),
              address: String(address).slice(0, 255),
              monitoringType,
              packetSize,
              status: 'online',
              lastChecked: nowIso,
              avgResponseTime: 20,
              createdAt: nowIso
            });
            importCount++;
          }
        }

        showNotification('success', `Imported ${importCount} servers successfully.`);
      } catch (err) {
        console.error('Import error:', err);
        showNotification('error', 'Failed to parse Excel file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Sorting Helper
  const handleSort = (field: 'name' | 'address' | 'status' | 'avgResponseTime' | 'lastChecked') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered & Sorted List
  const filteredServers = servers.filter((s) => {
    if (activeTab === 'online' && s.status !== 'online') return false;
    if (activeTab === 'offline' && s.status !== 'offline') return false;
    if (typeFilter !== 'all' && s.monitoringType !== typeFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.monitoringType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedAndFilteredServers = [...filteredServers].sort((a, b) => {
    let comp = 0;
    if (sortField === 'name') {
      comp = a.name.localeCompare(b.name);
    } else if (sortField === 'address') {
      comp = a.address.localeCompare(b.address);
    } else if (sortField === 'status') {
      const aVal = a.status === 'online' ? 1 : 0;
      const bVal = b.status === 'online' ? 1 : 0;
      comp = bVal - aVal;
    } else if (sortField === 'avgResponseTime') {
      const aVal = a.status === 'online' ? (a.avgResponseTime || 0) : 999999;
      const bVal = b.status === 'online' ? (b.avgResponseTime || 0) : 999999;
      comp = aVal - bVal;
    } else if (sortField === 'lastChecked') {
      const aVal = a.lastChecked ? new Date(a.lastChecked).getTime() : 0;
      const bVal = b.lastChecked ? new Date(b.lastChecked).getTime() : 0;
      comp = bVal - aVal;
    }
    return sortDirection === 'asc' ? comp : -comp;
  });

  // Global Metrics
  const totalServers = servers.length;
  const onlineServers = servers.filter((s) => s.status === 'online').length;
  const offlineServers = servers.filter((s) => s.status === 'offline').length;
  const uptimePercent = totalServers > 0 ? Math.round((onlineServers / totalServers) * 100) : 100;
  const activeAvgLatency = servers.filter(s => s.status === 'online' && s.avgResponseTime).length > 0
    ? Math.round(
        servers.filter(s => s.status === 'online' && s.avgResponseTime).reduce((acc, curr) => acc + (curr.avgResponseTime || 0), 0) /
        servers.filter(s => s.status === 'online' && s.avgResponseTime).length
      )
    : 0;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Toast Notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold backdrop-blur-md ${
              notice.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{notice.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <ServerIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                  Server & Host Monitoring
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Network & System
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Real-time heartbeat monitoring, ICMP ping probes & historical response time logs for infrastructure servers.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => runPingAll(true)}
              disabled={isPingingAll || servers.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
              title="Ping all registered servers sequentially"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPingingAll ? 'animate-spin' : ''}`} />
              <span>{isPingingAll ? 'Pinging All...' : 'Ping All Servers'}</span>
            </button>

            {canEdit && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Server</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
              <button
                onClick={handleExportExcel}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 text-xs font-medium transition cursor-pointer"
                title="Export Servers List to Excel"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <label
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 text-xs font-medium transition cursor-pointer"
                title="Import Servers from Excel (.xlsx)"
              >
                <Upload className="h-3.5 w-3.5" />
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportFile} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Live Auto-Refresh & Calibration Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                Real-Time Auto Ping
              </span>
            </label>

            {autoRefresh && (
              <>
                <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/50">
                  <Clock className="h-3 w-3 text-indigo-400" />
                  <span className="text-[11px]">Interval:</span>
                  <select
                    value={refreshIntervalSec}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRefreshIntervalSec(val);
                      setCountdown(val);
                    }}
                    className="bg-transparent text-indigo-300 font-mono text-[11px] font-bold focus:outline-hidden cursor-pointer"
                  >
                    <option value={3} className="bg-slate-900 text-white">3s (Ultra Live)</option>
                    <option value={5} className="bg-slate-900 text-white">5s (Live Pulse)</option>
                    <option value={10} className="bg-slate-900 text-white">10s</option>
                    <option value={30} className="bg-slate-900 text-white">30s</option>
                    <option value={60} className="bg-slate-900 text-white">60s</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]">
                  <Activity className="h-3 w-3 text-indigo-400 animate-pulse" />
                  <span>Next Probe:</span>
                  <span className="font-bold text-emerald-400">{countdown}s</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Live Ping Engine:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ICMP KERNEL
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Database:</span>
              <span className="text-indigo-400 font-bold">FIRESTORE SYNCED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Servers</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ServerIcon className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{totalServers}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Nodes Registered</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Online Nodes</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">{onlineServers}</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">{uptimePercent}% Operational</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Offline Nodes</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">{offlineServers}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">{totalServers > 0 ? ((offlineServers / totalServers) * 100).toFixed(0) : 0}% Packet Loss / Down</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Response Time</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight font-mono">
            {activeAvgLatency} <span className="text-sm font-semibold text-slate-400">ms</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Weighted Round-Trip Latency</div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All ({servers.length})
            </button>
            <button
              onClick={() => setActiveTab('online')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'online'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Online ({onlineServers})
            </button>
            <button
              onClick={() => setActiveTab('offline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'offline'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Offline ({offlineServers})
            </button>
          </div>

          {/* Search, Type & View Mode Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View (Recommended)"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Box / Card View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Box</span>
              </button>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="ping">Ping (ICMP)</option>
                <option value="server">Server (Host)</option>
                <option value="web">Web (HTTP/S)</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search server, IP, domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Servers List View */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <RefreshCw className="h-7 w-7 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Loading Monitored Servers from Firestore...</p>
        </div>
      ) : sortedAndFilteredServers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
            <ServerIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">No Servers Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchTerm || activeTab !== 'all' || typeFilter !== 'all'
                ? 'No monitored servers match your current search or filter criteria.'
                : 'No server targets have been configured yet in the Network & System cluster.'}
            </p>
          </div>
          {canEdit && !searchTerm && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Server</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE SYSTEM */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center font-mono">#</th>
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Server & Host</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Type</th>
                  <th
                    onClick={() => handleSort('status')}
                    className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('avgResponseTime')}
                    className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Latency (RTT)</span>
                      {sortField === 'avgResponseTime' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Packet Size</th>
                  <th
                    onClick={() => handleSort('lastChecked')}
                    className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Last Probe</span>
                      {sortField === 'lastChecked' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sortedAndFilteredServers.map((server, idx) => {
                  const isOnline = server.status === 'online';
                  const isCurrentlyPinging = pingingServerId === server.id;
                  const latency = server.avgResponseTime || 0;

                  return (
                    <tr
                      key={server.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isOnline ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400 font-semibold">
                        {idx + 1}
                      </td>

                      {/* Server Name & Address */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              server.monitoringType === 'web'
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                : server.monitoringType === 'server'
                                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                : 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                            }`}
                          >
                            {server.monitoringType === 'web' ? (
                              <Globe className="h-4 w-4" />
                            ) : server.monitoringType === 'server' ? (
                              <ServerIcon className="h-4 w-4" />
                            ) : (
                              <Radio className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                              <span>{server.name}</span>
                              {server.port && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  :{server.port}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-500 text-xs truncate flex items-center gap-1">
                              <span>{server.address}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Monitoring Type */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {server.monitoringType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                            isOnline
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                            }`}
                          />
                          {server.status}
                        </span>
                      </td>

                      {/* Latency */}
                      <td className="py-3 px-4">
                        {isOnline ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border ${
                                  latency < 50
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : latency < 120
                                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {latency} ms
                              </span>
                              {server.ttl && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200" title={`Time To Live: ${server.ttl}`}>
                                  TTL:{server.ttl}
                                </span>
                              )}
                              <span className="text-[9px] font-mono font-bold uppercase px-1 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                                {server.method ? server.method.toUpperCase() : 'ICMP'}
                              </span>
                            </div>
                            {/* Live mini jitter dots */}
                            {server.recentLatencies && server.recentLatencies.length > 1 && (
                              <div className="flex items-center gap-1 mt-0.5" title={`Recent latency probes: ${server.recentLatencies.join(', ')} ms`}>
                                {server.recentLatencies.slice(-6).map((lat, lidx) => (
                                  <span
                                    key={lidx}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      lat > 0 ? (lat < 80 ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-rose-400'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-rose-500 font-semibold px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                            0 ms (100% loss)
                          </span>
                        )}
                      </td>

                      {/* Packet Size */}
                      <td className="py-3 px-4 font-mono text-slate-600 font-medium text-xs">
                        {server.packetSize ?? 64} Bytes
                      </td>

                      {/* Last Probe */}
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1 font-semibold text-slate-800">
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{formatTimeAgo(server.lastChecked)}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {server.lastChecked ? new Date(server.lastChecked).toLocaleTimeString() : 'Never'}
                          </span>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setTerminalServer(server);
                              setTerminalLines([]);
                              setIsTerminalStreaming(true);
                              setTerminalPacketSize(server.packetSize ?? 64);
                            }}
                            className="p-1.5 rounded-lg text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 transition cursor-pointer"
                            title="Open Real-Time Ping Streaming Console"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleSinglePing(server)}
                            disabled={isCurrentlyPinging}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-95 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                            title="Send instant ICMP ping probe"
                          >
                            <Zap
                              className={`h-3.5 w-3.5 ${
                                isCurrentlyPinging
                                  ? 'animate-spin text-amber-500'
                                  : 'text-indigo-600'
                              }`}
                            />
                            <span>{isCurrentlyPinging ? 'Pinging...' : 'Ping'}</span>
                          </button>

                          <button
                            onClick={() => setHistoryModalServer(server)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                            title="View Ping Logs History"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => openEditModal(server)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition cursor-pointer"
                              title="Edit Server Configuration"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmServer(server)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                              title="Delete Server"
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

          {/* Table Footer Summary Bar */}
          <div className="bg-slate-50/90 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-slate-600 font-medium">
              <span>
                Total: <strong className="text-slate-900 font-mono">{sortedAndFilteredServers.length}</strong> servers
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Online: <strong className="text-emerald-700 font-mono">{onlineServers}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Offline: <strong className="text-rose-700 font-mono">{offlineServers}</strong>
              </span>
              <span>
                Avg Latency: <strong className="text-indigo-600 font-mono">{activeAvgLatency} ms</strong>
              </span>
            </div>

            <button
              onClick={() => runPingAll(true)}
              disabled={isPingingAll || servers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isPingingAll ? 'animate-spin' : ''}`} />
              <span>{isPingingAll ? 'Pinging All...' : 'Ping All Now'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* BOX / CARD SYSTEM */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAndFilteredServers.map((server) => {
            const isOnline = server.status === 'online';
            const isCurrentlyPinging = pingingServerId === server.id;

            return (
              <motion.div
                key={server.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`bg-white border rounded-2xl p-5 shadow-xs transition-all hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
                  isOnline ? 'border-slate-200 hover:border-indigo-300' : 'border-rose-200 bg-rose-50/10'
                }`}
              >
                {/* Status Indicator Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isOnline ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-red-600'
                  }`}
                />

                {/* Top Details */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">{server.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isOnline
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          {server.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        {server.monitoringType === 'web' ? (
                          <Globe className="h-3 w-3 text-indigo-500 shrink-0" />
                        ) : server.monitoringType === 'server' ? (
                          <ServerIcon className="h-3 w-3 text-blue-500 shrink-0" />
                        ) : (
                          <Radio className="h-3 w-3 text-cyan-500 shrink-0" />
                        )}
                        <span className="truncate max-w-[200px]" title={server.address}>{server.address}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      {server.monitoringType}
                    </span>
                  </div>

                  {/* Metrics Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Latency (RTT)</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-extrabold text-slate-800 text-sm">
                          {isOnline ? `${server.avgResponseTime || 0} ms` : '0 ms'}
                        </span>
                        {isOnline && server.ttl && (
                          <span className="text-[9px] font-mono text-slate-500 bg-white px-1 py-0.2 rounded border border-slate-200">
                            TTL:{server.ttl}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Packet Size</span>
                      <span className="font-mono font-bold text-slate-700 text-xs">
                        {server.packetSize ?? 64} Bytes
                      </span>
                    </div>
                  </div>

                  {/* Last Checked */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 pb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      Last probe:
                    </span>
                    <span className="font-medium text-slate-700">
                      {formatTimeAgo(server.lastChecked)} ({server.lastChecked ? new Date(server.lastChecked).toLocaleTimeString() : 'Never'})
                    </span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setTerminalServer(server);
                      setTerminalLines([]);
                      setIsTerminalStreaming(true);
                      setTerminalPacketSize(server.packetSize ?? 64);
                    }}
                    className="p-1.5 rounded-lg text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 transition cursor-pointer"
                    title="Open Live Real-Time Ping Console"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleSinglePing(server)}
                    disabled={isCurrentlyPinging}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-95 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <Zap className={`h-3.5 w-3.5 ${isCurrentlyPinging ? 'animate-bounce text-amber-500' : 'text-indigo-600'}`} />
                    <span>{isCurrentlyPinging ? 'Pinging...' : 'Instant Ping'}</span>
                  </button>

                  <button
                    onClick={() => setHistoryModalServer(server)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                    title="View Ping Records History"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => openEditModal(server)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition cursor-pointer"
                      title="Edit Server Configuration"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => setDeleteConfirmServer(server)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                      title="Delete Server"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Server Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <ServerIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {editingServer ? 'Edit Monitored Server' : 'Add Monitored Server'}
                    </h3>
                    <p className="text-[11px] text-slate-400">Configure host address and probe protocol</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveServer} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                    {formError}
                  </div>
                )}

                {/* Quick Presets */}
                {!editingServer && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Quick Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPreset('Google Public DNS', '8.8.8.8', 'ping', 64)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                      >
                        Google DNS (8.8.8.8)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('Cloudflare DNS', '1.1.1.1', 'ping', 64)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                      >
                        Cloudflare (1.1.1.1)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('Local Core Gateway', '192.168.1.1', 'server', 32)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                      >
                        Local Gateway
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('Corporate Web Portal', 'https://asrgroup.com', 'web', 128)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                      >
                        Web Portal
                      </button>
                    </div>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Server Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Primary DB Cluster, Core Router, Web Node"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block text-right">
                    {formName.length}/100
                  </span>
                </div>

                {/* Address */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Host Address (IP / Domain / URL) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={255}
                    placeholder="e.g. 192.168.1.1, 8.8.8.8, mail.asrgroup.com, https://example.com"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 font-mono focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Monitoring Type, Port & Packet Size */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Monitoring Type
                    </label>
                    <select
                      value={formMonitoringType}
                      onChange={(e) => setFormMonitoringType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-hidden focus:border-indigo-500 bg-white"
                    >
                      <option value="ping">Ping (ICMP Protocol)</option>
                      <option value="server">Server (Host & Port)</option>
                      <option value="web">Web (HTTP / HTTPS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Port <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      placeholder="e.g. 80, 443, 22"
                      value={formPort}
                      onChange={(e) => setFormPort(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 font-mono focus:outline-hidden focus:border-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Packet Size
                    </label>
                    <select
                      value={formPacketSize}
                      onChange={(e) => setFormPacketSize(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 font-mono font-bold focus:outline-hidden focus:border-indigo-500 bg-white"
                    >
                      <option value={32}>32 Bytes</option>
                      <option value={64}>64 Bytes (Std)</option>
                      <option value={128}>128 Bytes</option>
                      <option value={256}>256 Bytes</option>
                      <option value={512}>512 Bytes</option>
                    </select>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-600/20"
                  >
                    {isSubmitting ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ping History Drawer / Modal */}
      <AnimatePresence>
        {historyModalServer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      Ping History: {historyModalServer.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">{historyModalServer.address}</p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryModalServer(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Records Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {loadingHistory ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span className="text-xs">Fetching ping logs from /history collection...</span>
                  </div>
                ) : serverHistoryRecords.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <History className="h-8 w-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold">No historical ping logs found for this server.</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                      <span className="font-semibold">Recent Ping Attempts ({serverHistoryRecords.length})</span>
                      <span className="font-mono text-[11px]">Collection: /history</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Timestamp</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Response Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {serverHistoryRecords.map((rec, idx) => (
                            <tr key={rec.id || idx} className="hover:bg-slate-50/70 transition">
                              <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                {new Date(rec.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                    rec.status === 'online'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {rec.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                {rec.status === 'online' ? `${rec.responseTime} ms` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400 font-mono">
                  Schema: PingRecord • Firestore Linked
                </span>
                <button
                  onClick={() => setHistoryModalServer(null)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Ping Streaming Terminal Modal */}
      <AnimatePresence>
        {terminalServer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-slate-100 font-sans max-h-[90vh]"
            >
              {/* Terminal Window Header */}
              <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <div className="h-4 w-px bg-slate-800" />
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-indigo-400" />
                    <span className="font-bold text-sm text-slate-100 tracking-tight">
                      Live ICMP Ping Stream: {terminalServer.name}
                    </span>
                    <span className="font-mono text-xs text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60">
                      {terminalServer.address}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    <span className={`w-2 h-2 rounded-full ${isTerminalStreaming ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                    {isTerminalStreaming ? 'STREAMING' : 'PAUSED'}
                  </span>
                  <button
                    onClick={() => setTerminalServer(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Terminal Controls & Real-Time Stats Bar */}
              <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Stats */}
                {(() => {
                  const packets = terminalLines.filter((l) => l.seq > 0);
                  const received = packets.filter((l) => l.success);
                  const loss = packets.length > 0 ? Math.round(((packets.length - received.length) / packets.length) * 100) : 0;
                  const latencies = received.map((r) => r.latency).filter((l) => l > 0);
                  const minLat = latencies.length > 0 ? Math.min(...latencies) : 0;
                  const maxLat = latencies.length > 0 ? Math.max(...latencies) : 0;
                  const avgLat = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
                  const lastPacket = packets[packets.length - 1];

                  return (
                    <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-500">Transmitted: </span>
                        <strong className="text-slate-200">{packets.length}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Received: </span>
                        <strong className="text-emerald-400">{received.length}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Loss: </span>
                        <strong className={loss > 0 ? 'text-rose-400' : 'text-emerald-400'}>{loss}%</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Last RTT: </span>
                        <strong className="text-indigo-300">{lastPacket?.success ? `${lastPacket.latency} ms` : '—'}</strong>
                      </div>
                      {avgLat > 0 && (
                        <div>
                          <span className="text-slate-500">Avg: </span>
                          <strong className="text-cyan-300">{avgLat} ms</strong>
                          <span className="text-slate-500 text-[10px] ml-1">(min {minLat} / max {maxLat})</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Toolbar buttons */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                    <span className="text-slate-500">Bytes:</span>
                    <select
                      value={terminalPacketSize}
                      onChange={(e) => {
                        const newSize = Number(e.target.value);
                        setTerminalPacketSize(newSize);
                        setTerminalLines([]);
                      }}
                      className="bg-transparent text-indigo-400 font-mono font-bold focus:outline-hidden cursor-pointer"
                    >
                      <option value={32} className="bg-slate-900 text-white">32 B</option>
                      <option value={64} className="bg-slate-900 text-white">64 B</option>
                      <option value={128} className="bg-slate-900 text-white">128 B</option>
                      <option value={512} className="bg-slate-900 text-white">512 B</option>
                      <option value={1024} className="bg-slate-900 text-white">1024 B</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setIsTerminalStreaming(!isTerminalStreaming)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      isTerminalStreaming
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                    }`}
                  >
                    {isTerminalStreaming ? (
                      <>
                        <Pause className="h-3 w-3" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        <span>Resume</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setTerminalLines([])}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition cursor-pointer"
                    title="Clear terminal window"
                  >
                    Clear
                  </button>

                  <button
                    onClick={() => {
                      const text = terminalLines.map((l) => l.text).join('\n');
                      navigator.clipboard.writeText(text);
                      setTerminalCopied(true);
                      setTimeout(() => setTerminalCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition cursor-pointer"
                    title="Copy terminal output"
                  >
                    {terminalCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{terminalCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Monospace Terminal Body */}
              <div className="bg-slate-950 p-4 font-mono text-xs leading-relaxed overflow-y-auto max-h-80 min-h-60 space-y-1 select-text">
                <div className="text-slate-500 pb-1">
                  $ ping -c inf -s {terminalPacketSize} {terminalServer.address}
                </div>
                {terminalLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between ${
                      line.seq === 0
                        ? 'text-indigo-400 font-semibold'
                        : line.success
                        ? 'text-emerald-400'
                        : 'text-rose-400 font-semibold'
                    }`}
                  >
                    <span>{line.text}</span>
                    {line.latency > 0 && (
                      <span className="text-[10px] text-slate-500 ml-2 shrink-0">
                        {line.latency < 50 ? 'FAST' : line.latency < 120 ? 'NORMAL' : 'HIGH'}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>

              {/* Terminal Footer */}
              <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Server-Sent Events (SSE) stream via Linux ICMP Kernel</span>
                </div>
                <button
                  onClick={() => setTerminalServer(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  Close Console
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmServer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4"
            >
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Remove Server Target?</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to remove <strong>{deleteConfirmServer.name}</strong> from monitoring?
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setDeleteConfirmServer(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteServer}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition cursor-pointer shadow-md shadow-rose-600/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  HardDrive, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  Info, 
  Layers, 
  PieChart, 
  Server,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { subscribeQuotaState, isQuotaExceeded } from '../firebase';

interface CollectionStat {
  name: string;
  label: string;
  docCount: number;
  sizeBytes: number;
}

export function StorageCluster() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [stats, setStats] = useState<{
    totalBytes: number;
    totalDocs: number;
    firestoreBytes: number;
    localStorageBytes: number;
    collections: CollectionStat[];
  }>({
    totalBytes: 0,
    totalDocs: 0,
    firestoreBytes: 0,
    localStorageBytes: 0,
    collections: []
  });

  const collectionMap: { [key: string]: string } = {
    requisitions: 'Requisitions Log',
    acknowledgements: 'Handover & Acknowledgements',
    return_challans: 'Return Challans',
    product_quotations: 'Quotations',
    purchase_bills: 'Purchase Bills',
    monitor_targets: 'Monitor Targets',
    remote_credentials: 'Remote Credentials',
    hotspot_credentials: 'Hotspot Credentials',
    notebook_credentials: 'Notebook Credentials',
    notebook_ledgers: 'Notebook Categories',
    damaged_stock_proposals: 'Damaged Stock Proposals',
    users: 'System Users',
    preset_signers: 'Signers Database',
    customers: 'Customer Directory',
    company_profile: 'Company Profile'
  };

  useEffect(() => {
    const unsubscribe = subscribeQuotaState((exceeded) => {
      setQuotaExceeded(exceeded);
    });
    return () => unsubscribe();
  }, []);

  const calculateStorage = async () => {
    setIsCalculating(true);
    try {
      let totalDocCount = 0;
      let totalFsBytes = 0;
      let totalLsBytes = 0;
      const collStats: CollectionStat[] = [];

      // 1. Calculate LocalStorage Usage (Cache + App State)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || '';
          totalLsBytes += new TextEncoder().encode(key + val).length;
        }
      }

      // 2. Scan Collections from Cache
      const colNames = Object.keys(collectionMap);

      for (const colName of colNames) {
        let count = 0;
        let bytes = 0;

        // Check local cache first
        const cacheKey = `asr_app_cache_${colName}`;
        const rawCache = localStorage.getItem(cacheKey);
        
        if (rawCache) {
          try {
            const parsed = JSON.parse(rawCache);
            if (Array.isArray(parsed)) {
              count = parsed.length;
              bytes = new TextEncoder().encode(rawCache).length + (count * 64);
            }
          } catch (e) {
            // ignore
          }
        }

        totalDocCount += count;
        totalFsBytes += bytes;

        collStats.push({
          name: colName,
          label: collectionMap[colName],
          docCount: count,
          sizeBytes: bytes
        });
      }

      // Sort collections by size descending
      collStats.sort((a, b) => b.sizeBytes - a.sizeBytes);

      setStats({
        totalBytes: totalFsBytes + totalLsBytes,
        totalDocs: totalDocCount,
        firestoreBytes: totalFsBytes,
        localStorageBytes: totalLsBytes,
        collections: collStats
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.warn('Storage calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    calculateStorage();
    // Refresh storage stats every 30 seconds
    const interval = setInterval(calculateStorage, 30000);
    return () => clearInterval(interval);
  }, [quotaExceeded]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Firestore Free Tier limit = 1024 MB (1 GB)
  const FREE_TIER_BYTES = 1024 * 1024 * 1024;
  const remainingBytes = Math.max(0, FREE_TIER_BYTES - stats.totalBytes);
  const usagePercentage = Math.min((stats.totalBytes / FREE_TIER_BYTES) * 100, 100);

  return (
    <div className="border-t border-slate-800/80 bg-slate-900/90 text-slate-300 transition-all select-none">
      {/* Mini Bar Container */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-400">
              <Server className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
              Storage Cluster
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => calculateStorage()}
              disabled={isCalculating}
              className={`p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer ${
                isCalculating ? 'animate-spin text-indigo-400' : ''
              }`}
              title="Refresh Storage Cluster Stats"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title={isExpanded ? 'Collapse Storage Panel' : 'Expand Storage Panel'}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Main Usage Summary Line */}
        <div className="flex items-baseline justify-between text-xs mb-1">
          <div className="flex items-baseline gap-1">
            <span className="font-extrabold text-white text-sm font-mono">
              {formatSize(stats.totalBytes)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              / 1.00 GB
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {stats.totalDocs} Docs
          </span>
        </div>

        {/* Storage Bar Indicator */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
          <div 
            className={`h-full transition-all duration-500 rounded-full ${
              quotaExceeded 
                ? 'bg-amber-500' 
                : usagePercentage > 80 
                  ? 'bg-rose-500' 
                  : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400'
            }`}
            style={{ width: `${Math.max(usagePercentage, 2)}%` }}
          />
        </div>

        {/* Total Storage & Status Row */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>Total Storage: <strong className="text-slate-200 font-mono font-bold">1 GB</strong></span>
          <span className="font-mono text-indigo-300 font-semibold">{usagePercentage < 0.01 ? '<0.01%' : `${usagePercentage.toFixed(2)}%`} used</span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between text-[10px] pt-1">
          <div className="flex items-center gap-1">
            {quotaExceeded ? (
              <span className="inline-flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <AlertTriangle className="h-2.5 w-2.5" />
                Quota Hit (Offline)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Firestore Live
              </span>
            )}
          </div>
          <button
            onClick={() => setShowDetailModal(true)}
            className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
          >
            Details
          </button>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-[11px] font-sans">
            <div className="flex justify-between items-center text-slate-400">
              <span>Total Storage:</span>
              <span className="font-mono text-white font-bold">1,024 MB (1.00 GB)</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Used Storage:</span>
              <span className="font-mono text-indigo-300 font-bold">{formatSize(stats.totalBytes)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Available Storage:</span>
              <span className="font-mono text-emerald-400 font-semibold">{formatSize(remainingBytes)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Firestore Payload:</span>
              <span className="font-mono text-slate-300 font-medium">{formatSize(stats.firestoreBytes)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Local Offline Cache:</span>
              <span className="font-mono text-slate-300 font-medium">{formatSize(stats.localStorageBytes)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Quota Used:</span>
              <span className="font-mono text-indigo-400 font-bold">{usagePercentage.toFixed(4)}%</span>
            </div>
            <div className="pt-1 text-[9px] text-slate-500 text-right font-mono">
              Last synced: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Storage Breakdown Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Firestore Storage Cluster Metrics</h3>
                  <p className="text-xs text-slate-400">Real-time database payload, quota & collection statistics</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Top Level Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Total Storage</div>
                  <div className="text-sm font-extrabold text-white font-mono">1.00 GB</div>
                  <div className="text-[10px] text-slate-500">1,024 MB Free Tier</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Used Storage</div>
                  <div className="text-sm font-extrabold text-indigo-400 font-mono">{formatSize(stats.totalBytes)}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{usagePercentage.toFixed(4)}%</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Free Storage</div>
                  <div className="text-sm font-extrabold text-emerald-400 font-mono">{formatSize(remainingBytes)}</div>
                  <div className="text-[10px] text-slate-500">Available Space</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Total Docs</div>
                  <div className="text-sm font-extrabold text-cyan-400 font-mono">{stats.totalDocs}</div>
                  <div className="text-[10px] text-slate-500">15 Collections</div>
                </div>
              </div>

              {/* Collections Breakdown Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Collections Storage Allocation</span>
                  <span className="text-[10px] font-normal text-slate-400 lowercase">sorted by size</span>
                </h4>
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl divide-y divide-slate-800/60 overflow-hidden text-xs">
                  {stats.collections.map((col) => (
                    <div key={col.name} className="p-2.5 flex items-center justify-between hover:bg-slate-900/60 transition">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>
                        <span className="font-semibold text-slate-200 truncate">{col.label}</span>
                        <span className="text-[10px] font-mono text-slate-500">({col.name})</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 font-mono">
                        <span className="text-slate-400 text-[11px]">{col.docCount} docs</span>
                        <span className="font-bold text-indigo-300">{formatSize(col.sizeBytes)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[10px]">Updated: {lastUpdated.toLocaleTimeString()}</span>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

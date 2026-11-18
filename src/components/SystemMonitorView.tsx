import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Database, RefreshCw, Server } from 'lucide-react';
import type { AirQualityResponse, SystemHealthResponse } from '../types/environment';
import { fetchSystemHealth } from '../services/api';

interface SystemMonitorViewProps {
  airQuality: AirQualityResponse | null;
}

export function SystemMonitorView({ airQuality }: SystemMonitorViewProps) {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSystemHealth();
      setHealth(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to fetch system telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const dataFreshnessMinutes = airQuality?.provenance.fetchedAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(airQuality.provenance.fetchedAt)) / 60000))
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Admin & System Health Monitoring
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Live upstream provider statuses, server response cache metrics, data freshness, and API error logs
          </p>
        </div>

        <button
          type="button"
          onClick={loadHealth}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Telemetry
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {health && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">System Health</div>
              <div className="mt-1.5 flex items-center gap-2 text-base font-bold">
                {health.status === 'operational' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">Operational</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">Degraded</span>
                  </>
                )}
              </div>
              <div className="mt-1 text-[11px] font-mono text-slate-500">
                Uptime {Math.floor(health.uptimeSeconds / 60)}m {health.uptimeSeconds % 60}s
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Last Successful Refresh</div>
              <div className="mt-1.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                {health.lastSuccessfulRefresh
                  ? new Date(health.lastSuccessfulRefresh).toLocaleTimeString()
                  : 'Pending'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Active dataset age: {dataFreshnessMinutes !== null ? `${dataFreshnessMinutes} min` : '--'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Server Response Cache</div>
              <div className="mt-1.5 text-xl font-mono font-bold text-slate-900 dark:text-slate-100">
                {health.cache.hitRatePct}% Hit Rate
              </div>
              <div className="mt-1 text-[11px] font-mono text-slate-500">
                {health.cache.entries} entries · {health.cache.hits} hits / {health.cache.misses} misses
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Active Provenance</div>
              <div className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {airQuality?.provenance.isModelled ? 'Modelled (CAMS)' : 'Live'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {airQuality?.provenance.spatialResolution || '~11 km grid'}
              </div>
            </div>
          </div>

          {/* Upstream Providers Table */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Server className="h-4 w-4 text-cyan-600" />
              Upstream API Connection Status
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4 font-semibold">Provider</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Requests</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Errors</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Latency</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Last Success</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {health.providers.map((p) => (
                  <tr key={p.name}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{p.purpose}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={
                          p.status === 'connected'
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : p.status === 'degraded'
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-slate-500'
                        }
                      >
                        {p.status === 'connected' ? '● Connected' : p.status === 'degraded' ? '▲ Degraded' : '○ Idle'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{p.totalRequests}</td>
                    <td className="py-3 px-4 text-right font-mono">{p.errorCount}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {p.lastLatencyMs !== null ? `${p.lastLatencyMs} ms` : '--'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {p.lastSuccessAt ? new Date(p.lastSuccessAt).toLocaleTimeString() : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Data Sources & Error Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Database className="h-4 w-4 text-cyan-600" />
                Configured Data Sources & Methodology
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {health.dataSourcesSummary.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Activity className="h-4 w-4 text-rose-500" />
                Recent API Error Log ({health.recentErrors.length})
              </div>
              {health.recentErrors.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 text-xs font-mono">
                  {health.recentErrors.map((e, i) => (
                    <div key={i} className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2.5 text-rose-800 dark:text-rose-300">
                      <div className="font-semibold">
                        [{new Date(e.timestamp).toLocaleTimeString()}] {e.provider}
                      </div>
                      <div className="text-[11px] mt-0.5 break-all">{e.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  No upstream API errors recorded since server startup.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

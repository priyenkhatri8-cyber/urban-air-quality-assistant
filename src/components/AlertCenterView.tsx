import React from 'react';
import { Bell, BellOff, CheckCheck, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import type { AlertHistoryItem, AlertRuleConfig, CityPreset } from '../types/environment';
import { getAqiCategory } from '../utils/aqi';

interface AlertCenterViewProps {
  rules: AlertRuleConfig;
  history: AlertHistoryItem[];
  favoriteCities: CityPreset[];
  browserPermission: NotificationPermission | 'unsupported';
  onUpdateRules: (next: AlertRuleConfig) => void;
  onRequestBrowserPermission: () => void;
  onAcknowledgeAll: () => void;
  onClearHistory: () => void;
  onEvaluateNow: () => void;
}

export function AlertCenterView({
  rules,
  history,
  favoriteCities,
  browserPermission,
  onUpdateRules,
  onRequestBrowserPermission,
  onAcknowledgeAll,
  onClearHistory,
  onEvaluateNow,
}: AlertCenterViewProps) {
  const toggleRule = (key: keyof AlertRuleConfig) => {
    onUpdateRules({
      ...rules,
      [key]: !rules[key],
    });
  };

  return (
    <div className="space-y-5">
      {/* Alert Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Smart Alert Center
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated threshold monitoring for {favoriteCities.length} saved favorite cities with event deduplication
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleRule('enabled')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                rules.enabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {rules.enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {rules.enabled ? 'Alerts Enabled' : 'Alerts Paused'}
            </button>

            <button
              type="button"
              onClick={onEvaluateNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Favorite Cities Now
            </button>
          </div>
        </div>

        {/* Browser Notifications Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Browser Push Notifications: </span>
            <span className="font-mono text-slate-500 dark:text-slate-400">
              {browserPermission === 'unsupported'
                ? 'Not supported in this browser'
                : browserPermission === 'granted'
                ? 'Permission Granted'
                : browserPermission === 'denied'
                ? 'Blocked in browser settings'
                : 'Not requested yet'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {browserPermission === 'default' && (
              <button
                type="button"
                onClick={onRequestBrowserPermission}
                className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950"
              >
                Allow Browser Notifications
              </button>
            )}
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.browserNotifications}
                onChange={() => toggleRule('browserNotifications')}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Send desktop alerts on trigger</span>
            </label>
          </div>
        </div>
      </div>

      {/* Threshold Rule Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Alert Trigger Conditions
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {[
              { key: 'threshold100', title: 'AQI crosses 100', desc: 'Unhealthy for Sensitive Groups threshold' },
              { key: 'threshold150', title: 'AQI crosses 150', desc: 'Unhealthy air quality for general public' },
              { key: 'threshold200', title: 'AQI crosses 200', desc: 'Very Unhealthy emergency advisory' },
              { key: 'hazardousAlert', title: 'AQI enters Hazardous (301+)', desc: 'Severe ambient particulate warning' },
            ].map((item) => {
              const active = Boolean(rules[item.key as keyof AlertRuleConfig]);
              return (
                <label
                  key={item.key}
                  className="py-3 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</div>
                    <div className="text-slate-500 dark:text-slate-400">{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleRule(item.key as keyof AlertRuleConfig)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                </label>
              );
            })}

            <div className="py-3 space-y-2">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Custom PM2.5 Threshold
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Alert when PM2.5 exceeds your configured µg/m³ limit
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rules.customPm25Enabled}
                  onChange={() => toggleRule('customPm25Enabled')}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
              </label>
              {rules.customPm25Enabled && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-slate-600 dark:text-slate-400">Threshold (µg/m³):</label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={rules.customPm25Threshold}
                    onChange={(e) =>
                      onUpdateRules({
                        ...rules,
                        customPm25Threshold: Math.max(10, Number(e.target.value) || 35),
                      })
                    }
                    className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Alert History */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Deduplicated Alert History ({history.length})
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={onAcknowledgeAll}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark Read
              </button>
              <button
                type="button"
                onClick={onClearHistory}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {history.length > 0 ? (
              history.map((item) => {
                const cat = getAqiCategory(item.aqi);
                return (
                  <div
                    key={item.id}
                    className={`py-3 flex items-start justify-between gap-3 text-xs ${
                      item.acknowledged ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" style={{ color: cat.colorHex }} />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.cityName} · {item.conditionLabel}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Observed {item.observedTime.replace('T', ' ')} · Logged {new Date(item.triggeredAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <div className="font-bold" style={{ color: cat.colorHex }}>
                        {item.aqi !== null ? `${Math.round(item.aqi)} AQI` : '--'}
                      </div>
                      {item.pm25 !== null && (
                        <div className="text-[11px] text-slate-500">{item.pm25.toFixed(1)} µg/m³</div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-xs text-slate-500">
                No alert thresholds crossed across your monitored favorite cities yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

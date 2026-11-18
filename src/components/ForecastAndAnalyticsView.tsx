import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, Cpu, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { AiInvestigationResult, AirQualityResponse } from '../types/environment';
import { runAiInvestigation } from '../services/api';
import { formatMetric, getAqiCategory } from '../utils/aqi';
import { DashboardSkeleton } from './LoadingSkeleton';

interface ForecastAndAnalyticsViewProps {
  airQuality: AirQualityResponse | null;
  historyDays: number;
  loading: boolean;
  onChangeHistoryDays: (days: number) => void;
}

export function ForecastAndAnalyticsView({
  airQuality,
  historyDays,
  loading,
  onChangeHistoryDays,
}: ForecastAndAnalyticsViewProps) {
  const [forecastHorizon, setForecastHorizon] = useState<'24h' | '48h' | 'max'>('24h');
  const [aiForecast, setAiForecast] = useState<AiInvestigationResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const forecastPoints = useMemo(() => {
    if (!airQuality) return [];
    const future = airQuality.hourly.filter((h) => h.isForecast);
    const limit = forecastHorizon === '24h' ? 24 : forecastHorizon === '48h' ? 48 : future.length;
    return future.slice(0, limit).map((h) => ({
      label: h.time.slice(5, 16).replace('T', ' '),
      shortHour: h.time.slice(11, 16),
      aqi: h.usAqi,
      pm25: h.pm25,
      pm10: h.pm10,
      no2: h.no2,
      o3: h.o3,
    }));
  }, [airQuality, forecastHorizon]);

  const historicalPoints = useMemo(() => {
    if (!airQuality) return [];
    return airQuality.hourly
      .filter((h) => !h.isForecast)
      .map((h) => ({
        label: h.time.slice(5, 16).replace('T', ' '),
        aqi: h.usAqi,
        pm25: h.pm25,
        pm10: h.pm10,
      }));
  }, [airQuality]);

  // Diurnal pattern: average AQI and PM2.5 by hour-of-day (00..23) across historical points
  const diurnalPattern = useMemo(() => {
    if (!airQuality) return [];
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      aqis: [] as number[],
      pm25s: [] as number[],
    }));
    airQuality.hourly
      .filter((h) => !h.isForecast)
      .forEach((h) => {
        const hr = Number(h.time.slice(11, 13));
        if (hr >= 0 && hr < 24) {
          if (h.usAqi !== null) buckets[hr].aqis.push(h.usAqi);
          if (h.pm25 !== null) buckets[hr].pm25s.push(h.pm25);
        }
      });
    return buckets.map((b) => ({
      hour: b.hour,
      avgAqi: b.aqis.length
        ? Number((b.aqis.reduce((s, v) => s + v, 0) / b.aqis.length).toFixed(1))
        : null,
      avgPm25: b.pm25s.length
        ? Number((b.pm25s.reduce((s, v) => s + v, 0) / b.pm25s.length).toFixed(1))
        : null,
    }));
  }, [airQuality]);

  const pollutantComparison = useMemo(() => {
    if (!airQuality) return [];
    return [
      { name: 'PM2.5', value: airQuality.current.pm25 ?? 0 },
      { name: 'PM10', value: airQuality.current.pm10 ?? 0 },
      { name: 'NO₂', value: airQuality.current.no2 ?? 0 },
      { name: 'O₃', value: airQuality.current.o3 ?? 0 },
      { name: 'SO₂', value: airQuality.current.so2 ?? 0 },
    ];
  }, [airQuality]);

  const trendDelta = useMemo(() => {
    if (forecastPoints.length < 6) return null;
    const first = forecastPoints[0]?.aqi;
    const end = forecastPoints[Math.min(23, forecastPoints.length - 1)]?.aqi;
    if (first === null || first === undefined || end === null || end === undefined) return null;
    return Number((end - first).toFixed(1));
  }, [forecastPoints]);

  const handleRunAiTrend = async () => {
    if (!airQuality) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await runAiInvestigation(airQuality, 'forecast');
      setAiForecast(res);
    } catch (err: any) {
      setAiError(err?.message || 'AI forecast interpretation failed.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading && !airQuality) return <DashboardSkeleton />;
  if (!airQuality) return null;

  const availableForecastDays = Math.round(airQuality.provenance.forecastHorizonHours / 24);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              API Model Horizon: {airQuality.provenance.forecastHorizonHours}h forecast ({availableForecastDays} days available) · {airQuality.provenance.historicalHours}h historical
            </div>
            <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
              Pollution Forecasting & Environmental Analytics — {airQuality.location.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              {[
                { id: '24h', label: '24h Forecast' },
                { id: '48h', label: '48h Forecast' },
                { id: 'max', label: `${availableForecastDays}-Day Forecast` },
              ].map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setForecastHorizon(h.id as '24h' | '48h' | 'max')}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                    forecastHorizon === h.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              {[7, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChangeHistoryDays(days)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                    historyDays === days
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {days === 7 ? '7-Day History' : '30-Day Monthly'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trend Indicator Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {trendDelta !== null && (
              <>
                {trendDelta > 5 ? (
                  <TrendingUp className="h-4 w-4 text-rose-500" />
                ) : trendDelta < -5 ? (
                  <TrendingDown className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Calendar className="h-4 w-4 text-slate-400" />
                )}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  24h API Forecast Shift:{' '}
                  <span className="font-mono font-bold">
                    {trendDelta > 0 ? `+${trendDelta}` : trendDelta} AQI
                  </span>{' '}
                  ({trendDelta > 5 ? 'Worsening trend' : trendDelta < -5 ? 'Improving dispersion' : 'Relatively steady'})
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Source: Open-Meteo CAMS Forecast API (no synthetic forecast points generated)
          </div>
        </div>
      </div>

      {/* Forecast Charts (Module 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              API AQI Forecast Trajectory ({forecastHorizon === 'max' ? `${availableForecastDays} Days` : forecastHorizon})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct Open-Meteo CAMS forecast values · US EPA AQI
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastPoints} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastAqiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" minTickGap={28} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="aqi" name="Forecast US AQI" stroke="#0284c7" strokeWidth={2} fill="url(#forecastAqiFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Hourly PM2.5 & PM10 Forecast (µg/m³)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fine vs coarse particulate curves across forecast window
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastPoints} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" minTickGap={28} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Line type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke="#e11d48" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm10" name="PM10 (µg/m³)" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Clearly Separated AI Forecast Interpretation */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI-Generated Forecast Interpretation (Separate from API Measurements)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gemini atmospheric reasoning over the retrieved forecast horizon
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunAiTrend}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {aiLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {aiLoading ? 'Interpreting...' : 'Interpret Forecast with AI'}
          </button>
        </div>

        {aiError && <div className="text-xs text-rose-600 dark:text-rose-400">{aiError}</div>}

        {aiForecast ? (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-cyan-600" />
              AI Trend Commentary
            </div>
            <p className="leading-relaxed">{aiForecast.pollutionTrendInterpretation}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              {aiForecast.dataLimitationsNote}
            </p>
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Click &quot;Interpret Forecast with AI&quot; to generate a concise Gemini interpretation of the upcoming dispersion pattern.
          </div>
        )}
      </section>

      {/* Module 11: Historical & Diurnal Environmental Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Historical AQI & PM2.5 Trend ({historyDays}-Day Retrieved Archive)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Past {historicalPoints.length} retrieved hourly observations
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalPoints} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" minTickGap={35} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Line type="monotone" dataKey="aqi" name="Historical US AQI" stroke="#475569" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm25" name="Historical PM2.5" stroke="#0891b2" strokeWidth={1.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Current Pollutant Breakdown (µg/m³)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Simultaneous concentration comparison
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pollutantComparison} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" name="µg/m³" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Diurnal Pattern + Daily Averages Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Diurnal Hourly Pollution Pattern (24h Cycle)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mean AQI by hour of day across past {historyDays} days
            </p>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diurnalPattern} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={3} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="avgAqi" name="Avg AQI" fill="#0284c7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 overflow-x-auto">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Daily Average AQI Log
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Historical archive & API forecast daily rollups
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 px-3 font-semibold">Type</th>
                  <th className="py-2 px-3 font-semibold text-right">Avg AQI</th>
                  <th className="py-2 px-3 font-semibold text-right">Max AQI</th>
                  <th className="py-2 pl-3 font-semibold text-right">Avg PM2.5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {airQuality.daily.map((d) => {
                  const cat = getAqiCategory(d.avgAqi);
                  return (
                    <tr key={d.date}>
                      <td className="py-2 pr-3 font-mono text-slate-800 dark:text-slate-200">{d.date}</td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                        {d.isForecast ? 'API Forecast' : 'Historical'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: cat.colorHex }}>
                        {d.avgAqi !== null ? d.avgAqi.toFixed(0) : '--'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {d.maxAqi !== null ? Math.round(d.maxAqi) : '--'}
                      </td>
                      <td className="py-2 pl-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatMetric(d.avgPm25)} µg/m³
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

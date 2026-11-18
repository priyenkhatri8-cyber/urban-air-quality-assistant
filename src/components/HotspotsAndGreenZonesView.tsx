import React, { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Flame, Info, Leaf, MapPin, RefreshCw } from 'lucide-react';
import type { CityPreset, LocalGridResponse } from '../types/environment';
import { formatMetric, getAqiCategory } from '../utils/aqi';
import { TableSkeleton } from './LoadingSkeleton';

interface HotspotsAndGreenZonesViewProps {
  activeCity: CityPreset;
  localGrid: LocalGridResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenMap: () => void;
}

export function HotspotsAndGreenZonesView({
  activeCity,
  localGrid,
  loading,
  error,
  onRefresh,
  onOpenMap,
}: HotspotsAndGreenZonesViewProps) {
  const [mode, setMode] = useState<'hotspots' | 'greenzones'>('hotspots');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(25);

  const rankedPoints = useMemo(() => {
    if (!localGrid?.points) return [];
    const filtered = localGrid.points.filter(
      (p) => p.usAqi !== null && p.distanceKm <= maxDistanceKm
    );
    return filtered.sort((a, b) =>
      mode === 'hotspots'
        ? (b.usAqi ?? 0) - (a.usAqi ?? 0)
        : (a.usAqi ?? 0) - (b.usAqi ?? 0)
    );
  }, [localGrid, mode, maxDistanceKm]);

  const meanAqi = useMemo(() => {
    const vals = rankedPoints.map((p) => p.usAqi).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [rankedPoints]);

  if (loading && !localGrid) {
    return <TableSkeleton rows={6} />;
  }

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {mode === 'hotspots'
                ? 'Smart Pollution Hotspot Detection'
                : 'Green Zone Finder (Cleanest Monitored Areas)'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Comparative multi-coordinate AQI analysis around {activeCity.name} ({activeCity.lat.toFixed(3)}, {activeCity.lon.toFixed(3)})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setMode('hotspots')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'hotspots'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-rose-500" />
                Hotspot Ranking
              </button>
              <button
                type="button"
                onClick={() => setMode('greenzones')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'greenzones'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Leaf className="h-3.5 w-3.5 text-emerald-500" />
                Green Zone Finder
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenMap}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <MapPin className="h-3.5 w-3.5" />
              View on Map
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Radius filter */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Search Radius:</span>
            {[10, 15, 25].map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setMaxDistanceKm(km)}
                className={`rounded-md px-2.5 py-1 font-mono transition-colors ${
                  maxDistanceKm === km
                    ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                ≤ {km} km
              </button>
            ))}
          </div>
          {meanAqi !== null && (
            <div className="font-mono text-slate-600 dark:text-slate-300">
              Regional Baseline Mean: <strong>{meanAqi.toFixed(1)} AQI</strong> · {rankedPoints.length} coordinates evaluated
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Scientific integrity notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 text-xs text-slate-600 dark:text-slate-300">
        <Info className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <div>
          {mode === 'hotspots'
            ? 'Hotspots identify coordinates with comparatively higher retrieved AQI/PM2.5 within the Open-Meteo CAMS grid (~11 km resolution). Elevated values do not identify specific unverified emission sources.'
            : 'Green Zone Finder ranks monitored coordinates with comparatively lower retrieved ambient AQI and PM2.5. Parks or green spaces without actual supporting air quality data are never labelled as clean-air zones.'}
        </div>
      </div>

      {/* Ranked Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        {rankedPoints.length > 0 ? (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">Rank</th>
                <th className="py-3 px-4 font-semibold">Location / Zone</th>
                <th className="py-3 px-4 font-semibold">Coordinates</th>
                <th className="py-3 px-4 font-semibold text-right">Distance</th>
                <th className="py-3 px-4 font-semibold text-right">US AQI</th>
                <th className="py-3 px-4 font-semibold">Severity / Delta</th>
                <th className="py-3 px-4 font-semibold text-right">PM2.5</th>
                <th className="py-3 px-4 font-semibold text-right">PM10</th>
                <th className="py-3 px-4 font-semibold text-right">NO₂</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rankedPoints.map((pt, idx) => {
                const cat = getAqiCategory(pt.usAqi);
                const delta = meanAqi !== null && pt.usAqi !== null ? pt.usAqi - meanAqi : null;
                return (
                  <tr
                    key={pt.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{pt.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        {pt.zoneType} · Modelled CAMS
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {pt.lat.toFixed(3)}, {pt.lon.toFixed(3)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {pt.distanceKm.toFixed(1)} km
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold" style={{ color: cat.colorHex }}>
                      {pt.usAqi !== null ? Math.round(pt.usAqi) : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-medium ${cat.textClass}`}>{cat.label}</div>
                      {delta !== null && (
                        <div className="text-[11px] font-mono text-slate-500">
                          {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} vs city mean
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                      {formatMetric(pt.pm25)} µg/m³
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                      {formatMetric(pt.pm10)} µg/m³
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                      {formatMetric(pt.no2)} µg/m³
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            <ArrowDownWideNarrow className="h-5 w-5 mx-auto mb-2 text-slate-400" />
            No monitored coordinates found within {maxDistanceKm} km. Try expanding the radius filter.
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Award, AlertTriangle, Plus, Search, Trash2, Wind } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CityPreset, CityReadingSummary } from '../types/environment';
import { FEATURED_CITIES } from '../data/cities';
import { searchCities } from '../services/api';
import { formatMetric, getAqiCategory } from '../utils/aqi';

interface CityComparisonViewProps {
  comparedCities: CityPreset[];
  readings: CityReadingSummary[];
  loading: boolean;
  onAddCity: (city: CityPreset) => void;
  onRemoveCity: (id: string) => void;
}

export function CityComparisonView({
  comparedCities,
  readings,
  loading,
  onAddCity,
  onRemoveCity,
}: CityComparisonViewProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lon: number; state?: string; country?: string }>>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchCities(query.trim());
      setSearchResults(res);
      if (res.length === 0) setSearchError('No matching cities found.');
    } catch (err: any) {
      setSearchError(err?.message || 'City search failed.');
    } finally {
      setSearching(false);
    }
  };

  const compatibleReadings = useMemo(() => {
    return [...readings]
      .filter((r) => r.pollutants.usAqi !== null && r.aqiScale === 'US EPA AQI')
      .sort((a, b) => (a.pollutants.usAqi ?? 999) - (b.pollutants.usAqi ?? 999));
  }, [readings]);

  // Check if timestamps share the same UTC hour (or within 2 hours)
  const timestampSpreadOk = useMemo(() => {
    if (compatibleReadings.length < 2) return true;
    const uniqueHours = new Set(compatibleReadings.map((r) => r.observedTime.slice(0, 13)));
    return uniqueHours.size <= 2;
  }, [compatibleReadings]);

  const bestCity = compatibleReadings[0];
  const worstCity = compatibleReadings[compatibleReadings.length - 1];

  const chartData = compatibleReadings.map((r) => ({
    city: r.name,
    'US AQI': r.pollutants.usAqi ?? 0,
    'PM2.5': r.pollutants.pm25 ?? 0,
    'PM10': r.pollutants.pm10 ?? 0,
  }));

  return (
    <div className="space-y-5">
      {/* Header & City Selector (Max 5 cities) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              City Intelligence Comparison Engine ({comparedCities.length}/5 Cities)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aligned on US EPA AQI scale · Open-Meteo CAMS atmospheric model
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={comparedCities.length >= 5}
                placeholder={comparedCities.length >= 5 ? 'Max 5 cities active' : 'Add city to compare...'}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={searching || comparedCities.length >= 5}
              className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950 disabled:opacity-50 whitespace-nowrap"
            >
              {searching ? 'Searching...' : 'Find City'}
            </button>
          </form>
        </div>

        {/* Quick-add preset buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Quick Add:</span>
          {FEATURED_CITIES.filter((c) => !comparedCities.some((a) => a.id === c.id)).map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={comparedCities.length >= 5}
              onClick={() => onAddCity(c)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              {c.name}
            </button>
          ))}
        </div>

        {searchError && <div className="text-xs text-rose-600 dark:text-rose-400">{searchError}</div>}

        {searchResults.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-2">
            {searchResults.map((r, i) => (
              <button
                key={`${r.name}-${i}`}
                type="button"
                disabled={comparedCities.length >= 5}
                onClick={() => {
                  onAddCity({
                    id: `${r.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${r.lat.toFixed(2)}`,
                    name: r.name,
                    state: r.state || '',
                    country: r.country || '',
                    lat: r.lat,
                    lon: r.lon,
                  });
                  setSearchResults([]);
                  setQuery('');
                }}
                className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950"
              >
                + {r.name}{r.state ? `, ${r.state}` : ''}{r.country ? ` (${r.country})` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {!timestampSpreadOk && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Note: Cities across different timezones display their respective local observation timestamps. All values share the US EPA AQI scale.
          </span>
        </div>
      )}

      {/* Best vs Worst Summary */}
      {compatibleReadings.length >= 2 && bestCity && worstCity && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Award className="h-4 w-4" />
                Best Air Quality City
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{bestCity.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                PM2.5 {formatMetric(bestCity.pollutants.pm25)} µg/m³ · {getAqiCategory(bestCity.pollutants.usAqi).label}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {Math.round(bestCity.pollutants.usAqi ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500">US AQI</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                Highest Pollution City
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{worstCity.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                PM2.5 {formatMetric(worstCity.pollutants.pm25)} µg/m³ · {getAqiCategory(worstCity.pollutants.usAqi).label}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {Math.round(worstCity.pollutants.usAqi ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500">US AQI</div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Chart */}
      {chartData.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Cross-City AQI, PM2.5 & PM10 Comparison
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="city" tick={{ fontSize: 11 }} stroke="#94a3b8" />
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
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="US AQI" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="PM2.5" fill="#e11d48" radius={[4, 4, 0, 0]} />
                <Bar dataKey="PM10" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Ranked Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4 font-semibold">Rank</th>
              <th className="py-3 px-4 font-semibold">City</th>
              <th className="py-3 px-4 font-semibold text-right">US AQI</th>
              <th className="py-3 px-4 font-semibold">Category</th>
              <th className="py-3 px-4 font-semibold text-right">PM2.5</th>
              <th className="py-3 px-4 font-semibold text-right">PM10</th>
              <th className="py-3 px-4 font-semibold text-right">NO₂</th>
              <th className="py-3 px-4 font-semibold text-right">O₃</th>
              <th className="py-3 px-4 font-semibold">Weather</th>
              <th className="py-3 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {compatibleReadings.map((c, idx) => {
              const cat = getAqiCategory(c.pollutants.usAqi);
              return (
                <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-600 dark:text-slate-400">
                    #{idx + 1}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {c.observedTime.replace('T', ' ')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold" style={{ color: cat.colorHex }}>
                    {c.pollutants.usAqi !== null ? Math.round(c.pollutants.usAqi) : '--'}
                  </td>
                  <td className={`py-3 px-4 font-medium ${cat.textClass}`}>{cat.label}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatMetric(c.pollutants.pm25)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatMetric(c.pollutants.pm10)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatMetric(c.pollutants.no2)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatMetric(c.pollutants.o3)}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    <span className="font-mono">{formatMetric(c.weather.temperature)}°C</span> ·{' '}
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Wind className="h-3 w-3" /> {formatMetric(c.weather.windSpeed)} km/h
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveCity(c.id)}
                      disabled={comparedCities.length <= 1}
                      title="Remove city"
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {loading && compatibleReadings.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500">
                  Fetching city comparison telemetry...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from 'react';
import {
  Activity,
  ArrowRight,
  Bookmark,
  Compass,
  Droplets,
  Flame,
  Gauge,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Thermometer,
  Wind,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AirQualityResponse,
  CityPreset,
  CityReadingSummary,
  LanguageCode,
  LocalGridResponse,
  UserPreferences,
} from '../types/environment';
import { formatMetric, getAqiCategory, getLocalizedAqiLabel } from '../utils/aqi';
import { DashboardSkeleton } from './LoadingSkeleton';

interface OverviewDashboardProps {
  activeCity: CityPreset;
  airQuality: AirQualityResponse | null;
  cityReadings: CityReadingSummary[];
  localGrid: LocalGridResponse | null;
  loading: boolean;
  error: string | null;
  language: LanguageCode;
  preferences: UserPreferences;
  onRetry: () => void;
  onSelectCity: (city: CityPreset) => void;
  onToggleFavorite: (city: CityPreset) => void;
  onNavigate: (tab: string) => void;
  onUpdateWidgets: (widgets: UserPreferences['dashboardWidgets']) => void;
}

export function OverviewDashboard({
  activeCity,
  airQuality,
  cityReadings,
  localGrid,
  loading,
  error,
  language,
  preferences,
  onRetry,
  onSelectCity,
  onToggleFavorite,
  onNavigate,
  onUpdateWidgets,
}: OverviewDashboardProps) {
  if (loading && !airQuality) {
    return <DashboardSkeleton />;
  }

  if (error && !airQuality) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-8 text-center">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-2">
          Live Environmental Telemetry Unavailable
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-4">
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  if (!airQuality) return null;

  const currentAqi = airQuality.current.usAqi;
  const category = getAqiCategory(currentAqi);
  const localizedCat = getLocalizedAqiLabel(currentAqi, language);
  const isFav = preferences.favoriteCities.some((c) => c.id === activeCity.id);

  const next24Forecast = airQuality.hourly
    .filter((h) => h.isForecast)
    .slice(0, 24)
    .map((h) => ({
      hour: h.time.slice(11, 16),
      aqi: h.usAqi,
      pm25: h.pm25,
    }));

  const sortedHotspots = [...(localGrid?.points || [])]
    .filter((p) => p.usAqi !== null)
    .sort((a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0));
  const topHotspot = sortedHotspots[0];
  const cleanestZone = sortedHotspots[sortedHotspots.length - 1];

  const pollutants = [
    { label: 'PM2.5', value: formatMetric(airQuality.current.pm25), unit: 'µg/m³', desc: 'Fine particulate matter' },
    { label: 'PM10', value: formatMetric(airQuality.current.pm10), unit: 'µg/m³', desc: 'Coarse inhalable particles' },
    { label: 'NO₂', value: formatMetric(airQuality.current.no2), unit: 'µg/m³', desc: 'Nitrogen dioxide' },
    { label: 'O₃', value: formatMetric(airQuality.current.o3), unit: 'µg/m³', desc: 'Ground-level ozone' },
    { label: 'SO₂', value: formatMetric(airQuality.current.so2), unit: 'µg/m³', desc: 'Sulfur dioxide' },
    { label: 'CO', value: formatMetric(airQuality.current.co, 0), unit: 'µg/m³', desc: 'Carbon monoxide' },
  ];

  return (
    <div className="space-y-6">
      {/* Inline error notice if refresh failed while cached data is shown */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span>Refresh warning: {error}</span>
          <button type="button" onClick={onRetry} className="font-semibold underline whitespace-nowrap">
            Retry
          </button>
        </div>
      )}

      {/* Primary Hero Telemetry + Weather Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{activeCity.state ? `${activeCity.name}, ${activeCity.state}` : activeCity.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    {airQuality.location.lat.toFixed(3)}°N, {airQuality.location.lon.toFixed(3)}°E
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Modelled Estimate (Open-Meteo CAMS)</span>
                </div>
                <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {airQuality.location.name} Atmospheric Status
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(activeCity)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isFav
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
                  {isFav ? 'Saved City' : 'Save City'}
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-baseline gap-5">
              <div className="flex items-baseline gap-2.5">
                <span
                  className="text-5xl sm:text-6xl font-bold font-mono tracking-tight"
                  style={{ color: category.colorHex }}
                >
                  {currentAqi !== null ? Math.round(currentAqi) : '--'}
                </span>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  US EPA AQI
                </span>
              </div>

              <div className="space-y-1">
                <div className={`text-base font-semibold ${category.textClass}`}>
                  {localizedCat}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Observed {airQuality.current.time.replace('T', ' ')} · Band {category.range}
                </div>
              </div>
            </div>
          </div>

          {/* Quick action bar */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('investigator')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Run AI Investigation
            </button>
            <button
              type="button"
              onClick={() => onNavigate('map')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Compass className="h-3.5 w-3.5" />
              Open Interactive Map
            </button>
            <button
              type="button"
              onClick={() => onNavigate('routes')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Navigation className="h-3.5 w-3.5" />
              Compare Clean Routes
            </button>
            <button
              type="button"
              onClick={() => onNavigate('health')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Health Guidance
            </button>
          </div>
        </section>

        {/* Meteorology Card */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Meteorological Conditions</span>
              <span className="font-mono">{airQuality.weather.conditionLabel}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <Thermometer className="h-5 w-5 text-slate-400 self-center" />
              <span className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatMetric(airQuality.weather.temperature)}°C
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Feels {formatMetric(airQuality.weather.apparentTemperature)}°C
              </span>
            </div>
          </div>

          <dl className="mt-5 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <dt className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Droplets className="h-3.5 w-3.5" />
                Relative Humidity
              </dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatMetric(airQuality.weather.humidity, 0)}%
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Wind className="h-3.5 w-3.5" />
                Wind Speed & Bearing
              </dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatMetric(airQuality.weather.windSpeed)} km/h · {formatMetric(airQuality.weather.windDirection, 0)}°
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Gauge className="h-3.5 w-3.5" />
                Surface Pressure
              </dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatMetric(airQuality.weather.pressure, 0)} hPa
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* 6 Pollutant Telemetry Strip */}
      <section aria-label="Pollutant measurements">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {pollutants.map((p) => (
            <div
              key={p.label}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{p.label}</span>
                <span className="font-mono text-[11px]">{p.unit}</span>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {p.value}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard Widget Customizer Controls (Module 13) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 dark:border-slate-800 py-2.5 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-400">
          Personalized Overview Panels
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'showForecastMini', label: '24h Forecast' },
            { key: 'showHotspots', label: 'Hotspot Summary' },
            { key: 'showFavoritesStrip', label: 'Saved & Regional Cities' },
            { key: 'showHealthSummary', label: 'Recent Searches' },
          ].map((item) => {
            const active = preferences.dashboardWidgets[item.key as keyof UserPreferences['dashboardWidgets']];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  onUpdateWidgets({
                    ...preferences.dashboardWidgets,
                    [item.key]: !active,
                  })
                }
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional Personalized Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {preferences.dashboardWidgets.showForecastMini && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Next 24-Hour AQI Forecast
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  API Forecast Model · {airQuality.location.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('forecast')}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
              >
                Full Forecast <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="h-52 w-full">
              {next24Forecast.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={next24Forecast} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aqiMiniGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0891b2" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94a3b8" interval={3} />
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
                    <Area
                      type="monotone"
                      dataKey="aqi"
                      name="US AQI"
                      stroke="#0891b2"
                      strokeWidth={2}
                      fill="url(#aqiMiniGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No forecast hours returned for this coordinate.
                </div>
              )}
            </div>
          </section>
        )}

        {preferences.dashboardWidgets.showHotspots && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Local Spatial Hotspot & Clean Zone Snapshot
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comparative CAMS grid sampling around {airQuality.location.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('hotspots')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
                >
                  Inspect Grid <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {sortedHotspots.length > 0 ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Highest Sampled Hotspot</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {topHotspot.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {topHotspot.distanceKm} km from center · PM2.5 {formatMetric(topHotspot.pm25)} µg/m³
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold font-mono" style={{ color: getAqiCategory(topHotspot.usAqi).colorHex }}>
                        {Math.round(topHotspot.usAqi ?? 0)}
                      </div>
                      <div className="text-[11px] text-slate-500">US AQI</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Cleanest Monitored Area</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {cleanestZone.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {cleanestZone.distanceKm} km from center · PM2.5 {formatMetric(cleanestZone.pm25)} µg/m³
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold font-mono" style={{ color: getAqiCategory(cleanestZone.usAqi).colorHex }}>
                        {Math.round(cleanestZone.usAqi ?? 0)}
                      </div>
                      <div className="text-[11px] text-slate-500">US AQI</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  Loading local coordinate comparisons...
                </div>
              )}
            </div>
            <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
              {localGrid?.provenanceNote || 'Spatial points reflect modelled atmospheric grid estimates.'}
            </p>
          </section>
        )}
      </div>

      {/* Saved / Regional Cities Matrix */}
      {preferences.dashboardWidgets.showFavoritesStrip && cityReadings.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Regional & Favorite Cities Monitor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any city to switch active telemetry · Same US EPA AQI scale
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('compare')}
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
            >
              Compare All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {cityReadings.slice(0, 5).map((city) => {
              const cat = getAqiCategory(city.pollutants.usAqi);
              const isSelected = city.id === activeCity.id || city.name.toLowerCase() === activeCity.name.toLowerCase();
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() =>
                    onSelectCity({
                      id: city.id,
                      name: city.name,
                      state: city.state || '',
                      country: city.country || '',
                      lat: city.lat,
                      lon: city.lon,
                    })
                  }
                  className={`text-left rounded-lg border p-3.5 transition-colors ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {city.name}
                    </span>
                    <span className="text-base font-bold font-mono" style={{ color: cat.colorHex }}>
                      {city.pollutants.usAqi !== null ? Math.round(city.pollutants.usAqi) : '--'}
                    </span>
                  </div>
                  <div className={`mt-1 text-xs font-medium truncate ${cat.textClass}`}>{cat.label}</div>
                  <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    PM2.5 {formatMetric(city.pollutants.pm25)} · {formatMetric(city.weather.temperature)}°C
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Searches (Module 13) */}
      {preferences.dashboardWidgets.showHealthSummary && preferences.recentSearches.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Searches</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {preferences.recentSearches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCity(item)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {item.name}
                {item.state ? `, ${item.state}` : ''}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Compass,
  FileText,
  Flame,
  GitCompare,
  HeartPulse,
  LayoutDashboard,
  LocateFixed,
  Menu,
  MessageSquare,
  Moon,
  Navigation,
  Search,
  Server,
  Sparkles,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AirQualityResponse,
  AlertHistoryItem,
  CityPreset,
  CityReadingSummary,
  LanguageCode,
  LocalGridResponse,
  UserPreferences,
} from './types/environment';
import { DEFAULT_GUJARAT_COMPARISON_IDS, FEATURED_CITIES } from './data/cities';
import {
  fetchAirQuality,
  fetchBatchCities,
  fetchLocalGrid,
  reverseGeocode,
  searchCities,
} from './services/api';
import { UI_STRINGS } from './utils/i18n';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewDashboard } from './components/OverviewDashboard';
import { PollutionMapView } from './components/PollutionMapView';
import { HotspotsAndGreenZonesView } from './components/HotspotsAndGreenZonesView';
import { AiInvestigatorView } from './components/AiInvestigatorView';
import { RoutePlannerView } from './components/RoutePlannerView';
import { HealthAdvisorView } from './components/HealthAdvisorView';
import { ForecastAndAnalyticsView } from './components/ForecastAndAnalyticsView';
import { CityComparisonView } from './components/CityComparisonView';
import { ReportGeneratorView } from './components/ReportGeneratorView';
import { AlertCenterView } from './components/AlertCenterView';
import { MultilingualAssistantView } from './components/MultilingualAssistantView';
import { AwarenessCenterView } from './components/AwarenessCenterView';
import { SystemMonitorView } from './components/SystemMonitorView';

const PREFS_STORAGE_KEY = 'vayusense_preferences_v1';
const ALERTS_STORAGE_KEY = 'vayusense_alert_history_v1';

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteCities: FEATURED_CITIES.filter((c) => DEFAULT_GUJARAT_COMPARISON_IDS.includes(c.id)),
  recentSearches: FEATURED_CITIES.slice(0, 3),
  language: 'en',
  theme: 'light',
  pinnedCityId: 'ahmedabad',
  dashboardWidgets: {
    showHotspots: true,
    showHealthSummary: true,
    showForecastMini: true,
    showFavoritesStrip: true,
  },
  alerts: {
    enabled: true,
    browserNotifications: false,
    threshold100: true,
    threshold150: true,
    threshold200: true,
    hazardousAlert: true,
    customPm25Enabled: false,
    customPm25Threshold: 60,
  },
};

function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      dashboardWidgets: {
        ...DEFAULT_PREFERENCES.dashboardWidgets,
        ...(parsed.dashboardWidgets || {}),
      },
      alerts: {
        ...DEFAULT_PREFERENCES.alerts,
        ...(parsed.alerts || {}),
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function loadAlertHistory(): AlertHistoryItem[] {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadPreferences());
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>(() => loadAlertHistory());
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Active city & telemetry state
  const [activeCity, setActiveCity] = useState<CityPreset>(() => {
    const prefs = loadPreferences();
    return (
      prefs.favoriteCities.find((c) => c.id === prefs.pinnedCityId) ||
      FEATURED_CITIES.find((c) => c.id === prefs.pinnedCityId) ||
      FEATURED_CITIES[0]
    );
  });
  const [historyDays, setHistoryDays] = useState<number>(7);
  const [airQuality, setAirQuality] = useState<AirQualityResponse | null>(null);
  const [aqLoading, setAqLoading] = useState<boolean>(true);
  const [aqError, setAqError] = useState<string | null>(null);

  // Local spatial grid (Hotspots & Green zones)
  const [localGrid, setLocalGrid] = useState<LocalGridResponse | null>(null);
  const [gridLoading, setGridLoading] = useState<boolean>(false);
  const [gridError, setGridError] = useState<string | null>(null);

  // Compared / Featured cities batch readings
  const [comparedCities, setComparedCities] = useState<CityPreset[]>(() =>
    FEATURED_CITIES.filter((c) => DEFAULT_GUJARAT_COMPARISON_IDS.includes(c.id))
  );
  const [cityReadings, setCityReadings] = useState<CityReadingSummary[]>([]);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);

  // Geolocation & Search UI state
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ name: string; lat: number; lon: number; state?: string; country?: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [locationBanner, setLocationBanner] = useState<string | null>(null);

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
  }, [preferences.theme]);

  // Persist preferences & alert history
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // ignore quota error
    }
  }, [preferences]);

  useEffect(() => {
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alertHistory));
    } catch {
      // ignore quota error
    }
  }, [alertHistory]);

  // Network connectivity listener (Module 16)
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Load primary city AQI + weather + forecast
  const loadCityTelemetry = useCallback(
    async (city: CityPreset, pastDays: number, bypassCache = false) => {
      setAqLoading(true);
      setAqError(null);
      try {
        const data = await fetchAirQuality(city.lat, city.lon, city.name, pastDays, 7, bypassCache);
        setAirQuality(data);
      } catch (err: any) {
        setAqError(err?.message || 'Failed to fetch live air quality telemetry.');
      } finally {
        setAqLoading(false);
      }
    },
    []
  );

  // Load spatial grid around active city
  const loadSpatialGrid = useCallback(async (city: CityPreset) => {
    setGridLoading(true);
    setGridError(null);
    try {
      const grid = await fetchLocalGrid(city.lat, city.lon, city.name, city.id);
      setLocalGrid(grid);
    } catch (err: any) {
      setGridError(err?.message || 'Unable to load local hotspot grid.');
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCityTelemetry(activeCity, historyDays);
    loadSpatialGrid(activeCity);
  }, [activeCity, historyDays, loadCityTelemetry, loadSpatialGrid]);

  // Evaluate alert thresholds without duplicates (Module 9)
  const evaluateAlerts = useCallback(
    (readings: CityReadingSummary[]) => {
      if (!preferences.alerts.enabled) return;
      const favIds = new Set(preferences.favoriteCities.map((c) => c.id));
      const targets = readings.filter((r) => favIds.has(r.id) || r.id === activeCity.id);

      const newItems: AlertHistoryItem[] = [];
      const existingKeys = new Set(alertHistory.map((h) => h.dedupeKey));

      targets.forEach((city) => {
        const aqi = city.pollutants.usAqi;
        const pm25 = city.pollutants.pm25;
        const hourKey = city.observedTime.slice(0, 13);

        const pushIfNew = (ruleTag: string, conditionLabel: string) => {
          const dedupeKey = `${city.id}:${ruleTag}:${hourKey}`;
          if (existingKeys.has(dedupeKey)) return;
          existingKeys.add(dedupeKey);
          newItems.push({
            id: `${dedupeKey}-${Date.now()}`,
            dedupeKey,
            cityId: city.id,
            cityName: city.name,
            conditionLabel,
            aqi,
            pm25,
            triggeredAt: new Date().toISOString(),
            observedTime: city.observedTime,
            acknowledged: false,
          });
        };

        if (aqi !== null) {
          if (preferences.alerts.hazardousAlert && aqi >= 301) {
            pushIfNew('hazardous', 'AQI entered Hazardous category (301+)');
          } else if (preferences.alerts.threshold200 && aqi > 200) {
            pushIfNew('aqi200', 'AQI crossed 200 (Very Unhealthy)');
          } else if (preferences.alerts.threshold150 && aqi > 150) {
            pushIfNew('aqi150', 'AQI crossed 150 (Unhealthy)');
          } else if (preferences.alerts.threshold100 && aqi > 100) {
            pushIfNew('aqi100', 'AQI crossed 100 (Sensitive Groups)');
          }
        }

        if (
          preferences.alerts.customPm25Enabled &&
          pm25 !== null &&
          pm25 > preferences.alerts.customPm25Threshold
        ) {
          pushIfNew(
            `pm25-${preferences.alerts.customPm25Threshold}`,
            `PM2.5 exceeded ${preferences.alerts.customPm25Threshold} µg/m³`
          );
        }
      });

      if (newItems.length > 0) {
        setAlertHistory((prev) => [...newItems, ...prev].slice(0, 100));
        if (
          preferences.alerts.browserNotifications &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const top = newItems[0];
          new Notification(`VayuSense Alert: ${top.cityName}`, {
            body: `${top.conditionLabel} (AQI: ${top.aqi !== null ? Math.round(top.aqi) : '--'})`,
          });
        }
      }
    },
    [preferences.alerts, preferences.favoriteCities, activeCity.id, alertHistory]
  );

  // Batch load compared + favorite cities
  const loadBatchReadings = useCallback(async () => {
    setBatchLoading(true);
    try {
      const mergedMap = new Map<string, CityPreset>();
      [...comparedCities, ...preferences.favoriteCities].forEach((c) => mergedMap.set(c.id, c));
      const allLocs = Array.from(mergedMap.values()).slice(0, 15);
      const res = await fetchBatchCities(allLocs);
      setCityReadings(res.readings);
      evaluateAlerts(res.readings);
    } catch {
      // keep prior readings if batch refresh fails
    } finally {
      setBatchLoading(false);
    }
  }, [comparedCities, preferences.favoriteCities, evaluateAlerts]);

  useEffect(() => {
    loadBatchReadings();
  }, [comparedCities.length, preferences.favoriteCities.length]);

  const handleSelectCity = (city: CityPreset) => {
    setActiveCity(city);
    setPreferences((prev) => {
      const nextRecent = [city, ...prev.recentSearches.filter((r) => r.id !== city.id)].slice(0, 6);
      return {
        ...prev,
        pinnedCityId: city.id,
        recentSearches: nextRecent,
      };
    });
    setSearchResults([]);
    setSearchInput('');
    setLocationBanner(null);
  };

  const handleToggleFavorite = (city: CityPreset) => {
    setPreferences((prev) => {
      const exists = prev.favoriteCities.some((c) => c.id === city.id);
      const nextFavs = exists
        ? prev.favoriteCities.filter((c) => c.id !== city.id)
        : [city, ...prev.favoriteCities].slice(0, 10);
      return { ...prev, favoriteCities: nextFavs };
    });
  };

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await searchCities(searchInput.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setLocationBanner('Browser geolocation is unavailable in this environment.');
      return;
    }
    setLocating(true);
    setLocationBanner(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation({ lat, lon });
        try {
          const rev = await reverseGeocode(lat, lon);
          handleSelectCity({
            id: `gps-${lat.toFixed(2)}-${lon.toFixed(2)}`,
            name: rev.name || 'My Location',
            state: rev.state,
            country: rev.country,
            lat,
            lon,
          });
        } catch {
          handleSelectCity({
            id: `gps-${lat.toFixed(2)}-${lon.toFixed(2)}`,
            name: 'My GPS Location',
            state: '',
            country: '',
            lat,
            lon,
          });
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocationBanner(`Location access declined or unavailable (${err.message}).`);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setBrowserPermission(perm);
    if (perm === 'granted') {
      setPreferences((prev) => ({
        ...prev,
        alerts: { ...prev.alerts, browserNotifications: true },
      }));
    }
  };

  const unreadAlertsCount = useMemo(
    () => alertHistory.filter((a) => !a.acknowledged).length,
    [alertHistory]
  );

  const t = UI_STRINGS[preferences.language];

  const navItems = [
    { id: 'overview', label: t.navOverview, icon: LayoutDashboard },
    { id: 'map', label: t.navMap, icon: Compass },
    { id: 'hotspots', label: t.navHotspots, icon: Flame },
    { id: 'investigator', label: t.navInvestigator, icon: Sparkles },
    { id: 'routes', label: t.navRoutes, icon: Navigation },
    { id: 'health', label: t.navHealth, icon: HeartPulse },
    { id: 'forecast', label: t.navForecast, icon: BarChart3 },
    { id: 'compare', label: t.navCompare, icon: GitCompare },
    { id: 'reports', label: t.navReports, icon: FileText },
    { id: 'alerts', label: t.navAlerts, icon: Bell, badge: unreadAlertsCount },
    { id: 'assistant', label: t.navAssistant, icon: MessageSquare },
    { id: 'awareness', label: t.navAwareness, icon: BookOpen },
    { id: 'system', label: t.navSystem, icon: Server },
  ];

  const comparisonReadings = useMemo(() => {
    const ids = new Set(comparedCities.map((c) => c.id));
    return cityReadings.filter((r) => ids.has(r.id));
  }, [comparedCities, cityReadings]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B12] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar (Strict 1-row 3-zone contract) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B111D]/95 backdrop-blur-sm">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
            >
              VayuSense
            </button>
          </div>

          {/* Zone 2: Concise Primary Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'map', label: 'Map' },
              { id: 'forecast', label: 'Forecast' },
              { id: 'compare', label: 'Compare' },
              { id: 'assistant', label: 'AI Chat' },
            ].map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setActiveTab(link.id)}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 dark:hover:text-white ${
                  activeTab === link.id
                    ? 'text-cyan-700 dark:text-cyan-400 font-semibold underline underline-offset-8 decoration-2'
                    : ''
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              {t.generateReport}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex relative">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B111D] p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-cyan-500/15 dark:text-cyan-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="font-mono text-[11px] font-bold text-rose-500">{item.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="font-semibold text-slate-700 dark:text-slate-300">{t.brandTagline}</div>
            <div>{t.measuredVsModelled}</div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/60"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative z-50 w-72 max-w-[85vw] bg-white dark:bg-[#0B111D] border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-base font-bold text-slate-900 dark:text-white">VayuSense Modules</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 rounded-md text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-cyan-500/20 dark:text-cyan-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge && item.badge > 0 ? (
                        <span className="font-mono font-bold text-rose-500">{item.badge}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 max-w-[1440px] mx-auto w-full space-y-5">
          {/* Offline Banner (Module 16) */}
          {!isOnline && (
            <div className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Network connection offline. Live API updates are paused until connectivity is restored.</span>
            </div>
          )}

          {/* Workspace Search, Geolocation, Language & Theme Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="relative flex-1 min-w-[230px] max-w-md">
              <form onSubmit={handleCitySearch} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  {searching ? '...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 z-30 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                  {searchResults.map((res, idx) => (
                    <button
                      key={`${res.name}-${idx}`}
                      type="button"
                      onClick={() =>
                        handleSelectCity({
                          id: `${res.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${res.lat.toFixed(2)}`,
                          name: res.name,
                          state: res.state || '',
                          country: res.country || '',
                          lat: res.lat,
                          lon: res.lon,
                        })
                      }
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {res.name}
                        {res.state ? `, ${res.state}` : ''}
                        {res.country ? ` · ${res.country}` : ''}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {res.lat.toFixed(2)}, {res.lon.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLocateUser}
                disabled={locating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <LocateFixed className={`h-3.5 w-3.5 text-cyan-600 ${locating ? 'animate-spin' : ''}`} />
                {locating ? 'Locating...' : t.locateMe}
              </button>

              {/* Language selector (Module 12 & 13) */}
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
                {(['en', 'gu', 'hi'] as LanguageCode[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setPreferences((prev) => ({ ...prev, language: lang }))}
                    className={`rounded-md px-2 py-1 font-medium transition-colors ${
                      preferences.language === lang
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {lang === 'en' ? 'EN' : lang === 'gu' ? 'ગુજ' : 'हिन्दी'}
                  </button>
                ))}
              </div>

              {/* Dark / Light mode toggle (Module 13) */}
              <button
                type="button"
                onClick={() =>
                  setPreferences((prev) => ({
                    ...prev,
                    theme: prev.theme === 'dark' ? 'light' : 'dark',
                  }))
                }
                aria-label="Toggle color theme"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {preferences.theme === 'dark' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" />
                    <span>{t.lightMode}</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-slate-600" />
                    <span>{t.darkMode}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {locationBanner && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
              {locationBanner}
            </div>
          )}

          {/* Active Module Viewport wrapped in ErrorBoundary */}
          <ErrorBoundary sectionName={navItems.find((n) => n.id === activeTab)?.label}>
            {activeTab === 'overview' && (
              <OverviewDashboard
                activeCity={activeCity}
                airQuality={airQuality}
                cityReadings={cityReadings}
                localGrid={localGrid}
                loading={aqLoading}
                error={aqError}
                language={preferences.language}
                preferences={preferences}
                onRetry={() => loadCityTelemetry(activeCity, historyDays, true)}
                onSelectCity={handleSelectCity}
                onToggleFavorite={handleToggleFavorite}
                onNavigate={setActiveTab}
                onUpdateWidgets={(widgets) =>
                  setPreferences((prev) => ({ ...prev, dashboardWidgets: widgets }))
                }
              />
            )}

            {activeTab === 'map' && (
              <PollutionMapView
                activeCity={activeCity}
                cityReadings={cityReadings}
                localPoints={localGrid?.points || []}
                userLocation={userLocation}
                onLocateUser={handleLocateUser}
                onSelectCity={handleSelectCity}
              />
            )}

            {activeTab === 'hotspots' && (
              <HotspotsAndGreenZonesView
                activeCity={activeCity}
                localGrid={localGrid}
                loading={gridLoading}
                error={gridError}
                onRefresh={() => loadSpatialGrid(activeCity)}
                onOpenMap={() => setActiveTab('map')}
              />
            )}

            {activeTab === 'investigator' && <AiInvestigatorView airQuality={airQuality} />}

            {activeTab === 'routes' && <RoutePlannerView />}

            {activeTab === 'health' && <HealthAdvisorView airQuality={airQuality} />}

            {activeTab === 'forecast' && (
              <ForecastAndAnalyticsView
                airQuality={airQuality}
                historyDays={historyDays}
                loading={aqLoading}
                onChangeHistoryDays={(days) => setHistoryDays(days)}
              />
            )}

            {activeTab === 'compare' && (
              <CityComparisonView
                comparedCities={comparedCities}
                readings={comparisonReadings}
                loading={batchLoading}
                onAddCity={(city) => {
                  setComparedCities((prev) => {
                    if (prev.length >= 5 || prev.some((c) => c.id === city.id)) return prev;
                    return [...prev, city];
                  });
                }}
                onRemoveCity={(id) => {
                  setComparedCities((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));
                }}
              />
            )}

            {activeTab === 'reports' && (
              <ReportGeneratorView airQuality={airQuality} comparisonCities={comparisonReadings} />
            )}

            {activeTab === 'alerts' && (
              <AlertCenterView
                rules={preferences.alerts}
                history={alertHistory}
                favoriteCities={preferences.favoriteCities}
                browserPermission={browserPermission}
                onUpdateRules={(next) => setPreferences((prev) => ({ ...prev, alerts: next }))}
                onRequestBrowserPermission={handleRequestNotificationPermission}
                onAcknowledgeAll={() =>
                  setAlertHistory((prev) => prev.map((a) => ({ ...a, acknowledged: true })))
                }
                onClearHistory={() => setAlertHistory([])}
                onEvaluateNow={loadBatchReadings}
              />
            )}

            {activeTab === 'assistant' && (
              <MultilingualAssistantView
                language={preferences.language}
                activeCityData={airQuality}
                cityReadings={cityReadings}
                onChangeLanguage={(lang) => setPreferences((prev) => ({ ...prev, language: lang }))}
              />
            )}

            {activeTab === 'awareness' && <AwarenessCenterView />}

            {activeTab === 'system' && <SystemMonitorView airQuality={airQuality} />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

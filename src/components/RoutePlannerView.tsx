import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Bike, Car, CheckCircle2, Footprints, Info, Navigation, RefreshCw, Route } from 'lucide-react';
import type { RouteComparisonResponse } from '../types/environment';
import { compareRoutes } from '../services/api';
import { formatMetric, getAqiCategory } from '../utils/aqi';

const ROUTE_PRESETS = [
  { label: 'Ahmedabad → Gandhinagar', start: 'Ahmedabad', end: 'Gandhinagar' },
  { label: 'Navrangpura → Narol (Ahmedabad)', start: 'Navrangpura, Ahmedabad', end: 'Narol, Ahmedabad' },
  { label: 'Surat → Vadodara', start: 'Surat', end: 'Vadodara' },
  { label: 'Ahmedabad → Vadodara', start: 'Ahmedabad', end: 'Vadodara' },
];

export function RoutePlannerView() {
  const [startQuery, setStartQuery] = useState('Ahmedabad');
  const [endQuery, setEndQuery] = useState('Gandhinagar');
  const [mode, setMode] = useState<'driving' | 'cycling' | 'walking'>('driving');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteComparisonResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, {
      center: [23.11, 72.6],
      zoom: 11,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !result) return;

    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    result.routes.forEach((route, idx) => {
      const isSelected = selectedRouteId ? route.id === selectedRouteId : route.isRecommended;
      const color = route.isRecommended ? '#16A34A' : idx === 0 ? '#0284C7' : '#64748B';
      const poly = L.polyline(route.geometry, {
        color,
        weight: isSelected ? 6 : 3.5,
        opacity: isSelected ? 0.95 : 0.65,
        dashArray: isSelected ? undefined : '6 6',
      });
      poly.addTo(layer);
      route.geometry.forEach((pt) => bounds.extend(pt));

      if (isSelected) {
        route.sampledWaypoints.forEach((wp) => {
          const cat = getAqiCategory(wp.usAqi);
          L.circleMarker([wp.lat, wp.lon], {
            radius: 6,
            color: '#fff',
            weight: 2,
            fillColor: cat.colorHex,
            fillOpacity: 1,
          })
            .bindPopup(
              `Waypoint AQI: <b>${wp.usAqi !== null ? Math.round(wp.usAqi) : 'Unavailable'}</b><br/>PM2.5: ${formatMetric(wp.pm25)} µg/m³`
            )
            .addTo(layer);
        });
      }
    });

    L.marker([result.start.lat, result.start.lon]).bindPopup(`Start: ${result.start.name}`).addTo(layer);
    L.marker([result.end.lat, result.end.lon]).bindPopup(`End: ${result.end.name}`).addTo(layer);
    bounds.extend([result.start.lat, result.start.lon]);
    bounds.extend([result.end.lat, result.end.lon]);

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [36, 36] });
    }
  }, [result, selectedRouteId]);

  const handleAnalyzeRoute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (startQuery.trim().length < 2 || endQuery.trim().length < 2) {
      setError('Enter both a valid starting location and destination.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await compareRoutes({
        startQuery: startQuery.trim(),
        endQuery: endQuery.trim(),
        mode,
      });
      setResult(data);
      const rec = data.routes.find((r) => r.isRecommended) || data.routes[0];
      setSelectedRouteId(rec ? rec.id : null);
    } catch (err: any) {
      setError(err?.message || 'Unable to compute route comparison.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleAnalyzeRoute}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Smart Low-Exposure Route Recommendation
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real OSRM routing alternatives paired with Open-Meteo CAMS waypoint air quality sampling
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROUTE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setStartQuery(p.start);
                  setEndQuery(p.end);
                }}
                className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Starting Location
            </label>
            <input
              type="text"
              value={startQuery}
              onChange={(e) => setStartQuery(e.target.value)}
              placeholder="e.g. Ahmedabad"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Destination
            </label>
            <input
              type="text"
              value={endQuery}
              onChange={(e) => setEndQuery(e.target.value)}
              placeholder="e.g. Gandhinagar"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Travel Mode
            </label>
            <div className="grid grid-cols-3 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {[
                { id: 'driving', icon: Car, label: 'Drive' },
                { id: 'cycling', icon: Bike, label: 'Cycle' },
                { id: 'walking', icon: Footprints, label: 'Walk' },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id as 'driving' | 'cycling' | 'walking')}
                    title={m.label}
                    className={`flex items-center justify-center py-1.5 rounded-md text-xs transition-colors ${
                      mode === m.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
              {loading ? 'Routing...' : 'Compare Routes'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        {/* Route Alternatives List */}
        <div className="lg:col-span-2 space-y-3">
          {result ? (
            <>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <Info className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                <span>{result.provenanceNote}</span>
              </div>

              {result.routes.map((route) => {
                const isSelected = route.id === selectedRouteId;
                const cat = getAqiCategory(route.avgAqi);
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {route.name}
                        </div>
                        {route.isRecommended && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {route.aqiDataAvailable
                              ? 'Recommended · Lowest Sampled Exposure'
                              : 'Recommended · Fastest Route'}
                          </div>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {route.durationMin} min
                        </div>
                        <div className="text-[11px] text-slate-500">{route.distanceKm} km</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[11px] text-slate-500">Avg Route AQI</div>
                        <div className="font-mono font-bold" style={{ color: cat.colorHex }}>
                          {route.aqiDataAvailable && route.avgAqi !== null ? route.avgAqi.toFixed(0) : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Peak Waypoint</div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {route.aqiDataAvailable && route.maxAqi !== null ? Math.round(route.maxAqi) : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Avg PM2.5</div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {route.aqiDataAvailable ? `${formatMetric(route.avgPm25)} µg/m³` : 'Unavailable'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500 space-y-2">
              <Route className="h-6 w-6 mx-auto text-slate-400" />
              <div className="font-medium text-slate-700 dark:text-slate-300">
                Ready to Compare Commute Routes
              </div>
              <p>
                Enter origin and destination above to retrieve live OSRM routes and sampled air quality exposure along each path.
              </p>
            </div>
          )}
        </div>

        {/* Leaflet Route Map */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900 min-h-[420px]">
          <div ref={mapElRef} className="w-full h-[450px]" />
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Layers, LocateFixed, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import type { CityPreset, CityReadingSummary, LocalGridPoint } from '../types/environment';
import { FEATURED_CITIES } from '../data/cities';
import { formatMetric, getAqiCategory } from '../utils/aqi';

interface PollutionMapViewProps {
  activeCity: CityPreset;
  cityReadings: CityReadingSummary[];
  localPoints: LocalGridPoint[];
  userLocation: { lat: number; lon: number } | null;
  onLocateUser: () => void;
  onSelectCity: (city: CityPreset) => void;
}

export function PollutionMapView({
  activeCity,
  cityReadings,
  localPoints,
  userLocation,
  onLocateUser,
  onSelectCity,
}: PollutionMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const areasLayerRef = useRef<L.LayerGroup | null>(null);

  const [showCities, setShowCities] = useState(true);
  const [showAreaCircles, setShowAreaCircles] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<{
    name: string;
    lat: number;
    lon: number;
    usAqi: number | null;
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    o3: number | null;
    observedTime: string;
    provenance: string;
    zoneType?: string;
  } | null>(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [activeCity.lat, activeCity.lon],
      zoom: 11,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const areasLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    areasLayerRef.current = areasLayer;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      areasLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Re-center when activeCity changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([activeCity.lat, activeCity.lon], 11, { duration: 0.7 });
  }, [activeCity.lat, activeCity.lon]);

  // Render markers and area-wise visualization
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const areasLayer = areasLayerRef.current;
    if (!markersLayer || !areasLayer) return;

    markersLayer.clearLayers();
    areasLayer.clearLayers();

    // Area-wise pollution visualization circles around local grid points
    if (showAreaCircles) {
      localPoints.forEach((pt) => {
        const cat = getAqiCategory(pt.usAqi);
        const circle = L.circle([pt.lat, pt.lon], {
          radius: 3200,
          color: cat.colorHex,
          fillColor: cat.colorHex,
          fillOpacity: 0.16,
          weight: 1,
        });
        circle.addTo(areasLayer);
      });
    }

    // Local grid hotspot markers
    if (showHotspots) {
      localPoints.forEach((pt) => {
        const cat = getAqiCategory(pt.usAqi);
        const aqiText = pt.usAqi !== null ? Math.round(pt.usAqi) : '--';
        const isHigh = (pt.usAqi ?? 0) >= 150;
        const icon = L.divIcon({
          className: 'vayusense-grid-marker',
          html: `<div style="background:${cat.colorHex};color:#fff;border:2px solid #fff;border-radius:6px;padding:2px 6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">${
            isHigh ? '▲ ' : ''
          }${aqiText}</div>`,
          iconSize: [44, 24],
          iconAnchor: [22, 12],
        });

        const marker = L.marker([pt.lat, pt.lon], { icon });
        marker.bindPopup(
          `<div style="min-width:190px;font-family:sans-serif;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${pt.name}</div>
            <div style="font-size:12px;color:${cat.colorHex};font-weight:600;margin-bottom:6px;">US AQI ${aqiText} · ${cat.label}</div>
            <div style="font-size:11px;line-height:1.5;">
              PM2.5: <b>${formatMetric(pt.pm25)} µg/m³</b><br/>
              PM10: <b>${formatMetric(pt.pm10)} µg/m³</b><br/>
              Zone: ${pt.zoneType}<br/>
              <span style="color:#64748b;">Modelled Estimate (Open-Meteo CAMS)</span>
            </div>
          </div>`
        );
        marker.on('click', () => {
          setSelectedMarker({
            name: pt.name,
            lat: pt.lat,
            lon: pt.lon,
            usAqi: pt.usAqi,
            pm25: pt.pm25,
            pm10: pt.pm10,
            no2: pt.no2,
            o3: pt.o3,
            observedTime: pt.observedTime,
            provenance: pt.sourceLabel,
            zoneType: pt.zoneType,
          });
        });
        marker.addTo(markersLayer);
      });
    }

    // City markers
    if (showCities) {
      cityReadings.forEach((city) => {
        const cat = getAqiCategory(city.pollutants.usAqi);
        const aqiText = city.pollutants.usAqi !== null ? Math.round(city.pollutants.usAqi) : '--';
        const icon = L.divIcon({
          className: 'vayusense-city-marker',
          html: `<div style="background:#0f172a;color:#fff;border:2px solid ${cat.colorHex};border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;box-shadow:0 3px 10px rgba(0,0,0,0.35);white-space:nowrap;display:inline-flex;align-items:center;gap:6px;">
            <span>${city.name}</span>
            <span style="background:${cat.colorHex};color:#fff;padding:1px 5px;border-radius:4px;font-family:'JetBrains Mono',monospace;">${aqiText}</span>
          </div>`,
          iconSize: [120, 28],
          iconAnchor: [60, 14],
        });

        const marker = L.marker([city.lat, city.lon], { icon });
        marker.bindPopup(
          `<div style="min-width:210px;font-family:sans-serif;">
            <div style="font-weight:700;font-size:14px;margin-bottom:3px;">${city.name}</div>
            <div style="font-size:12px;color:${cat.colorHex};font-weight:600;margin-bottom:6px;">US AQI ${aqiText} · ${cat.label}</div>
            <div style="font-size:11px;line-height:1.5;">
              PM2.5: <b>${formatMetric(city.pollutants.pm25)} µg/m³</b><br/>
              PM10: <b>${formatMetric(city.pollutants.pm10)} µg/m³</b><br/>
              NO₂: <b>${formatMetric(city.pollutants.no2)} µg/m³</b> · O₃: <b>${formatMetric(city.pollutants.o3)} µg/m³</b><br/>
              Weather: ${formatMetric(city.weather.temperature)}°C, Wind ${formatMetric(city.weather.windSpeed)} km/h<br/>
              <span style="color:#64748b;">${city.sourceLabel}</span>
            </div>
          </div>`
        );
        marker.on('click', () => {
          setSelectedMarker({
            name: city.name,
            lat: city.lat,
            lon: city.lon,
            usAqi: city.pollutants.usAqi,
            pm25: city.pollutants.pm25,
            pm10: city.pollutants.pm10,
            no2: city.pollutants.no2,
            o3: city.pollutants.o3,
            observedTime: city.observedTime,
            provenance: city.sourceLabel,
          });
        });
        marker.addTo(markersLayer);
      });
    }

    // User location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'vayusense-user-marker',
        html: `<div style="width:16px;height:16px;border-radius:9999px;background:#0284c7;border:3px solid #fff;box-shadow:0 0 0 3px rgba(2,132,199,0.35);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .bindPopup('<b>Your Browser Location</b>')
        .addTo(markersLayer);
    }
  }, [cityReadings, localPoints, userLocation, showCities, showAreaCircles, showHotspots]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleCenterActive = () => {
    mapInstanceRef.current?.flyTo([activeCity.lat, activeCity.lon], 11, { duration: 0.6 });
  };
  const handleZoomRegional = () => {
    mapInstanceRef.current?.flyTo([22.5, 72.1], 7, { duration: 0.8 });
  };

  return (
    <div className="space-y-4">
      {/* Quick City Selector Bar (Gujarat & Major Cities) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
            Explore Cities:
          </span>
          {FEATURED_CITIES.slice(0, 7).map((city) => {
            const isSelected = city.id === activeCity.id;
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => onSelectCity(city)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {city.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleZoomRegional}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Gujarat Overview
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <Layers className="h-3.5 w-3.5" />
            Layers:
          </span>
          {[
            { label: 'Cities', state: showCities, set: setShowCities },
            { label: 'Hotspots', state: showHotspots, set: setShowHotspots },
            { label: 'Area Zones', state: showAreaCircles, set: setShowAreaCircles },
          ].map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => l.set(!l.state)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                l.state
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map + Marker Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        <div className="lg:col-span-3 relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900 min-h-[500px]">
          <div ref={mapContainerRef} className="w-full h-[520px]" />

          {/* Custom Map Controls */}
          <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom in"
              className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom out"
              className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCenterActive}
              title="Center on selected city"
              className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Crosshair className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onLocateUser}
              title="Locate my GPS position"
              className="h-9 w-9 rounded-lg border border-cyan-500 bg-cyan-600 text-white flex items-center justify-center shadow-sm hover:bg-cyan-700"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          </div>

          {/* AQI Color Scale Legend */}
          <div className="absolute bottom-3 left-3 z-[400] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 py-2 text-[11px] shadow-sm">
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
              US EPA AQI Scale (Modelled Estimates)
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-slate-600 dark:text-slate-300 font-mono">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#16A34A]" /> 0–50 Good
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#CA8A04]" /> 51–100 Mod
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#EA580C]" /> 101–150 USG
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#DC2626]" /> 151–200 Unhealthy
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#9333EA]" /> 201+ Severe
              </span>
            </div>
          </div>
        </div>

        {/* Side Marker Inspector */}
        <aside className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Marker Telemetry Inspector
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click any city or area marker on the map to inspect PM2.5, PM10, and data provenance.
            </p>

            {selectedMarker ? (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-cyan-600" />
                    <span className="font-mono">
                      {selectedMarker.lat.toFixed(3)}, {selectedMarker.lon.toFixed(3)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedMarker.name}
                  </h3>
                  {selectedMarker.zoneType && (
                    <div className="text-xs text-slate-500 capitalize">
                      Zone profile: {selectedMarker.zoneType}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">US EPA AQI</div>
                  <div
                    className="text-3xl font-bold font-mono mt-1"
                    style={{ color: getAqiCategory(selectedMarker.usAqi).colorHex }}
                  >
                    {selectedMarker.usAqi !== null ? Math.round(selectedMarker.usAqi) : '--'}
                  </div>
                  <div className={`text-xs font-semibold mt-0.5 ${getAqiCategory(selectedMarker.usAqi).textClass}`}>
                    {getAqiCategory(selectedMarker.usAqi).label}
                  </div>
                </div>

                <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">PM2.5</dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatMetric(selectedMarker.pm25)} µg/m³
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">PM10</dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatMetric(selectedMarker.pm10)} µg/m³
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">NO₂</dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatMetric(selectedMarker.no2)} µg/m³
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">O₃</dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatMetric(selectedMarker.o3)} µg/m³
                    </dd>
                  </div>
                </dl>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-semibold">Data Provenance</div>
                  <div>{selectedMarker.provenance}</div>
                  <div className="font-mono text-slate-500">
                    Timestamp: {selectedMarker.observedTime.replace('T', ' ')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                No marker selected yet. Click a marker on the OpenStreetMap canvas to view pollutant details.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            All plotted points represent real retrieved Open-Meteo CAMS atmospheric model coordinates (~11 km resolution). No synthetic locations are plotted.
          </div>
        </aside>
      </div>
    </div>
  );
}

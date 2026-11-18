import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

interface CacheEntry {
  data: unknown;
  expiresAt: number;
  fetchedAt: string;
}

interface ProviderStat {
  name: string;
  purpose: string;
  status: 'connected' | 'degraded' | 'idle';
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  totalRequests: number;
  errorCount: number;
  lastLatencyMs: number | null;
}

interface ApiErrorLog {
  timestamp: string;
  provider: string;
  message: string;
  statusCode?: number;
}

const serverStartTime = Date.now();
const cache = new Map<string, CacheEntry>();
let cacheHits = 0;
let cacheMisses = 0;
let lastSuccessfulRefresh: string | null = null;

const providerStats: Record<string, ProviderStat> = {
  openMeteoAq: {
    name: 'Open-Meteo Air Quality (CAMS)',
    purpose: 'Atmospheric AQI, PM2.5, PM10, NO₂, SO₂, CO, O₃ & multi-day forecasts',
    status: 'idle',
    lastSuccessAt: null,
    lastErrorAt: null,
    totalRequests: 0,
    errorCount: 0,
    lastLatencyMs: null,
  },
  openMeteoWeather: {
    name: 'Open-Meteo Weather',
    purpose: 'Real-time meteorology (temperature, humidity, wind, pressure)',
    status: 'idle',
    lastSuccessAt: null,
    lastErrorAt: null,
    totalRequests: 0,
    errorCount: 0,
    lastLatencyMs: null,
  },
  nominatim: {
    name: 'OpenStreetMap Nominatim & Open-Meteo Geocoding',
    purpose: 'City search, coordinate resolution, and reverse geocoding',
    status: 'idle',
    lastSuccessAt: null,
    lastErrorAt: null,
    totalRequests: 0,
    errorCount: 0,
    lastLatencyMs: null,
  },
  osrm: {
    name: 'OSRM Public Routing Engine',
    purpose: 'Multi-modal route geometry, distance, and travel time alternatives',
    status: 'idle',
    lastSuccessAt: null,
    lastErrorAt: null,
    totalRequests: 0,
    errorCount: 0,
    lastLatencyMs: null,
  },
  gemini: {
    name: 'Gemini Environmental Intelligence',
    purpose: 'AI Pollution Investigator, Health Advisor, Reports & Multilingual Assistant',
    status: ai ? 'idle' : 'degraded',
    lastSuccessAt: null,
    lastErrorAt: null,
    totalRequests: 0,
    errorCount: 0,
    lastLatencyMs: null,
  },
};

const recentErrors: ApiErrorLog[] = [];

function recordProviderSuccess(key: string, latencyMs: number) {
  const stat = providerStats[key];
  if (!stat) return;
  const now = new Date().toISOString();
  stat.status = 'connected';
  stat.lastSuccessAt = now;
  stat.totalRequests += 1;
  stat.lastLatencyMs = latencyMs;
  lastSuccessfulRefresh = now;
}

function recordProviderError(key: string, message: string, statusCode?: number) {
  const stat = providerStats[key];
  const now = new Date().toISOString();
  if (stat) {
    stat.status = 'degraded';
    stat.lastErrorAt = now;
    stat.totalRequests += 1;
    stat.errorCount += 1;
  }
  recentErrors.unshift({
    timestamp: now,
    provider: stat ? stat.name : key,
    message: message.slice(0, 260),
    statusCode,
  });
  if (recentErrors.length > 50) {
    recentErrors.length = 50;
  }
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    cacheMisses += 1;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    cacheMisses += 1;
    return null;
  }
  cacheHits += 1;
  return entry.data as T;
}

function setCached(key: string, data: unknown, ttlMs: number) {
  if (cache.size > 400) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    fetchedAt: new Date().toISOString(),
  });
}

async function fetchJsonWithTimeout(
  url: string,
  providerKey: string,
  options: RequestInit = {},
  timeoutMs = 12000
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VayuSense-Environmental-Platform/1.0',
        ...(options.headers || {}),
      },
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      recordProviderError(providerKey, `HTTP ${res.status}: ${bodyText || res.statusText}`, res.status);
      const err = new Error(`Upstream ${providerKey} error (${res.status})`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    recordProviderSuccess(providerKey, latency);
    return json;
  } catch (err: any) {
    if (!err?.status) {
      recordProviderError(providerKey, err?.message || 'Network request failed');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function weatherCodeToLabel(code: number | null | undefined): string {
  if (code === null || code === undefined) return 'Unavailable';
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Fog / Haze';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Variable Conditions';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

const KNOWN_CITIES: Record<string, { name: string; lat: number; lon: number; state?: string; country?: string }> = {
  ahmedabad: { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, state: 'Gujarat', country: 'India' },
  gandhinagar: { name: 'Gandhinagar', lat: 23.2156, lon: 72.6369, state: 'Gujarat', country: 'India' },
  surat: { name: 'Surat', lat: 21.1702, lon: 72.8311, state: 'Gujarat', country: 'India' },
  vadodara: { name: 'Vadodara', lat: 22.3072, lon: 73.1812, state: 'Gujarat', country: 'India' },
  rajkot: { name: 'Rajkot', lat: 22.3039, lon: 70.8022, state: 'Gujarat', country: 'India' },
  delhi: { name: 'New Delhi', lat: 28.6139, lon: 77.209, state: 'Delhi', country: 'India' },
  'new delhi': { name: 'New Delhi', lat: 28.6139, lon: 77.209, state: 'Delhi', country: 'India' },
  mumbai: { name: 'Mumbai', lat: 19.076, lon: 72.8777, state: 'Maharashtra', country: 'India' },
  bengaluru: { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, state: 'Karnataka', country: 'India' },
  jaipur: { name: 'Jaipur', lat: 26.9124, lon: 75.7873, state: 'Rajasthan', country: 'India' },
  pune: { name: 'Pune', lat: 18.5204, lon: 73.8567, state: 'Maharashtra', country: 'India' },
};

const GUJARAT_SUBZONES: Record<
  string,
  Array<{ id: string; name: string; lat: number; lon: number; zoneType: string }>
> = {
  ahmedabad: [
    { id: 'ahm-navrangpura', name: 'Navrangpura Central', lat: 23.0365, lon: 72.5611, zoneType: 'urban' },
    { id: 'ahm-narol', name: 'Narol Vatva Corridor', lat: 22.9612, lon: 72.5998, zoneType: 'industrial' },
    { id: 'ahm-bopal', name: 'South Bopal', lat: 23.0268, lon: 72.4673, zoneType: 'residential' },
    { id: 'ahm-sabarmati', name: 'Sabarmati Riverfront North', lat: 23.0686, lon: 72.5797, zoneType: 'greenbelt' },
    { id: 'ahm-chandkheda', name: 'Chandkheda Ring Road', lat: 23.1116, lon: 72.5728, zoneType: 'transit' },
    { id: 'ahm-nikol', name: 'Nikol East', lat: 23.0479, lon: 72.6657, zoneType: 'residential' },
    { id: 'ahm-sarkhej', name: 'Sarkhej SG Highway', lat: 22.9897, lon: 72.4996, zoneType: 'transit' },
    { id: 'ahm-maninagar', name: 'Maninagar', lat: 22.9962, lon: 72.6031, zoneType: 'urban' },
  ],
  gandhinagar: [
    { id: 'gnd-sec11', name: 'Sector 11 Sachivalaya', lat: 23.223, lon: 72.65, zoneType: 'urban' },
    { id: 'gnd-infocity', name: 'Infocity & GIFT Corridor', lat: 23.1645, lon: 72.6836, zoneType: 'transit' },
    { id: 'gnd-indroda', name: 'Indroda Park Area', lat: 23.1995, lon: 72.6391, zoneType: 'greenbelt' },
    { id: 'gnd-kudasan', name: 'Kudasan South', lat: 23.1782, lon: 72.6321, zoneType: 'residential' },
    { id: 'gnd-kalol', name: 'Kalol Industrial Edge', lat: 23.2432, lon: 72.5015, zoneType: 'industrial' },
  ],
  surat: [
    { id: 'srt-athwa', name: 'Athwa Lines', lat: 21.1815, lon: 72.8055, zoneType: 'urban' },
    { id: 'srt-hazira', name: 'Hazira Port Corridor', lat: 21.1243, lon: 72.6512, zoneType: 'industrial' },
    { id: 'srt-vesu', name: 'Vesu South', lat: 21.1418, lon: 72.7709, zoneType: 'residential' },
    { id: 'srt-sachin', name: 'Sachin Industrial Area', lat: 21.0844, lon: 72.8632, zoneType: 'industrial' },
    { id: 'srt-dumas', name: 'Dumas Coastal Zone', lat: 21.0937, lon: 72.7107, zoneType: 'greenbelt' },
  ],
  vadodara: [
    { id: 'vad-alkapuri', name: 'Alkapuri Central', lat: 22.3106, lon: 73.1701, zoneType: 'urban' },
    { id: 'vad-makarpura', name: 'Makarpura GIDC', lat: 22.2442, lon: 73.1932, zoneType: 'industrial' },
    { id: 'vad-nandesari', name: 'Nandesari Petrochemical Belt', lat: 22.4117, lon: 73.0953, zoneType: 'industrial' },
    { id: 'vad-gotri', name: 'Gotri West', lat: 22.3164, lon: 73.1337, zoneType: 'residential' },
    { id: 'vad-kamati', name: 'Sayajibaug Precinct', lat: 22.3114, lon: 73.1895, zoneType: 'greenbelt' },
  ],
  rajkot: [
    { id: 'raj-kalawad', name: 'Kalawad Road', lat: 22.2839, lon: 70.7681, zoneType: 'urban' },
    { id: 'raj-shapar', name: 'Shapar Veraval GIDC', lat: 22.1592, lon: 70.7995, zoneType: 'industrial' },
    { id: 'raj-nyari', name: 'Nyari Dam Perimeter', lat: 22.2389, lon: 70.7131, zoneType: 'greenbelt' },
    { id: 'raj-kuvadva', name: 'Kuvadva Highway', lat: 22.3461, lon: 70.8768, zoneType: 'transit' },
  ],
};

async function resolveGeocodeQuery(query: string) {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  if (KNOWN_CITIES[normalized]) {
    return [KNOWN_CITIES[normalized]];
  }
  const cacheKey = `geo:${normalized}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  try {
    const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      trimmed
    )}&count=6&language=en&format=json`;
    const omJson = await fetchJsonWithTimeout(omUrl, 'nominatim');
    if (Array.isArray(omJson?.results) && omJson.results.length > 0) {
      const mapped = omJson.results.map((r: any) => ({
        name: r.name,
        lat: Number(r.latitude),
        lon: Number(r.longitude),
        state: r.admin1 || '',
        country: r.country || '',
      }));
      setCached(cacheKey, mapped, 30 * 60 * 1000);
      return mapped;
    }
  } catch {
    // Fall through to Nominatim
  }

  const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    trimmed
  )}&format=jsonv2&limit=5&addressdetails=1`;
  const nomJson = await fetchJsonWithTimeout(nomUrl, 'nominatim');
  const results = Array.isArray(nomJson)
    ? nomJson.map((r: any) => ({
        name: r.name || r.display_name?.split(',')[0] || trimmed,
        lat: Number(r.lat),
        lon: Number(r.lon),
        state: r.address?.state || '',
        country: r.address?.country || '',
        displayName: r.display_name,
      }))
    : [];
  setCached(cacheKey, results, 30 * 60 * 1000);
  return results;
}

async function fetchSingleAirQuality(lat: number, lon: number, name: string, pastDays: number, forecastDays: number) {
  const safePast = Math.min(Math.max(pastDays, 1), 30);
  const safeForecast = Math.min(Math.max(forecastDays, 1), 7);
  const cacheKey = `aq:${lat.toFixed(4)}:${lon.toFixed(4)}:p${safePast}:f${safeForecast}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const buildAqUrl = (fDays: number) =>
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,uv_index&hourly=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&past_days=${safePast}&forecast_days=${fDays}&timezone=auto`;

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&timezone=auto`;

  let aqJson: any;
  const aqPromise = fetchJsonWithTimeout(buildAqUrl(safeForecast), 'openMeteoAq').catch(async (err) => {
    if (safeForecast > 5 && err?.status === 400) {
      return fetchJsonWithTimeout(buildAqUrl(5), 'openMeteoAq');
    }
    throw err;
  });

  const [resolvedAq, weatherJson] = await Promise.all([
    aqPromise,
    fetchJsonWithTimeout(weatherUrl, 'openMeteoWeather'),
  ]);
  aqJson = resolvedAq;

  const currentTimeStr: string = aqJson?.current?.time || new Date().toISOString();
  const nowEpoch = Date.now();
  const times: string[] = aqJson?.hourly?.time || [];
  const offsetSeconds: number = Number(aqJson?.utc_offset_seconds || 0);

  const hourly = [];
  const dailyMap = new Map<
    string,
    { aqis: number[]; pm25s: number[]; pm10s: number[]; isForecast: boolean }
  >();

  let forecastHours = 0;
  let historicalHours = 0;

  for (let i = 0; i < times.length; i++) {
    const tStr = times[i];
    const usAqi = toNum(aqJson.hourly?.us_aqi?.[i]);
    const pm25 = toNum(aqJson.hourly?.pm2_5?.[i]);
    const pm10 = toNum(aqJson.hourly?.pm10?.[i]);
    const no2 = toNum(aqJson.hourly?.nitrogen_dioxide?.[i]);
    const so2 = toNum(aqJson.hourly?.sulphur_dioxide?.[i]);
    const co = toNum(aqJson.hourly?.carbon_monoxide?.[i]);
    const o3 = toNum(aqJson.hourly?.ozone?.[i]);

    // Skip trailing empty hours beyond the upstream model horizon
    if (usAqi === null && pm25 === null && pm10 === null) continue;

    // Open-Meteo local time string YYYY-MM-DDTHH:MM; convert to approximate UTC epoch using utc_offset_seconds
    const parsedUtcMs = Date.parse(tStr + ':00Z') - offsetSeconds * 1000;
    const isForecast = parsedUtcMs > nowEpoch;
    if (isForecast) forecastHours++;
    else historicalHours++;

    hourly.push({
      time: tStr,
      epochMs: parsedUtcMs,
      isForecast,
      usAqi,
      pm25,
      pm10,
      no2,
      so2,
      co,
      o3,
    });

    const dateKey = tStr.slice(0, 10);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { aqis: [], pm25s: [], pm10s: [], isForecast });
    }
    const bucket = dailyMap.get(dateKey)!;
    if (!isForecast) bucket.isForecast = false;
    if (usAqi !== null) bucket.aqis.push(usAqi);
    if (pm25 !== null) bucket.pm25s.push(pm25);
    if (pm10 !== null) bucket.pm10s.push(pm10);
  }

  const avg = (arr: number[]) =>
    arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

  const daily = Array.from(dailyMap.entries()).map(([date, bucket]) => ({
    date,
    isForecast: bucket.isForecast,
    avgAqi: avg(bucket.aqis),
    maxAqi: bucket.aqis.length ? Math.max(...bucket.aqis) : null,
    minAqi: bucket.aqis.length ? Math.min(...bucket.aqis) : null,
    avgPm25: avg(bucket.pm25s),
    avgPm10: avg(bucket.pm10s),
    hoursCount: Math.max(bucket.aqis.length, bucket.pm25s.length),
  }));

  const payload = {
    location: {
      name,
      lat,
      lon,
      timezone: aqJson?.timezone || 'UTC',
      utcOffsetSeconds: offsetSeconds,
    },
    current: {
      time: currentTimeStr,
      usAqi: toNum(aqJson?.current?.us_aqi),
      europeanAqi: toNum(aqJson?.current?.european_aqi),
      pm25: toNum(aqJson?.current?.pm2_5),
      pm10: toNum(aqJson?.current?.pm10),
      no2: toNum(aqJson?.current?.nitrogen_dioxide),
      so2: toNum(aqJson?.current?.sulphur_dioxide),
      co: toNum(aqJson?.current?.carbon_monoxide),
      o3: toNum(aqJson?.current?.ozone),
      uvIndex: toNum(aqJson?.current?.uv_index),
    },
    weather: {
      time: weatherJson?.current?.time || currentTimeStr,
      temperature: toNum(weatherJson?.current?.temperature_2m),
      humidity: toNum(weatherJson?.current?.relative_humidity_2m),
      apparentTemperature: toNum(weatherJson?.current?.apparent_temperature),
      windSpeed: toNum(weatherJson?.current?.wind_speed_10m),
      windDirection: toNum(weatherJson?.current?.wind_direction_10m),
      pressure: toNum(weatherJson?.current?.surface_pressure),
      weatherCode: toNum(weatherJson?.current?.weather_code),
      conditionLabel: weatherCodeToLabel(toNum(weatherJson?.current?.weather_code)),
    },
    hourly,
    daily,
    provenance: {
      airQualitySource: 'Open-Meteo Air Quality API (Copernicus CAMS Atmospheric Model)',
      weatherSource: 'Open-Meteo Meteorological Forecast API',
      provenanceType: 'modelled',
      isModelled: true,
      spatialResolution: '~11 km atmospheric grid (CAMS Global / Regional assimilation)',
      aqiScale: 'US EPA AQI',
      fetchedAt: new Date().toISOString(),
      forecastHorizonHours: forecastHours,
      historicalHours,
      notes:
        'Air quality metrics combine satellite and model assimilation (CAMS) rather than a single street-level physical sensor. Forecast hours represent model projections and are visually separated from historical hours.',
    },
  };

  setCached(cacheKey, payload, 5 * 60 * 1000);
  return payload;
}

async function fetchBatchCurrentReadings(
  locations: Array<{ id: string; name: string; lat: number; lon: number; state?: string; country?: string }>
) {
  if (!locations.length) return [];
  const key =
    'batch:' +
    locations
      .map((l) => `${l.lat.toFixed(3)},${l.lon.toFixed(3)}`)
      .join('|');
  const cached = getCached<any[]>(key);
  if (cached) return cached;

  const lats = locations.map((l) => l.lat.toFixed(4)).join(',');
  const lons = locations.map((l) => l.lon.toFixed(4)).join(',');

  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;
  const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&timezone=auto`;

  const [aqRaw, wRaw] = await Promise.all([
    fetchJsonWithTimeout(aqUrl, 'openMeteoAq'),
    fetchJsonWithTimeout(wUrl, 'openMeteoWeather'),
  ]);

  const aqArr = Array.isArray(aqRaw) ? aqRaw : [aqRaw];
  const wArr = Array.isArray(wRaw) ? wRaw : [wRaw];

  const mapped = locations.map((loc, idx) => {
    const aq = aqArr[idx] || {};
    const w = wArr[idx] || {};
    const wCode = toNum(w?.current?.weather_code);
    return {
      id: loc.id,
      name: loc.name,
      state: loc.state || '',
      country: loc.country || '',
      lat: loc.lat,
      lon: loc.lon,
      timezone: aq?.timezone || 'UTC',
      observedTime: aq?.current?.time || new Date().toISOString(),
      pollutants: {
        usAqi: toNum(aq?.current?.us_aqi),
        europeanAqi: toNum(aq?.current?.european_aqi),
        pm25: toNum(aq?.current?.pm2_5),
        pm10: toNum(aq?.current?.pm10),
        no2: toNum(aq?.current?.nitrogen_dioxide),
        so2: toNum(aq?.current?.sulphur_dioxide),
        co: toNum(aq?.current?.carbon_monoxide),
        o3: toNum(aq?.current?.ozone),
      },
      weather: {
        temperature: toNum(w?.current?.temperature_2m),
        humidity: toNum(w?.current?.relative_humidity_2m),
        apparentTemperature: toNum(w?.current?.apparent_temperature),
        windSpeed: toNum(w?.current?.wind_speed_10m),
        windDirection: toNum(w?.current?.wind_direction_10m),
        pressure: toNum(w?.current?.surface_pressure),
        weatherCode: wCode,
        conditionLabel: weatherCodeToLabel(wCode),
      },
      isModelled: true,
      sourceLabel: 'Modelled Estimate (Open-Meteo CAMS)',
      aqiScale: 'US EPA AQI',
    };
  });

  setCached(key, mapped, 5 * 60 * 1000);
  return mapped;
}

function buildSpatialGridAround(lat: number, lon: number, cityName: string, cityId?: string) {
  const lowerId = (cityId || cityName).toLowerCase();
  const matchedPresetKey = Object.keys(GUJARAT_SUBZONES).find((k) => lowerId.includes(k));
  if (matchedPresetKey) {
    return GUJARAT_SUBZONES[matchedPresetKey];
  }

  // Generate an 8-point concentric spatial sampling grid around any searched city or GPS location
  const offsets = [
    { dir: 'North Core', dLat: 0.045, dLon: 0, zoneType: 'urban' },
    { dir: 'North-East Zone', dLat: 0.06, dLon: 0.06, zoneType: 'residential' },
    { dir: 'East Corridor', dLat: 0, dLon: 0.075, zoneType: 'transit' },
    { dir: 'South-East Perimeter', dLat: -0.06, dLon: 0.06, zoneType: 'industrial' },
    { dir: 'South Sector', dLat: -0.055, dLon: 0, zoneType: 'urban' },
    { dir: 'South-West Outskirts', dLat: -0.065, dLon: -0.065, zoneType: 'greenbelt' },
    { dir: 'West District', dLat: 0, dLon: -0.07, zoneType: 'residential' },
    { dir: 'North-West Outskirts', dLat: 0.065, dLon: -0.06, zoneType: 'greenbelt' },
  ];

  return offsets.map((o, i) => ({
    id: `grid-${i}-${o.dir.toLowerCase().replace(/\s+/g, '-')}`,
    name: `${cityName} · ${o.dir}`,
    lat: Number((lat + o.dLat).toFixed(4)),
    lon: Number((lon + o.dLon).toFixed(4)),
    zoneType: o.zoneType,
  }));
}

function requireGemini() {
  if (!ai) {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable AI features.'
    ) as Error & { status?: number };
    err.status = 503;
    throw err;
  }
  return ai;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Module 15: Admin & System Monitoring
  app.get('/api/health', (_req, res) => {
    const totalLookups = cacheHits + cacheMisses;
    const providers = Object.values(providerStats);
    const hasDegraded = providers.some((p) => p.status === 'degraded');
    res.json({
      status: hasDegraded ? 'degraded' : 'operational',
      uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
      lastSuccessfulRefresh,
      cache: {
        entries: cache.size,
        hits: cacheHits,
        misses: cacheMisses,
        hitRatePct: totalLookups ? Math.round((cacheHits / totalLookups) * 100) : 0,
      },
      providers,
      recentErrors,
      dataSourcesSummary: [
        'Air Quality & Forecasts: Open-Meteo Air Quality API (Copernicus CAMS ~11 km grid)',
        'Meteorology: Open-Meteo Weather Forecast API',
        'Geocoding & Maps: OpenStreetMap & Nominatim',
        'Routing: Open Source Routing Machine (OSRM)',
        'Environmental AI Reasoning: Server-side Gemini API (gemini-4-hydrogen)',
      ],
    });
  });

  // Geocoding search
  app.get('/api/geocode', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
    }
    try {
      const results = await resolveGeocodeQuery(q);
      res.json({ results });
    } catch (err: any) {
      res.status(err?.status || 502).json({ error: err?.message || 'Geocoding service unavailable.' });
    }
  });

  // Reverse geocoding
  app.get('/api/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Valid lat and lon parameters are required.' });
    }
    const cacheKey = `rev:${lat.toFixed(3)}:${lon.toFixed(3)}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2`;
      const json = await fetchJsonWithTimeout(url, 'nominatim');
      const addr = json?.address || {};
      const cityName =
        addr.city || addr.town || addr.village || addr.suburb || addr.state_district || 'Current Location';
      const payload = {
        name: cityName,
        state: addr.state || '',
        country: addr.country || '',
        displayName: json?.display_name || cityName,
      };
      setCached(cacheKey, payload, 60 * 60 * 1000);
      res.json(payload);
    } catch (err: any) {
      res.status(err?.status || 502).json({ error: err?.message || 'Reverse geocoding failed.' });
    }
  });

  // Single city air quality + weather + forecast + history
  app.get('/api/air-quality', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const name = String(req.query.name || 'Selected Location').slice(0, 80);
    const pastDays = Number(req.query.pastDays || 7);
    const forecastDays = Number(req.query.forecastDays || 7);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return res.status(400).json({ error: 'Valid latitude (-90..90) and longitude (-180..180) are required.' });
    }

    try {
      const data = await fetchSingleAirQuality(lat, lon, name, pastDays, forecastDays);
      res.json(data);
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Failed to retrieve live air quality data from Open-Meteo.',
      });
    }
  });

  // Batch air quality for City Comparison, Map Markers, Alerts
  app.post('/api/air-quality/batch', async (req, res) => {
    const locations = Array.isArray(req.body?.locations) ? req.body.locations : [];
    if (!locations.length || locations.length > 20) {
      return res.status(400).json({ error: 'Provide between 1 and 20 valid locations.' });
    }
    const sanitized = locations.filter(
      (l: any) =>
        typeof l?.name === 'string' &&
        Number.isFinite(Number(l?.lat)) &&
        Number.isFinite(Number(l?.lon))
    );
    if (!sanitized.length) {
      return res.status(400).json({ error: 'No valid coordinates provided.' });
    }

    try {
      const readings = await fetchBatchCurrentReadings(
        sanitized.map((l: any) => ({
          id: String(l.id || l.name.toLowerCase()),
          name: String(l.name),
          state: l.state ? String(l.state) : '',
          country: l.country ? String(l.country) : '',
          lat: Number(l.lat),
          lon: Number(l.lon),
        }))
      );
      res.json({ readings, fetchedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(err?.status || 502).json({ error: err?.message || 'Batch air quality fetch failed.' });
    }
  });

  // Module 2 & 10: Smart Pollution Hotspot Detection & Green Zone Finder
  app.get('/api/local-grid', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const name = String(req.query.name || 'Selected Area').slice(0, 80);
    const cityId = String(req.query.cityId || '');

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Valid lat and lon are required.' });
    }

    const cacheKey = `grid:${lat.toFixed(3)}:${lon.toFixed(3)}:${cityId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const zones = buildSpatialGridAround(lat, lon, name, cityId);
      const lats = zones.map((z) => z.lat.toFixed(4)).join(',');
      const lons = zones.map((z) => z.lon.toFixed(4)).join(',');
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&timezone=auto`;
      const raw = await fetchJsonWithTimeout(aqUrl, 'openMeteoAq');
      const arr = Array.isArray(raw) ? raw : [raw];

      const points = zones.map((z, idx) => {
        const item = arr[idx] || {};
        return {
          id: z.id,
          name: z.name,
          lat: z.lat,
          lon: z.lon,
          distanceKm: haversineKm(lat, lon, z.lat, z.lon),
          zoneType: z.zoneType,
          usAqi: toNum(item?.current?.us_aqi),
          pm25: toNum(item?.current?.pm2_5),
          pm10: toNum(item?.current?.pm10),
          no2: toNum(item?.current?.nitrogen_dioxide),
          o3: toNum(item?.current?.ozone),
          observedTime: item?.current?.time || new Date().toISOString(),
          isModelled: true,
          sourceLabel: 'Modelled Grid Estimate (Open-Meteo CAMS)',
        };
      });

      const payload = {
        center: { name, lat, lon },
        points,
        fetchedAt: new Date().toISOString(),
        provenanceNote:
          'Local coordinate comparisons use Open-Meteo CAMS atmospheric model data (~11 km resolution). Micro-scale roadside spikes or parks without co-located sensors are not directly measured.',
      };
      setCached(cacheKey, payload, 5 * 60 * 1000);
      res.json(payload);
    } catch (err: any) {
      res.status(err?.status || 502).json({ error: err?.message || 'Failed to fetch local spatial grid.' });
    }
  });

  // Module 4: Smart Route Recommendation (OSRM + Open-Meteo waypoint sampling)
  app.post('/api/route', async (req, res) => {
    const startQuery = String(req.body?.startQuery || '').trim();
    const endQuery = String(req.body?.endQuery || '').trim();
    const mode = ['driving', 'cycling', 'walking'].includes(req.body?.mode)
      ? (req.body.mode as 'driving' | 'cycling' | 'walking')
      : 'driving';

    let startCoords = req.body?.startCoords;
    let endCoords = req.body?.endCoords;

    try {
      let startPoint: { name: string; lat: number; lon: number } | null = null;
      let endPoint: { name: string; lat: number; lon: number } | null = null;

      if (startCoords && Number.isFinite(Number(startCoords.lat)) && Number.isFinite(Number(startCoords.lon))) {
        startPoint = {
          name: startQuery || 'Selected Origin',
          lat: Number(startCoords.lat),
          lon: Number(startCoords.lon),
        };
      } else if (startQuery.length >= 2) {
        const resStart = await resolveGeocodeQuery(startQuery);
        if (resStart.length > 0) {
          startPoint = { name: resStart[0].name, lat: resStart[0].lat, lon: resStart[0].lon };
        }
      }

      if (endCoords && Number.isFinite(Number(endCoords.lat)) && Number.isFinite(Number(endCoords.lon))) {
        endPoint = {
          name: endQuery || 'Selected Destination',
          lat: Number(endCoords.lat),
          lon: Number(endCoords.lon),
        };
      } else if (endQuery.length >= 2) {
        const resEnd = await resolveGeocodeQuery(endQuery);
        if (resEnd.length > 0) {
          endPoint = { name: resEnd[0].name, lat: resEnd[0].lat, lon: resEnd[0].lon };
        }
      }

      if (!startPoint || !endPoint) {
        return res.status(400).json({
          error: 'Could not geocode both start and destination locations. Please enter valid city or neighborhood names.',
        });
      }

      const osrmProfile = mode === 'cycling' ? 'bike' : mode === 'walking' ? 'foot' : 'driving';
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${startPoint.lon},${startPoint.lat};${endPoint.lon},${endPoint.lat}?alternatives=true&overview=full&geometries=geojson`;

      const osrmJson = await fetchJsonWithTimeout(osrmUrl, 'osrm');
      if (osrmJson?.code !== 'Ok' || !Array.isArray(osrmJson?.routes) || osrmJson.routes.length === 0) {
        return res.status(404).json({ error: 'No navigable route found between these locations.' });
      }

      const rawRoutes = osrmJson.routes.slice(0, 3);
      // Sample up to 5 evenly spaced waypoints per route
      const allSamplePoints: Array<{ routeIdx: number; lat: number; lon: number }> = [];
      const routeGeometries: Array<Array<[number, number]>> = [];

      rawRoutes.forEach((route: any, rIdx: number) => {
        const coords: Array<[number, number]> = (route.geometry?.coordinates || []).map((c: [number, number]) => [
          c[1],
          c[0],
        ]);
        routeGeometries.push(coords);
        if (coords.length > 0) {
          const sampleCount = Math.min(5, coords.length);
          for (let s = 0; s < sampleCount; s++) {
            const idx = Math.min(
              coords.length - 1,
              Math.floor((s / Math.max(1, sampleCount - 1)) * (coords.length - 1))
            );
            allSamplePoints.push({
              routeIdx: rIdx,
              lat: Number(coords[idx][0].toFixed(4)),
              lon: Number(coords[idx][1].toFixed(4)),
            });
          }
        }
      });

      let aqSamples: any[] = [];
      let aqiFetchSucceeded = false;
      if (allSamplePoints.length > 0) {
        try {
          const lats = allSamplePoints.map((p) => p.lat).join(',');
          const lons = allSamplePoints.map((p) => p.lon).join(',');
          const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,pm2_5&timezone=auto`;
          const aqRaw = await fetchJsonWithTimeout(aqUrl, 'openMeteoAq');
          aqSamples = Array.isArray(aqRaw) ? aqRaw : [aqRaw];
          aqiFetchSucceeded = true;
        } catch {
          aqiFetchSucceeded = false;
        }
      }

      const routes = rawRoutes.map((route: any, rIdx: number) => {
        const distanceKm = Number(((route.distance || 0) / 1000).toFixed(2));
        const durationMin = Math.max(1, Math.round((route.duration || 0) / 60));

        const waypoints: Array<{ lat: number; lon: number; usAqi: number | null; pm25: number | null }> = [];
        allSamplePoints.forEach((sp, sIdx) => {
          if (sp.routeIdx === rIdx) {
            const aqItem = aqSamples[sIdx];
            waypoints.push({
              lat: sp.lat,
              lon: sp.lon,
              usAqi: aqiFetchSucceeded ? toNum(aqItem?.current?.us_aqi) : null,
              pm25: aqiFetchSucceeded ? toNum(aqItem?.current?.pm2_5) : null,
            });
          }
        });

        const validAqis = waypoints.map((w) => w.usAqi).filter((v): v is number => v !== null);
        const validPm25s = waypoints.map((w) => w.pm25).filter((v): v is number => v !== null);

        const avgAqi = validAqis.length
          ? Number((validAqis.reduce((a, b) => a + b, 0) / validAqis.length).toFixed(1))
          : null;
        const maxAqi = validAqis.length ? Math.max(...validAqis) : null;
        const avgPm25 = validPm25s.length
          ? Number((validPm25s.reduce((a, b) => a + b, 0) / validPm25s.length).toFixed(1))
          : null;

        // Exposure proxy combines sampled AQI with travel duration when AQI is available
        const exposureScore = avgAqi !== null ? Number(((avgAqi * durationMin) / 60).toFixed(1)) : null;

        return {
          id: `route-${rIdx + 1}`,
          name: route.legs?.[0]?.summary ? `Via ${route.legs[0].summary}` : `Route Option ${rIdx + 1}`,
          distanceKm,
          durationMin,
          geometry: routeGeometries[rIdx],
          sampledWaypoints: waypoints,
          avgAqi,
          maxAqi,
          avgPm25,
          exposureScore,
          aqiDataAvailable: validAqis.length > 0,
          isRecommended: false,
        };
      });

      // Mark recommended route: lowest exposureScore if AQI available, otherwise fastest
      let bestIdx = 0;
      const withScore = routes.filter((r: any) => r.exposureScore !== null);
      if (withScore.length === routes.length) {
        routes.forEach((r: any, i: number) => {
          if ((r.exposureScore ?? Infinity) < (routes[bestIdx].exposureScore ?? Infinity)) {
            bestIdx = i;
          }
        });
      } else {
        routes.forEach((r: any, i: number) => {
          if (r.durationMin < routes[bestIdx].durationMin) {
            bestIdx = i;
          }
        });
      }
      if (routes[bestIdx]) routes[bestIdx].isRecommended = true;

      res.json({
        start: startPoint,
        end: endPoint,
        mode,
        routes,
        provenanceNote: aqiFetchSucceeded
          ? 'Routes computed via OSRM. Pollution exposure is estimated by sampling Open-Meteo CAMS (~11 km grid) at waypoints along each route; street-level vehicle exhaust variations inside the same grid cell are not directly measured.'
          : 'Routes computed via OSRM, but route-level AQI sampling was unavailable for this request.',
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(err?.status || 502).json({ error: err?.message || 'Route comparison failed.' });
    }
  });

  // Module 3 & Module 6: Gemini AI Pollution Investigator
  app.post('/api/ai/investigate', async (req, res) => {
    try {
      const client = requireGemini();
      const { location, current, weather, recentHistory, forecastSummary, mode } = req.body || {};
      if (!location || !current) {
        return res.status(400).json({ error: 'Current location and pollutant measurements are required.' });
      }

      const start = Date.now();
      const prompt = `Analyze the following real atmospheric and meteorological measurements for ${location.name} (${location.lat}, ${location.lon}).
Current Air Quality (US EPA AQI scale, Modelled Open-Meteo CAMS at ${current.time}):
- US AQI: ${current.usAqi ?? 'N/A'}
- PM2.5: ${current.pm25 ?? 'N/A'} µg/m³
- PM10: ${current.pm10 ?? 'N/A'} µg/m³
- NO2: ${current.no2 ?? 'N/A'} µg/m³
- SO2: ${current.so2 ?? 'N/A'} µg/m³
- CO: ${current.co ?? 'N/A'} µg/m³
- O3: ${current.o3 ?? 'N/A'} µg/m³

Current Meteorology (${weather?.time || 'N/A'}):
- Temperature: ${weather?.temperature ?? 'N/A'} °C
- Relative Humidity: ${weather?.humidity ?? 'N/A'} %
- Wind Speed: ${weather?.windSpeed ?? 'N/A'} km/h (Direction: ${weather?.windDirection ?? 'N/A'}°)
- Surface Pressure: ${weather?.pressure ?? 'N/A'} hPa
- Condition: ${weather?.conditionLabel || 'N/A'}

Recent Historical Hours (past 24h sample): ${JSON.stringify(recentHistory || [])}
Upcoming Forecast Summary: ${JSON.stringify(forecastSummary || [])}
Analysis Focus: ${mode === 'forecast' ? 'Forecast Trend Interpretation' : 'Full Pollution Investigation'}

STRICT SCIENTIFIC INTEGRITY RULES:
1. Never invent measurements or claim unverified specific local emission sources (do NOT claim a specific factory fire or construction site unless meteorological/pollutant ratios support a general hypothesis, and explicitly qualify hypotheses as "possible contributing factors consistent with meteorological/pollutant patterns").
2. Ground all numbers strictly in the values provided above.
3. Explicitly note that the upstream dataset is Open-Meteo CAMS atmospheric model assimilation (~11 km grid) rather than a single calibrated regulatory ground monitor.`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a senior atmospheric scientist and environmental data analyst. Provide rigorous, transparent, evidence-grounded air quality investigations.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              conditionSummary: { type: Type.STRING },
              mainPollutantAnalysis: { type: Type.STRING },
              possibleContributingFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
              healthExposureRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              pollutionTrendInterpretation: { type: Type.STRING },
              suggestedPreventiveActions: { type: Type.ARRAY, items: { type: Type.STRING } },
              dataLimitationsNote: { type: Type.STRING },
            },
            required: [
              'conditionSummary',
              'mainPollutantAnalysis',
              'possibleContributingFactors',
              'healthExposureRecommendations',
              'pollutionTrendInterpretation',
              'suggestedPreventiveActions',
              'dataLimitationsNote',
            ],
          },
        },
      });

      recordProviderSuccess('gemini', Date.now() - start);
      const parsed = JSON.parse((response.text || '{}').trim());
      res.json({
        ...parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      recordProviderError('gemini', err?.message || 'Gemini investigate failed', err?.status);
      res.status(err?.status || 500).json({ error: err?.message || 'AI investigation failed.' });
    }
  });

  // Module 5: AI Health Impact Advisor
  app.post('/api/ai/health-advisory', async (req, res) => {
    try {
      const client = requireGemini();
      const { location, current, weather } = req.body || {};
      if (!location || !current) {
        return res.status(400).json({ error: 'Location and current pollutant measurements are required.' });
      }

      const start = Date.now();
      const prompt = `Generate structured environmental health guidance for ${location.name} based on:
- US AQI: ${current.usAqi ?? 'N/A'}
- PM2.5: ${current.pm25 ?? 'N/A'} µg/m³
- PM10: ${current.pm10 ?? 'N/A'} µg/m³
- NO2: ${current.no2 ?? 'N/A'} µg/m³
- O3: ${current.o3 ?? 'N/A'} µg/m³
- Temperature: ${weather?.temperature ?? 'N/A'} °C, Humidity: ${weather?.humidity ?? 'N/A'}%, Wind: ${weather?.windSpeed ?? 'N/A'} km/h

Provide practical, actionable guidance for ALL FIVE population groups with exact groupId values:
- "children" (Children & Infants)
- "seniors" (Senior Citizens)
- "outdoor_workers" (Outdoor Workers)
- "general" (General Population)
- "sensitive" (People Sensitive to Air Pollution)

Include a clear medical disclaimer stating this platform does not diagnose diseases or replace professional medical advice.`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a public environmental health advisor. Give clear, non-alarmist, evidence-based guidance grounded in EPA/WHO air quality thresholds. Always include a non-diagnosis medical disclaimer.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallRiskSummary: { type: Type.STRING },
              medicalDisclaimer: { type: Type.STRING },
              groups: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    groupId: { type: Type.STRING },
                    groupTitle: { type: Type.STRING },
                    riskLevel: { type: Type.STRING },
                    outdoorActivity: { type: Type.STRING },
                    maskGuidance: { type: Type.STRING },
                    exerciseGuidance: { type: Type.STRING },
                    indoorAirTips: { type: Type.STRING },
                    exposureReductionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: [
                    'groupId',
                    'groupTitle',
                    'riskLevel',
                    'outdoorActivity',
                    'maskGuidance',
                    'exerciseGuidance',
                    'indoorAirTips',
                    'exposureReductionTips',
                  ],
                },
              },
            },
            required: ['overallRiskSummary', 'medicalDisclaimer', 'groups'],
          },
        },
      });

      recordProviderSuccess('gemini', Date.now() - start);
      const parsed = JSON.parse((response.text || '{}').trim());
      res.json({
        ...parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      recordProviderError('gemini', err?.message || 'Gemini health advisory failed', err?.status);
      res.status(err?.status || 500).json({ error: err?.message || 'AI health advisory generation failed.' });
    }
  });

  // Module 12: Multilingual AI Assistant (English, Gujarati, Hindi)
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const client = requireGemini();
      const { message, language, contextCities, activeCityData, history } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      // Check if user's question mentions specific known cities not yet in contextCities
      const lowerMsg = message.toLowerCase();
      const cityAliases: Record<string, string> = {
        ahmedabad: 'ahmedabad',
        અમદાવાદ: 'ahmedabad',
        अहमदाबाद: 'ahmedabad',
        gandhinagar: 'gandhinagar',
        ગાંધીનગર: 'gandhinagar',
        गांधीनगर: 'gandhinagar',
        surat: 'surat',
        સુરત: 'surat',
        सूरत: 'surat',
        vadodara: 'vadodara',
        વડોદરા: 'vadodara',
        वडोदरा: 'vadodara',
        rajkot: 'rajkot',
        રાજકોટ: 'rajkot',
        राजकोट: 'rajkot',
        delhi: 'delhi',
        દિલ્હી: 'delhi',
        दिल्ली: 'delhi',
        mumbai: 'mumbai',
        મુંબઈ: 'mumbai',
        मुंबई: 'mumbai',
        bengaluru: 'bengaluru',
        jaipur: 'jaipur',
        pune: 'pune',
      };

      const existingIds = new Set((contextCities || []).map((c: any) => String(c.id || '').toLowerCase()));
      const extraToFetch: Array<{ id: string; name: string; lat: number; lon: number }> = [];
      for (const [alias, canonical] of Object.entries(cityAliases)) {
        if ((lowerMsg.includes(alias) || message.includes(alias)) && !existingIds.has(canonical)) {
          const preset = KNOWN_CITIES[canonical];
          if (preset && !extraToFetch.some((x) => x.id === canonical)) {
            extraToFetch.push({ id: canonical, name: preset.name, lat: preset.lat, lon: preset.lon });
          }
        }
      }

      let liveExtraReadings: any[] = [];
      if (extraToFetch.length > 0) {
        try {
          liveExtraReadings = await fetchBatchCurrentReadings(extraToFetch);
        } catch {
          liveExtraReadings = [];
        }
      }

      const combinedContext = {
        activeCity: activeCityData || null,
        monitoredCities: [...(contextCities || []), ...liveExtraReadings],
      };

      const targetLang =
        language === 'gu'
          ? 'Gujarati (ગુજરાતી)'
          : language === 'hi'
          ? 'Hindi (हिन्दी)'
          : 'English (unless the user explicitly wrote in Gujarati or Hindi, in which case match the user language)';

      const start = Date.now();
      const prompt = `User question: "${message}"

Preferred response language: ${targetLang}.
If the user wrote in Gujarati script, respond in clear natural Gujarati. If in Hindi script, respond in clear natural Hindi. Otherwise respond in ${targetLang}.

Live Application Environmental Data Context (Open-Meteo CAMS Modelled Atmospheric Data, US EPA AQI scale):
${JSON.stringify(combinedContext)}

Conversation History:
${JSON.stringify((history || []).slice(-6))}

Rules:
1. Answer data questions directly using the exact numbers from the Live Application Environmental Data Context above.
2. If a city requested by the user is NOT present in the context, explicitly state that live data for that city was not fetched in the current query rather than inventing AQI numbers.
3. Briefly note when citing values that they are Open-Meteo CAMS atmospheric model estimates.
4. Keep health advice practical and remind users that this assistant does not replace medical advice.`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are VayuSense Multilingual Environmental Assistant, fluent in English, Gujarati, and Hindi. Be concise, accurate, data-grounded, and helpful.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      recordProviderSuccess('gemini', Date.now() - start);
      res.json({
        reply: response.text || 'Unable to generate a response.',
        fetchedExtraCities: liveExtraReadings.map((r) => r.name),
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      recordProviderError('gemini', err?.message || 'Gemini chat failed', err?.status);
      res.status(err?.status || 500).json({ error: err?.message || 'Multilingual AI assistant failed.' });
    }
  });

  // Module 8: Report Narrative Generator
  app.post('/api/ai/report-summary', async (req, res) => {
    try {
      const client = requireGemini();
      const { reportType, primaryLocation, current, weather, comparisonCities, dailySummary } = req.body || {};
      const start = Date.now();
      const prompt = `Generate a concise executive narrative and recommendations for a formal "${reportType}" environmental report.
Primary Location: ${primaryLocation?.name || 'Unknown'} (${primaryLocation?.lat}, ${primaryLocation?.lon})
Current Snapshot: ${JSON.stringify(current || {})}
Meteorology: ${JSON.stringify(weather || {})}
Daily Aggregated Summary: ${JSON.stringify(dailySummary || [])}
City Comparison Data: ${JSON.stringify(comparisonCities || [])}

Do not invent numbers. Include clear data limitations acknowledging Open-Meteo CAMS modelled resolution.`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are an environmental reporting specialist writing formal technical executive summaries for municipal air quality reports.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              limitationsStatement: { type: Type.STRING },
            },
            required: ['executiveSummary', 'keyFindings', 'recommendations', 'limitationsStatement'],
          },
        },
      });

      recordProviderSuccess('gemini', Date.now() - start);
      const parsed = JSON.parse((response.text || '{}').trim());
      res.json({ ...parsed, generatedAt: new Date().toISOString() });
    } catch (err: any) {
      recordProviderError('gemini', err?.message || 'Gemini report summary failed', err?.status);
      res.status(err?.status || 500).json({ error: err?.message || 'AI report summary generation failed.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VayuSense server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VayuSense server:', err);
  process.exit(1);
});

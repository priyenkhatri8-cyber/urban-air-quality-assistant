import type {
  AiHealthAdvisoryResult,
  AiInvestigationResult,
  AirQualityResponse,
  CityPreset,
  CityReadingSummary,
  LanguageCode,
  LocalGridResponse,
  RouteComparisonResponse,
  SystemHealthResponse,
} from '../types/environment';

const clientCache = new Map<string, { data: unknown; expiresAt: number }>();

async function requestWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retries = 2,
  cacheTtlMs = 0
): Promise<T> {
  if (cacheTtlMs > 0 && (!options.method || options.method === 'GET')) {
    const cached = clientCache.get(url);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error || `Request failed with status ${res.status}`;
        const err = new Error(errMsg) as Error & { status?: number };
        err.status = res.status;
        // Don't retry 4xx client/validation errors or 503 missing key
        if (res.status < 500 || res.status === 503) {
          throw err;
        }
        throw err;
      }
      if (cacheTtlMs > 0 && (!options.method || options.method === 'GET')) {
        clientCache.set(url, { data, expiresAt: Date.now() + cacheTtlMs });
      }
      return data as T;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err?.status && (err.status < 500 || err.status === 503)) {
        throw lastError;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError || new Error('Network request failed');
}

export function clearClientCache() {
  clientCache.clear();
}

export async function searchCities(query: string): Promise<Array<{ name: string; lat: number; lon: number; state?: string; country?: string }>> {
  const res = await requestWithRetry<{ results: any[] }>(
    `/api/geocode?q=${encodeURIComponent(query)}`,
    {},
    1,
    10 * 60 * 1000
  );
  return res.results || [];
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ name: string; state: string; country: string }> {
  return requestWithRetry(`/api/reverse-geocode?lat=${lat}&lon=${lon}`, {}, 1, 30 * 60 * 1000);
}

export async function fetchAirQuality(
  lat: number,
  lon: number,
  name: string,
  pastDays = 7,
  forecastDays = 7,
  bypassCache = false
): Promise<AirQualityResponse> {
  const url = `/api/air-quality?lat=${lat}&lon=${lon}&name=${encodeURIComponent(
    name
  )}&pastDays=${pastDays}&forecastDays=${forecastDays}`;
  if (bypassCache) clientCache.delete(url);
  return requestWithRetry<AirQualityResponse>(url, {}, 2, 2 * 60 * 1000);
}

export async function fetchBatchCities(
  locations: Array<Pick<CityPreset, 'id' | 'name' | 'lat' | 'lon' | 'state' | 'country'>>
): Promise<{ readings: CityReadingSummary[]; fetchedAt: string }> {
  return requestWithRetry('/api/air-quality/batch', {
    method: 'POST',
    body: JSON.stringify({ locations }),
  });
}

export async function fetchLocalGrid(
  lat: number,
  lon: number,
  name: string,
  cityId?: string
): Promise<LocalGridResponse> {
  return requestWithRetry<LocalGridResponse>(
    `/api/local-grid?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name)}&cityId=${encodeURIComponent(cityId || '')}`,
    {},
    2,
    2 * 60 * 1000
  );
}

export async function compareRoutes(payload: {
  startQuery: string;
  endQuery: string;
  startCoords?: { lat: number; lon: number };
  endCoords?: { lat: number; lon: number };
  mode: 'driving' | 'cycling' | 'walking';
}): Promise<RouteComparisonResponse> {
  return requestWithRetry<RouteComparisonResponse>('/api/route', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 1);
}

export async function runAiInvestigation(
  aqData: AirQualityResponse,
  mode: 'investigation' | 'forecast' = 'investigation'
): Promise<AiInvestigationResult> {
  const recentHistory = aqData.hourly
    .filter((h) => !h.isForecast)
    .slice(-24)
    .map((h) => ({ time: h.time, usAqi: h.usAqi, pm25: h.pm25, pm10: h.pm10 }));

  const forecastSummary = aqData.daily
    .filter((d) => d.isForecast)
    .slice(0, 7)
    .map((d) => ({ date: d.date, avgAqi: d.avgAqi, maxAqi: d.maxAqi, avgPm25: d.avgPm25 }));

  return requestWithRetry<AiInvestigationResult>('/api/ai/investigate', {
    method: 'POST',
    body: JSON.stringify({
      location: aqData.location,
      current: aqData.current,
      weather: aqData.weather,
      recentHistory,
      forecastSummary,
      mode,
    }),
  }, 1);
}

export async function runAiHealthAdvisory(aqData: AirQualityResponse): Promise<AiHealthAdvisoryResult> {
  return requestWithRetry<AiHealthAdvisoryResult>('/api/ai/health-advisory', {
    method: 'POST',
    body: JSON.stringify({
      location: aqData.location,
      current: aqData.current,
      weather: aqData.weather,
    }),
  }, 1);
}

export async function sendMultilingualChat(payload: {
  message: string;
  language: LanguageCode;
  activeCityData: AirQualityResponse | null;
  contextCities: CityReadingSummary[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ reply: string; fetchedExtraCities: string[]; generatedAt: string }> {
  return requestWithRetry('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 1);
}

export async function generateReportNarrative(payload: {
  reportType: string;
  primaryLocation: AirQualityResponse['location'];
  current: AirQualityResponse['current'];
  weather: AirQualityResponse['weather'];
  dailySummary: AirQualityResponse['daily'];
  comparisonCities: CityReadingSummary[];
}): Promise<{
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  limitationsStatement: string;
  generatedAt: string;
}> {
  return requestWithRetry('/api/ai/report-summary', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 1);
}

export async function fetchSystemHealth(): Promise<SystemHealthResponse> {
  return requestWithRetry<SystemHealthResponse>('/api/health', {}, 1);
}

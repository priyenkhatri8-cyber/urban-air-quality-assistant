export type LanguageCode = 'en' | 'gu' | 'hi';

export type DataProvenanceType =
  | 'measured'
  | 'modelled'
  | 'historical_model'
  | 'forecast_model';

export interface CityPreset {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  subZones?: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    zoneType: 'urban' | 'industrial' | 'residential' | 'greenbelt' | 'transit';
  }>;
}

export interface PollutantSnapshot {
  usAqi: number | null;
  europeanAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
  uvIndex?: number | null;
}

export interface WeatherSnapshot {
  temperature: number | null;
  humidity: number | null;
  apparentTemperature: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  pressure: number | null;
  weatherCode: number | null;
  conditionLabel: string;
}

export interface HourlyDataPoint {
  time: string;
  epochMs: number;
  isForecast: boolean;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
}

export interface DailyAggregatePoint {
  date: string;
  isForecast: boolean;
  avgAqi: number | null;
  maxAqi: number | null;
  minAqi: number | null;
  avgPm25: number | null;
  avgPm10: number | null;
  hoursCount: number;
}

export interface AirQualityResponse {
  location: {
    name: string;
    lat: number;
    lon: number;
    timezone: string;
    utcOffsetSeconds: number;
  };
  current: PollutantSnapshot & {
    time: string;
  };
  weather: WeatherSnapshot & {
    time: string;
  };
  hourly: HourlyDataPoint[];
  daily: DailyAggregatePoint[];
  provenance: {
    airQualitySource: string;
    weatherSource: string;
    provenanceType: DataProvenanceType;
    isModelled: boolean;
    spatialResolution: string;
    aqiScale: 'US EPA AQI';
    fetchedAt: string;
    forecastHorizonHours: number;
    historicalHours: number;
    notes: string;
  };
}

export interface CityReadingSummary {
  id: string;
  name: string;
  state?: string;
  country?: string;
  lat: number;
  lon: number;
  timezone: string;
  observedTime: string;
  pollutants: PollutantSnapshot;
  weather: WeatherSnapshot;
  isModelled: boolean;
  sourceLabel: string;
  aqiScale: 'US EPA AQI';
}

export interface LocalGridPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  zoneType: string;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  observedTime: string;
  isModelled: boolean;
  sourceLabel: string;
}

export interface LocalGridResponse {
  center: {
    name: string;
    lat: number;
    lon: number;
  };
  points: LocalGridPoint[];
  fetchedAt: string;
  provenanceNote: string;
}

export interface RouteAlternative {
  id: string;
  name: string;
  distanceKm: number;
  durationMin: number;
  geometry: Array<[number, number]>; // [lat, lon]
  sampledWaypoints: Array<{
    lat: number;
    lon: number;
    usAqi: number | null;
    pm25: number | null;
  }>;
  avgAqi: number | null;
  maxAqi: number | null;
  avgPm25: number | null;
  exposureScore: number | null;
  aqiDataAvailable: boolean;
  isRecommended: boolean;
}

export interface RouteComparisonResponse {
  start: { name: string; lat: number; lon: number };
  end: { name: string; lat: number; lon: number };
  mode: 'driving' | 'cycling' | 'walking';
  routes: RouteAlternative[];
  provenanceNote: string;
  fetchedAt: string;
}

export interface AiInvestigationResult {
  conditionSummary: string;
  mainPollutantAnalysis: string;
  possibleContributingFactors: string[];
  healthExposureRecommendations: string[];
  pollutionTrendInterpretation: string;
  suggestedPreventiveActions: string[];
  dataLimitationsNote: string;
  generatedAt: string;
}

export interface AiHealthAdvisoryResult {
  overallRiskSummary: string;
  medicalDisclaimer: string;
  groups: Array<{
    groupId: 'children' | 'seniors' | 'outdoor_workers' | 'general' | 'sensitive';
    groupTitle: string;
    riskLevel: string;
    outdoorActivity: string;
    maskGuidance: string;
    exerciseGuidance: string;
    indoorAirTips: string;
    exposureReductionTips: string[];
  }>;
  generatedAt: string;
}

export interface AlertRuleConfig {
  enabled: boolean;
  browserNotifications: boolean;
  threshold100: boolean;
  threshold150: boolean;
  threshold200: boolean;
  hazardousAlert: boolean;
  customPm25Enabled: boolean;
  customPm25Threshold: number;
}

export interface AlertHistoryItem {
  id: string;
  dedupeKey: string;
  cityId: string;
  cityName: string;
  conditionLabel: string;
  aqi: number | null;
  pm25: number | null;
  triggeredAt: string;
  observedTime: string;
  acknowledged: boolean;
}

export interface UserPreferences {
  favoriteCities: CityPreset[];
  recentSearches: CityPreset[];
  language: LanguageCode;
  theme: 'light' | 'dark';
  pinnedCityId: string;
  dashboardWidgets: {
    showHotspots: boolean;
    showHealthSummary: boolean;
    showForecastMini: boolean;
    showFavoritesStrip: boolean;
  };
  alerts: AlertRuleConfig;
}

export interface SystemHealthResponse {
  status: 'operational' | 'degraded';
  uptimeSeconds: number;
  lastSuccessfulRefresh: string | null;
  cache: {
    entries: number;
    hits: number;
    misses: number;
    hitRatePct: number;
  };
  providers: Array<{
    name: string;
    purpose: string;
    status: 'connected' | 'degraded' | 'idle';
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    totalRequests: number;
    errorCount: number;
    lastLatencyMs: number | null;
  }>;
  recentErrors: Array<{
    timestamp: string;
    provider: string;
    message: string;
    statusCode?: number;
  }>;
  dataSourcesSummary: string[];
}

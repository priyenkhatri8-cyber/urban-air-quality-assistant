import type { AiHealthAdvisoryResult, LanguageCode } from '../types/environment';

export interface AqiCategoryMeta {
  level: 'good' | 'moderate' | 'usg' | 'unhealthy' | 'very_unhealthy' | 'hazardous' | 'unknown';
  label: string;
  labelGu: string;
  labelHi: string;
  colorHex: string;
  textClass: string;
  bgSubtleClass: string;
  borderClass: string;
  range: string;
}

export function getAqiCategory(aqi: number | null | undefined): AqiCategoryMeta {
  if (aqi === null || aqi === undefined || Number.isNaN(aqi)) {
    return {
      level: 'unknown',
      label: 'Unavailable',
      labelGu: 'ઉપલબ્ધ નથી',
      labelHi: 'उपलब्ध नहीं',
      colorHex: '#64748B',
      textClass: 'text-slate-600 dark:text-slate-400',
      bgSubtleClass: 'bg-slate-100 dark:bg-slate-800/70',
      borderClass: 'border-slate-300 dark:border-slate-700',
      range: '--',
    };
  }
  if (aqi <= 50) {
    return {
      level: 'good',
      label: 'Good',
      labelGu: 'સારું',
      labelHi: 'अच्छा',
      colorHex: '#16A34A',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      bgSubtleClass: 'bg-emerald-50 dark:bg-emerald-950/50',
      borderClass: 'border-emerald-200 dark:border-emerald-800',
      range: '0–50',
    };
  }
  if (aqi <= 100) {
    return {
      level: 'moderate',
      label: 'Moderate',
      labelGu: 'મધ્યમ',
      labelHi: 'संतोषजनक',
      colorHex: '#CA8A04',
      textClass: 'text-amber-700 dark:text-amber-400',
      bgSubtleClass: 'bg-amber-50 dark:bg-amber-950/50',
      borderClass: 'border-amber-200 dark:border-amber-800',
      range: '51–100',
    };
  }
  if (aqi <= 150) {
    return {
      level: 'usg',
      label: 'Unhealthy for Sensitive Groups',
      labelGu: 'સંવેદનશીલ જૂથો માટે અસ્વસ્થ',
      labelHi: 'संवेदनशील समूहों के लिए अस्वस्थ',
      colorHex: '#EA580C',
      textClass: 'text-orange-700 dark:text-orange-400',
      bgSubtleClass: 'bg-orange-50 dark:bg-orange-950/50',
      borderClass: 'border-orange-200 dark:border-orange-800',
      range: '101–150',
    };
  }
  if (aqi <= 200) {
    return {
      level: 'unhealthy',
      label: 'Unhealthy',
      labelGu: 'અસ્વસ્થ',
      labelHi: 'अस्वस्थ',
      colorHex: '#DC2626',
      textClass: 'text-rose-700 dark:text-rose-400',
      bgSubtleClass: 'bg-rose-50 dark:bg-rose-950/50',
      borderClass: 'border-rose-200 dark:border-rose-800',
      range: '151–200',
    };
  }
  if (aqi <= 300) {
    return {
      level: 'very_unhealthy',
      label: 'Very Unhealthy',
      labelGu: 'ખૂબ અસ્વસ્થ',
      labelHi: 'बहुत अस्वस्थ',
      colorHex: '#9333EA',
      textClass: 'text-purple-700 dark:text-purple-400',
      bgSubtleClass: 'bg-purple-50 dark:bg-purple-950/50',
      borderClass: 'border-purple-200 dark:border-purple-800',
      range: '201–300',
    };
  }
  return {
    level: 'hazardous',
    label: 'Hazardous',
    labelGu: 'જોખમી',
    labelHi: 'गंभीर / खतरनाक',
    colorHex: '#881337',
    textClass: 'text-red-800 dark:text-red-400',
    bgSubtleClass: 'bg-red-50 dark:bg-red-950/60',
    borderClass: 'border-red-300 dark:border-red-800',
    range: '301+',
  };
}

export function getLocalizedAqiLabel(aqi: number | null | undefined, lang: LanguageCode): string {
  const cat = getAqiCategory(aqi);
  if (lang === 'gu') return cat.labelGu;
  if (lang === 'hi') return cat.labelHi;
  return cat.label;
}

export function formatMetric(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '--';
  return Number(val).toFixed(decimals);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

export function weatherCodeToLabel(code: number | null | undefined): string {
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

export function buildBaselineHealthAdvisory(aqi: number | null, pm25: number | null): AiHealthAdvisoryResult {
  const val = aqi ?? 0;
  const isHigh = val > 150;
  const isModerateHigh = val > 100 && val <= 150;
  const isVeryHigh = val > 200;

  return {
    overallRiskSummary:
      aqi === null
        ? 'Air quality index data is currently unavailable for deterministic risk scoring. Exercise standard precautions.'
        : `Current US EPA AQI is ${Math.round(val)} (${getAqiCategory(val).label})${pm25 !== null ? ` with PM2.5 at ${pm25.toFixed(1)} µg/m³` : ''}. Guidance below reflects standard public-health exposure thresholds.`,
    medicalDisclaimer:
      'Disclaimer: VayuSense provides general environmental health guidance based on public air-quality thresholds. It does not diagnose medical conditions or replace professional medical advice. Consult a physician if you experience respiratory or cardiac symptoms.',
    generatedAt: new Date().toISOString(),
    groups: [
      {
        groupId: 'children',
        groupTitle: 'Children & Infants',
        riskLevel: isVeryHigh ? 'High Risk' : isHigh ? 'Elevated Risk' : isModerateHigh ? 'Moderate Caution' : 'Low Risk',
        outdoorActivity: isVeryHigh
          ? 'Keep outdoor play indoors; avoid school playground exertion.'
          : isHigh
          ? 'Shorten outdoor playtime and move vigorous activities indoors.'
          : isModerateHigh
          ? 'Prefer shaded, lower-traffic parks and limit prolonged intense running.'
          : 'Normal outdoor play is appropriate; monitor for any coughing.',
        maskGuidance: isHigh
          ? 'Well-fitted child-sized N95/KF94 mask if outdoor transit is unavoidable.'
          : 'Mask generally not needed during Good/Moderate hours.',
        exerciseGuidance: isHigh
          ? 'Indoor active games only; avoid heavy breathing outdoors.'
          : 'Normal physical education with hydration breaks.',
        indoorAirTips: 'Keep classroom and bedroom windows closed during peak traffic hours; run HEPA filtration if available.',
        exposureReductionTips: [
          'Avoid walking along busy arterial roads during school drop-off.',
          'Schedule outdoor sports in early afternoon when mixing height is higher, if AQI permits.',
        ],
      },
      {
        groupId: 'seniors',
        groupTitle: 'Senior Citizens (65+)',
        riskLevel: isVeryHigh ? 'High Risk' : isHigh ? 'Elevated Risk' : isModerateHigh ? 'Moderate Caution' : 'Low Risk',
        outdoorActivity: isVeryHigh
          ? 'Remain indoors with filtered air; postpone non-essential errands.'
          : isHigh
          ? 'Minimize outdoor exposure, especially during morning/evening haze.'
          : isModerateHigh
          ? 'Keep walks brief and calm; rest if breath feels tight.'
          : 'Routine morning or evening walks are suitable.',
        maskGuidance: isModerateHigh || isHigh
          ? 'Wear a snug N95/FFP2 respirator when commuting or walking near traffic.'
          : 'Optional; helpful in dusty construction corridors.',
        exerciseGuidance: isHigh
          ? 'Switch to gentle indoor stretching or stationary movement.'
          : 'Light-to-moderate walking; avoid strenuous outdoor exertion when AQI > 100.',
        indoorAirTips: 'Maintain indoor air circulation with filtration; avoid incense or indoor smoke.',
        exposureReductionTips: [
          'Keep prescribed inhalers or cardiovascular medications accessible.',
          'Check hourly AQI forecast before planning outdoor appointments.',
        ],
      },
      {
        groupId: 'outdoor_workers',
        groupTitle: 'Outdoor Workers & Traffic Personnel',
        riskLevel: isVeryHigh ? 'Severe Occupational Exposure' : isHigh ? 'High Occupational Exposure' : isModerateHigh ? 'Moderate Exposure' : 'Standard',
        outdoorActivity: isHigh
          ? 'Rotate heavy physical tasks with shaded indoor recovery breaks every 45–60 minutes.'
          : 'Continue scheduled shifts while monitoring hourly PM2.5 spikes.',
        maskGuidance: isModerateHigh || isHigh
          ? 'Use NIOSH N95 / IS 9473 FFP2 particulate respirators with a proper nose seal; replace if damp or clogged.'
          : 'Standard dust protection around construction or unpaved roads.',
        exerciseGuidance: 'Pace heavy lifting to avoid rapid deep inhalation of fine particulates.',
        indoorAirTips: 'Provide clean, filtered break rooms for hydration and mask-free recovery.',
        exposureReductionTips: [
          'Wet-suppress construction dust where possible.',
          'Stay hydrated and wash face/nasal passages after shifts.',
        ],
      },
      {
        groupId: 'general',
        groupTitle: 'General Adult Population',
        riskLevel: isVeryHigh ? 'Unhealthy' : isHigh ? 'Elevated' : isModerateHigh ? 'Acceptable with Caution' : 'Nominal',
        outdoorActivity: isVeryHigh
          ? 'Avoid prolonged outdoor exertion; reschedule outdoor social events.'
          : isHigh
          ? 'Reduce prolonged or heavy outdoor exertion.'
          : 'Normal daily outdoor routines are appropriate.',
        maskGuidance: isHigh
          ? 'N95/FFP2 recommended for two-wheeler commuters and pedestrians.'
          : 'Optional in high-traffic corridors.',
        exerciseGuidance: isVeryHigh
          ? 'Move workouts indoors.'
          : isHigh
          ? 'Reduce workout intensity and duration outdoors; prefer indoor gyms.'
          : 'Outdoor jogging and cycling are fine; prefer lower-traffic routes.',
        indoorAirTips: 'Use kitchen exhaust while cooking and ventilate only during lowest-AQI afternoon hours.',
        exposureReductionTips: [
          'Use Smart Route comparison to pick lower-exposure transit paths.',
          'Set car AC to recirculation mode in congested traffic.',
        ],
      },
      {
        groupId: 'sensitive',
        groupTitle: 'Sensitive Groups (Asthma, COPD, Cardiac, Pregnancy)',
        riskLevel: isVeryHigh ? 'Critical Caution' : isHigh ? 'High Risk' : isModerateHigh ? 'Elevated Risk' : 'Monitor Closely',
        outdoorActivity: isHigh
          ? 'Stay indoors as much as possible; avoid outdoor exposure.'
          : isModerateHigh
          ? 'Limit prolonged outdoor stays and avoid roadside corridors completely.'
          : 'Moderate outdoor activity is usually tolerated; carry rescue medication.',
        maskGuidance: isModerateHigh || isHigh
          ? 'Wear a properly sealed N95/FFP2 respirator outdoors; cloth/surgical masks do not filter PM2.5.'
          : 'Consider N95 in crowded or dusty environments.',
        exerciseGuidance: isModerateHigh || isHigh
          ? 'Perform low-intensity exercise indoors only.'
          : 'Light outdoor exercise; stop immediately if wheezing, chest tightness, or dizziness occurs.',
        indoorAirTips: 'Run a true HEPA H13 air purifier in sleeping quarters and seal door/window drafts during pollution peaks.',
        exposureReductionTips: [
          'Enable AQI > 100 alerts in the Smart Alert Center.',
          'Follow your clinician’s asthma or cardiac action plan if symptoms worsen.',
        ],
      },
    ],
  };
}

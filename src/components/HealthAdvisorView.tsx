import React, { useMemo, useState } from 'react';
import { AlertTriangle, Baby, Briefcase, HeartPulse, RefreshCw, ShieldCheck, Sparkles, UserCheck, Users } from 'lucide-react';
import type { AiHealthAdvisoryResult, AirQualityResponse } from '../types/environment';
import { runAiHealthAdvisory } from '../services/api';
import { buildBaselineHealthAdvisory, formatMetric, getAqiCategory } from '../utils/aqi';

interface HealthAdvisorViewProps {
  airQuality: AirQualityResponse | null;
}

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  children: Baby,
  seniors: UserCheck,
  outdoor_workers: Briefcase,
  general: Users,
  sensitive: HeartPulse,
};

export function HealthAdvisorView({ airQuality }: HealthAdvisorViewProps) {
  const [aiAdvisory, setAiAdvisory] = useState<AiHealthAdvisoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  const baseline = useMemo(() => {
    return buildBaselineHealthAdvisory(
      airQuality?.current.usAqi ?? null,
      airQuality?.current.pm25 ?? null
    );
  }, [airQuality?.current.usAqi, airQuality?.current.pm25]);

  const activeData = aiAdvisory || baseline;
  const visibleGroups =
    selectedGroupId === 'all'
      ? activeData.groups
      : activeData.groups.filter((g) => g.groupId === selectedGroupId);

  const handleGeneratePersonalized = async () => {
    if (!airQuality) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runAiHealthAdvisory(airQuality);
      setAiAdvisory(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to generate AI health advisory.');
    } finally {
      setLoading(false);
    }
  };

  const cat = getAqiCategory(airQuality?.current.usAqi ?? null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {aiAdvisory ? 'Gemini Personalized Advisory' : 'Deterministic EPA/WHO Threshold Guidance'}
              {airQuality ? ` · ${airQuality.location.name} (AQI ${Math.round(airQuality.current.usAqi ?? 0)} · PM2.5 ${formatMetric(airQuality.current.pm25)} µg/m³)` : ''}
            </div>
            <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
              AI Health Impact Advisor
            </h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              {activeData.overallRiskSummary}
            </p>
          </div>

          <button
            type="button"
            onClick={handleGeneratePersonalized}
            disabled={loading || !airQuality}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? 'Personalizing...' : 'Personalize with Gemini AI'}
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Population Groups' },
            { id: 'children', label: 'Children' },
            { id: 'seniors', label: 'Senior Citizens' },
            { id: 'outdoor_workers', label: 'Outdoor Workers' },
            { id: 'general', label: 'General Population' },
            { id: 'sensitive', label: 'Sensitive Groups' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedGroupId(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                selectedGroupId === tab.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Medical Disclaimer */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Medical Disclaimer: </span>
          {activeData.medicalDisclaimer}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-xs text-rose-700 dark:text-rose-300">
          {error} (Showing baseline public-health threshold guidance below.)
        </div>
      )}

      {/* Population Group Guidance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleGroups.map((group) => {
          const Icon = GROUP_ICONS[group.groupId] || ShieldCheck;
          return (
            <article
              key={group.groupId}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {group.groupTitle}
                    </h2>
                    <div className="text-xs font-mono" style={{ color: cat.colorHex }}>
                      {group.riskLevel}
                    </div>
                  </div>
                </div>
              </div>

              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="font-semibold text-slate-700 dark:text-slate-300">Outdoor Activity</dt>
                  <dd className="mt-0.5 text-slate-600 dark:text-slate-400">{group.outdoorActivity}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700 dark:text-slate-300">Mask Guidance</dt>
                  <dd className="mt-0.5 text-slate-600 dark:text-slate-400">{group.maskGuidance}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700 dark:text-slate-300">Exercise Recommendations</dt>
                  <dd className="mt-0.5 text-slate-600 dark:text-slate-400">{group.exerciseGuidance}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700 dark:text-slate-300">Indoor Air Quality</dt>
                  <dd className="mt-0.5 text-slate-600 dark:text-slate-400">{group.indoorAirTips}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700 dark:text-slate-300">Exposure Reduction Tips</dt>
                  <dd className="mt-1">
                    <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                      {group.exposureReductionTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-cyan-600 dark:text-cyan-400">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

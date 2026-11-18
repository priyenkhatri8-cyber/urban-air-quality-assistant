import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Cpu, RefreshCw, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';
import type { AiInvestigationResult, AirQualityResponse } from '../types/environment';
import { runAiInvestigation } from '../services/api';
import { formatMetric, getAqiCategory } from '../utils/aqi';

interface AiInvestigatorViewProps {
  airQuality: AirQualityResponse | null;
}

export function AiInvestigatorView({ airQuality }: AiInvestigatorViewProps) {
  const [result, setResult] = useState<AiInvestigationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCityKey, setLastCityKey] = useState<string>('');

  const currentCityKey = airQuality ? `${airQuality.location.name}-${airQuality.current.time}` : '';

  const handleInvestigate = async () => {
    if (!airQuality) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runAiInvestigation(airQuality, 'investigation');
      setResult(res);
      setLastCityKey(currentCityKey);
    } catch (err: any) {
      setError(err?.message || 'AI investigation request failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!airQuality) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
        Select a city first to inspect live atmospheric data with the AI Pollution Investigator.
      </div>
    );
  }

  const cat = getAqiCategory(airQuality.current.usAqi);
  const isStaleForCity = result && lastCityKey !== currentCityKey;

  return (
    <div className="space-y-5">
      {/* Control Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              AI-Generated Atmospheric Interpretation · Grounded in Retrieved Telemetry
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              AI Pollution Investigator — {airQuality.location.name}
            </h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              Synthesizes current AQI, PM2.5, PM10, NO₂, SO₂, CO, O₃, meteorology, and recent 24-hour trends without inventing measurements or unverified emission sources.
            </p>
          </div>

          <button
            type="button"
            onClick={handleInvestigate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing Telemetry...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {result ? 'Re-run Investigation' : 'Run AI Pollution Investigation'}
              </>
            )}
          </button>
        </div>

        {/* Input Evidence Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
          <div>
            <div className="text-slate-500 dark:text-slate-400">US AQI</div>
            <div className="font-mono font-bold text-base" style={{ color: cat.colorHex }}>
              {airQuality.current.usAqi !== null ? Math.round(airQuality.current.usAqi) : '--'}
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">PM2.5</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatMetric(airQuality.current.pm25)} µg/m³
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">PM10</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatMetric(airQuality.current.pm10)} µg/m³
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">NO₂</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatMetric(airQuality.current.no2)} µg/m³
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">SO₂</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatMetric(airQuality.current.so2)} µg/m³
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">CO / O₃</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatMetric(airQuality.current.co, 0)} / {formatMetric(airQuality.current.o3, 0)}
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Temp / RH</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatMetric(airQuality.weather.temperature)}°C / {formatMetric(airQuality.weather.humidity, 0)}%
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Wind</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatMetric(airQuality.weather.windSpeed)} km/h
            </div>
          </div>
        </div>
      </div>

      {isStaleForCity && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span>Active city changed. Click &quot;Re-run Investigation&quot; to analyze {airQuality.location.name}.</span>
          <button type="button" onClick={handleInvestigate} className="font-semibold underline">
            Update Now
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 flex items-start gap-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">AI Investigation Error</div>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2 animate-pulse">
          <Cpu className="h-6 w-6 mx-auto text-cyan-600 dark:text-cyan-400" />
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Running Gemini Atmospheric Investigation...
          </div>
          <div className="text-xs text-slate-500">
            Cross-referencing particulate ratios, gaseous tracers, wind dispersion, and 24-hour trajectory.
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              1. Pollution Condition Summary
            </h2>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {result.conditionSummary}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              2. Main Pollutant Analysis
            </h2>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {result.mainPollutantAnalysis}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              3. Possible Contributing Factors (Hypothesis Only)
            </h2>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              {result.possibleContributingFactors.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-slate-400">0{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              4. Health Exposure Recommendations
            </h2>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              {result.healthExposureRecommendations.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              5. Pollution Trend Interpretation
            </h2>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {result.pollutionTrendInterpretation}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              6. Suggested Preventive Actions
            </h2>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              {result.suggestedPreventiveActions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap justify-between gap-2">
            <span>{result.dataLimitationsNote}</span>
            <span className="font-mono">Generated {new Date(result.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, RefreshCw, Sparkles } from 'lucide-react';
import type { AirQualityResponse, CityReadingSummary } from '../types/environment';
import { generateReportNarrative } from '../services/api';
import { formatMetric, getAqiCategory } from '../utils/aqi';
import { downloadReportCsv, downloadReportPdf } from '../utils/exportReport';

interface ReportGeneratorViewProps {
  airQuality: AirQualityResponse | null;
  comparisonCities: CityReadingSummary[];
}

const REPORT_TYPES = [
  'Daily AQI Report',
  'Weekly Air Quality Report',
  'City Comparison Report',
  'Pollution Analysis Report',
  'Environmental Health Advisory',
];

export function ReportGeneratorView({ airQuality, comparisonCities }: ReportGeneratorViewProps) {
  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [narrative, setNarrative] = useState<{
    executiveSummary: string;
    keyFindings: string[];
    recommendations: string[];
    limitationsStatement: string;
    generatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!airQuality) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
        Load a city first to generate environmental reports.
      </div>
    );
  }

  const handleGenerateAiSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateReportNarrative({
        reportType,
        primaryLocation: airQuality.location,
        current: airQuality.current,
        weather: airQuality.weather,
        dailySummary: airQuality.daily,
        comparisonCities,
      });
      setNarrative(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to generate AI narrative.');
    } finally {
      setLoading(false);
    }
  };

  const payload = {
    reportType,
    primaryData: airQuality,
    comparisonCities,
    narrative,
  };

  const cat = getAqiCategory(airQuality.current.usAqi);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Environmental Report Generator
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate downloadable PDF and CSV environmental intelligence reports for {airQuality.location.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateAiSummary}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-cyan-600" />}
              {narrative ? 'Regenerate AI Analysis' : 'Include AI Analysis'}
            </button>
            <button
              type="button"
              onClick={() => downloadReportCsv(payload)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => downloadReportPdf(payload)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {REPORT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setReportType(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                reportType === type
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Formal Report Preview Sheet */}
      <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-wrap justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-cyan-700 dark:text-cyan-400 font-semibold">
              <FileText className="h-4 w-4" />
              <span>{reportType}</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {airQuality.location.name} — Environmental Intelligence Brief
            </h2>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
              Coordinates: {airQuality.location.lat.toFixed(4)}, {airQuality.location.lon.toFixed(4)} · Generated {new Date().toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Observed US AQI</div>
            <div className="text-3xl font-bold font-mono" style={{ color: cat.colorHex }}>
              {airQuality.current.usAqi !== null ? Math.round(airQuality.current.usAqi) : '--'}
            </div>
            <div className={`text-xs font-semibold ${cat.textClass}`}>{cat.label}</div>
          </div>
        </div>

        {/* Pollutant Measurements Table */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Pollutant & Meteorological Measurements
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-slate-500">PM2.5</div>
              <div className="font-mono font-bold text-base mt-0.5">{formatMetric(airQuality.current.pm25)} µg/m³</div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-slate-500">PM10</div>
              <div className="font-mono font-bold text-base mt-0.5">{formatMetric(airQuality.current.pm10)} µg/m³</div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-slate-500">NO₂ / SO₂</div>
              <div className="font-mono font-bold text-base mt-0.5">
                {formatMetric(airQuality.current.no2)} / {formatMetric(airQuality.current.so2)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-slate-500">O₃ / Wind</div>
              <div className="font-mono font-bold text-base mt-0.5">
                {formatMetric(airQuality.current.o3)} · {formatMetric(airQuality.weather.windSpeed)} km/h
              </div>
            </div>
          </div>
        </div>

        {/* AI Executive Narrative */}
        {narrative ? (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">AI Executive Analysis</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{narrative.executiveSummary}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Key Findings</h4>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {narrative.keyFindings.map((k, i) => (
                    <li key={i}>• {k}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Recommendations</h4>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {narrative.recommendations.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-500">
            Optional: Click &quot;Include AI Analysis&quot; above to embed a Gemini-synthesized executive summary and tailored recommendations into the PDF/CSV export.
          </div>
        )}

        {/* Data Source & Limitations */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-300">Data Source & Limitations: </strong>
          {narrative?.limitationsStatement || `${airQuality.provenance.airQualitySource}. ${airQuality.provenance.notes}`}
        </div>
      </article>
    </div>
  );
}

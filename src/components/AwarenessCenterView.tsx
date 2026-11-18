import React from 'react';
import { BookOpen, Home, Leaf, Shield, Wind } from 'lucide-react';

const AQI_SCALE_ROWS = [
  { range: '0 – 50', category: 'Good', color: '#16A34A', meaning: 'Minimal health impact; air quality is satisfactory.' },
  { range: '51 – 100', category: 'Moderate', color: '#CA8A04', meaning: 'Acceptable air quality; unusually sensitive individuals may experience mild symptoms.' },
  { range: '101 – 150', category: 'Unhealthy for Sensitive Groups', color: '#EA580C', meaning: 'Children, seniors, and people with asthma or heart disease should reduce prolonged outdoor exertion.' },
  { range: '151 – 200', category: 'Unhealthy', color: '#DC2626', meaning: 'Everyone may begin to experience health effects; limit prolonged outdoor activity.' },
  { range: '201 – 300', category: 'Very Unhealthy', color: '#9333EA', meaning: 'Health alert: increased risk of respiratory and cardiovascular effects for everyone.' },
  { range: '301+', category: 'Hazardous', color: '#881337', meaning: 'Emergency conditions: avoid outdoor physical exertion and keep indoor air filtered.' },
];

export function AwarenessCenterView() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
          <BookOpen className="h-4 w-4" />
          <span>Environmental Education & Public Health Reference</span>
        </div>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
          Environmental Awareness Center
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
          Evidence-based fundamentals on air quality indices, particulate matter sizing, health impacts, and practical strategies to reduce personal exposure and urban emissions.
        </p>
      </div>

      {/* Core Concepts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">What is AQI?</h2>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            The Air Quality Index (AQI) translates complex concentrations of major pollutants (PM2.5, PM10, O₃, NO₂, SO₂, CO) into a standardized 0–500 scale. VayuSense reports the <strong>US EPA AQI scale</strong> so all cities and forecasts are compared consistently.
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">What is PM2.5?</h2>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Fine particulate matter with aerodynamic diameter ≤ 2.5 micrometers (roughly 1/30th the width of a human hair). Because of its tiny size, PM2.5 penetrates deep into lung alveoli and can enter the bloodstream, originating from combustion, traffic exhaust, and secondary atmospheric aerosols.
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">What is PM10?</h2>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Coarse inhalable particles ≤ 10 micrometers in diameter, including road dust, construction resuspension, industrial grinding, pollen, and sea salt. PM10 primarily irritates the eyes, nose, throat, and upper respiratory airways.
          </p>
        </article>
      </div>

      {/* US EPA AQI Reference Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            US EPA AQI Health Breakpoints
          </h2>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-4 font-semibold">AQI Range</th>
              <th className="py-2.5 px-4 font-semibold">Category</th>
              <th className="py-2.5 px-4 font-semibold">Public Health Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {AQI_SCALE_ROWS.map((row) => (
              <tr key={row.range}>
                <td className="py-2.5 px-4 font-mono font-bold whitespace-nowrap" style={{ color: row.color }}>
                  {row.range}
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {row.category}
                </td>
                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{row.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Actionable Guidance Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Shield className="h-4 w-4 text-rose-500" />
            Health Effects
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li>• Airway inflammation, coughing, and asthma flare-ups</li>
            <li>• Elevated blood pressure and cardiovascular strain</li>
            <li>• Reduced lung function growth in children</li>
            <li>• Eye, nasal, and throat irritation during dust spikes</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Wind className="h-4 w-4 text-cyan-600" />
            Reduce Urban Pollution
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li>• Use metro, BRTS, carpooling, or EVs for daily commutes</li>
            <li>• Eliminate open waste or biomass burning</li>
            <li>• Maintain vehicle tire pressure and emission checks</li>
            <li>• Support covered transport and water misting at construction sites</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Home className="h-4 w-4 text-amber-500" />
            Indoor Air Quality Tips
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li>• Run kitchen range hoods and exhaust fans while cooking</li>
            <li>• Ventilate rooms during afternoon lowest-AQI hours</li>
            <li>• Use HEPA H13 filtration in bedrooms during high-AQI nights</li>
            <li>• Wet-mop floors instead of dry sweeping to trap settled dust</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Leaf className="h-4 w-4 text-emerald-600" />
            Environmental Protection
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li>• Expand native urban tree canopy along dust corridors</li>
            <li>• Adopt rooftop solar to lower fossil-fuel grid load</li>
            <li>• Segregate dry waste to prevent landfill fires</li>
            <li>• Monitor local AQI trends to inform civic planning</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

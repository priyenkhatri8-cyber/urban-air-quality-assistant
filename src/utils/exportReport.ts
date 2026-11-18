import { jsPDF } from 'jspdf';
import type { AirQualityResponse, CityReadingSummary } from '../types/environment';
import { formatMetric, getAqiCategory } from './aqi';

export interface ReportPayload {
  reportType: string;
  primaryData: AirQualityResponse;
  comparisonCities: CityReadingSummary[];
  narrative: {
    executiveSummary: string;
    keyFindings: string[];
    recommendations: string[];
    limitationsStatement: string;
  } | null;
}

export function downloadReportCsv(payload: ReportPayload) {
  const { reportType, primaryData, comparisonCities, narrative } = payload;
  const lines: string[] = [];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  lines.push([esc('Report Type'), esc(reportType)].join(','));
  lines.push([esc('Generated At'), esc(new Date().toISOString())].join(','));
  lines.push([esc('Primary Location'), esc(primaryData.location.name)].join(','));
  lines.push([esc('Coordinates'), esc(`${primaryData.location.lat}, ${primaryData.location.lon}`)].join(','));
  lines.push([esc('Data Source'), esc(primaryData.provenance.airQualitySource)].join(','));
  lines.push([esc('Data Classification'), esc('Modelled Atmospheric Estimate (US EPA AQI)')].join(','));
  lines.push('');

  lines.push(['Current Measurements', 'Value', 'Unit'].map(esc).join(','));
  lines.push(['US EPA AQI', primaryData.current.usAqi ?? '--', 'AQI'].map(esc).join(','));
  lines.push(['Category', getAqiCategory(primaryData.current.usAqi).label, ''].map(esc).join(','));
  lines.push(['PM2.5', formatMetric(primaryData.current.pm25), 'ug/m3'].map(esc).join(','));
  lines.push(['PM10', formatMetric(primaryData.current.pm10), 'ug/m3'].map(esc).join(','));
  lines.push(['NO2', formatMetric(primaryData.current.no2), 'ug/m3'].map(esc).join(','));
  lines.push(['SO2', formatMetric(primaryData.current.so2), 'ug/m3'].map(esc).join(','));
  lines.push(['CO', formatMetric(primaryData.current.co), 'ug/m3'].map(esc).join(','));
  lines.push(['O3', formatMetric(primaryData.current.o3), 'ug/m3'].map(esc).join(','));
  lines.push(['Temperature', formatMetric(primaryData.weather.temperature), 'C'].map(esc).join(','));
  lines.push(['Humidity', formatMetric(primaryData.weather.humidity, 0), '%'].map(esc).join(','));
  lines.push(['Wind Speed', formatMetric(primaryData.weather.windSpeed), 'km/h'].map(esc).join(','));
  lines.push('');

  if (primaryData.daily.length > 0) {
    lines.push(['Date', 'Type', 'Avg AQI', 'Max AQI', 'Avg PM2.5 (ug/m3)', 'Avg PM10 (ug/m3)'].map(esc).join(','));
    primaryData.daily.forEach((d) => {
      lines.push(
        [
          d.date,
          d.isForecast ? 'Forecast' : 'Historical/Current',
          d.avgAqi ?? '--',
          d.maxAqi ?? '--',
          d.avgPm25 ?? '--',
          d.avgPm10 ?? '--',
        ]
          .map(esc)
          .join(',')
      );
    });
    lines.push('');
  }

  if (comparisonCities.length > 0) {
    lines.push(['City Comparison', 'US AQI', 'Category', 'PM2.5', 'PM10', 'NO2', 'O3', 'Temp (C)', 'Observed Time'].map(esc).join(','));
    comparisonCities.forEach((c) => {
      lines.push(
        [
          c.name,
          c.pollutants.usAqi ?? '--',
          getAqiCategory(c.pollutants.usAqi).label,
          formatMetric(c.pollutants.pm25),
          formatMetric(c.pollutants.pm10),
          formatMetric(c.pollutants.no2),
          formatMetric(c.pollutants.o3),
          formatMetric(c.weather.temperature),
          c.observedTime,
        ]
          .map(esc)
          .join(',')
      );
    });
    lines.push('');
  }

  if (narrative) {
    lines.push([esc('AI Executive Summary'), esc(narrative.executiveSummary)].join(','));
    narrative.recommendations.forEach((r, idx) => {
      lines.push([esc(`Recommendation ${idx + 1}`), esc(r)].join(','));
    });
    lines.push([esc('Data Limitations'), esc(narrative.limitationsStatement)].join(','));
  }

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = primaryData.location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `vayusense-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadReportPdf(payload: ReportPayload) {
  const { reportType, primaryData, comparisonCities, narrative } = payload;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  };

  const addWrappedText = (text: string, fontSize: number, color: [number, number, number] = [30, 41, 59], lineGap = 14) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(text, contentWidth);
    wrapped.forEach((line: string) => {
      ensureSpace(lineGap);
      doc.text(line, margin, y);
      y += lineGap;
    });
  };

  // Header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 86, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('VayuSense Environmental Intelligence Report', margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${reportType}  |  Location: ${primaryData.location.name} (${primaryData.location.lat.toFixed(3)}, ${primaryData.location.lon.toFixed(3)})`,
    margin,
    56
  );
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Scale: US EPA AQI (Modelled CAMS)`, margin, 72);

  y = 112;

  // Current Air Quality Summary Box
  const cat = getAqiCategory(primaryData.current.usAqi);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 88, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('CURRENT ATMOSPHERIC SNAPSHOT', margin + 14, y + 20);

  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${primaryData.current.usAqi !== null ? Math.round(primaryData.current.usAqi) : '--'} AQI`,
    margin + 14,
    y + 52
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(cat.label, margin + 14, y + 72);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `PM2.5: ${formatMetric(primaryData.current.pm25)} ug/m3   |   PM10: ${formatMetric(primaryData.current.pm10)} ug/m3   |   NO2: ${formatMetric(primaryData.current.no2)} ug/m3`,
    margin + 190,
    y + 38
  );
  doc.text(
    `O3: ${formatMetric(primaryData.current.o3)} ug/m3   |   SO2: ${formatMetric(primaryData.current.so2)} ug/m3   |   CO: ${formatMetric(primaryData.current.co)} ug/m3`,
    margin + 190,
    y + 54
  );
  doc.text(
    `Weather: ${formatMetric(primaryData.weather.temperature)} C, ${formatMetric(primaryData.weather.humidity, 0)}% RH, Wind ${formatMetric(primaryData.weather.windSpeed)} km/h (${primaryData.weather.conditionLabel})`,
    margin + 190,
    y + 70
  );

  y += 110;

  // Daily Chart Vector Bars (Visual chart inside PDF)
  const chartDays = primaryData.daily.slice(-7);
  if (chartDays.length > 0) {
    ensureSpace(120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('DAILY AQI TRAJECTORY (RECENT & FORECAST)', margin, y);
    y += 14;

    const chartHeight = 72;
    const maxVal = Math.max(150, ...chartDays.map((d) => d.avgAqi || 0));
    const barSlot = contentWidth / chartDays.length;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + chartHeight, margin + contentWidth, y + chartHeight);

    chartDays.forEach((d, idx) => {
      const val = d.avgAqi ?? 0;
      const barH = Math.max(4, (val / maxVal) * (chartHeight - 16));
      const bx = margin + idx * barSlot + barSlot * 0.2;
      const bw = barSlot * 0.6;
      const by = y + chartHeight - barH;
      if (d.isForecast) {
        doc.setFillColor(14, 165, 233);
      } else {
        doc.setFillColor(51, 65, 85);
      }
      doc.rect(bx, by, bw, barH, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(String(Math.round(val)), bx + bw / 2, by - 4, { align: 'center' });
      doc.text(d.date.slice(5) + (d.isForecast ? '*' : ''), bx + bw / 2, y + chartHeight + 11, { align: 'center' });
    });

    y += chartHeight + 28;
  }

  // AI Narrative if available
  if (narrative) {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('AI-GENERATED ENVIRONMENTAL ANALYSIS', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    addWrappedText(narrative.executiveSummary, 10, [51, 65, 85], 14);
    y += 6;

    if (narrative.keyFindings.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      ensureSpace(18);
      doc.text('Key Findings:', margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      narrative.keyFindings.forEach((f) => addWrappedText(`• ${f}`, 9.5, [51, 65, 85], 13));
      y += 6;
    }

    if (narrative.recommendations.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      ensureSpace(18);
      doc.text('Recommended Actions:', margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      narrative.recommendations.forEach((r) => addWrappedText(`• ${r}`, 9.5, [51, 65, 85], 13));
      y += 8;
    }
  }

  // City Comparison Table if included
  if (comparisonCities.length > 0) {
    ensureSpace(80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('CITY COMPARISON SNAPSHOT', margin, y);
    y += 16;

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('City', margin, y);
    doc.text('US AQI', margin + 150, y);
    doc.text('PM2.5', margin + 215, y);
    doc.text('PM10', margin + 275, y);
    doc.text('Category', margin + 335, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, margin + contentWidth, y);
    y += 12;

    doc.setFont('helvetica', 'normal');
    comparisonCities.slice(0, 8).forEach((c) => {
      ensureSpace(16);
      doc.setTextColor(15, 23, 42);
      doc.text(c.name, margin, y);
      doc.text(c.pollutants.usAqi !== null ? String(Math.round(c.pollutants.usAqi)) : '--', margin + 150, y);
      doc.text(formatMetric(c.pollutants.pm25), margin + 215, y);
      doc.text(formatMetric(c.pollutants.pm10), margin + 275, y);
      doc.text(getAqiCategory(c.pollutants.usAqi).label, margin + 335, y);
      y += 15;
    });
    y += 8;
  }

  // Source & Limitations Footer
  ensureSpace(60);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, margin + contentWidth, y);
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DATA SOURCE & LIMITATIONS', margin, y);
  y += 13;
  doc.setFont('helvetica', 'normal');
  addWrappedText(
    narrative?.limitationsStatement ||
      `${primaryData.provenance.airQualitySource}. ${primaryData.provenance.notes} This report is for informational planning and does not constitute medical advice.`,
    8.5,
    [100, 116, 139],
    12
  );

  const safeName = primaryData.location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`vayusense-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

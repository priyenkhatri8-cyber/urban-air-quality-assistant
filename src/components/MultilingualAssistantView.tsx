import React, { useState } from 'react';
import { Languages, RefreshCw, Send, Sparkles } from 'lucide-react';
import type { AirQualityResponse, CityReadingSummary, LanguageCode } from '../types/environment';
import { sendMultilingualChat } from '../services/api';
import { MULTILINGUAL_SAMPLE_PROMPTS } from '../utils/i18n';

interface MultilingualAssistantViewProps {
  language: LanguageCode;
  activeCityData: AirQualityResponse | null;
  cityReadings: CityReadingSummary[];
  onChangeLanguage: (lang: LanguageCode) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  extraCities?: string[];
}

export function MultilingualAssistantView({
  language,
  activeCityData,
  cityReadings,
  onChangeLanguage,
}: MultilingualAssistantViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await sendMultilingualChat({
        message: text,
        language,
        activeCityData,
        contextCities: cityReadings,
        history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString(),
          extraCities: res.fetchedExtraCities,
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Unable to reach Multilingual AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Multilingual Environmental AI Assistant
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Grounded in live telemetry for {activeCityData?.location.name || 'monitored cities'} · Supports English, ગુજરાતી, and हिन्दी
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <Languages className="h-3.5 w-3.5 text-slate-500 mx-1.5" />
            {[
              { id: 'en', label: 'English' },
              { id: 'gu', label: 'ગુજરાતી' },
              { id: 'hi', label: 'हिन्दी' },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onChangeLanguage(l.id as LanguageCode)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                  language === l.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sample Questions */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Sample Questions ({language === 'gu' ? 'ગુજરાતી' : language === 'hi' ? 'हिन्दी' : 'English'}):
          </div>
          <div className="flex flex-wrap gap-2">
            {MULTILINGUAL_SAMPLE_PROMPTS[language].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                disabled={loading}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:border-cyan-500 transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Viewport */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[460px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Ask about AQI, PM2.5, safe outdoor exercise, or city comparisons
              </div>
              <p>
                Questions are answered using live Open-Meteo atmospheric readings loaded in VayuSense. Try clicking any sample prompt above or typing in English, Gujarati, or Hindi.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950'
                    : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className="mt-1.5 text-[10px] opacity-70 font-mono">
                  {msg.timestamp}
                  {msg.extraCities && msg.extraCities.length > 0
                    ? ` · Live data fetched for ${msg.extraCities.join(', ')}`
                    : ''}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-slate-500 inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                Querying live telemetry & generating response...
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="border-t border-slate-200 dark:border-slate-800 p-3 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              language === 'gu'
                ? 'અમદાવાદના AQI અથવા હવા વિશે પૂછો...'
                : language === 'hi'
                ? 'अहमदाबाद के AQI या बाहर जाने के बारे में पूछें...'
                : 'Ask about city AQI, health safety, or compare cities...'
            }
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

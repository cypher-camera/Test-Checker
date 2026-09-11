import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, ShieldCheck, Sparkles, BookOpen, ChevronDown, CheckCircle2, Server } from 'lucide-react';
import { SAMPLE_PAPERS, SamplePaper } from '../utils/samplePapers';

interface HeaderProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  onLoadSample: (sample: SamplePaper) => void;
}

export const Header: React.FC<HeaderProps> = ({
  apiKey,
  onApiKeyChange,
  onLoadSample,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [showSamplesMenu, setShowSamplesMenu] = useState(false);
  const [isKeyInputOpen, setIsKeyInputOpen] = useState(false);
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null);

  // Check if server has an active GEMINI_API_KEY environment variable
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.hasEnvKey === 'boolean') {
          setHasServerKey(data.hasEnvKey);
        }
      })
      .catch(() => setHasServerKey(false));
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & App Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-200 shrink-0">
            <span className="font-handwriting text-2xl font-bold leading-none select-none">A+</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                AI Auto Test Paper Evaluator
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                Visual Annotator
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden md:block truncate">
              Multimodal Vision OCR • Step-wise Grading • Teacher Pen Markings
            </p>
          </div>
        </div>

        {/* Action Controls & Key Management */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Demo Samples Dropdown */}
          <div className="relative">
            <button
              id="samples-menu-button"
              type="button"
              onClick={() => setShowSamplesMenu(!showSamplesMenu)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Load Sample Exam</span>
              <span className="sm:hidden">Samples</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showSamplesMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSamplesMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Instant Realistic Tests
                    </p>
                  </div>
                  {SAMPLE_PAPERS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        onLoadSample(sample);
                        setShowSamplesMenu(false);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start space-x-2.5 text-xs sm:text-sm text-slate-800"
                    >
                      <div className="w-6 h-6 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {sample.subject[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">{sample.title}</p>
                        <p className="text-xs text-slate-500">
                          {sample.subject} • Max Marks: {sample.totalMarks}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* AI Engine Status Badge */}
          <div
            className="hidden lg:flex items-center space-x-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700"
            title="Optimized Gemini Engine with auto-failover against traffic spikes"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">
              Gemini Vision Engine
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              Auto-Failover
            </span>
          </div>

          {/* API Key Management */}
          <div className="relative">
            <button
              id="api-key-toggle-button"
              type="button"
              onClick={() => setIsKeyInputOpen(!isKeyInputOpen)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                apiKey.trim()
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : hasServerKey
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
              title="Google AI Studio API Key Configuration"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {apiKey.trim()
                  ? 'Custom Key Active'
                  : hasServerKey
                  ? 'Server Key Connected'
                  : 'Set Gemini Key'}
              </span>
              <span className="sm:hidden">Key</span>
              {apiKey.trim() ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              ) : hasServerKey ? (
                <Server className="w-3 h-3 text-slate-500" />
              ) : null}
            </button>

            {isKeyInputOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsKeyInputOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Google AI Studio API Key
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Local Storage
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    Provide your Gemini API key from{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Google AI Studio
                    </a>
                    . Saved privately in your browser.
                  </p>

                  <div className="relative flex items-center mb-3">
                    <input
                      id="gemini-api-key-input"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => onApiKeyChange(e.target.value)}
                      placeholder={hasServerKey ? 'Using server key (or enter custom key)' : 'AIzaSy...'}
                      className="w-full text-xs font-mono px-3 py-2 pr-16 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 px-2 py-1 text-slate-400 hover:text-slate-600 text-xs"
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {hasServerKey && !apiKey.trim()
                        ? '✓ Environment key active'
                        : apiKey.trim()
                        ? '✓ Stored in browser'
                        : 'Key needed to run evaluation'}
                    </span>
                    {apiKey && (
                      <button
                        type="button"
                        onClick={() => onApiKeyChange('')}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Clear Key
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

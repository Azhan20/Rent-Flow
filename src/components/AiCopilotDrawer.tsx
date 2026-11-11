import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Search,
  Bot,
  User,
  ExternalLink,
  Loader2,
  HelpCircle,
  TrendingUp,
  FileText,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; url: string }[];
  timestamp: string;
}

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({ isOpen, onClose }) => {
  const { currentOrg, equipmentList, bookings, maintenanceOrders } = useRentFlow();

  const [activeTab, setActiveTab] = useState<'chat' | 'search'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      role: 'assistant',
      content: `Hello! I am **RentFlow Operations Copilot** for ${currentOrg.name}.\n\nI can help you with:\n- Rental duration rate calculations and deposit advice\n- Live equipment market intelligence via **Google Search Grounding**\n- Machinery telematics & preventive service scheduling\n- Custom rental agreement terms & damage settlement estimates.\n\nHow can I assist your dispatch team today?`,
      timestamp: 'Just now',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [marketSearchResults, setMarketSearchResults] = useState<{
    answer: string;
    sources: { title: string; url: string }[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            organization: currentOrg.name,
            totalFleetCount: equipmentList.length,
            activeRentalsCount: bookings.filter((b) => b.status === 'CHECKED_OUT').length,
            activeMaintenanceCount: maintenanceOrders.filter((m) => m.status === 'IN_PROGRESS').length,
          },
        }),
      });

      const data = await response.json();
      const reply = data.reply || data.fallbackText || 'I am ready to help with your rental fleet operations.';

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'RentFlow Copilot is ready. (Check that your GEMINI_API_KEY is configured in Settings > Secrets).',
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunMarketResearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!marketSearchQuery.trim() || loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/gemini/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: marketSearchQuery,
          category: 'Commercial Industrial Rental Equipment',
        }),
      });

      const data = await response.json();
      setMarketSearchResults({
        answer: data.answer,
        sources: data.sources || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'Recommend optimal weekly rate for a 5-ton mini excavator',
    'Draft a standard equipment damage waiver clause',
    'What preventive maintenance is needed at 1,000 engine hours?',
    'Explain how to calculate refundable security deposits',
  ];

  const marketPresets = [
    'CAT 305.5 Mini Excavator daily and weekly rental rates in Texas',
    'Genie S-65 Boom Lift competitive hire benchmark',
    'Multiquip 70kVA Diesel Generator rental pricing standards',
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-xs">RentFlow Copilot</span>
              <span className="rounded bg-purple-100 text-purple-700 px-1.5 py-0.2 text-[9px] font-bold border border-purple-200">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Fleet Operations & Market Search</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 rounded-lg py-1.5 transition-colors ${
            activeTab === 'chat'
              ? 'bg-white text-purple-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Operations Chatbot
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`flex-1 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'search'
              ? 'bg-white text-blue-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="h-3 w-3" />
          <span>Google Search Grounding</span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'chat' ? (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-md bg-purple-600 text-white flex items-center justify-center shrink-0 text-[10px]">
                    RF
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <span
                    className={`block mt-1 text-[9px] ${
                      m.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span>RentFlow Copilot is analyzing fleet parameters...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Chips */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/70 overflow-x-auto flex gap-1.5 scrollbar-none">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p)}
                className="shrink-0 rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-[10px] font-medium text-purple-700 hover:bg-purple-50 transition-colors shadow-2xs"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about rates, availability, maintenance..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-xl bg-purple-600 p-2 text-white hover:bg-purple-700 transition-colors disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Google Search Grounding Mode */
        <div className="flex-1 flex flex-col justify-between overflow-y-auto p-4 space-y-4 text-xs">
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">
              Live Commercial Equipment Market Intelligence
            </h3>
            <p className="text-slate-500 text-xs">
              Directly grounded with Google Search data. Look up live regional rental rates, machinery specifications, and industry benchmarks.
            </p>

            <form onSubmit={handleRunMarketResearch} className="space-y-2 pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. CAT 305 mini excavator rental price Texas"
                  value={marketSearchQuery}
                  onChange={(e) => setMarketSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={!marketSearchQuery.trim() || loading}
                className="w-full rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Searching Google Grounding...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    <span>Run Market Intelligence Search</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Popular Searches:
              </span>
              <div className="flex flex-col gap-1.5">
                {marketPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMarketSearchQuery(preset);
                      // Trigger search immediately
                      setTimeout(() => handleRunMarketResearch(), 100);
                    }}
                    className="text-left rounded-lg border border-slate-200 p-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search Grounding Results Card */}
          {marketSearchResults && (
            <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-blue-900 text-xs">
                  Grounded Market Analysis
                </span>
                <span className="rounded bg-blue-50 text-blue-700 px-1.5 py-0.2 text-[9px] font-bold">
                  gemini-3.8-flash + googleSearch
                </span>
              </div>

              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-xs">
                {marketSearchResults.answer}
              </div>

              {marketSearchResults.sources.length > 0 && (
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Grounded Web Sources ({marketSearchResults.sources.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {marketSearchResults.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 px-2 py-0.5 text-[10px] text-slate-600 transition-colors"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        <span className="truncate max-w-[180px]">{s.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Send,
  X,
  Maximize2,
  Trash2,
  CheckCircle2,
  FileSearch,
  Scale,
  Layers,
  ChevronRight,
  MessageSquareText,
} from 'lucide-react';
import type {
  AnalysisRun,
  CaseRecord,
  ChatMessage,
  ChatModelTier,
  ChatRolePersona,
  InvoiceRecord,
} from '../types/index.ts';

interface FloatingAssistantPopupProps {
  caseRecord?: CaseRecord;
  invoices: InvoiceRecord[];
  analysis: AnalysisRun | null;
  chatHistory: ChatMessage[];
  onSendMessage: (payload: {
    message: string;
    modelTier: ChatModelTier;
    rolePersona: ChatRolePersona;
  }) => Promise<void>;
  onClearChat: () => Promise<void>;
  isSending: boolean;
  onOpenFullChatbot: () => void;
}

const PERSONA_OPTIONS: {
  id: ChatRolePersona;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'msme_evidence_analyst',
    shortLabel: 'Evidence Analyst',
    icon: FileSearch,
  },
  {
    id: 'statutory_compliance_specialist',
    shortLabel: '§§ 15–16 Specialist',
    icon: Scale,
  },
  {
    id: 'monorepo_cloud_architect',
    shortLabel: 'Edge Architect',
    icon: Layers,
  },
];

const MODEL_OPTIONS: { id: ChatModelTier; label: string }[] = [
  { id: 'gemini-3.8-flash', label: '3.8 Flash' },
  { id: 'gemini-4-argon', label: '4 Argon' },
  { id: 'gemini-3.1-flash-lite', label: '3.1 Lite' },
];

const QUICK_PROMPTS = [
  'Summarize overdue principal & Section 16 statutory interest',
  'Why is INV-2023-102 flagged in the evidence chain?',
  'Explain the 45-day MSMED Section 15 cap & monthly rests',
  'Draft MSEFC Section 18 Samadhaan filing readiness summary',
];

export const FloatingAssistantPopup: React.FC<FloatingAssistantPopupProps> = ({
  caseRecord,
  invoices,
  analysis,
  chatHistory,
  onSendMessage,
  onClearChat,
  isSending,
  onOpenFullChatbot,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGreetingDismissed, setIsGreetingDismissed] = useState(false);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<ChatModelTier>('gemini-3.8-flash');
  const [selectedPersona, setSelectedPersona] = useState<ChatRolePersona>(
    'msme_evidence_analyst'
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isSending, isOpen]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText ?? input).trim();
    if (!textToSend || isSending) return;
    if (!customText) setInput('');
    if (!isOpen) setIsOpen(true);
    await onSendMessage({
      message: textToSend,
      modelTier: selectedModel,
      rolePersona: selectedPersona,
    });
  };

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const totalClaimable =
    (analysis?.msmedResult?.totalClaimAmountPaise
      ? Number(analysis.msmedResult.totalClaimAmountPaise)
      : invoices.reduce(
          (acc, inv) =>
            acc + Math.max(0, Number(inv.totalAmountPaise) - Number(inv.paidAmountPaise)),
          0
        )) / 100;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none"
      data-testid="floating-assistant-container"
    >
      {/* Expanded Popup Assistant Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="assistant-popup-window"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            data-testid="floating-ai-assistant-popup"
            className="pointer-events-auto w-[calc(100vw-2rem)] sm:w-[410px] h-[570px] max-h-[calc(100vh-7rem)] rounded-[2rem] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden"
          >
            {/* Top Gradient Header */}
            <div className="relative px-5 py-4 bg-gradient-to-r from-indigo-950 via-indigo-900 to-zinc-900 text-white border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 shadow-inner">
                    <Bot className="w-5 h-5 text-indigo-300" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold tracking-tight text-white">
                        DuesGuard AI Assistant
                      </h3>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                    </div>
                    <p className="text-[11px] text-indigo-200/80 truncate max-w-[200px]">
                      {caseRecord
                        ? `${caseRecord.id.toUpperCase()} · ${formatINR(totalClaimable)} Claim`
                        : 'MSMED §§ 15–16 Case Intelligence'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenFullChatbot();
                    }}
                    title="Expand to full workspace view"
                    className="p-2 rounded-xl text-indigo-200/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onClearChat}
                    title="Reset conversation"
                    className="p-2 rounded-xl text-indigo-200/80 hover:text-rose-300 hover:bg-white/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    data-testid="close-floating-assistant-btn"
                    title="Minimize assistant"
                    className="p-2 rounded-xl text-indigo-200/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Compact Persona & Model Selector Bar */}
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {PERSONA_OPTIONS.map((persona) => {
                    const Icon = persona.icon;
                    const active = selectedPersona === persona.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => setSelectedPersona(persona.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                          active
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'bg-white/5 text-indigo-200/75 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {persona.shortLabel}
                      </button>
                    );
                  })}
                </div>

                <select
                  aria-label="Select AI Model Tier"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ChatModelTier)}
                  className="bg-white/10 text-indigo-100 text-[10px] font-mono font-semibold px-2 py-1 rounded-lg border border-white/15 focus:outline-none cursor-pointer"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scrollable Messages & Greeting Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-zinc-50/60 dark:bg-zinc-950/50">
              {/* Persistent Assistant Greeting Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-zinc-50 dark:from-indigo-950/40 dark:via-zinc-900/90 dark:to-zinc-900 border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      How can I help you today?
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      I have live context on{' '}
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {invoices.length} invoices
                      </span>{' '}
                      for{' '}
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {caseRecord?.buyerName ?? 'your active buyer'}
                      </span>
                      . Pick a question or ask anything below:
                    </p>
                  </div>
                </div>

                {/* Quick Starter Prompts */}
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleSend(prompt)}
                      className="group flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl bg-white dark:bg-zinc-900/90 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 border border-zinc-200/80 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-all disabled:opacity-50"
                    >
                      <span className="truncate">{prompt}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation Thread */}
              {chatHistory.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-br-xs'
                          : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/10 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-line space-y-1">
                        {msg.text.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, idx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <strong
                                key={idx}
                                className={
                                  isUser
                                    ? 'font-bold text-white'
                                    : 'font-bold text-zinc-900 dark:text-white'
                                }
                              >
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          if (part.startsWith('`') && part.endsWith('`')) {
                            return (
                              <code
                                key={idx}
                                className={`px-1 py-0.5 rounded font-mono text-[11px] ${
                                  isUser
                                    ? 'bg-indigo-700 text-indigo-100'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 border border-zinc-200/80 dark:border-white/10'
                                }`}
                              >
                                {part.slice(1, -1)}
                              </code>
                            );
                          }
                          return <React.Fragment key={idx}>{part}</React.Fragment>;
                        })}
                      </div>

                      {!isUser && msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-white/10 flex flex-wrap gap-1">
                          {msg.citations.map((cite, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/20 text-[10px] font-mono"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {cite}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                      {isUser ? 'You' : 'DuesGuard AI'}
                    </span>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 rounded-2xl px-3.5 py-2.5 w-fit shadow-xs">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:300ms]" />
                  </span>
                  <span className="font-medium text-[11px]">
                    Analyzing case ledger &amp; MSMED §§ 15–16...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-white/10 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                data-testid="floating-assistant-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask how I can help with your case..."
                disabled={isSending}
                className="flex-1 bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-xs rounded-xl px-3.5 py-2.5 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none transition-all"
              />
              <button
                type="submit"
                data-testid="floating-assistant-send-btn"
                disabled={!input.trim() || isSending}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-Right Launcher Row: "How can I help you today?" Bubble + Assistant Avatar Orb */}
      <div className="pointer-events-auto flex items-center gap-3">
        <AnimatePresence>
          {!isOpen && !isGreetingDismissed && (
            <motion.div
              key="assistant-greeting-bubble"
              initial={{ opacity: 0, x: 16, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              data-testid="floating-assistant-greeting-bubble"
              className="relative group flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-indigo-200/80 dark:border-indigo-500/30 shadow-[0_12px_36px_rgba(79,70,229,0.18)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)] cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-400 transition-all"
              onClick={() => setIsOpen(true)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
                <MessageSquareText className="w-4 h-4" />
              </div>
              <div className="pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    DuesGuard AI Assistant
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white leading-snug">
                  How can I help you today?
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss greeting bubble"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGreetingDismissed(true);
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Glowing Assistant Orb Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsOpen((prev) => !prev)}
          data-testid="floating-ai-assistant-btn"
          aria-label="Toggle AI Assistant Popup"
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-[0_12px_32px_rgba(79,70,229,0.45)] hover:shadow-[0_16px_40px_rgba(79,70,229,0.65)] border border-white/25 cursor-pointer transition-shadow"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              <Bot className="w-6 h-6" />
              <Sparkles className="w-3.5 h-3.5 text-amber-200 absolute top-2.5 right-2.5" />
            </>
          )}
          {/* Online status badge */}
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-zinc-950" />
        </motion.button>
      </div>
    </div>
  );
};

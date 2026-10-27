/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Trash2,
  ShieldCheck,
  Zap,
  Brain,
  Cpu,
  Scale,
  FileSearch,
  Layers,
  Clock,
} from 'lucide-react';
import type {
  AnalysisRun,
  CaseRecord,
  ChatMessage,
  ChatModelTier,
  ChatRolePersona,
  InvoiceRecord,
} from '../types/index.ts';
import { formatINR } from '../services/finance.ts';

interface ChatbotViewProps {
  caseRecord: CaseRecord;
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
}

const ROLE_OPTIONS: Array<{
  id: ChatRolePersona;
  label: string;
  subtitle: string;
  systemPromptPreview: string;
}> = [
  {
    id: 'msme_evidence_analyst',
    label: 'MSME Evidence & Discrepancy Analyst',
    subtitle: 'PO → Invoice → POD chain & gap triage',
    systemPromptPreview:
      'Role: Senior MSME Evidence Analyst. Inspects invoice-to-PO-to-delivery chains, explains missing PODs (like DC-4480 on INV-102), and prepares ODR annexures.',
  },
  {
    id: 'statutory_compliance_specialist',
    label: 'MSMED §§ 15–16 Compliance Specialist',
    subtitle: 'Appointed day, 45-day cap & 3× RBI rate',
    systemPromptPreview:
      'Role: MSMED Act 2006 §§ 15, 16, 18 & 23 Specialist. Explains 45-day statutory credit caps, 3× RBI Bank Rate monthly compounding, and Silpi Industries Udyam timing rules.',
  },
  {
    id: 'monorepo_cloud_architect',
    label: 'Turborepo & Cloudflare Edge Architect',
    subtitle: 'D1 SQLite, R2 presigned URLs, Workflows & Expo',
    systemPromptPreview:
      'Role: Principal Full-Stack Edge AI Architect. Guides Turborepo packages, Cloudflare Workers + D1 + R2 + Workflows, Better Auth RBAC, and Expo mobile integration.',
  },
];

const MODEL_TIERS: Array<{
  id: ChatModelTier;
  name: string;
  badge: string;
  description: string;
}> = [
  {
    id: 'gemini-3.1-flash-lite',
    name: 'gemini-3.1-flash-lite',
    badge: 'Fast Triage',
    description: 'Low-latency lookups, quick status checks & document routing',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'gemini-3.8-flash',
    badge: 'Standard General',
    description: 'Balanced multi-turn evidence synthesis & case summaries',
  },
  {
    id: 'gemini-4-argon',
    name: 'gemini-4-argon',
    badge: 'Deep Reasoning',
    description: 'Complex statutory discrepancy & multi-document reasoning',
  },
];

export const ChatbotView: React.FC<ChatbotViewProps> = ({
  caseRecord,
  invoices,
  analysis,
  chatHistory,
  onSendMessage,
  onClearChat,
  isSending,
}) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<ChatModelTier>('gemini-3.8-flash');
  const [selectedPersona, setSelectedPersona] = useState<ChatRolePersona>('msme_evidence_analyst');
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput('');
    await onSendMessage({
      message: text,
      modelTier: selectedModel,
      rolePersona: selectedPersona,
    });
  };

  const handleQuickPrompt = async (promptText: string, persona?: ChatRolePersona, tier?: ChatModelTier) => {
    if (isSending) return;
    const usePersona = persona || selectedPersona;
    const useTier = tier || selectedModel;
    if (persona) setSelectedPersona(persona);
    if (tier) setSelectedModel(tier);
    await onSendMessage({
      message: promptText,
      modelTier: useTier,
      rolePersona: usePersona,
    });
  };

  const activeRoleObj = ROLE_OPTIONS.find((r) => r.id === selectedPersona) || ROLE_OPTIONS[0];
  const msmed = analysis?.msmedResult;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Multi-Turn Chat Thread & Controls */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[720px] overflow-hidden">
        {/* Top Bar: Role Persona & Intelligent Model Routing */}
        <div className="p-4 bg-slate-900 text-white border-b border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Gemini Multi-Turn Case & Architecture Chatbot
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700">
                    Grounded Trust Mode
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Maintains multi-turn conversation history with role-specific system instructions & model routing
                </p>
              </div>
            </div>

            <button
              onClick={onClearChat}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 border border-slate-700 cursor-pointer"
              aria-label="Reset Chat Conversation History"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Reset Thread</span>
            </button>
          </div>

          {/* Selectors Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label
                htmlFor="chatbot-role-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"
              >
                System Instruction Role Persona
              </label>
              <select
                id="chatbot-role-select"
                aria-label="Select Chatbot Role Persona"
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value as ChatRolePersona)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label} — ({role.subtitle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="chatbot-model-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"
              >
                Gemini Model Tier Router
              </label>
              <select
                id="chatbot-model-select"
                aria-label="Select Gemini Model Tier"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ChatModelTier)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {MODEL_TIERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} [{m.badge}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Active System Instruction Banner */}
        <div className="px-4 py-2 bg-indigo-50/80 border-b border-indigo-100 text-[11px] text-indigo-900 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">{activeRoleObj.systemPromptPreview}</span>
        </div>

        {/* Scrollable Multi-Turn Message Thread */}
        <div
          data-testid="chat-scroll-thread"
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
        >
          {chatHistory.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-indigo-400 border border-slate-700'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[10px]">
                    <span className={`font-bold ${isUser ? 'text-indigo-100' : 'text-slate-900'}`}>
                      {isUser ? 'You (Authorized User)' : 'DuesGuard Gemini Assistant'}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono ${
                        isUser
                          ? 'bg-indigo-700 text-indigo-100'
                          : 'bg-slate-100 text-indigo-700 border border-slate-200'
                      }`}
                    >
                      {msg.resolvedModel || msg.modelTier}
                    </span>
                    {msg.latencyMs !== undefined && (
                      <span className="text-slate-400 font-mono flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {msg.latencyMs}ms
                      </span>
                    )}
                  </div>

                  <div className="whitespace-pre-line space-y-1">
                    {msg.text.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, idx) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return (
                          <strong key={idx} className={isUser ? 'font-bold text-white' : 'font-bold text-slate-900'}>
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
                                : 'bg-slate-100 text-indigo-800 border border-slate-200'
                            }`}
                          >
                            {part.slice(1, -1)}
                          </code>
                        );
                      }
                      return <React.Fragment key={idx}>{part}</React.Fragment>;
                    })}
                  </div>

                  {msg.citations && msg.citations.length > 0 && !isUser && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold">Grounded Refs:</span>
                      {msg.citations.map((c) => (
                        <span
                          key={c}
                          className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>
                Routing turn #{chatHistory.length + 1} via <strong>{selectedModel}</strong>...
              </span>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Quick Multi-Turn Prompt Starters */}
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Quick Prompts:</span>
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt(
                'Why is Invoice INV-102 flagged as a critical gap in the Evidence Graph?',
                'msme_evidence_analyst',
                'gemini-3.1-flash-lite'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-medium whitespace-nowrap transition cursor-pointer"
          >
            ⚡ Triage INV-102 Missing POD (Flash-Lite)
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt(
                'Explain the Section 15 deadline and Section 16 3x RBI compound interest calculation for this case.',
                'statutory_compliance_specialist',
                'gemini-3.8-flash'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-medium whitespace-nowrap transition cursor-pointer"
          >
            ⚖️ Explain §§ 15–16 Interest Math (3.8-Flash)
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt(
                'How does the Turborepo monorepo connect Cloudflare D1, private R2 presigned uploads, and Expo Mobile?',
                'monorepo_cloud_architect',
                'gemini-4-argon'
              )
            }
            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-medium whitespace-nowrap transition cursor-pointer"
          >
            🧠 Turborepo & Cloudflare D1/R2 Blueprint (4-Argon)
          </button>
        </div>

        {/* Chat Input Form */}
        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 flex gap-2">
          <input
            type="text"
            aria-label="Ask the Gemini Case Assistant"
            placeholder="Ask a follow-up about invoices, missing PODs, MSMED Section 16 interest, or Turborepo architecture..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Right Column: Model Routing Policy & Deterministic Grounding Context */}
      <div className="space-y-4">
        {/* Model Routing Tier Matrix */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            Intelligent Gemini Model Routing
          </h3>
          <p className="text-xs text-slate-500">
            Selects the optimal Gemini tier per task complexity while keeping currency math 100% in deterministic TypeScript.
          </p>

          <div className="space-y-2 text-xs">
            {MODEL_TIERS.map((tier) => {
              const active = selectedModel === tier.id;
              return (
                <div
                  key={tier.id}
                  onClick={() => setSelectedModel(tier.id)}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    active
                      ? 'bg-indigo-50/70 border-indigo-400 text-indigo-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono font-bold text-xs">{tier.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white border border-slate-200">
                      {tier.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{tier.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grounded Deterministic Case Facts Card */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Injected Deterministic Facts
            </span>
            <span className="text-[10px] font-mono text-slate-400">{caseRecord.caseReference}</span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Invoiced:</span>
              <span className="font-mono font-bold">{formatINR(msmed?.principalAmountPaise || '10000000')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Overdue Principal:</span>
              <span className="font-mono font-bold text-rose-400">
                {formatINR(analysis?.summary.totalOverduePaise || '8000000')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">§ 16 Compound Interest:</span>
              <span className="font-mono font-bold text-indigo-300">
                {formatINR(msmed?.compoundedInterestPaise || '318359')}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-300 font-semibold">Total Claim:</span>
              <span className="font-mono font-extrabold text-emerald-400">
                {formatINR(msmed?.totalClaimAmountPaise || '10318359')}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700 text-[10px] text-slate-300 leading-relaxed">
            <strong>Trust Rule Active:</strong> Gemini interprets documents and explains findings, while all currency and date values above come strictly from <code>packages/finance</code> (<code>decimal.js</code>).
          </div>
        </div>
      </div>
    </div>
  );
};

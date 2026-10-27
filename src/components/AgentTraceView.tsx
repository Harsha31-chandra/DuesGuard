/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  GitMerge,
  Play,
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertTriangle,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { AgentEvent, AnalysisRun } from '../types/index.ts';

interface AgentTraceViewProps {
  analysis: AnalysisRun | null;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  onNavigateTab: (tabId: string) => void;
}

export const AgentTraceView: React.FC<AgentTraceViewProps> = ({
  analysis,
  onRunAnalysis,
  isAnalyzing,
  onNavigateTab,
}) => {
  const events: AgentEvent[] = analysis?.agentEvents || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              LangGraph Multi-Agent Execution Trace & State Machine
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              StateGraph Architecture
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Coordinates specialized AI agent nodes and deterministic computation modules with durable checkpoint persistence.
          </p>
        </div>

        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Play className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Executing Pipeline...' : 'Re-Run Multi-Agent Graph'}</span>
        </button>
      </div>

      {/* LangGraph Checkpoint Banner */}
      <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 text-amber-950 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
            <PauseCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-900">
              LangGraph Checkpoint Triggered: Human Review Gate Paused
            </h3>
            <p className="text-xs text-amber-800 mt-0.5">
              The analysis graph has paused execution after node <code>calculateFinances</code>. In accordance with legal engineering trust rules, report generation is halted until an authorized reviewer signs off on findings.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('review')}
          className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
        >
          <span>Open Review & Approval Gate</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Visual Pipeline Stages */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-lg">
        <h3 className="font-bold text-sm text-slate-300 mb-6 flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-indigo-400" />
          StateGraph Node Sequence & Interruption Boundary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {[
            {
              id: 'classifyDocuments',
              title: '1. Classify Documents',
              type: 'AI Vision / Heuristic',
              desc: 'Classifies uploaded PDFs into Invoice, PO, POD, and Udyam categories.',
              status: 'completed',
            },
            {
              id: 'extractDocuments',
              title: '2. Multimodal Extraction',
              type: 'Gemini 3.8 Flash',
              desc: 'Extracts structured invoice and transaction fields with page provenance.',
              status: 'completed',
            },
            {
              id: 'validateInvoices',
              title: '3. Validate Invoices',
              type: 'Deterministic Engine',
              desc: 'Detects duplicates, checks numbering, validates 18% GST and PO references.',
              status: 'completed',
            },
            {
              id: 'verifyMsmeRegistration',
              title: '4. MSME & GSTIN Check',
              type: 'Statutory Engine',
              desc: 'Silpi Industries timing check, classification eligibility, Mod-36 checksum.',
              status: 'completed',
            },
            {
              id: 'reconcileEvidence',
              title: '5. Reconcile Evidence',
              type: 'Graph Agent',
              desc: 'Traces PO -> Invoice -> Delivery -> Payment chain of custody.',
              status: 'completed',
            },
            {
              id: 'verifyEvidence',
              title: '6. Evidence Gap Audit',
              type: 'Audit Agent',
              desc: 'Flags missing delivery challans, unsigned receipts, and unallocated credits.',
              status: 'completed',
            },
            {
              id: 'calculateFinances',
              title: '7. MSMED Finance Engine',
              type: 'Pure Decimal.js',
              desc: 'Calculates Section 15 deadlines and Section 16 monthly compound interest.',
              status: 'completed',
            },
            {
              id: 'checkpointForReview',
              title: '8. Review Checkpoint',
              type: 'Human-in-the-Loop Gate',
              desc: 'Pauses execution. Requires authorized reviewer approval before report seal.',
              status: 'paused_for_review',
            },
          ].map((node, i) => (
            <div
              key={node.id}
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                node.status === 'paused_for_review'
                  ? 'bg-amber-950/60 border-amber-600/80 ring-2 ring-amber-500/20'
                  : 'bg-slate-800/80 border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-100">{node.title}</span>
                  {node.status === 'paused_for_review' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-900 text-amber-300 border border-amber-700 font-bold">
                      Paused
                    </span>
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <span className="text-[10px] text-indigo-400 font-medium block mb-2">{node.type}</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">{node.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Event Stream */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Real-Time Agent Execution Event Log</h3>
          <span className="text-xs text-slate-500 font-mono">{events.length} Events Logged</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {events.map((ev, idx) => (
            <div key={idx} className="p-4 hover:bg-slate-50/60 transition flex items-start gap-4">
              <div className="mt-0.5">
                {ev.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : ev.status === 'paused_for_review' ? (
                  <PauseCircle className="w-4 h-4 text-amber-600" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-400" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900 font-mono uppercase text-[11px]">{ev.step}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                      ev.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ev.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto font-mono">{ev.timestamp}</span>
                </div>
                <p className="text-slate-700 leading-relaxed">{ev.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

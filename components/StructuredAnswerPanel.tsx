"use client";

import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  Check,
  ChevronDown,
  Copy,
  FileText,
  ListTree,
  TerminalSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ShimmerBorderCard } from "@/components/ShimmerBorderCard";
import type { LogEntry, Reference } from "@/lib/types";

type ResultTab = "answer" | "sources" | "logs";

interface Props {
  answer: string;
  references: Reference[];
  logs: LogEntry[];
}

const tabs: Array<{ id: ResultTab; label: string; icon: typeof FileText }> = [
  { id: "answer", label: "Answer", icon: FileText },
  { id: "sources", label: "Sources", icon: BookOpenCheck },
  { id: "logs", label: "Process Logs", icon: TerminalSquare },
];

export function StructuredAnswerPanel({ answer, references, logs }: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>("answer");
  const [copied, setCopied] = useState(false);
  const formattedAnswer = answer.replace(/\[(\d+)\](?!\()/g, "[$1](#source-$1)");

  useEffect(() => {
    function syncHash() {
      if (window.location.hash === "#sources") setActiveTab("sources");
      if (window.location.hash === "#logs") setActiveTab("logs");
      if (window.location.hash === "#results") setActiveTab("answer");
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  async function copyAnswer() {
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!answer && !references.length && !logs.length) return null;

  return (
    <section className="results-section" id="results">
      <div className="results-heading">
        <div>
          <span className="technical-label">DOCUMENT INTELLIGENCE / OUTPUT</span>
          <h2>Structured result.</h2>
        </div>
        <span className="result-ready"><Check size={12} /> Grounded in retrieved sources</span>
      </div>

      <div className="result-tabs" role="tablist" aria-label="Result views">
        {tabs.map(({ id, label, icon: Icon }) => {
          const count = id === "sources" ? references.length : id === "logs" ? logs.length : 0;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`result-panel-${id}`}
              className={activeTab === id ? "is-active" : ""}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} />
              {label}
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
      </div>

      <ShimmerBorderCard className="structured-result">
        {activeTab === "answer" && (
          <div id="result-panel-answer" role="tabpanel" className="answer-tab">
            <div className="structured-result-header">
              <div>
                <span className="technical-label">GROUNDED RESPONSE</span>
                <h3>Document answer</h3>
              </div>
              <button type="button" className="copy-button" onClick={() => void copyAnswer()}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="answer-layout">
              <div className="markdown-answer">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h3: ({ children }) => (
                      <h3><ListTree size={17} aria-hidden="true" /> {children}</h3>
                    ),
                    a: ({ children }) => <span className="markdown-citation">{children}</span>,
                    table: ({ children }) => (
                      <div className="markdown-table-wrap"><table>{children}</table></div>
                    ),
                  }}
                >
                  {formattedAnswer}
                </ReactMarkdown>
              </div>
              {references.length > 0 && (
                <aside className="desktop-reference-rail" aria-label="References used">
                  <span className="technical-label">REFERENCES USED</span>
                  {references.map((reference) => (
                    <button
                      type="button"
                      key={reference.referenceNumber}
                      onClick={() => setActiveTab("sources")}
                    >
                      <span>[{reference.referenceNumber}]</span>
                      <strong>{reference.fileName}</strong>
                      <small>Chunk {reference.chunkNumber} · {(reference.similarity * 100).toFixed(0)}%</small>
                    </button>
                  ))}
                </aside>
              )}
            </div>
            {references.length > 0 && (
              <div className="references-used">
                <span>References used</span>
                <div>
                  {references.map((reference) => (
                    <button
                      type="button"
                      key={reference.referenceNumber}
                      onClick={() => setActiveTab("sources")}
                      aria-label={`View reference ${reference.referenceNumber}`}
                    >
                      [{reference.referenceNumber}]
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sources" && (
          <div id="result-panel-sources" role="tabpanel" className="sources-tab" data-anchor="sources">
            <div className="structured-result-header">
              <div>
                <span className="technical-label">RETRIEVED CONTEXT</span>
                <h3>Sources used in the answer</h3>
              </div>
              <span className="reference-total">{references.length} passages</span>
            </div>
            <div className="reference-list">
              {references.map((reference) => (
                <article
                  className="reference-card"
                  id={`source-${reference.referenceNumber}`}
                  key={reference.referenceNumber}
                >
                  <div className="reference-meta">
                    <span>[{String(reference.referenceNumber).padStart(2, "0")}]</span>
                    <span className="used-label"><Check size={9} /> Used in answer</span>
                  </div>
                  <h4><FileText size={14} /> {reference.fileName}</h4>
                  <div className="reference-facts">
                    <span>Chunk {reference.chunkNumber}</span>
                    <span>{(reference.similarity * 100).toFixed(1)}% similarity</span>
                  </div>
                  <p>{reference.snippet}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div id="result-panel-logs" role="tabpanel" className="logs-tab" data-anchor="logs">
            <div className="structured-result-header">
              <div>
                <span className="technical-label">PROCESS TRACE</span>
                <h3>User-friendly activity</h3>
              </div>
              <TerminalSquare size={18} />
            </div>
            <div className="structured-log-list">
              {logs.length ? logs.map((log) => (
                <div className={`structured-log-row ${log.tone ?? "neutral"}`} key={log.id}>
                  <time>{log.at}</time>
                  <span>{log.message}</span>
                </div>
              )) : (
                <p className="empty-result-state">No process activity yet.</p>
              )}
            </div>
          </div>
        )}
      </ShimmerBorderCard>

      <button
        type="button"
        className="mobile-sources-toggle"
        onClick={() => setActiveTab(activeTab === "sources" ? "answer" : "sources")}
      >
        <BookOpenCheck size={14} />
        {activeTab === "sources" ? "Return to answer" : `Show ${references.length} sources`}
        <ChevronDown size={14} />
      </button>
    </section>
  );
}

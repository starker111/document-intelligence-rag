"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Braces,
  FileSearch,
  FileText,
  Link2,
  Network,
  Rocket,
  ScanSearch,
} from "lucide-react";
import { BenchmarkTable } from "@/components/BenchmarkTable";
import { CyberNavbar } from "@/components/CyberNavbar";
import { EmbeddingVisualizer } from "@/components/EmbeddingVisualizer";
import { GradientText } from "@/components/GradientText";
import { MorphingBackgroundGlows } from "@/components/MorphingBackgroundGlows";
import { RagConsole } from "@/components/RagConsole";
import { SpotlightCard } from "@/components/SpotlightCard";
import type {
  AskResponse,
  DocumentRecord,
  IngestResponse,
  LogEntry,
  Reference,
  WorkflowStep,
} from "@/lib/types";

interface Health {
  ready: boolean;
  passwordRequired: boolean | null;
  maxFileMb: number;
  embeddingDimensions: number;
  topK: number;
}

const features = [
  {
    icon: FileSearch,
    title: "PDF Parsing",
    description: "Extract clean, searchable text from text-based PDF documents.",
    code: "01 / EXTRACT",
  },
  {
    icon: Braces,
    title: "768D Embeddings",
    description: "Translate each passage into a semantic coordinate for meaning-aware retrieval.",
    code: "02 / VECTORIZE",
  },
  {
    icon: Network,
    title: "Vector Search",
    description: "Find the passages closest in meaning to every natural-language question.",
    code: "03 / RETRIEVE",
  },
  {
    icon: ScanSearch,
    title: "Grounded Answering",
    description: "Compose useful answers from retrieved context instead of model memory alone.",
    code: "04 / REASON",
  },
  {
    icon: Link2,
    title: "Source References",
    description: "Trace every response back to its supporting file, chunk, and similarity score.",
    code: "05 / VERIFY",
  },
  {
    icon: Rocket,
    title: "Vercel Ready",
    description: "Built on server routes and deployment-safe secrets for a production workflow.",
    code: "06 / DEPLOY",
  },
];

function messageFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    return String((payload as { message: unknown }).message);
  }
  return fallback;
}

export default function Home() {
  const [status, setStatus] = useState<WorkflowStep>("idle");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [answer, setAnswer] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [operation, setOperation] = useState<"upload" | "ask" | null>(null);
  const [lastOperation, setLastOperation] = useState("Waiting for activity");
  const [indexedFileName, setIndexedFileName] = useState("");
  const [lastChunkCount, setLastChunkCount] = useState(0);
  const [indexedAt, setIndexedAt] = useState("");
  const [health, setHealth] = useState<Health>({
    ready: false,
    passwordRequired: null,
    maxFileMb: 10,
    embeddingDimensions: 768,
    topK: 5,
  });

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (password) headers["x-app-password"] = password;
    return headers;
  }, [password]);

  const selectedDocument = documents.find((document) => document.id === documentId);
  const totalChunks = documents.reduce((sum, document) => sum + document.chunkCount, 0);

  const addLog = useCallback((message: string, tone: LogEntry["tone"] = "neutral") => {
    setLogs((current) => [
      {
        id: crypto.randomUUID(),
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        message,
        tone,
      },
      ...current,
    ].slice(0, 12));
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", { headers: authHeaders });
      const payload = await response.json();
      if (!response.ok) throw new Error(messageFromPayload(payload, "Could not load documents."));
      const recent = payload.documents as DocumentRecord[];
      setDocuments(recent);
      setDocumentId((current) =>
        current && recent.some((document) => document.id === current)
          ? current
          : recent[0]?.id ?? "",
      );
      setError("");
    } catch (loadError) {
      if (health.passwordRequired && !password) return;
      setError(loadError instanceof Error ? loadError.message : "Could not load documents.");
    }
  }, [authHeaders, health.passwordRequired, password]);

  useEffect(() => {
    fetch("/api/health")
      .then(async (response) => {
        const payload = await response.json();
        setHealth({
          ready: Boolean(payload.ready),
          passwordRequired: Boolean(payload.passwordRequired),
          maxFileMb: Number(payload.maxFileMb) || 10,
          embeddingDimensions: Number(payload.embeddingDimensions) || 768,
          topK: Number(payload.topK) || 5,
        });
      })
      .catch(() =>
        setHealth({
          ready: false,
          passwordRequired: null,
          maxFileMb: 10,
          embeddingDimensions: 768,
          topK: 5,
        }),
      );
  }, []);

  useEffect(() => {
    if (health.passwordRequired !== false) return;
    const timer = window.setTimeout(() => void loadDocuments(), 0);
    return () => window.clearTimeout(timer);
  }, [health.passwordRequired, loadDocuments]);

  async function upload(file: File) {
    setOperation("upload");
    setError("");
    setAnswer("");
    setReferences([]);
    setIndexedFileName(file.name);
    setLastOperation(`Indexing ${file.name}`);
    const phases: WorkflowStep[] = [
      "uploading",
      "extracting",
      "chunking",
      "embedding",
      "storing",
    ];
    let phaseIndex = 0;
    setStatus(phases[phaseIndex]);
    const timer = window.setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, phases.length - 1);
      setStatus(phases[phaseIndex]);
    }, 1400);

    try {
      const form = new FormData();
      form.append("file", file);
      addLog(`Started indexing ${file.name}.`);
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: authHeaders,
        body: form,
      });
      const payload = (await response.json()) as IngestResponse | { message?: string };
      if (!response.ok) throw new Error(messageFromPayload(payload, "Indexing failed."));

      const result = payload as IngestResponse;
      setStatus("ready");
      setDocumentId(result.documentId);
      setIndexedFileName(result.fileName);
      setLastChunkCount(result.chunksStored);
      setIndexedAt(new Date().toLocaleString());
      setLastOperation(`Indexed ${result.fileName}`);
      addLog(`${result.fileName} is ready with ${result.chunksStored} chunks.`, "success");
      await loadDocuments();
    } catch (uploadError) {
      setStatus("error");
      const message = uploadError instanceof Error ? uploadError.message : "Indexing failed.";
      setError(message);
      setLastOperation("Indexing failed");
      addLog(message, "error");
    } finally {
      window.clearInterval(timer);
      setOperation(null);
    }
  }

  async function ask(question: string) {
    setOperation("ask");
    setError("");
    setAnswer("");
    setReferences([]);
    setStatus("searching");
    setLastOperation("Searching indexed passages");
    const timer = window.setTimeout(() => setStatus("answering"), 900);

    try {
      addLog(`Searching the selected document for “${question}”`);
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ question, documentId }),
      });
      const payload = (await response.json()) as AskResponse | { message?: string };
      if (!response.ok) throw new Error(messageFromPayload(payload, "The question failed."));

      const result = payload as AskResponse;
      setAnswer(result.answer);
      setReferences(result.references);
      setStatus("ready");
      setLastOperation(`Answered with ${result.references.length} references`);
      addLog(`Answer completed with ${result.references.length} references.`, "success");
    } catch (askError) {
      setStatus("error");
      const message = askError instanceof Error ? askError.message : "The question failed.";
      setError(message);
      setLastOperation("Question failed");
      addLog(message, "error");
    } finally {
      window.clearTimeout(timer);
      setOperation(null);
    }
  }

  return (
    <main>
      <MorphingBackgroundGlows />
      <CyberNavbar ready={health.ready} />

      <section className="hero-section" id="home">
        <div className="page-width hero-grid">
          <div className="hero-copy">
            <div className="technical-label">
              <span className="pulse-dot" />
              Document intelligence / online
            </div>
            <h1>
              Your documents,
              <br />
              <em>made legible.</em>
            </h1>
            <p>
              Upload a PDF, convert it into embeddings, and ask grounded questions
              with source-backed answers.
            </p>
            <div className="hero-actions">
              <a className="button button-light" href="#upload">
                Index a document <ArrowRight size={16} />
              </a>
              <a className="button button-ghost" href="#ask">
                Ask a question
              </a>
            </div>
            <div className="hero-proof">
              <span>Gemini reasoning</span>
              <span>Supabase pgvector</span>
              <span>Vercel runtime</span>
            </div>
          </div>

          <div className="hero-art" aria-label="Abstract document embedding interface">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-panel hero-panel-main">
              <div className="panel-topline">
                <span>SEMANTIC INDEX / 01</span>
                <span className="live-indicator">LIVE</span>
              </div>
              <div className="document-lines">
                {[88, 62, 76, 48, 82, 55].map((width, index) => (
                  <span key={width} style={{ width: `${width}%`, animationDelay: `${index * 110}ms` }} />
                ))}
              </div>
              <div className="vector-preview">
                {Array.from({ length: 48 }, (_, index) => (
                  <i key={index} style={{ animationDelay: `${(index % 12) * 70}ms` }} />
                ))}
              </div>
            </div>
            <div className="hero-panel hero-panel-small">
              <span className="technical-label">VECTOR MATCH</span>
              <strong>0.942</strong>
              <div className="signal-bars">
                {[24, 42, 65, 38, 78, 56, 88, 46].map((height) => (
                  <i key={height} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <div className="floating-node node-one" />
            <div className="floating-node node-two" />
            <div className="floating-node node-three" />
          </div>
        </div>
      </section>

      <RagConsole
        status={status}
        documents={documents}
        documentId={documentId}
        answer={answer}
        references={references}
        logs={logs}
        error={error}
        operation={operation}
        passwordRequired={health.passwordRequired === true}
        password={password}
        maxFileMb={health.maxFileMb}
        embeddingDimensions={health.embeddingDimensions}
        topK={health.topK}
        indexedAt={indexedAt}
        onPasswordChange={setPassword}
        onUnlock={loadDocuments}
        onDocumentChange={setDocumentId}
        onUpload={upload}
        onAsk={ask}
      />

      <EmbeddingVisualizer
        status={status}
        chunksStored={lastChunkCount || selectedDocument?.chunkCount || 0}
        embeddingDimensions={health.embeddingDimensions}
        topK={health.topK}
        documentName={indexedFileName || selectedDocument?.fileName || ""}
      />

      <section className="section page-width" id="capabilities">
        <div className="section-intro">
          <span className="technical-label">SYSTEM CAPABILITIES</span>
          <h2>Precision at every layer.</h2>
          <p>Each stage is designed to keep answers useful, attributable, and grounded.</p>
        </div>
        <div className="bento-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <SpotlightCard key={feature.title} className={`feature-card reveal-delay-${index % 3}`}>
                <span className="feature-code">{feature.code}</span>
                <div className="feature-icon"><Icon size={20} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </SpotlightCard>
            );
          })}
        </div>
      </section>

      <BenchmarkTable
        documents={documents}
        totalChunks={totalChunks}
        embeddingDimensions={health.embeddingDimensions}
        topK={health.topK}
        selectedDocument={selectedDocument?.fileName || "None selected"}
        lastOperation={lastOperation}
      />

      <section className="final-cta page-width">
        <span className="technical-label">THE KNOWLEDGE IS ALREADY THERE</span>
        <h2><GradientText>Make every document answerable.</GradientText></h2>
        <p>Index your first PDF and turn static pages into a searchable source of truth.</p>
        <a className="button button-light" href="#upload">
          Open the RAG console <ArrowRight size={16} />
        </a>
      </section>

      <footer className="site-footer page-width">
        <div className="footer-brand">
          <span className="mini-mark"><FileText size={15} /></span>
          <span>KEPLER / DOCUMENT INTELLIGENCE</span>
        </div>
        <span>GEMINI · SUPABASE · VERCEL</span>
        <a href="#home">RETURN TO TOP ↑</a>
      </footer>
    </main>
  );
}

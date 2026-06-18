"use client";

import { FormEvent, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  KeyRound,
  UploadCloud,
} from "lucide-react";
import { ShimmerBorderCard } from "@/components/ShimmerBorderCard";
import { StatusPill } from "@/components/StatusPill";
import { StructuredAnswerPanel } from "@/components/StructuredAnswerPanel";
import type {
  DocumentRecord,
  LogEntry,
  Reference,
  WorkflowStep,
} from "@/lib/types";

const workflow = [
  "uploading",
  "extracting",
  "chunking",
  "embedding",
  "storing",
  "ready",
  "searching",
  "answering",
] as const;

const labels: Record<(typeof workflow)[number], string> = {
  uploading: "Uploading",
  extracting: "Extracting",
  chunking: "Chunking",
  embedding: "Embedding",
  storing: "Storing",
  ready: "Ready",
  searching: "Searching",
  answering: "Answering",
};

function pillState(step: (typeof workflow)[number], status: WorkflowStep) {
  if (status === "error") return step === "uploading" ? "error" : "inactive";
  if (status === "idle") return "inactive";
  const current = workflow.indexOf(status as (typeof workflow)[number]);
  const index = workflow.indexOf(step);
  const completed =
    current > index ||
    (status === "ready" && index <= workflow.indexOf("ready")) ||
    (current >= workflow.indexOf("searching") && index <= workflow.indexOf("ready"));
  if (completed) return "completed";
  if (current === index) return "active";
  return "inactive";
}

interface Props {
  status: WorkflowStep;
  documents: DocumentRecord[];
  documentId: string;
  answer: string;
  references: Reference[];
  logs: LogEntry[];
  error: string;
  operation: "upload" | "ask" | null;
  passwordRequired: boolean;
  password: string;
  maxFileMb: number;
  embeddingDimensions: number;
  topK: number;
  indexedAt: string;
  onPasswordChange: (password: string) => void;
  onUnlock: () => Promise<void>;
  onDocumentChange: (id: string) => void;
  onUpload: (file: File) => Promise<void>;
  onAsk: (question: string) => Promise<void>;
}

export function RagConsole({
  status,
  documents,
  documentId,
  answer,
  references,
  logs,
  error,
  operation,
  passwordRequired,
  password,
  maxFileMb,
  embeddingDimensions,
  topK,
  indexedAt,
  onPasswordChange,
  onUnlock,
  onDocumentChange,
  onUpload,
  onAsk,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [question, setQuestion] = useState("");

  const selectedDocument = documents.find((document) => document.id === documentId);
  const locked = passwordRequired && !password;

  async function submitQuestion(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || !documentId || operation) return;
    await onAsk(question.trim());
  }

  function choose(candidate?: File) {
    if (!candidate) return;
    setFile(candidate);
  }

  return (
    <section className="section page-width rag-section">
      <div className="console-heading">
        <div>
          <span className="technical-label">RAG CONSOLE / LIVE WORKSPACE</span>
          <h2>From PDF to grounded answer.</h2>
        </div>
        <span className={`console-health ${status === "error" ? "has-error" : ""}`}>
          <i />
          {status === "error" ? "Attention needed" : operation ? "Processing" : "Console ready"}
        </span>
      </div>

      {passwordRequired && (
        <div className="password-console">
          <KeyRound size={16} />
          <div>
            <strong>Protected workspace</strong>
            <span>Enter the application password to load and query documents.</span>
          </div>
          <input
            value={password}
            type="password"
            aria-label="Application password"
            placeholder="Workspace password"
            onChange={(event) => onPasswordChange(event.target.value)}
          />
          <button type="button" onClick={() => void onUnlock()} disabled={!password}>
            Unlock
          </button>
        </div>
      )}

      <div className="workflow-pills" aria-label={`Workflow status: ${status}`}>
        {workflow.map((step) => (
          <StatusPill key={step} label={labels[step]} state={pillState(step, status)} />
        ))}
      </div>

      {documentId && (status === "ready" || status === "searching" || status === "answering") && (
        <div className="indexing-summary" aria-label="Indexing summary">
          <div className="summary-title">
            <span className="summary-ready"><Check size={12} /> Ready</span>
            <strong>Indexing summary</strong>
          </div>
          <dl>
            <div><dt>File name</dt><dd title={selectedDocument?.fileName}>{selectedDocument?.fileName || "Indexed document"}</dd></div>
            <div><dt>Document ID</dt><dd>{`${documentId.slice(0, 8)}…${documentId.slice(-4)}`}</dd></div>
            <div><dt>Chunks stored</dt><dd>{selectedDocument?.chunkCount ?? "—"}</dd></div>
            <div><dt>Embedding</dt><dd>{embeddingDimensions}D</dd></div>
            <div><dt>Top K</dt><dd>{topK}</dd></div>
            <div><dt>Indexed</dt><dd>{indexedAt || (selectedDocument?.createdAt ? new Date(selectedDocument.createdAt).toLocaleString() : "Available")}</dd></div>
          </dl>
        </div>
      )}

      {error && (
        <div className="console-error" role="alert">
          <strong>Operation interrupted.</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="console-grid">
        <ShimmerBorderCard className="console-panel" id="upload">
          <div className="panel-heading">
            <span className="panel-index">01</span>
            <div>
              <h3>Index a document</h3>
              <p>Text-based PDFs up to {maxFileMb} MB.</p>
            </div>
          </div>

          <button
            type="button"
            className={`cyber-dropzone ${dragging ? "is-dragging" : ""}`}
            disabled={operation !== null || locked}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => choose(event.target.files?.[0])}
            />
            <span className="upload-icon">
              {file ? <FileText size={23} /> : <UploadCloud size={23} />}
            </span>
            <strong>{file ? file.name : "Drop a PDF into the index"}</strong>
            <span>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB · click to replace`
                : "or browse from your computer"}
            </span>
          </button>

          <button
            type="button"
            className="console-button"
            disabled={!file || operation !== null || locked}
            onClick={() => file && void onUpload(file)}
          >
            <UploadCloud size={16} />
            {operation === "upload" ? "Indexing document…" : "Upload & Index PDF"}
          </button>
        </ShimmerBorderCard>

        <ShimmerBorderCard className="console-panel" id="ask">
          <div className="panel-heading">
            <span className="panel-index">02</span>
            <div>
              <h3>Ask the index</h3>
              <p>Answers remain grounded in one selected document.</p>
            </div>
          </div>

          <label className="field-label" htmlFor="document-select">
            <BookOpen size={13} /> Active document
          </label>
          <select
            className="cyber-select"
            id="document-select"
            value={documentId}
            onChange={(event) => onDocumentChange(event.target.value)}
            disabled={!documents.length || operation !== null || locked}
          >
            <option value="">Select an indexed document</option>
            {documents.map((document) => (
              <option value={document.id} key={document.id}>
                {document.fileName} · {document.chunkCount} chunks
              </option>
            ))}
          </select>

          <div className="question-context">
            <span>Selected source</span>
            <strong>{selectedDocument?.fileName || "No document selected"}</strong>
          </div>

          <form className="question-composer" onSubmit={submitQuestion}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={
                documentId
                  ? "Ask a precise question about this document…"
                  : "Index or select a document first…"
              }
              disabled={!documentId || operation !== null || locked}
              rows={5}
            />
            <div className="composer-footer">
              <span>{question.length}/1200</span>
              <button
                type="submit"
                aria-label="Ask document"
                disabled={!question.trim() || !documentId || operation !== null || locked}
              >
                {operation === "ask" ? "Reasoning…" : "Ask Document"}
                <ArrowUp size={16} />
              </button>
            </div>
          </form>
        </ShimmerBorderCard>
      </div>

      <span id="sources" className="anchor-target" aria-hidden="true" />
      <span id="logs" className="anchor-target" aria-hidden="true" />
      <StructuredAnswerPanel answer={answer} references={references} logs={logs} />
    </section>
  );
}

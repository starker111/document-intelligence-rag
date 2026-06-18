import { ArrowRight, Check, FileText } from "lucide-react";
import type { WorkflowStep } from "@/lib/types";

interface Props {
  status: WorkflowStep;
  chunksStored: number;
  embeddingDimensions: number;
  topK: number;
  documentName: string;
}

const activeStatuses: WorkflowStep[] = [
  "uploading",
  "extracting",
  "chunking",
  "embedding",
  "storing",
];

export function EmbeddingVisualizer({
  status,
  chunksStored,
  embeddingDimensions,
  topK,
  documentName,
}: Props) {
  const animating = activeStatuses.includes(status);
  const indexed = status === "ready" || status === "searching" || status === "answering";
  const chunkLabels = [
    "The document describes…",
    "Key findings indicate…",
    "The recommended action…",
  ];

  return (
    <section className="section page-width" id="embeddings">
      <div className="section-intro embedding-intro">
        <div>
          <span className="technical-label">SEMANTIC TRANSFORMATION</span>
          <h2>Language becomes coordinates.</h2>
        </div>
        <p>
          Each text chunk is mapped into a high-dimensional semantic space, making
          meaning searchable without displaying sensitive raw vectors.
        </p>
      </div>

      <div className={`embedding-machine ${animating ? "is-processing" : ""}`}>
        <div className="machine-grid">
          <div className="chunk-stream">
            <div className="machine-label">INPUT / TEXT CHUNKS</div>
            {chunkLabels.map((label, index) => (
              <div className="chunk-card" key={label} style={{ animationDelay: `${index * 180}ms` }}>
                <span><FileText size={13} /> CHUNK_{String(index + 1).padStart(3, "0")}</span>
                <p>{label}</p>
                <i style={{ width: `${78 - index * 13}%` }} />
              </div>
            ))}
          </div>

          <div className="transform-core" aria-hidden="true">
            <div className="beam-line" />
            <div className="scanner-ring">
              <span />
              <i />
            </div>
            <ArrowRight size={20} />
            <small>ENCODE</small>
          </div>

          <div className="vector-output">
            <div className="machine-label">OUTPUT / SEMANTIC MAP</div>
            <div className="vector-meta">
              <span>VECTOR[{embeddingDimensions}]</span>
              <span>CHUNK_ID</span>
              <span className={indexed ? "indexed" : ""}>
                {indexed ? <Check size={10} /> : null}
                {indexed ? "INDEXED" : "STANDBY"}
              </span>
            </div>
            <div className="vector-field">
              <div className="dot-matrix">
                {Array.from({ length: 96 }, (_, index) => <i key={index} />)}
              </div>
              <div className="vector-bars">
                {[34, 62, 45, 82, 28, 70, 52, 91, 39, 66, 48, 76].map((height, index) => (
                  <i key={`${height}-${index}`} style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="vector-cells">
                {["0.18", "−0.42", "0.77", "0.09", "…", "0.53"].map((cell) => (
                  <span key={cell}>{cell}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="embedding-readout">
          <div><span>CHUNKS STORED</span><strong>{chunksStored || "—"}</strong></div>
          <div><span>DIMENSIONS</span><strong>{embeddingDimensions}D</strong></div>
          <div><span>RETRIEVAL TOP K</span><strong>{topK}</strong></div>
          <div className="document-readout">
            <span>INDEXED DOCUMENT</span>
            <strong title={documentName}>{documentName || "Awaiting document"}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

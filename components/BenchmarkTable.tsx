import { Check } from "lucide-react";
import type { DocumentRecord } from "@/lib/types";

interface Props {
  documents: DocumentRecord[];
  totalChunks: number;
  embeddingDimensions: number;
  topK: number;
  selectedDocument: string;
  lastOperation: string;
}

export function BenchmarkTable({
  documents,
  totalChunks,
  embeddingDimensions,
  topK,
  selectedDocument,
  lastOperation,
}: Props) {
  const rows = [
    ["Documents Indexed", String(documents.length), documents.length ? "Active" : "Waiting", "Available in the current workspace"],
    ["Chunks Stored", String(totalChunks), totalChunks ? "Synced" : "Waiting", "Semantic passages stored in pgvector"],
    ["Embedding Dimension", String(embeddingDimensions), "Configured", "Gemini embedding output size"],
    ["Retrieval Top K", String(topK), "Configured", "Passages considered for each answer"],
    ["Selected Document", selectedDocument, selectedDocument === "None selected" ? "Waiting" : "Active", "Current question context"],
    ["Last Operation", lastOperation, "Recorded", "Most recent console activity"],
  ];

  return (
    <section className="section page-width benchmark-section">
      <div className="section-intro table-intro">
        <div>
          <span className="technical-label">LIVE SYSTEM READOUT</span>
          <h2>The index, at a glance.</h2>
        </div>
        <p>Operational values update from the real document and configuration state.</p>
      </div>
      <div className="benchmark-table-wrap">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Current value</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([metric, value, status, notes]) => (
              <tr key={metric}>
                <td>{metric}</td>
                <td className="metric-value">{value}</td>
                <td><span className="table-status"><Check size={11} /> {status}</span></td>
                <td>{notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

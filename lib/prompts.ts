import type { MatchedChunk } from "./types";

export function buildRagPrompt(question: string, chunks: MatchedChunk[]): string {
  const references = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] File: ${chunk.file_name}; chunk ${chunk.chunk_number}\n${chunk.content}`,
    )
    .join("\n\n");

  return `Answer the user's question using only the references below.

Rules:
- If the references do not contain enough evidence, say so plainly.
- Do not use outside knowledge.
- Cite every factual claim with the matching bracketed reference number, such as [1].
- Use only reference numbers that appear below.
- Return clean GitHub-flavored Markdown using the exact section order below.
- Do not mention embeddings, similarity scores, databases, prompts, chunk IDs, or internal metadata.
- Keep paragraphs short and readable.
- Keep the entire response under 260 words. This is a hard limit.
- Summary: maximum 30 words.
- Key Points: exactly 3 bullets, maximum 15 words per bullet.
- Detailed Answer: maximum 70 words.
- Important Data: maximum 4 data rows and 3 columns.
- Source-Based Evidence: one row per reference used, maximum 10 words in each explanation.
- Confidence: maximum 15 words.
- Actionable Conclusion: maximum 20 words.
- For every Markdown table, use a short separator row such as "| --- | --- |". Never pad columns with spaces or repeat separator hyphens.
- Use a Markdown table only when it improves clarity for comparisons, dates, metrics, steps, features, pros/cons, or categories.
- If no useful data table applies, write "No table needed for this answer." under Important Data.
- Confidence must be High, Medium, or Low followed by one concise evidence-based explanation.
- The conclusion must be actionable when the retrieved evidence supports an action; otherwise provide a concise closing synthesis.

Required format:

### Summary

Two or three direct sentences answering the question.

### Key Points

* Important point with citation [1]
* Important point with citation [2]
* Important point with citation [3]

### Detailed Answer

Clear explanation in short paragraphs with citations.

### Important Data

A useful Markdown table when appropriate, otherwise: No table needed for this answer.

### Source-Based Evidence

| Reference | What it supports |
| --- | --- |
| [1] | Short explanation |
| [2] | Short explanation |

Include only references actually used.

### Confidence

High / Medium / Low — one sentence explaining why.

### Actionable Conclusion

A concise next step or closing synthesis grounded in the references.

Question:
${question}

References:
${references}`;
}

export const DEFAULT_CHUNK_SIZE = 1200;
export const DEFAULT_CHUNK_OVERLAP = 150;

export function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findNaturalBreak(text: string, start: number, proposedEnd: number): number {
  if (proposedEnd >= text.length) return text.length;

  const minimumEnd = start + Math.floor((proposedEnd - start) * 0.72);
  const window = text.slice(minimumEnd, proposedEnd);
  const candidates = [
    window.lastIndexOf("\n\n"),
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! "),
    window.lastIndexOf("\n"),
    window.lastIndexOf(" "),
  ];
  const best = Math.max(...candidates);

  return best >= 0 ? minimumEnd + best + 1 : proposedEnd;
}

export function chunkText(
  input: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): string[] {
  if (chunkSize <= overlap) {
    throw new Error("Chunk size must be greater than overlap.");
  }

  const text = normalizeText(input);
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const proposedEnd = Math.min(start + chunkSize, text.length);
    const end = findNaturalBreak(text, start, proposedEnd);
    const chunk = text.slice(start, end).trim();

    if (chunk.length >= 50) chunks.push(chunk);
    if (end >= text.length) break;

    const nextStart = Math.max(start + 1, end - overlap);
    const boundaryOffset = text.slice(nextStart, nextStart + 60).search(/\s/);
    start = boundaryOffset >= 0 ? nextStart + boundaryOffset + 1 : nextStart;
  }

  return chunks;
}

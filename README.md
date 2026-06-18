# Kepler Document Intelligence

Production-ready PDF question answering built with Next.js App Router, TypeScript, Tailwind CSS, Gemini, and Supabase pgvector.

Users upload a text-based PDF, index its contents, select an indexed document, ask questions, and receive grounded answers with supporting passages.

## Application flow

```text
PDF upload
  -> PDF text extraction
  -> whitespace normalization
  -> overlapping text chunks
  -> Gemini 768-dimensional embeddings
  -> Supabase documents and document_chunks

Question
  -> Gemini 768-dimensional embedding
  -> document-scoped pgvector search
  -> grounded prompt
  -> Gemini answer
  -> references shown in the UI
```

All Gemini and Supabase service-role access runs in server-only modules. Secrets are never returned to the browser.

## Project structure

```text
app/
  api/
    ask/route.ts
    documents/route.ts
    health/route.ts
    ingest/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
lib/
supabase/schema.sql
.env.example
```

## Environment variables

Copy `.env.example` to `.env.local` and provide:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_CHAT_MODEL=gemini-2.5-flash
APP_MAX_FILE_MB=10
APP_TOP_K=3
MAX_CHUNKS_PER_PDF=100
APP_REQUIRE_PASSWORD=false
APP_PASSWORD=
```

`NEXT_PUBLIC_SUPABASE_URL` must be the project base URL, for example:

```text
https://your-project.supabase.co
```

Do not use a REST endpoint suffix. The service-role and Gemini keys must never use a `NEXT_PUBLIC_` prefix.

`GEMINI_EMBEDDING_DIMENSIONS` must remain `768` because the database column and search function use `vector(768)`.

## Supabase setup

1. Open the Supabase SQL Editor.
2. Run the complete contents of `supabase/schema.sql`.
3. Confirm these objects exist:
   - `documents`
   - `document_chunks`
   - `match_document_chunks`
4. Confirm `document_chunks.embedding` is `vector(768)`.

The schema enables pgvector, adds an HNSW cosine index, cascades chunk deletion with document deletion, enables RLS without public access policies, and grants the search function to the service role.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Quality checks:

```bash
npm run lint
npm run build
```

## API routes

### `POST /api/ingest`

Accepts `multipart/form-data` using field name `file`.

It validates the PDF and size, extracts text, rejects image-only documents, chunks the normalized text, applies `MAX_CHUNKS_PER_PDF`, generates 768-dimensional embeddings, and stores the document and chunks in Supabase.

Success response:

```json
{
  "success": true,
  "documentId": "uuid",
  "fileName": "report.pdf",
  "chunksStored": 12,
  "message": "PDF indexed successfully and is ready for questions."
}
```

### `POST /api/ask`

Request:

```json
{
  "question": "What are the main risks?",
  "documentId": "uuid"
}
```

The route embeds the question, calls `match_document_chunks` with the selected document ID and `APP_TOP_K`, generates an answer using only retrieved passages, and returns references.

### `GET /api/documents`

Returns the 20 most recent indexed documents.

### `GET /api/health`

Reports configuration presence and limits without exposing environment variable values.

## Optional shared password

```dotenv
APP_REQUIRE_PASSWORD=true
APP_PASSWORD=use-a-long-random-value
```

The UI sends this value only to protected server routes. For a multi-user production system, replace the shared password with authentication and user-scoped RLS.

## Vercel deployment

- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave empty/default
- Add every variable from `.env.example` in Project Settings

The PDF ingestion route explicitly uses the Node.js runtime. No custom output directory or separate backend process is required.

## Operational notes

- Failed ingestion removes its partially created document row; chunk rows cascade automatically.
- Search is always filtered by `documentId`.
- `APP_TOP_K` is clamped between 1 and 10.
- The embedding dimension is checked at runtime before any Gemini request.
- PDF content and embeddings are stored in Supabase, not browser storage.
- Scanned PDFs require OCR before upload.
- Rotate any secret that was previously committed or placed in a tracked example file.

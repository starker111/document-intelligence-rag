-- Document Intelligence RAG schema
-- Embedding size is fixed at 768 to match lib/ai.ts.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  file_name text not null,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default extensions.gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_number integer not null check (chunk_number > 0),
  content text not null,
  characters integer not null check (characters > 0),
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_number)
);

create index if not exists documents_created_at_idx
  on public.documents (created_at desc);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_document_chunks (
  query_embedding extensions.vector(768),
  match_document_id uuid,
  match_count integer default 3
)
returns table (
  id uuid,
  chunk_number integer,
  content text,
  similarity double precision,
  file_name text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    dc.id,
    dc.chunk_number,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity,
    d.file_name
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where dc.document_id = match_document_id
  order by dc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- No public policies are created. The server-only Supabase service role bypasses RLS.
revoke all on function public.match_document_chunks(extensions.vector, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.match_document_chunks(extensions.vector, uuid, integer)
  to service_role;

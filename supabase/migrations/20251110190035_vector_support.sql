-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create source_chunks table
CREATE TABLE IF NOT EXISTS public.source_chunks (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
	-- Chunk content and metadata
	content TEXT NOT NULL,
	chunk_index INTEGER NOT NULL,
	token_count INTEGER NOT NULL,
	-- Additional context fields
	start_char_offset INTEGER,
	end_char_offset INTEGER,
	heading_context TEXT,
	-- Flexible metadata storage
	metadata JSONB,
	-- Vector embedding (1024 dimensions for Voyage AI default)
	embedding vector(1024) NOT NULL,
	-- Timestamps
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	-- Ensure unique chunk ordering per source
	UNIQUE(source_id, chunk_index)
);

-- Create indexes for performance
-- CREATE INDEX IF NOT EXISTS idx_source_chunks_source_id ON public.source_chunks(source_id);
-- CREATE INDEX IF NOT EXISTS idx_source_chunks_token_count ON public.source_chunks(token_count);
-- Create HNSW index for vector similarity search
-- Note: This will be created after populating the table for best performance
-- Uncomment when ready to enable vector search:
-- CREATE INDEX idx_source_chunks_embedding ON public.source_chunks
-- USING hnsw (embedding vector_cosine_ops);
-- Enable Row Level Security
ALTER TABLE
	public.source_chunks ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
-- CREATE POLICY "Allow all operations for authenticated users on source_chunks" ON public.source_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Add updated_at trigger
CREATE TRIGGER handle_source_chunks_updated_at BEFORE
UPDATE
	ON public.source_chunks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create enhanced vector search function with metadata filtering
CREATE
OR REPLACE FUNCTION match_source_chunks_enhanced(
	query_embedding vector(1024),
	match_threshold float DEFAULT 0.7,
	match_count int DEFAULT 10,
	essay_id uuid DEFAULT NULL,
	metadata_filter jsonb DEFAULT NULL
) RETURNS TABLE (
	id uuid,
	source_id uuid,
	content text,
	chunk_index int,
	similarity float,
	source_title text,
	source_url text,
	source_summary text,
	date_accessed timestamptz,
	search_query text,
	heading_context text,
	metadata jsonb
) LANGUAGE plpgsql STABLE AS $ $ BEGIN RETURN QUERY
SELECT
	sc.id,
	sc.source_id,
	sc.content,
	sc.chunk_index,
	1 - (sc.embedding <= > query_embedding) as similarity,
	s.title,
	s.url,
	s.summary,
	s.date_accessed,
	s.search_query,
	sc.heading_context,
	sc.metadata
FROM
	source_chunks sc
	JOIN sources s ON sc.source_id = s.id
	LEFT JOIN essay_sources es ON s.id = es.source_id
WHERE
	-- Similarity threshold
	1 - (sc.embedding <= > query_embedding) > match_threshold -- Optional essay filter
	AND (
		essay_id IS NULL
		OR es.essay_id = essay_id
	) -- Optional metadata filters
	AND (
		metadata_filter IS NULL
		OR sc.metadata @ > metadata_filter
	)
ORDER BY
	sc.embedding <= > query_embedding
LIMIT
	match_count;

END;

$ $;

-- Create simple vector search function for backward compatibility
CREATE
OR REPLACE FUNCTION match_source_chunks(
	query_embedding vector(1024),
	match_threshold float DEFAULT 0.7,
	match_count int DEFAULT 10
) RETURNS TABLE (
	id uuid,
	source_id uuid,
	content text,
	chunk_index int,
	similarity float,
	source_title text,
	source_url text,
	source_summary text,
	date_accessed timestamptz,
	search_query text
) LANGUAGE sql STABLE AS $ $
SELECT
	sc.id,
	sc.source_id,
	sc.content,
	sc.chunk_index,
	1 - (sc.embedding <= > query_embedding) as similarity,
	s.title,
	s.url,
	s.summary,
	s.date_accessed,
	s.search_query
FROM
	source_chunks sc
	JOIN sources s ON sc.source_id = s.id
WHERE
	1 - (sc.embedding <= > query_embedding) > match_threshold
ORDER BY
	sc.embedding <= > query_embedding
LIMIT
	match_count;

$ $;

-- Create function for batch inserting chunks
CREATE
OR REPLACE FUNCTION batch_insert_chunks(chunks_data jsonb) RETURNS void LANGUAGE plpgsql AS $ $ BEGIN
INSERT INTO
	source_chunks (
		source_id,
		content,
		chunk_index,
		token_count,
		start_char_offset,
		end_char_offset,
		heading_context,
		metadata,
		embedding
	)
SELECT
	(chunk ->> 'source_id') :: UUID,
	chunk ->> 'content',
	(chunk ->> 'chunk_index') :: INTEGER,
	(chunk ->> 'token_count') :: INTEGER,
	(chunk ->> 'start_char_offset') :: INTEGER,
	(chunk ->> 'end_char_offset') :: INTEGER,
	chunk ->> 'heading_context',
	chunk -> 'metadata',
	(chunk ->> 'embedding') :: vector(1024)
FROM
	jsonb_array_elements(chunks_data) AS chunk;

END;

$ $;

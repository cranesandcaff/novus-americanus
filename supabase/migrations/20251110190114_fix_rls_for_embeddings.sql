-- Update batch_insert_chunks to run with SECURITY DEFINER
-- This allows the function to bypass RLS when called from the backend
CREATE
OR REPLACE FUNCTION batch_insert_chunks(chunks_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
	search_path = public AS $ $ BEGIN
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION batch_insert_chunks(jsonb) TO authenticated;

-- Also grant to service_role for backend operations
GRANT EXECUTE ON FUNCTION batch_insert_chunks(jsonb) TO service_role;

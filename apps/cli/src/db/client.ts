import {createClient} from '@supabase/supabase-js';
import {config} from '../config.js';

export const supabase = createClient(
	config.supabase.url,
	config.supabase.anonKey,
);

export type Essay = {
	id: string;
	title: string;
	slug: string;
	summary: string | null;
	status: string;
	directory_path: string | null;
	created_at: Date;
	updated_at: Date;
};

export type Source = {
	id: string;
	title: string;
	summary: string | null;
	key_points: string | null;
	url: string | null;
	date_accessed: Date | null;
	search_query: string | null;
	jina_archive_contents: string | null;
	created_at: Date;
	updated_at: Date;
};

export type EssaySource = {
	essay_id: string;
	source_id: string;
	created_at: Date;
};

export type SourceChunk = {
	id: string;
	source_id: string;
	content: string;
	chunk_index: number;
	token_count: number;
	start_char_offset: number | null;
	end_char_offset: number | null;
	heading_context: string | null;
	metadata: Record<string, unknown> | null;
	embedding: number[];
	created_at: Date;
	updated_at: Date;
};

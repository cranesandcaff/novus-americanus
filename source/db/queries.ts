import {supabase, type Essay, type Source, type SourceChunk} from './client.js';

export const essays = {
	async getAll(): Promise<Essay[]> {
		const {data, error} = await supabase
			.from('essays')
			.select('*')
			.order('created_at', {ascending: false});

		if (error) {
			throw error;
		}

		return data ?? [];
	},

	async getBySlug(slug: string): Promise<Essay | null> {
		const {data, error} = await supabase
			.from('essays')
			.select('*')
			.eq('slug', slug)
			.single();

		if (error && error.code !== 'PGRST116') {
			throw error;
		}

		return data;
	},

	async create(data: {
		title: string;
		slug: string;
		summary?: string;
		status?: string;
		directory_path?: string;
	}): Promise<Essay> {
		const {data: essay, error} = await supabase
			.from('essays')
			.insert({
				title: data.title,
				slug: data.slug,
				summary: data.summary ?? null,
				status: data.status ?? 'draft',
				directory_path: data.directory_path ?? null,
			})
			.select()
			.single();

		if (error) {
			throw error;
		}

		return essay!;
	},

	async update(
		id: string,
		data: Partial<Omit<Essay, 'id' | 'created_at' | 'updated_at'>>,
	): Promise<Essay> {
		const {data: essay, error} = await supabase
			.from('essays')
			.update(data)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw error;
		}

		return essay!;
	},

	async delete(id: string): Promise<void> {
		const {error} = await supabase.from('essays').delete().eq('id', id);

		if (error) {
			throw error;
		}
	},

	async getSources(essayId: string): Promise<Source[]> {
		const {data, error} = await supabase
			.from('essay_sources')
			.select(
				`
				source_id,
				sources (*)
			`,
			)
			.eq('essay_id', essayId)
			.order('created_at', {ascending: false});

		if (error) {
			throw error;
		}

		return (data?.map(item => item.sources).filter(Boolean) as Source[]) ?? [];
	},
};

export const sources = {
	async getAll(): Promise<Source[]> {
		const {data, error} = await supabase
			.from('sources')
			.select('*')
			.order('created_at', {ascending: false});

		if (error) {
			throw error;
		}

		return data ?? [];
	},

	async getAllMinimal(): Promise<Array<{id: string; title: string}>> {
		const {data, error} = await supabase
			.from('sources')
			.select('id, title')
			.order('created_at', {ascending: false});

		if (error) {
			throw error;
		}

		return data ?? [];
	},

	async getById(id: string): Promise<Source | null> {
		const {data, error} = await supabase
			.from('sources')
			.select('*')
			.eq('id', id)
			.single();

		if (error && error.code !== 'PGRST116') {
			throw error;
		}

		return data;
	},

	async create(data: {
		title: string;
		summary?: string;
		key_points?: string;
		url?: string;
		date_accessed?: Date;
		search_query?: string;
		jina_archive_contents?: string;
	}): Promise<Source> {
		const {data: source, error} = await supabase
			.from('sources')
			.insert({
				title: data.title,
				summary: data.summary ?? null,
				key_points: data.key_points ?? null,
				url: data.url ?? null,
				date_accessed: data.date_accessed ?? null,
				search_query: data.search_query ?? null,
				jina_archive_contents: data.jina_archive_contents ?? null,
			})
			.select()
			.single();

		if (error) {
			throw error;
		}

		return source!;
	},

	async update(
		id: string,
		data: Partial<Omit<Source, 'id' | 'created_at' | 'updated_at'>>,
	): Promise<Source> {
		const {data: source, error} = await supabase
			.from('sources')
			.update(data)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw error;
		}

		return source!;
	},

	async delete(id: string): Promise<void> {
		const {error} = await supabase.from('sources').delete().eq('id', id);

		if (error) {
			throw error;
		}
	},

	async getEssays(sourceId: string): Promise<Essay[]> {
		const {data, error} = await supabase
			.from('essay_sources')
			.select(
				`
				essay_id,
				essays (*)
			`,
			)
			.eq('source_id', sourceId)
			.order('created_at', {ascending: false});

		if (error) {
			throw error;
		}

		return (data?.map(item => item.essays).filter(Boolean) as Essay[]) ?? [];
	},
};

export const essaySources = {
	async link(essayId: string, sourceId: string): Promise<void> {
		const {error} = await supabase.from('essay_sources').upsert(
			{
				essay_id: essayId,
				source_id: sourceId,
			},
			{
				onConflict: 'essay_id,source_id',
			},
		);

		if (error) {
			throw error;
		}
	},

	async unlink(essayId: string, sourceId: string): Promise<void> {
		const {error} = await supabase
			.from('essay_sources')
			.delete()
			.eq('essay_id', essayId)
			.eq('source_id', sourceId);

		if (error) {
			throw error;
		}
	},
};

export const sourceChunks = {
	async getBySourceId(sourceId: string): Promise<SourceChunk[]> {
		const {data, error} = await supabase
			.from('source_chunks')
			.select('*')
			.eq('source_id', sourceId)
			.order('chunk_index', {ascending: true});

		if (error) {
			throw error;
		}

		return data ?? [];
	},

	async deleteBySourceId(sourceId: string): Promise<void> {
		const {error} = await supabase
			.from('source_chunks')
			.delete()
			.eq('source_id', sourceId);

		if (error) {
			throw error;
		}
	},

	async count(): Promise<number> {
		const {count, error} = await supabase
			.from('source_chunks')
			.select('*', {count: 'exact', head: true});

		if (error) {
			throw error;
		}

		return count ?? 0;
	},

	async hasEmbeddings(sourceId: string): Promise<boolean> {
		const {count, error} = await supabase
			.from('source_chunks')
			.select('*', {count: 'exact', head: true})
			.eq('source_id', sourceId);

		if (error) {
			throw error;
		}

		return (count ?? 0) > 0;
	},
};

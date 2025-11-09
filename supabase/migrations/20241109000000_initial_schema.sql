-- Create essays table
CREATE TABLE IF NOT EXISTS public.essays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    directory_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create sources table
CREATE TABLE IF NOT EXISTS public.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    key_points TEXT,
    url TEXT,
    date_accessed TIMESTAMPTZ,
    search_query TEXT,
    jina_archive_contents TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create essay_sources junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.essay_sources (
    essay_id UUID NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (essay_id, source_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_essays_slug ON public.essays(slug);
CREATE INDEX IF NOT EXISTS idx_essays_status ON public.essays(status);
CREATE INDEX IF NOT EXISTS idx_sources_url ON public.sources(url);
CREATE INDEX IF NOT EXISTS idx_essay_sources_essay_id ON public.essay_sources(essay_id);
CREATE INDEX IF NOT EXISTS idx_essay_sources_source_id ON public.essay_sources(source_id);

-- Enable Row Level Security
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_sources ENABLE ROW LEVEL SECURITY;

-- Create policies (modify based on your auth requirements)
-- For now, allowing all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users on essays"
    ON public.essays
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on sources"
    ON public.sources
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on essay_sources"
    ON public.essay_sources
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to automatically update updated_at
CREATE TRIGGER handle_essays_updated_at
    BEFORE UPDATE ON public.essays
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_sources_updated_at
    BEFORE UPDATE ON public.sources
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

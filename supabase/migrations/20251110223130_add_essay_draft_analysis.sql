-- Create table for tracking essay draft quality over time
CREATE TABLE IF NOT EXISTS public.essay_draft_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    essay_id UUID NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
    draft_version INTEGER NOT NULL,

    -- Overall quality metrics
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    publication_ready BOOLEAN NOT NULL DEFAULT false,

    -- Readability metrics
    flesch_kincaid_grade DECIMAL(4,2),
    gunning_fog DECIMAL(4,2),
    word_count INTEGER,
    estimated_reading_time INTEGER,

    -- Style metrics
    passive_voice_pct DECIMAL(4,2),
    lexical_diversity DECIMAL(3,2),
    transition_density DECIMAL(4,2),

    -- Quality checks
    bias_issues INTEGER DEFAULT 0,
    citation_coverage DECIMAL(3,2),
    uncited_claims INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    total_issues INTEGER DEFAULT 0,

    -- Structure checks
    has_introduction BOOLEAN,
    has_conclusion BOOLEAN,
    body_paragraph_count INTEGER,
    outline_adherence_pct DECIMAL(5,2),

    -- Full analysis results (detailed data)
    analysis_result JSONB NOT NULL,

    -- Timestamps
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique combination of essay_id and draft_version
    UNIQUE(essay_id, draft_version)
);

-- Create indexes for querying
CREATE INDEX IF NOT EXISTS idx_essay_draft_analyses_essay_id ON public.essay_draft_analyses(essay_id);
CREATE INDEX IF NOT EXISTS idx_essay_draft_analyses_overall_score ON public.essay_draft_analyses(overall_score);
CREATE INDEX IF NOT EXISTS idx_essay_draft_analyses_publication_ready ON public.essay_draft_analyses(publication_ready);
CREATE INDEX IF NOT EXISTS idx_essay_draft_analyses_analyzed_at ON public.essay_draft_analyses(analyzed_at);

-- Enable Row Level Security
ALTER TABLE public.essay_draft_analyses ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all operations for authenticated users on essay_draft_analyses"
    ON public.essay_draft_analyses
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE public.essay_draft_analyses IS 'Tracks essay draft quality metrics over time to monitor improvements across revisions';
COMMENT ON COLUMN public.essay_draft_analyses.overall_score IS 'Overall quality score from 0-100 calculated by reviewComplete()';
COMMENT ON COLUMN public.essay_draft_analyses.draft_version IS 'Draft version number, increment for each revision';
COMMENT ON COLUMN public.essay_draft_analyses.analysis_result IS 'Full JSON analysis result from reviewComplete() including all issues and recommendations';
COMMENT ON COLUMN public.essay_draft_analyses.publication_ready IS 'True if essay meets all publication criteria (score e85, zero critical issues)';

-- Add text analysis columns to sources table for research quality tracking

ALTER TABLE public.sources
ADD COLUMN IF NOT EXISTS credibility_score INTEGER,
ADD COLUMN IF NOT EXISTS bias_issues INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fact_density DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS reading_level DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS passive_voice_pct DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS has_citations BOOLEAN,
ADD COLUMN IF NOT EXISTS has_author BOOLEAN,
ADD COLUMN IF NOT EXISTS overall_quality TEXT CHECK (overall_quality IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS use_for_research BOOLEAN,
ADD COLUMN IF NOT EXISTS analysis_result JSONB,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Create index on credibility score for filtering high-quality sources
CREATE INDEX IF NOT EXISTS idx_sources_credibility_score ON public.sources(credibility_score);
CREATE INDEX IF NOT EXISTS idx_sources_overall_quality ON public.sources(overall_quality);
CREATE INDEX IF NOT EXISTS idx_sources_use_for_research ON public.sources(use_for_research);

-- Add helpful comment
COMMENT ON COLUMN public.sources.credibility_score IS 'Source credibility score from 0-100 calculated by text analysis toolkit';
COMMENT ON COLUMN public.sources.analysis_result IS 'Full JSON analysis result from evaluateSource() including all metrics, issues, and recommendations';
COMMENT ON COLUMN public.sources.use_for_research IS 'Boolean flag indicating if source meets quality standards for research use';

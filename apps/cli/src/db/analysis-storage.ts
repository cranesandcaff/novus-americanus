/**
 * Database storage functions for text analysis results
 */

import {supabase} from './client.js';
import type {SourceEvaluation} from '../tools/analysis/ResearchAnalysisTools.js';
import type {ComprehensiveReview} from '../tools/analysis/ReviewerAnalysisTools.js';

/**
 * Save source analysis results to database
 */
export async function saveSourceAnalysis(
	sourceId: string,
	evaluation: SourceEvaluation,
): Promise<void> {
	const {error} = await supabase
		.from('sources')
		.update({
			credibility_score: evaluation.credibilityScore,
			bias_issues: evaluation.metrics.biasScore,
			fact_density: evaluation.metrics.factDensity,
			reading_level: evaluation.metrics.readability.fleschKincaidGrade,
			passive_voice_pct: evaluation.metrics.style.passiveVoicePercentage,
			has_citations: evaluation.metrics.hasCitations,
			has_author: evaluation.metrics.hasAuthorAttribution,
			overall_quality: evaluation.metrics.overallQuality,
			use_for_research: evaluation.useForResearch,
			analysis_result: evaluation,
			analyzed_at: new Date().toISOString(),
		})
		.eq('id', sourceId);

	if (error) {
		throw new Error(`Failed to save source analysis: ${error.message}`);
	}
}

/**
 * Get sources filtered by quality metrics
 */
export async function getQualitySources(
	options: {
		minCredibility?: number;
		maxBiasIssues?: number;
		requireCitations?: boolean;
		qualityLevel?: 'high' | 'medium' | 'low';
	} = {},
): Promise<
	Array<{
		id: string;
		title: string;
		url: string | null;
		credibilityScore: number;
		overallQuality: string;
		useForResearch: boolean;
	}>
> {
	let query = supabase
		.from('sources')
		.select(
			'id, title, url, credibility_score, overall_quality, use_for_research',
		)
		.not('credibility_score', 'is', null);

	if (options.minCredibility !== undefined) {
		query = query.gte('credibility_score', options.minCredibility);
	}

	if (options.maxBiasIssues !== undefined) {
		query = query.lte('bias_issues', options.maxBiasIssues);
	}

	if (options.requireCitations) {
		query = query.eq('has_citations', true);
	}

	if (options.qualityLevel) {
		query = query.eq('overall_quality', options.qualityLevel);
	}

	query = query.order('credibility_score', {ascending: false});

	const {data, error} = await query;

	if (error) {
		throw new Error(`Failed to fetch quality sources: ${error.message}`);
	}

	return (data ?? []).map(row => ({
		id: row.id,
		title: row.title,
		url: row.url,
		credibilityScore: row.credibility_score,
		overallQuality: row.overall_quality,
		useForResearch: row.use_for_research,
	}));
}

/**
 * Save essay draft analysis results to database
 */
export async function saveEssayDraftAnalysis(
	essayId: string,
	draftVersion: number,
	review: ComprehensiveReview,
): Promise<void> {
	const {error} = await supabase.from('essay_draft_analyses').insert({
		essay_id: essayId,
		draft_version: draftVersion,
		overall_score: review.overallScore,
		publication_ready: review.publicationReady,
		flesch_kincaid_grade: review.readability.fleschKincaidGrade,
		gunning_fog: review.readability.gunningFog,
		word_count: review.readability.wordCount,
		estimated_reading_time: review.readability.estimatedReadingTimeMinutes,
		passive_voice_pct: review.style.passiveVoicePercentage,
		lexical_diversity: review.style.lexicalDiversity,
		transition_density: review.style.transitionDensity,
		bias_issues: review.biasScore,
		citation_coverage:
			review.citations.totalCitations > 0
				? review.citations.totalCitations /
				  (review.citations.totalCitations +
						review.citations.unsubstantiatedClaims.length)
				: 0,
		uncited_claims: review.citations.unsubstantiatedClaims.length,
		critical_issues: review.criticalIssues.length,
		total_issues: review.allIssues.length,
		has_introduction: review.structure.hasIntroduction,
		has_conclusion: review.structure.hasConclusion,
		body_paragraph_count: review.structure.bodyParagraphCount,
		analysis_result: review,
	});

	if (error) {
		throw new Error(`Failed to save essay draft analysis: ${error.message}`);
	}
}

/**
 * Get quality trend for an essay across drafts
 */
export async function getEssayQualityTrend(essayId: string): Promise<
	Array<{
		draftVersion: number;
		overallScore: number;
		publicationReady: boolean;
		criticalIssues: number;
		analyzedAt: Date;
	}>
> {
	const {data, error} = await supabase
		.from('essay_draft_analyses')
		.select(
			'draft_version, overall_score, publication_ready, critical_issues, analyzed_at',
		)
		.eq('essay_id', essayId)
		.order('draft_version', {ascending: true});

	if (error) {
		throw new Error(`Failed to fetch essay quality trend: ${error.message}`);
	}

	return (data ?? []).map(row => ({
		draftVersion: row.draft_version,
		overallScore: row.overall_score,
		publicationReady: row.publication_ready,
		criticalIssues: row.critical_issues,
		analyzedAt: new Date(row.analyzed_at),
	}));
}

/**
 * Get latest analysis for an essay
 */
export async function getLatestEssayAnalysis(
	essayId: string,
): Promise<ComprehensiveReview | null> {
	const {data, error} = await supabase
		.from('essay_draft_analyses')
		.select('analysis_result')
		.eq('essay_id', essayId)
		.order('draft_version', {ascending: false})
		.limit(1)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			return null;
		}

		throw new Error(`Failed to fetch latest essay analysis: ${error.message}`);
	}

	return data.analysis_result as ComprehensiveReview;
}

/**
 * Get publication-ready essays
 */
export async function getPublicationReadyEssays(): Promise<
	Array<{
		essayId: string;
		essayTitle: string;
		draftVersion: number;
		overallScore: number;
		analyzedAt: Date;
	}>
> {
	const {data, error} = await supabase
		.from('essay_draft_analyses')
		.select(
			`
      essay_id,
      draft_version,
      overall_score,
      analyzed_at,
      essays!inner(title)
    `,
		)
		.eq('publication_ready', true)
		.order('analyzed_at', {ascending: false});

	if (error) {
		throw new Error(
			`Failed to fetch publication-ready essays: ${error.message}`,
		);
	}

	return (data ?? []).map(row => ({
		essayId: row.essay_id,
		essayTitle: row.essays.title,
		draftVersion: row.draft_version,
		overallScore: row.overall_score,
		analyzedAt: new Date(row.analyzed_at),
	}));
}

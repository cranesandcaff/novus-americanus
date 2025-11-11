import {
	analyzeReadability,
	detectBias,
	analyzeStyle,
	type ReadabilityMetrics,
	type StyleMetrics,
	type AnalysisResult,
} from '../../analysis/TextAnalysisToolkit.js';

export type SourceQualityMetrics = {
	readability: ReadabilityMetrics;
	style: StyleMetrics;
	biasScore: number;
	factDensity: number;
	hasCitations: boolean;
	hasAuthorAttribution: boolean;
	overallQuality: 'high' | 'medium' | 'low';
};

export type SourceEvaluation = {
	url?: string;
	metrics: SourceQualityMetrics;
	issues: Array<{
		type: string;
		severity: 'high' | 'medium' | 'low';
		message: string;
		suggestion: string;
	}>;
	recommendations: string[];
	credibilityScore: number;
	useForResearch: boolean;
};

/**
 * Evaluate source quality for research purposes
 */
export async function evaluateSource(
	content: string,
	url?: string,
): Promise<SourceEvaluation> {
	if (!content || content.trim().length === 0) {
		throw new Error('Content cannot be empty');
	}

	const [readabilityResult, biasResult, styleResult] = await Promise.all([
		analyzeReadability(content),
		detectBias(content),
		analyzeStyle(content),
	]);

	const hasCitations =
		/\[\d+\]|\(\w+,?\s+\d{4}\)|\(\w+\s+et\s+al\.,?\s+\d{4}\)/i.test(content);

	const hasAuthorAttribution = /by\s+[\w\s]+|author:/i.test(
		content.slice(0, 500),
	);

	const factDensity = calculateFactDensity(content);

	const biasScore = biasResult.metrics.issuesFound;

	let credibilityScore = 100;

	credibilityScore -= biasScore * 10;

	if (!hasCitations) {
		credibilityScore -= 20;
	}

	if (!hasAuthorAttribution) {
		credibilityScore -= 10;
	}

	if (readabilityResult.metrics.fleschKincaidGrade < 8) {
		credibilityScore -= 15;
	}

	if (styleResult.metrics.passiveVoicePercentage > 20) {
		credibilityScore -= 10;
	}

	if (factDensity < 0.05) {
		credibilityScore -= 15;
	}

	credibilityScore = Math.max(0, Math.min(100, credibilityScore));

	let overallQuality: 'high' | 'medium' | 'low';
	if (credibilityScore >= 75) {
		overallQuality = 'high';
	} else if (credibilityScore >= 50) {
		overallQuality = 'medium';
	} else {
		overallQuality = 'low';
	}

	const allIssues = [
		...readabilityResult.issues,
		...biasResult.issues,
		...styleResult.issues,
	];

	const recommendations = [
		...new Set([
			...readabilityResult.recommendations,
			...biasResult.recommendations,
			...styleResult.recommendations,
		]),
	];

	if (!hasCitations) {
		recommendations.push(
			'Source lacks citations - verify claims independently',
		);
	}

	if (factDensity < 0.1) {
		recommendations.push(
			'Low fact density - source may be more opinion than analysis',
		);
	}

	const useForResearch = credibilityScore >= 60 && biasScore <= 2;

	return {
		url,
		metrics: {
			readability: readabilityResult.metrics,
			style: styleResult.metrics,
			biasScore,
			factDensity,
			hasCitations,
			hasAuthorAttribution,
			overallQuality,
		},
		issues: allIssues,
		recommendations,
		credibilityScore,
		useForResearch,
	};
}

/**
 * Detect biased language in source material
 */
export async function detectSourceBias(
	text: string,
): Promise<AnalysisResult<{issuesFound: number}>> {
	return detectBias(text);
}

/**
 * Analyze source quality focusing on credibility indicators
 */
export async function analyzeSourceQuality(content: string): Promise<{
	factDensity: number;
	hasCitations: boolean;
	hasAuthorAttribution: boolean;
	readingLevel: number;
	wordCount: number;
	recommendations: string[];
}> {
	if (!content || content.trim().length === 0) {
		throw new Error('Content cannot be empty');
	}

	const readabilityResult = await analyzeReadability(content);

	const hasCitations =
		/\[\d+\]|\(\w+,?\s+\d{4}\)|\(\w+\s+et\s+al\.,?\s+\d{4}\)/i.test(content);

	const hasAuthorAttribution = /by\s+[\w\s]+|author:/i.test(
		content.slice(0, 500),
	);

	const factDensity = calculateFactDensity(content);

	const recommendations: string[] = [];

	if (factDensity < 0.1) {
		recommendations.push(
			'Low fact density detected - source appears more opinion-based',
		);
	}

	if (!hasCitations) {
		recommendations.push('No citations found - verify claims independently');
	}

	if (!hasAuthorAttribution) {
		recommendations.push('No clear author attribution found');
	}

	if (readabilityResult.metrics.fleschKincaidGrade < 8) {
		recommendations.push(
			'Reading level may be too low for academic/policy research',
		);
	}

	return {
		factDensity,
		hasCitations,
		hasAuthorAttribution,
		readingLevel: readabilityResult.metrics.fleschKincaidGrade,
		wordCount: readabilityResult.metrics.wordCount,
		recommendations,
	};
}

/**
 * Calculate fact density (presence of numbers, dates, statistics)
 */
function calculateFactDensity(text: string): number {
	const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

	const factIndicators = [
		/\d+(\.\d+)?%/,
		/\$[\d,]+(\.\d+)?/,
		/\d{4}/,
		/\d+\s+(?:people|percent|million|billion|thousand)/i,
		/according to/i,
		/study|research|data|statistics|survey|poll/i,
	];

	const sentencesWithFacts = sentences.filter(sentence =>
		factIndicators.some(pattern => pattern.test(sentence)),
	);

	return sentences.length > 0
		? sentencesWithFacts.length / sentences.length
		: 0;
}

/**
 * Anthropic tool definition for evaluateSource
 */
export const evaluateSourceTool = {
	name: 'evaluate_source',
	description:
		"Evaluate a source's credibility, bias, and quality for political writing research. Returns credibility score, bias issues, and recommendations on whether to use the source.",
	input_schema: {
		type: 'object',
		properties: {
			content: {
				type: 'string',
				description: 'The full text content of the source article',
			},
			url: {
				type: 'string',
				description: 'Optional URL of the source for reference',
			},
		},
		required: ['content'],
	},
};

/**
 * Anthropic tool definition for detectSourceBias
 */
export const detectSourceBiasTool = {
	name: 'detect_source_bias',
	description:
		'Detect biased, insensitive, or problematic language in source material using linguistic analysis. Flags gendered, ableist, and other potentially biased terms.',
	input_schema: {
		type: 'object',
		properties: {
			text: {
				type: 'string',
				description: 'The text content to analyze for bias',
			},
		},
		required: ['text'],
	},
};

/**
 * Anthropic tool definition for analyzeSourceQuality
 */
export const analyzeSourceQualityTool = {
	name: 'analyze_source_quality',
	description:
		'Analyze source quality metrics including fact density, citation presence, author attribution, and reading level. Helps determine if a source is suitable for academic political research.',
	input_schema: {
		type: 'object',
		properties: {
			content: {
				type: 'string',
				description: 'The article text content to analyze',
			},
		},
		required: ['content'],
	},
};

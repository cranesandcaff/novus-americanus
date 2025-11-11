import {
	analyzeReadability,
	analyzeStyle,
	checkRepetition,
	type ReadabilityMetrics,
	type StyleMetrics,
	type AnalysisResult,
} from '../../analysis/TextAnalysisToolkit.js';

export type DraftQuality = {
	readability: ReadabilityMetrics;
	style: StyleMetrics;
	repetition: {
		overusedWords: Array<{word: string; count: number}>;
		repeatedPhrases: Array<{phrase: string; count: number}>;
	};
	overallScore: number;
	readyForReview: boolean;
};

/**
 * Comprehensive draft analysis for journalist agent
 */
export async function analyzeDraft(
	draft: string,
): Promise<AnalysisResult<DraftQuality>> {
	if (!draft || draft.trim().length === 0) {
		throw new Error('Draft cannot be empty');
	}

	const [readabilityResult, styleResult, repetitionResult] = await Promise.all([
		analyzeReadability(draft),
		analyzeStyle(draft),
		checkRepetition(draft),
	]);

	let overallScore = 100;

	if (!readabilityResult.passed) {
		overallScore -= 15;
	}

	if (!styleResult.passed) {
		overallScore -= 20;
	}

	if (!repetitionResult.passed) {
		overallScore -= 10;
	}

	if (styleResult.metrics.passiveVoicePercentage > 15) {
		overallScore -= 10;
	}

	if (readabilityResult.metrics.fleschKincaidGrade > 13) {
		overallScore -= 10;
	}

	overallScore = Math.max(0, overallScore);

	const readyForReview = overallScore >= 70;

	const metrics: DraftQuality = {
		readability: readabilityResult.metrics,
		style: styleResult.metrics,
		repetition: repetitionResult.metrics,
		overallScore,
		readyForReview,
	};

	const allIssues = [
		...readabilityResult.issues,
		...styleResult.issues,
		...repetitionResult.issues,
	];

	const recommendations = [
		...new Set([
			...readabilityResult.recommendations,
			...styleResult.recommendations,
			...repetitionResult.recommendations,
		]),
	];

	if (!readyForReview) {
		recommendations.push(
			`Overall score (${overallScore}/100) needs improvement before review`,
		);
	}

	const passed = readyForReview;

	return {
		metrics,
		issues: allIssues,
		recommendations,
		passed,
	};
}

/**
 * Analyze writing style specifically for political essays
 */
export async function analyzePoliticalStyle(
	draft: string,
): Promise<AnalysisResult<StyleMetrics>> {
	return analyzeStyle(draft);
}

/**
 * Check for overused words and repetitive phrases
 */
export async function checkDraftRepetition(draft: string): Promise<
	AnalysisResult<{
		overusedWords: Array<{word: string; count: number}>;
		repeatedPhrases: Array<{phrase: string; count: number}>;
	}>
> {
	return checkRepetition(draft);
}

/**
 * Generate actionable editing recommendations
 */
export async function generateEditingRecommendations(draft: string): Promise<{
	topPriority: string[];
	styleImprovements: string[];
	readabilityImprovements: string[];
	vocabularyImprovements: string[];
}> {
	if (!draft || draft.trim().length === 0) {
		throw new Error('Draft cannot be empty');
	}

	const [readabilityResult, styleResult, repetitionResult] = await Promise.all([
		analyzeReadability(draft),
		analyzeStyle(draft),
		checkRepetition(draft),
	]);

	const topPriority: string[] = [];
	const styleImprovements: string[] = [];
	const readabilityImprovements: string[] = [];
	const vocabularyImprovements: string[] = [];

	for (const issue of [
		...readabilityResult.issues,
		...styleResult.issues,
		...repetitionResult.issues,
	]) {
		if (issue.severity === 'high') {
			topPriority.push(issue.suggestion);
		}
	}

	if (styleResult.metrics.passiveVoicePercentage > 10) {
		styleImprovements.push(
			`Reduce passive voice from ${styleResult.metrics.passiveVoicePercentage.toFixed(
				1,
			)}% to under 10%`,
		);
		styleImprovements.push(
			'Convert passive constructions like "was done by" to active voice',
		);
	}

	if (styleResult.metrics.transitionDensity < 15) {
		styleImprovements.push(
			'Add transition words (however, moreover, therefore) to improve flow',
		);
	}

	if (readabilityResult.metrics.fleschKincaidGrade > 12) {
		readabilityImprovements.push(
			'Simplify sentences to reach 10th-12th grade reading level',
		);
		readabilityImprovements.push(
			'Break complex sentences into shorter, clearer statements',
		);
	}

	if (readabilityResult.metrics.gunningFog > 14) {
		readabilityImprovements.push(
			'Reduce complex words (3+ syllables) to improve accessibility',
		);
	}

	if (styleResult.metrics.lexicalDiversity < 0.5) {
		vocabularyImprovements.push(
			'Increase vocabulary variety - lexical diversity is below 0.5',
		);
	}

	if (repetitionResult.metrics.overusedWords.length > 0) {
		const topWords = repetitionResult.metrics.overusedWords
			.slice(0, 3)
			.map(w => `"${w.word}" (${w.count} times)`)
			.join(', ');
		vocabularyImprovements.push(
			`Find synonyms for overused words: ${topWords}`,
		);
	}

	if (repetitionResult.metrics.repeatedPhrases.length > 0) {
		vocabularyImprovements.push(
			'Rephrase repeated expressions to maintain reader engagement',
		);
	}

	return {
		topPriority,
		styleImprovements,
		readabilityImprovements,
		vocabularyImprovements,
	};
}

/**
 * Quick readability check for target audience
 */
export async function checkTargetReadability(
	draft: string,
	targetGradeLevel: number = 11,
): Promise<{
	meetsTarget: boolean;
	currentLevel: number;
	difference: number;
	recommendation: string;
}> {
	if (!draft || draft.trim().length === 0) {
		throw new Error('Draft cannot be empty');
	}

	const result = await analyzeReadability(draft);
	const currentLevel = result.metrics.fleschKincaidGrade;
	const difference = currentLevel - targetGradeLevel;

	let recommendation: string;
	if (Math.abs(difference) <= 1) {
		recommendation = 'Reading level is appropriate for target audience';
	} else if (difference > 1) {
		recommendation = `Text is too complex. Simplify by ${Math.round(
			difference,
		)} grade levels`;
	} else {
		recommendation = `Text may be too simple. Consider adding more sophisticated vocabulary`;
	}

	return {
		meetsTarget: Math.abs(difference) <= 1,
		currentLevel,
		difference,
		recommendation,
	};
}

/**
 * Anthropic tool definition for analyzeDraft
 */
export const analyzeDraftTool = {
	name: 'analyze_draft',
	description:
		'Comprehensive analysis of essay draft including readability, style, and repetition. Returns overall quality score and readiness for review.',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The full essay draft text to analyze',
			},
		},
		required: ['draft'],
	},
};

/**
 * Anthropic tool definition for analyzePoliticalStyle
 */
export const analyzePoliticalStyleTool = {
	name: 'analyze_political_style',
	description:
		'Analyze writing style for political essays, checking passive voice, lexical diversity, sentence length, and transition usage.',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The essay text to analyze for style',
			},
		},
		required: ['draft'],
	},
};

/**
 * Anthropic tool definition for checkDraftRepetition
 */
export const checkDraftRepetitionTool = {
	name: 'check_draft_repetition',
	description:
		'Identify overused words and repeated phrases in the draft that should be varied for better writing quality.',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The essay draft to check for repetition',
			},
		},
		required: ['draft'],
	},
};

/**
 * Anthropic tool definition for generateEditingRecommendations
 */
export const generateEditingRecommendationsTool = {
	name: 'generate_editing_recommendations',
	description:
		'Generate prioritized, actionable editing recommendations organized by category: top priority issues, style improvements, readability improvements, and vocabulary improvements.',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The essay draft to generate recommendations for',
			},
		},
		required: ['draft'],
	},
};

/**
 * Anthropic tool definition for checkTargetReadability
 */
export const checkTargetReadabilityTool = {
	name: 'check_target_readability',
	description:
		'Check if the draft meets the target reading level (default: 11th grade for political essays).',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The essay draft to check',
			},
			targetGradeLevel: {
				type: 'number',
				description: 'Target grade level (default: 11)',
			},
		},
		required: ['draft'],
	},
};

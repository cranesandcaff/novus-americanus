import {
	analyzeReadability,
	detectBias,
	analyzeStyle,
	analyzeStructure,
	checkCitations,
	checkRepetition,
	type ReadabilityMetrics,
	type StyleMetrics,
	type StructureAnalysis,
	type CitationCheck,
	type AnalysisResult,
	type QualityIssue,
} from '../../analysis/TextAnalysisToolkit.js';

export type ComprehensiveReview = {
	readability: ReadabilityMetrics;
	style: StyleMetrics;
	structure: StructureAnalysis;
	citations: CitationCheck;
	biasScore: number;
	overallScore: number;
	criticalIssues: QualityIssue[];
	allIssues: QualityIssue[];
	recommendations: string[];
	publicationReady: boolean;
};

export type OutlineAdherence = {
	coveragePercentage: number;
	missingSections: string[];
	extraSections: string[];
	outOfOrderSections: string[];
	adherenceScore: number;
	meetsRequirements: boolean;
};

export type ClaimVerification = {
	totalClaims: number;
	citedClaims: number;
	uncitedClaims: Array<{
		claim: string;
		context: string;
		severity: 'high' | 'medium' | 'low';
	}>;
	citationCoverage: number;
	needsImprovement: boolean;
};

/**
 * Comprehensive review of complete essay draft
 */
export async function reviewComplete(
	draft: string,
	outline?: string,
	sources?: string[],
): Promise<AnalysisResult<ComprehensiveReview>> {
	if (!draft || draft.trim().length === 0) {
		throw new Error('Draft cannot be empty');
	}

	const [
		readabilityResult,
		biasResult,
		styleResult,
		structureResult,
		citationResult,
		repetitionResult,
	] = await Promise.all([
		analyzeReadability(draft),
		detectBias(draft),
		analyzeStyle(draft),
		analyzeStructure(draft),
		checkCitations(draft),
		checkRepetition(draft),
	]);

	let overallScore = 100;

	if (!readabilityResult.passed) {
		overallScore -= 15;
	}

	if (!styleResult.passed) {
		overallScore -= 20;
	}

	if (!structureResult.passed) {
		overallScore -= 15;
	}

	if (!citationResult.passed) {
		overallScore -= 25;
	}

	if (biasResult.metrics.issuesFound > 0) {
		overallScore -= Math.min(25, biasResult.metrics.issuesFound * 5);
	}

	overallScore = Math.max(0, overallScore);

	const allIssues = [
		...readabilityResult.issues,
		...biasResult.issues,
		...styleResult.issues,
		...structureResult.issues,
		...citationResult.issues,
		...repetitionResult.issues,
	];

	const criticalIssues = allIssues.filter(issue => issue.severity === 'high');

	const recommendations = [
		...new Set([
			...readabilityResult.recommendations,
			...biasResult.recommendations,
			...styleResult.recommendations,
			...structureResult.recommendations,
			...citationResult.recommendations,
			...repetitionResult.recommendations,
		]),
	];

	if (outline) {
		recommendations.push(
			'Verify all outline sections are addressed in the draft',
		);
	}

	if (sources && sources.length > 0) {
		recommendations.push(
			`Verify all ${sources.length} sources are properly cited in the text`,
		);
	}

	const publicationReady = overallScore >= 85 && criticalIssues.length === 0;

	if (!publicationReady) {
		recommendations.unshift(
			`Address ${criticalIssues.length} critical issue(s) before publication`,
		);
	}

	const metrics: ComprehensiveReview = {
		readability: readabilityResult.metrics,
		style: styleResult.metrics,
		structure: structureResult.metrics,
		citations: citationResult.metrics,
		biasScore: biasResult.metrics.issuesFound,
		overallScore,
		criticalIssues,
		allIssues,
		recommendations,
		publicationReady,
	};

	return {
		metrics,
		issues: allIssues,
		recommendations,
		passed: publicationReady,
	};
}

/**
 * Check if draft adheres to the outline
 */
export async function checkOutlineAdherence(
	draft: string,
	outline: string,
): Promise<AnalysisResult<OutlineAdherence>> {
	if (!draft || draft.trim().length === 0) {
		throw new Error('Draft cannot be empty');
	}

	if (!outline || outline.trim().length === 0) {
		throw new Error('Outline cannot be empty');
	}

	const outlineSections = extractOutlineSections(outline);
	const draftSections = extractDraftSections(draft);

	const missingSections: string[] = [];
	const extraSections: string[] = [];
	const outOfOrderSections: string[] = [];

	let coveredCount = 0;

	for (const outlineSection of outlineSections) {
		const found = draftSections.some(draftSection =>
			isSectionMatch(draftSection, outlineSection),
		);

		if (found) {
			coveredCount++;
		} else {
			missingSections.push(outlineSection);
		}
	}

	for (const draftSection of draftSections) {
		const found = outlineSections.some(outlineSection =>
			isSectionMatch(draftSection, outlineSection),
		);

		if (!found && draftSection.length > 10) {
			extraSections.push(draftSection);
		}
	}

	for (
		let i = 0;
		i < Math.min(outlineSections.length, draftSections.length);
		i++
	) {
		const draftSection = draftSections[i];
		const outlineSection = outlineSections[i];

		if (
			draftSection &&
			outlineSection &&
			!isSectionMatch(draftSection, outlineSection)
		) {
			outOfOrderSections.push(outlineSection);
		}
	}

	const coveragePercentage =
		outlineSections.length > 0
			? (coveredCount / outlineSections.length) * 100
			: 100;

	const adherenceScore = Math.max(
		0,
		coveragePercentage -
			extraSections.length * 5 -
			outOfOrderSections.length * 3,
	);

	const meetsRequirements =
		coveragePercentage >= 90 &&
		missingSections.length === 0 &&
		outOfOrderSections.length === 0;

	const metrics: OutlineAdherence = {
		coveragePercentage,
		missingSections,
		extraSections,
		outOfOrderSections,
		adherenceScore,
		meetsRequirements,
	};

	const issues: QualityIssue[] = [];
	const recommendations: string[] = [];

	if (missingSections.length > 0) {
		issues.push({
			type: 'structure',
			severity: 'high',
			message: `Missing ${missingSections.length} outline section(s)`,
			suggestion: `Add sections: ${missingSections.slice(0, 3).join(', ')}`,
		});
	}

	if (outOfOrderSections.length > 0) {
		issues.push({
			type: 'structure',
			severity: 'medium',
			message: `${outOfOrderSections.length} section(s) appear out of order`,
			suggestion: 'Reorganize to match outline structure',
		});
	}

	if (extraSections.length > 0) {
		recommendations.push(
			`Review ${extraSections.length} section(s) not in outline - ensure they add value`,
		);
	}

	if (coveragePercentage < 100) {
		recommendations.push(
			`Outline coverage is ${coveragePercentage.toFixed(1)}% - aim for 100%`,
		);
	}

	return {
		metrics,
		issues,
		recommendations,
		passed: meetsRequirements,
	};
}

/**
 * Identify claims that need citations
 */
export async function checkClaimsNeedCitation(
	draft: string,
): Promise<AnalysisResult<ClaimVerification>> {
	if (!draft || draft.trim().length === 0) {
		throw new Error('Draft cannot be empty');
	}

	const citationResult = await checkCitations(draft);

	const uncitedClaims = citationResult.metrics.unsubstantiatedClaims.map(
		claim => {
			let severity: 'high' | 'medium' | 'low' = 'medium';

			if (/\d+%|\$[\d,]+/i.test(claim.claim)) {
				severity = 'high';
			} else if (/studies? show|research|data|statistics/i.test(claim.claim)) {
				severity = 'high';
			} else if (/according to|report/i.test(claim.claim)) {
				severity = 'medium';
			}

			return {
				claim: claim.claim,
				context: claim.context,
				severity,
			};
		},
	);

	const totalClaims =
		citationResult.metrics.totalCitations + uncitedClaims.length;
	const citedClaims = citationResult.metrics.totalCitations;
	const citationCoverage = totalClaims > 0 ? citedClaims / totalClaims : 1;

	const metrics: ClaimVerification = {
		totalClaims,
		citedClaims,
		uncitedClaims,
		citationCoverage,
		needsImprovement: uncitedClaims.length > 0,
	};

	const issues: QualityIssue[] = [];
	const recommendations: string[] = [];

	const highPriorityClaims = uncitedClaims.filter(c => c.severity === 'high');

	if (highPriorityClaims.length > 0) {
		issues.push({
			type: 'citation',
			severity: 'high',
			message: `${highPriorityClaims.length} high-priority claim(s) need citations`,
			suggestion: 'Add citations for all statistics and data-driven claims',
		});
	}

	if (uncitedClaims.length > 0) {
		recommendations.push(
			`Add citations for ${uncitedClaims.length} unsubstantiated claim(s)`,
		);
		recommendations.push(
			'Review each claim containing numbers, statistics, or research references',
		);
	}

	if (citationCoverage < 0.8) {
		recommendations.push(
			`Citation coverage (${(citationCoverage * 100).toFixed(
				1,
			)}%) should be above 80%`,
		);
	}

	return {
		metrics,
		issues,
		recommendations,
		passed: uncitedClaims.length === 0,
	};
}

/**
 * Generate actionable improvement recommendations
 */
export async function generateRecommendations(draft: string): Promise<{
	immediate: string[];
	important: string[];
	optional: string[];
	estimatedRevisionTime: string;
}> {
	if (!draft || draft.trim().length === 0) {
		throw new Error('Draft cannot be empty');
	}

	const [
		readabilityResult,
		biasResult,
		styleResult,
		structureResult,
		citationResult,
	] = await Promise.all([
		analyzeReadability(draft),
		detectBias(draft),
		analyzeStyle(draft),
		analyzeStructure(draft),
		checkCitations(draft),
	]);

	const immediate: string[] = [];
	const important: string[] = [];
	const optional: string[] = [];

	const allIssues = [
		...readabilityResult.issues,
		...biasResult.issues,
		...styleResult.issues,
		...structureResult.issues,
		...citationResult.issues,
	];

	for (const issue of allIssues) {
		if (issue.severity === 'high') {
			immediate.push(issue.suggestion);
		} else if (issue.severity === 'medium') {
			important.push(issue.suggestion);
		} else {
			optional.push(issue.suggestion);
		}
	}

	if (biasResult.metrics.issuesFound > 0) {
		immediate.unshift('Address all biased language before publication');
	}

	if (citationResult.metrics.unsubstantiatedClaims.length > 0) {
		immediate.push('Add citations for all factual claims and statistics');
	}

	if (!structureResult.metrics.hasIntroduction) {
		immediate.push('Add a clear introduction section');
	}

	if (!structureResult.metrics.hasConclusion) {
		immediate.push('Add a conclusion that synthesizes arguments');
	}

	let estimatedMinutes = 0;
	estimatedMinutes += immediate.length * 15;
	estimatedMinutes += important.length * 10;
	estimatedMinutes += optional.length * 5;

	const estimatedRevisionTime =
		estimatedMinutes < 60
			? `${estimatedMinutes} minutes`
			: `${Math.round(estimatedMinutes / 60)} hour(s)`;

	return {
		immediate,
		important,
		optional,
		estimatedRevisionTime,
	};
}

/**
 * Extract sections from outline
 */
function extractOutlineSections(outline: string): string[] {
	const sections: string[] = [];
	const lines = outline.split('\n');

	for (const line of lines) {
		const match = line.match(/^#{1,6}\s+(.+)$/);
		if (match && match[1]) {
			sections.push(match[1].trim().toLowerCase());
		}
	}

	return sections;
}

/**
 * Extract sections from draft
 */
function extractDraftSections(draft: string): string[] {
	const sections: string[] = [];
	const lines = draft.split('\n');

	for (const line of lines) {
		const match = line.match(/^#{1,6}\s+(.+)$/);
		if (match && match[1]) {
			sections.push(match[1].trim().toLowerCase());
		}
	}

	return sections;
}

/**
 * Check if two section titles match
 */
function isSectionMatch(section1: string, section2: string): boolean {
	const normalize = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^\w\s]/g, '')
			.trim();

	const norm1 = normalize(section1);
	const norm2 = normalize(section2);

	if (norm1 === norm2) {
		return true;
	}

	if (norm1.includes(norm2) || norm2.includes(norm1)) {
		return true;
	}

	const words1 = new Set(norm1.split(/\s+/));
	const words2 = new Set(norm2.split(/\s+/));

	const intersection = new Set([...words1].filter(word => words2.has(word)));

	return intersection.size >= Math.min(words1.size, words2.size) * 0.6;
}

/**
 * Anthropic tool definition for reviewComplete
 */
export const reviewCompleteTool = {
	name: 'review_complete',
	description:
		'Comprehensive review of a complete essay draft. Analyzes readability, style, structure, citations, and bias. Returns overall quality score and publication readiness.',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The complete essay draft to review',
			},
			outline: {
				type: 'string',
				description: 'Optional outline to check adherence against',
			},
			sources: {
				type: 'array',
				items: {type: 'string'},
				description: 'Optional list of source URLs that should be cited',
			},
		},
		required: ['draft'],
	},
};

/**
 * Anthropic tool definition for checkOutlineAdherence
 */
export const checkOutlineAdherenceTool = {
	name: 'check_outline_adherence',
	description:
		'Verify that the essay draft covers all sections from the outline and follows the planned structure.',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The essay draft to check',
			},
			outline: {
				type: 'string',
				description: 'The outline to compare against',
			},
		},
		required: ['draft', 'outline'],
	},
};

/**
 * Anthropic tool definition for checkClaimsNeedCitation
 */
export const checkClaimsNeedCitationTool = {
	name: 'check_claims_need_citation',
	description:
		'Identify all factual claims, statistics, and data points that need citations. Prioritizes claims by severity.',
	input_schema: {
		type: 'object',
		properties: {
			draft: {
				type: 'string',
				description: 'The essay draft to check for uncited claims',
			},
		},
		required: ['draft'],
	},
};

/**
 * Anthropic tool definition for generateRecommendations
 */
export const generateRecommendationsTool = {
	name: 'generate_recommendations',
	description:
		'Generate prioritized, actionable improvement recommendations organized by urgency: immediate (must fix), important (should fix), and optional (nice to have). Includes estimated revision time.',
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

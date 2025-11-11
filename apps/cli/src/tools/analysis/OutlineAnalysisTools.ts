import {
	analyzeStructure,
	type AnalysisResult,
} from '../../analysis/TextAnalysisToolkit.js';
import nlp from 'compromise';

export type OutlineCoherence = {
	logicalFlow: 'strong' | 'moderate' | 'weak';
	transitionDensity: number;
	hasIntroduction: boolean;
	hasConclusion: boolean;
	sectionCount: number;
	averageSectionLength: number;
	topicProgression: 'clear' | 'unclear';
};

export type OutlineStructure = {
	hasIntroSection: boolean;
	hasBodySections: boolean;
	hasConclusionSection: boolean;
	sectionCount: number;
	subsectionCount: number;
	depth: number;
	balanced: boolean;
};

export type TransitionAnalysis = {
	transitionWordCount: number;
	transitionDensity: number;
	transitionWords: string[];
	weakTransitions: string[];
	recommendations: string[];
};

/**
 * Analyze outline coherence and logical flow
 */
export async function analyzeOutlineCoherence(
	outline: string,
): Promise<AnalysisResult<OutlineCoherence>> {
	if (!outline || outline.trim().length === 0) {
		throw new Error('Outline cannot be empty');
	}

	const structureResult = await analyzeStructure(outline);

	const sections = extractSections(outline);
	const sectionCount = sections.length;

	const totalSectionLength = sections.reduce(
		(sum, section) => sum + section.content.split(/\s+/).length,
		0,
	);
	const averageSectionLength =
		sectionCount > 0 ? totalSectionLength / sectionCount : 0;

	const topicProgression = analyzeTopicProgression(sections);

	const transitionWords = structureResult.metrics.transitionWords;
	const transitionDensity =
		sectionCount > 0 ? transitionWords.length / sectionCount : 0;

	const metrics: OutlineCoherence = {
		logicalFlow: structureResult.metrics.logicalFlow,
		transitionDensity,
		hasIntroduction: structureResult.metrics.hasIntroduction,
		hasConclusion: structureResult.metrics.hasConclusion,
		sectionCount,
		averageSectionLength,
		topicProgression,
	};

	const issues = [...structureResult.issues];
	const recommendations = [...structureResult.recommendations];

	if (topicProgression === 'unclear') {
		issues.push({
			type: 'structure',
			severity: 'high',
			message: 'Topic progression is unclear or disjointed',
			suggestion:
				'Reorganize sections to follow a logical progression of ideas',
		});
		recommendations.push(
			'Ensure each section builds logically on the previous one',
		);
	}

	if (sectionCount < 4) {
		issues.push({
			type: 'structure',
			severity: 'medium',
			message: 'Outline has fewer than 4 main sections',
			suggestion: 'Expand outline with more detailed sections',
		});
	}

	if (averageSectionLength < 20) {
		recommendations.push('Consider adding more detail to section descriptions');
	}

	const passed =
		metrics.logicalFlow !== 'weak' &&
		metrics.hasIntroduction &&
		metrics.hasConclusion &&
		topicProgression === 'clear' &&
		sectionCount >= 4;

	return {
		metrics,
		issues,
		recommendations,
		passed,
	};
}

/**
 * Check outline structure for essential components
 */
export async function checkOutlineStructure(
	outline: string,
): Promise<AnalysisResult<OutlineStructure>> {
	if (!outline || outline.trim().length === 0) {
		throw new Error('Outline cannot be empty');
	}

	const sections = extractSections(outline);

	const hasIntroSection = sections.some(
		s =>
			s.title.toLowerCase().includes('intro') ||
			s.title.toLowerCase().includes('overview') ||
			s.level === 1,
	);

	const hasConclusionSection = sections.some(
		s =>
			s.title.toLowerCase().includes('conclusion') ||
			s.title.toLowerCase().includes('summary') ||
			s.title.toLowerCase().includes('final'),
	);

	const hasBodySections =
		sections.filter(
			s =>
				!s.title.toLowerCase().includes('intro') &&
				!s.title.toLowerCase().includes('conclusion'),
		).length >= 3;

	const sectionCount = sections.filter(s => s.level === 1).length;
	const subsectionCount = sections.filter(s => s.level > 1).length;

	const depth = Math.max(...sections.map(s => s.level), 0);

	const sectionLengths = sections.map(s => s.content.split(/\s+/).length);
	const avgLength =
		sectionLengths.reduce((sum, len) => sum + len, 0) / sectionLengths.length;
	const balanced = sectionLengths.every(
		len => Math.abs(len - avgLength) < avgLength * 0.5,
	);

	const metrics: OutlineStructure = {
		hasIntroSection,
		hasBodySections,
		hasConclusionSection,
		sectionCount,
		subsectionCount,
		depth,
		balanced,
	};

	const issues: Array<{
		type:
			| 'readability'
			| 'structure'
			| 'style'
			| 'citation'
			| 'bias'
			| 'repetition';
		severity: 'high' | 'medium' | 'low';
		message: string;
		suggestion: string;
	}> = [];
	const recommendations: string[] = [];

	if (!hasIntroSection) {
		issues.push({
			type: 'structure',
			severity: 'high',
			message: 'Outline lacks an introduction section',
			suggestion:
				'Add an introduction section that previews the essay structure',
		});
	}

	if (!hasConclusionSection) {
		issues.push({
			type: 'structure',
			severity: 'high',
			message: 'Outline lacks a conclusion section',
			suggestion: 'Add a conclusion section to synthesize main arguments',
		});
	}

	if (!hasBodySections) {
		issues.push({
			type: 'structure',
			severity: 'high',
			message: 'Outline needs at least 3 body sections',
			suggestion: 'Develop more main argument sections',
		});
	}

	if (depth < 2) {
		recommendations.push(
			'Consider adding subsections to provide more detail in the outline',
		);
	}

	if (!balanced) {
		recommendations.push(
			'Section lengths are imbalanced - consider redistributing content',
		);
	}

	const passed = hasIntroSection && hasBodySections && hasConclusionSection;

	return {
		metrics,
		issues,
		recommendations,
		passed,
	};
}

/**
 * Analyze transitions between outline sections
 */
export async function analyzeOutlineTransitions(
	outline: string,
): Promise<AnalysisResult<TransitionAnalysis>> {
	if (!outline || outline.trim().length === 0) {
		throw new Error('Outline cannot be empty');
	}

	const transitionWords = [
		'however',
		'moreover',
		'furthermore',
		'therefore',
		'consequently',
		'nevertheless',
		'first',
		'second',
		'third',
		'finally',
		'next',
		'then',
		'additionally',
		'meanwhile',
		'similarly',
		'conversely',
	];

	const foundTransitions: string[] = [];
	const sections = extractSections(outline);

	for (const section of sections) {
		const sectionLower = section.content.toLowerCase();
		for (const transition of transitionWords) {
			if (
				sectionLower.includes(transition) &&
				!foundTransitions.includes(transition)
			) {
				foundTransitions.push(transition);
			}
		}
	}

	const transitionDensity =
		sections.length > 0 ? foundTransitions.length / sections.length : 0;

	const weakTransitions: string[] = [];
	for (let i = 1; i < sections.length; i++) {
		const previousSection = sections[i - 1];
		const currentSection = sections[i];

		if (!previousSection || !currentSection) {
			continue;
		}

		const hasTransition = transitionWords.some(
			tw =>
				currentSection.content.toLowerCase().includes(tw) ||
				previousSection.content.toLowerCase().includes(tw),
		);

		if (!hasTransition) {
			weakTransitions.push(
				`Between "${previousSection.title}" and "${currentSection.title}"`,
			);
		}
	}

	const metrics: TransitionAnalysis = {
		transitionWordCount: foundTransitions.length,
		transitionDensity,
		transitionWords: foundTransitions,
		weakTransitions,
		recommendations: [],
	};

	const issues: Array<{
		type:
			| 'readability'
			| 'structure'
			| 'style'
			| 'citation'
			| 'bias'
			| 'repetition';
		severity: 'high' | 'medium' | 'low';
		message: string;
		suggestion: string;
	}> = [];
	const recommendations: string[] = [];

	if (transitionDensity < 0.5 && sections.length > 2) {
		issues.push({
			type: 'structure',
			severity: 'medium',
			message: `Low transition density (${(transitionDensity * 100).toFixed(
				1,
			)}%)`,
			suggestion: 'Add transition indicators to show how sections connect',
		});
		recommendations.push(
			'Add transition words or phrases to explain how each section relates to the next',
		);
	}

	if (weakTransitions.length > 0) {
		recommendations.push(
			`Add transitions between: ${weakTransitions.slice(0, 2).join('; ')}`,
		);
	}

	metrics.recommendations = recommendations;

	const passed = transitionDensity >= 0.5 || sections.length <= 2;

	return {
		metrics,
		issues,
		recommendations,
		passed,
	};
}

/**
 * Extract sections from outline text
 */
function extractSections(
	outline: string,
): Array<{title: string; content: string; level: number}> {
	const sections: Array<{title: string; content: string; level: number}> = [];

	const lines = outline.split('\n');
	let currentSection: {title: string; content: string; level: number} | null =
		null;

	for (const line of lines) {
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

		if (headingMatch) {
			if (currentSection) {
				sections.push(currentSection);
			}

			const level = headingMatch[1]?.length ?? 1;
			const title = headingMatch[2]?.trim() ?? '';

			currentSection = {
				title,
				content: '',
				level,
			};
		} else if (currentSection && line.trim().length > 0) {
			currentSection.content += line + '\n';
		}
	}

	if (currentSection) {
		sections.push(currentSection);
	}

	return sections;
}

/**
 * Analyze topic progression through sections
 */
function analyzeTopicProgression(
	sections: Array<{title: string; content: string; level: number}>,
): 'clear' | 'unclear' {
	if (sections.length < 2) {
		return 'clear';
	}

	let overlapScore = 0;

	for (let i = 1; i < sections.length; i++) {
		const previousSection = sections[i - 1];
		const currentSection = sections[i];

		if (!previousSection || !currentSection) {
			continue;
		}

		const prevDoc = nlp(previousSection.content);
		const currDoc = nlp(currentSection.content);

		const prevNouns = new Set(
			prevDoc
				.nouns()
				.out('array')
				.map((n: string) => n.toLowerCase()),
		);
		const currNouns = new Set(
			currDoc
				.nouns()
				.out('array')
				.map((n: string) => n.toLowerCase()),
		);

		const intersection = new Set(
			[...prevNouns].filter(noun => currNouns.has(noun)),
		);

		const overlap = intersection.size / Math.max(prevNouns.size, 1);

		if (overlap > 0.1) {
			overlapScore += 1;
		}
	}

	const progressionScore = overlapScore / (sections.length - 1);

	return progressionScore > 0.3 ? 'clear' : 'unclear';
}

/**
 * Anthropic tool definition for analyzeOutlineCoherence
 */
export const analyzeOutlineCoherenceTool = {
	name: 'analyze_outline_coherence',
	description:
		'Analyze the logical flow and coherence of an essay outline. Checks for clear progression of ideas, appropriate transitions, and structural completeness.',
	input_schema: {
		type: 'object',
		properties: {
			outline: {
				type: 'string',
				description: 'The essay outline in markdown format with headings',
			},
		},
		required: ['outline'],
	},
};

/**
 * Anthropic tool definition for checkOutlineStructure
 */
export const checkOutlineStructureTool = {
	name: 'check_outline_structure',
	description:
		'Verify that an outline has all essential components: introduction, body sections, and conclusion. Analyzes section balance and depth.',
	input_schema: {
		type: 'object',
		properties: {
			outline: {
				type: 'string',
				description: 'The essay outline to check for structural completeness',
			},
		},
		required: ['outline'],
	},
};

/**
 * Anthropic tool definition for analyzeOutlineTransitions
 */
export const analyzeOutlineTransitionsTool = {
	name: 'analyze_outline_transitions',
	description:
		'Analyze transitions between sections in an outline to ensure logical connections and flow.',
	input_schema: {
		type: 'object',
		properties: {
			outline: {
				type: 'string',
				description: 'The essay outline to analyze for transitions',
			},
		},
		required: ['outline'],
	},
};

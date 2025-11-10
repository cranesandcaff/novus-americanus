import {
	fleschKincaidGrade,
	gunningFog,
	automatedReadabilityIndex,
	smog,
	daleChallReadabilityScore,
} from 'text-readability';
import nlp from 'compromise';
import {retext} from 'retext';
import retextEquality from 'retext-equality';
import {VFile} from 'vfile';

export type ReadabilityMetrics = {
	fleschKincaidGrade: number;
	gunningFog: number;
	automatedReadabilityIndex: number;
	smog: number;
	daleChall: number;
	estimatedReadingTimeMinutes: number;
	wordCount: number;
};

export type BiasIssue = {
	type: 'bias' | 'profanity' | 'insensitive';
	text: string;
	line?: number;
	column?: number;
	reason: string;
	suggestion?: string;
};

export type StyleMetrics = {
	averageSentenceLength: number;
	passiveVoicePercentage: number;
	lexicalDiversity: number;
	complexWordPercentage: number;
	transitionDensity: number;
	sentenceCount: number;
};

export type StructureAnalysis = {
	hasIntroduction: boolean;
	hasConclusion: boolean;
	bodyParagraphCount: number;
	headingCount: number;
	averageParagraphLength: number;
	logicalFlow: 'strong' | 'moderate' | 'weak';
	transitionWords: string[];
};

export type CitationCheck = {
	totalCitations: number;
	citationDensity: number;
	unsubstantiatedClaims: Array<{
		claim: string;
		context: string;
	}>;
	needsCitation: boolean;
};

export type QualityIssue = {
	type:
		| 'readability'
		| 'structure'
		| 'style'
		| 'citation'
		| 'bias'
		| 'repetition';
	severity: 'high' | 'medium' | 'low';
	message: string;
	location?: string;
	suggestion: string;
};

export type AnalysisResult<T> = {
	metrics: T;
	issues: QualityIssue[];
	recommendations: string[];
	passed: boolean;
};

const TRANSITION_WORDS = [
	'however',
	'moreover',
	'furthermore',
	'therefore',
	'consequently',
	'nevertheless',
	'additionally',
	'meanwhile',
	'similarly',
	'conversely',
	'thus',
	'hence',
	'accordingly',
	'likewise',
	'alternatively',
	'specifically',
	'namely',
	'indeed',
	'finally',
	'overall',
	'in contrast',
	'on the other hand',
	'for example',
	'for instance',
	'in fact',
	'as a result',
	'in addition',
	'in conclusion',
	'to illustrate',
	'that said',
];

const CLAIM_INDICATORS = [
	/\d+(\.\d+)?%/,
	/\$[\d,]+/,
	/\d{4}/,
	/according to/i,
	/studies? show/i,
	/research (?:shows|indicates|suggests)/i,
	/data (?:shows|indicates|suggests)/i,
	/statistics show/i,
	/evidence (?:shows|suggests|indicates)/i,
	/report(?:s|ed) that/i,
	/survey(?:s|ed)/i,
	/poll(?:s|ed)/i,
];

const CITATION_PATTERNS = [
	/\[\d+\]/,
	/\(\w+,?\s+\d{4}\)/,
	/\(\w+\s+et\s+al\.,?\s+\d{4}\)/,
	/\d{4}\)/,
	/\^/,
	/†/,
	/\*\*/,
];

/**
 * Calculate readability metrics for political essay writing
 */
export async function analyzeReadability(
	text: string,
): Promise<AnalysisResult<ReadabilityMetrics>> {
	if (!text || text.trim().length === 0) {
		throw new Error('Text cannot be empty');
	}

	const cleanText = text.trim();
	const wordCount = cleanText.split(/\s+/).length;
	const estimatedReadingTimeMinutes = Math.ceil(wordCount / 250);

	const metrics: ReadabilityMetrics = {
		fleschKincaidGrade: fleschKincaidGrade(cleanText),
		gunningFog: gunningFog(cleanText),
		automatedReadabilityIndex: automatedReadabilityIndex(cleanText),
		smog: smog(cleanText),
		daleChall: daleChallReadabilityScore(cleanText),
		estimatedReadingTimeMinutes,
		wordCount,
	};

	const issues: QualityIssue[] = [];
	const recommendations: string[] = [];

	if (metrics.fleschKincaidGrade < 10) {
		recommendations.push(
			'Content may be too simple for political discourse. Consider adding more sophisticated vocabulary and complex sentence structures.',
		);
	} else if (metrics.fleschKincaidGrade > 12) {
		issues.push({
			type: 'readability',
			severity: 'medium',
			message: `Reading level (${metrics.fleschKincaidGrade.toFixed(
				1,
			)} grade) exceeds target of 10th-12th grade`,
			suggestion:
				'Simplify complex sentences and replace jargon with clearer alternatives',
		});
		recommendations.push(
			'Break down complex sentences and reduce academic jargon to improve accessibility.',
		);
	}

	if (metrics.gunningFog > 14) {
		issues.push({
			type: 'readability',
			severity: 'medium',
			message: `Gunning Fog index (${metrics.gunningFog.toFixed(
				1,
			)}) indicates overly complex writing`,
			suggestion:
				'Reduce use of complex words (3+ syllables) and shorten sentences',
		});
	}

	const passed =
		metrics.fleschKincaidGrade >= 10 &&
		metrics.fleschKincaidGrade <= 12 &&
		metrics.gunningFog <= 14;

	return {
		metrics,
		issues,
		recommendations,
		passed,
	};
}

/**
 * Detect biased, insensitive, or problematic language using retext-equality
 */
export async function detectBias(
	text: string,
): Promise<AnalysisResult<{issuesFound: number}>> {
	if (!text || text.trim().length === 0) {
		throw new Error('Text cannot be empty');
	}

	const file = new VFile({value: text});
	const processor = retext().use(retextEquality);

	await processor.process(file);

	const biasIssues: BiasIssue[] = file.messages.map(message => ({
		type: 'bias',
		text: message.source ?? 'Unknown',
		line: message.line,
		column: message.column,
		reason: message.reason ?? message.message,
		suggestion: message.note ?? undefined,
	}));

	const issues: QualityIssue[] = biasIssues.map(biasIssue => ({
		type: 'bias',
		severity: 'high',
		message: biasIssue.reason,
		location: biasIssue.line
			? `Line ${biasIssue.line}, Column ${biasIssue.column}`
			: undefined,
		suggestion:
			biasIssue.suggestion ?? 'Review and replace with neutral language',
	}));

	const recommendations: string[] = [];
	if (biasIssues.length > 0) {
		recommendations.push(
			'Review flagged language for potential bias or insensitivity',
		);
		recommendations.push(
			'Replace gendered, ableist, or otherwise problematic terms with neutral alternatives',
		);
	}

	return {
		metrics: {issuesFound: biasIssues.length},
		issues,
		recommendations,
		passed: biasIssues.length === 0,
	};
}

/**
 * Analyze writing style including passive voice, lexical diversity, and complexity
 */
export async function analyzeStyle(
	text: string,
): Promise<AnalysisResult<StyleMetrics>> {
	if (!text || text.trim().length === 0) {
		throw new Error('Text cannot be empty');
	}

	const doc = nlp(text);

	const sentences = doc.sentences().out('array');
	const sentenceCount = sentences.length;

	const words = doc
		.terms()
		.out('array')
		.map((w: string) => w.toLowerCase());
	const wordCount = words.length;

	const uniqueWords = new Set(words);
	const lexicalDiversity = uniqueWords.size / wordCount;

	const passiveSentences = doc
		.sentences()
		.filter(s => {
			const sent = s as unknown;
			return (sent as {has: (pattern: string) => boolean}).has('#Passive');
		})
		.out('array');

	const passiveVoicePercentage =
		sentenceCount > 0 ? (passiveSentences.length / sentenceCount) * 100 : 0;

	const averageSentenceLength =
		sentenceCount > 0 ? wordCount / sentenceCount : 0;

	const complexWords = words.filter((word: string) => {
		const syllableCount = countSyllables(word);
		return syllableCount >= 3;
	});
	const complexWordPercentage =
		wordCount > 0 ? (complexWords.length / wordCount) * 100 : 0;

	const transitionCount = sentences.filter((sentence: string) => {
		const lowerSentence = sentence.toLowerCase();
		return TRANSITION_WORDS.some(transition =>
			lowerSentence.includes(transition),
		);
	}).length;

	const transitionDensity =
		sentenceCount > 0 ? (transitionCount / sentenceCount) * 100 : 0;

	const metrics: StyleMetrics = {
		averageSentenceLength,
		passiveVoicePercentage,
		lexicalDiversity,
		complexWordPercentage,
		transitionDensity,
		sentenceCount,
	};

	const issues: QualityIssue[] = [];
	const recommendations: string[] = [];

	if (passiveVoicePercentage > 10) {
		issues.push({
			type: 'style',
			severity: 'medium',
			message: `Passive voice usage (${passiveVoicePercentage.toFixed(
				1,
			)}%) exceeds 10% threshold`,
			suggestion:
				'Convert passive constructions to active voice for clearer, more direct writing',
		});
		recommendations.push(
			'Reduce passive voice by making subjects perform actions directly',
		);
	}

	if (lexicalDiversity < 0.5) {
		issues.push({
			type: 'style',
			severity: 'low',
			message: `Lexical diversity (${lexicalDiversity.toFixed(
				2,
			)}) is below 0.5 threshold`,
			suggestion: 'Vary vocabulary to avoid repetitive word choices',
		});
		recommendations.push(
			'Increase vocabulary variety to make writing more engaging',
		);
	}

	if (transitionDensity < 15) {
		issues.push({
			type: 'style',
			severity: 'medium',
			message: `Transition density (${transitionDensity.toFixed(
				1,
			)}%) is below 15% threshold`,
			suggestion: 'Add more transition words to improve flow between ideas',
		});
		recommendations.push(
			'Incorporate transition words to create smoother logical connections',
		);
	}

	const passed =
		passiveVoicePercentage <= 10 &&
		lexicalDiversity >= 0.5 &&
		transitionDensity >= 15;

	return {
		metrics,
		issues,
		recommendations,
		passed,
	};
}

/**
 * Check for proper citation coverage of factual claims
 */
export async function checkCitations(
	text: string,
): Promise<AnalysisResult<CitationCheck>> {
	if (!text || text.trim().length === 0) {
		throw new Error('Text cannot be empty');
	}

	const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

	const citations = text.match(
		new RegExp(CITATION_PATTERNS.map(p => p.source).join('|'), 'g'),
	);
	const totalCitations = citations?.length ?? 0;

	const citationDensity =
		sentences.length > 0 ? totalCitations / sentences.length : 0;

	const unsubstantiatedClaims: Array<{claim: string; context: string}> = [];

	for (const sentence of sentences) {
		const hasClaim = CLAIM_INDICATORS.some(pattern => pattern.test(sentence));
		const hasCitation = CITATION_PATTERNS.some(pattern =>
			pattern.test(sentence),
		);

		if (hasClaim && !hasCitation) {
			const trimmedSentence = sentence.trim();
			unsubstantiatedClaims.push({
				claim: trimmedSentence.slice(0, 100),
				context: trimmedSentence,
			});
		}
	}

	const metrics: CitationCheck = {
		totalCitations,
		citationDensity,
		unsubstantiatedClaims,
		needsCitation: unsubstantiatedClaims.length > 0,
	};

	const issues: QualityIssue[] = [];
	const recommendations: string[] = [];

	if (unsubstantiatedClaims.length > 0) {
		issues.push({
			type: 'citation',
			severity: 'high',
			message: `Found ${unsubstantiatedClaims.length} claim(s) that may need citations`,
			suggestion: 'Add citations for data-driven claims and statistics',
		});
		recommendations.push(
			'Add citations for all factual claims, statistics, and data points',
		);
	}

	if (citationDensity < 0.1 && sentences.length > 10) {
		recommendations.push(
			'Consider adding more citations to strengthen credibility',
		);
	}

	return {
		metrics,
		issues,
		recommendations,
		passed: unsubstantiatedClaims.length === 0,
	};
}

/**
 * Analyze document structure and logical flow
 */
export async function analyzeStructure(
	text: string,
): Promise<AnalysisResult<StructureAnalysis>> {
	if (!text || text.trim().length === 0) {
		throw new Error('Text cannot be empty');
	}

	const paragraphs = text
		.split(/\n\n+/)
		.filter(p => p.trim().length > 0)
		.map(p => p.trim());

	const headings = text.match(/^#{1,6}\s+.+$/gm) ?? [];
	const headingCount = headings.length;

	const firstParagraph = paragraphs[0]?.toLowerCase() ?? '';
	const lastParagraph = paragraphs[paragraphs.length - 1]?.toLowerCase() ?? '';

	const hasIntroduction =
		firstParagraph.includes('introduction') ||
		firstParagraph.includes('in this essay') ||
		firstParagraph.includes('this essay') ||
		paragraphs.length > 0;

	const hasConclusion =
		lastParagraph.includes('conclusion') ||
		lastParagraph.includes('in conclusion') ||
		lastParagraph.includes('to conclude') ||
		lastParagraph.includes('ultimately') ||
		lastParagraph.includes('in summary');

	const bodyParagraphCount = Math.max(0, paragraphs.length - 2);

	const totalParagraphLength = paragraphs.reduce(
		(sum, p) => sum + p.split(/\s+/).length,
		0,
	);
	const averageParagraphLength =
		paragraphs.length > 0 ? totalParagraphLength / paragraphs.length : 0;

	const transitionWords: string[] = [];
	const transitionCount = paragraphs.filter(paragraph => {
		const lowerParagraph = paragraph.toLowerCase();
		const foundTransition = TRANSITION_WORDS.find(transition =>
			lowerParagraph.includes(transition),
		);
		if (foundTransition && !transitionWords.includes(foundTransition)) {
			transitionWords.push(foundTransition);
		}

		return foundTransition !== undefined;
	}).length;

	const transitionDensity =
		paragraphs.length > 0 ? transitionCount / paragraphs.length : 0;

	let logicalFlow: 'strong' | 'moderate' | 'weak' = 'weak';
	if (transitionDensity > 0.5 && hasIntroduction && hasConclusion) {
		logicalFlow = 'strong';
	} else if (transitionDensity > 0.3 || hasIntroduction || hasConclusion) {
		logicalFlow = 'moderate';
	}

	const metrics: StructureAnalysis = {
		hasIntroduction,
		hasConclusion,
		bodyParagraphCount,
		headingCount,
		averageParagraphLength,
		logicalFlow,
		transitionWords,
	};

	const issues: QualityIssue[] = [];
	const recommendations: string[] = [];

	if (!hasIntroduction) {
		issues.push({
			type: 'structure',
			severity: 'high',
			message: 'Essay appears to lack a clear introduction',
			suggestion:
				'Add an introductory paragraph that previews the main arguments',
		});
	}

	if (!hasConclusion) {
		issues.push({
			type: 'structure',
			severity: 'high',
			message: 'Essay appears to lack a clear conclusion',
			suggestion: 'Add a concluding paragraph that synthesizes key points',
		});
	}

	if (bodyParagraphCount < 3) {
		issues.push({
			type: 'structure',
			severity: 'medium',
			message: 'Essay has fewer than 3 body paragraphs',
			suggestion: 'Develop more supporting paragraphs for thorough analysis',
		});
	}

	if (logicalFlow === 'weak') {
		issues.push({
			type: 'structure',
			severity: 'medium',
			message: 'Logical flow appears weak',
			suggestion:
				'Add more transition words and ensure clear progression of ideas',
		});
		recommendations.push(
			'Improve logical flow with transition words and clearer paragraph connections',
		);
	}

	if (averageParagraphLength < 50) {
		recommendations.push(
			'Consider developing paragraphs more fully to support arguments',
		);
	} else if (averageParagraphLength > 200) {
		recommendations.push(
			'Consider breaking up very long paragraphs for better readability',
		);
	}

	const passed =
		hasIntroduction &&
		hasConclusion &&
		bodyParagraphCount >= 3 &&
		logicalFlow !== 'weak';

	return {
		metrics,
		issues,
		recommendations,
		passed,
	};
}

/**
 * Check for repetitive words and phrases
 */
export async function checkRepetition(text: string): Promise<
	AnalysisResult<{
		overusedWords: Array<{word: string; count: number}>;
		repeatedPhrases: Array<{phrase: string; count: number}>;
	}>
> {
	if (!text || text.trim().length === 0) {
		throw new Error('Text cannot be empty');
	}

	const doc = nlp(text);

	const words = doc
		.terms()
		.out('array')
		.map((w: string) => w.toLowerCase())
		.filter((w: string) => w.length > 4);

	const wordFrequency = new Map<string, number>();
	for (const word of words) {
		wordFrequency.set(word, (wordFrequency.get(word) ?? 0) + 1);
	}

	const totalWords = words.length;
	const threshold = Math.max(3, Math.floor(totalWords * 0.02));

	const overusedWords = Array.from(wordFrequency.entries())
		.filter(([_, count]) => count >= threshold)
		.map(([word, count]) => ({word, count}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	const sentences = doc.sentences().out('array');
	const bigrams: string[] = [];
	const trigrams: string[] = [];

	for (const sentence of sentences) {
		const sentenceWords = sentence
			.toLowerCase()
			.split(/\s+/)
			.filter((w: string) => w.length > 0);

		for (let i = 0; i < sentenceWords.length - 1; i++) {
			bigrams.push(`${sentenceWords[i]} ${sentenceWords[i + 1]}`);
		}

		for (let i = 0; i < sentenceWords.length - 2; i++) {
			trigrams.push(
				`${sentenceWords[i]} ${sentenceWords[i + 1]} ${sentenceWords[i + 2]}`,
			);
		}
	}

	const phraseFrequency = new Map<string, number>();
	for (const phrase of [...bigrams, ...trigrams]) {
		phraseFrequency.set(phrase, (phraseFrequency.get(phrase) ?? 0) + 1);
	}

	const repeatedPhrases = Array.from(phraseFrequency.entries())
		.filter(([_, count]) => count >= 3)
		.map(([phrase, count]) => ({phrase, count}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	const metrics = {
		overusedWords,
		repeatedPhrases,
	};

	const issues: QualityIssue[] = [];
	const recommendations: string[] = [];

	if (overusedWords.length > 0) {
		issues.push({
			type: 'repetition',
			severity: 'low',
			message: `Found ${overusedWords.length} overused word(s)`,
			suggestion: 'Vary vocabulary to avoid repetitive word choices',
		});
		recommendations.push(
			`Consider using synonyms for frequently repeated words: ${overusedWords
				.slice(0, 3)
				.map(w => w.word)
				.join(', ')}`,
		);
	}

	if (repeatedPhrases.length > 0) {
		issues.push({
			type: 'repetition',
			severity: 'medium',
			message: `Found ${repeatedPhrases.length} repeated phrase(s)`,
			suggestion: 'Rephrase repeated expressions for variety',
		});
		recommendations.push(
			'Rephrase repeated expressions to maintain reader engagement',
		);
	}

	return {
		metrics,
		issues,
		recommendations,
		passed: overusedWords.length === 0 && repeatedPhrases.length === 0,
	};
}

/**
 * Simple syllable counter for complex word detection
 */
function countSyllables(word: string): number {
	word = word.toLowerCase();
	if (word.length <= 3) {
		return 1;
	}

	word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
	word = word.replace(/^y/, '');
	const syllables = word.match(/[aeiouy]{1,2}/g);
	return syllables?.length ?? 1;
}

import test from 'ava';
import {
	analyzeReadability,
	detectBias,
	analyzeStyle,
	analyzeStructure,
	checkCitations,
	checkRepetition,
} from './TextAnalysisToolkit.js';

const SAMPLE_POLITICAL_ESSAY = `
# Police Liability Reform

## Introduction

Police accountability represents one of the most pressing civil rights issues of our generation.
According to recent studies, qualified immunity shields officers from consequences in over 80% of
misconduct cases. This essay examines why mandatory liability insurance is the only reform that
can truly address systemic police violence.

## The Problem with Qualified Immunity

The doctrine of qualified immunity, established in the 1967 Supreme Court case Pierson v. Ray,
has effectively created a two-tiered justice system. Data from the Marshall Project shows that
departments paid $1.8 billion in settlements between 2010 and 2020, yet individual officers
faced consequences in less than 2% of cases. Moreover, this creates perverse incentives where
departments prioritize protecting officers over protecting citizens.

## Why Liability Insurance Works

Mandatory professional liability insurance would fundamentally change these dynamics. When officers
carry personal insurance, insurance companies become the accountability mechanism. Furthermore,
officers with patterns of misconduct would face higher premiums or become uninsurable. This market-
based approach succeeds where legal reforms have failed.

## Conclusion

In conclusion, while many reforms have been proposed, only mandatory liability insurance addresses
the root cause of police impunity. By aligning financial incentives with public safety, we can
create lasting change in how law enforcement operates.
`;

const SIMPLE_TEXT = `
This is a very simple text. It has short sentences. The words are easy. Anyone can read this.
Even a child could understand. It is not complex at all.
`;

const COMPLEX_TEXT = `
The epistemological ramifications of contemporary jurisprudential frameworks necessitate
a comprehensive reevaluation of fundamental presuppositions underlying constitutional
interpretation methodologies, particularly with regard to the implementation of remedial
mechanisms designed to ameliorate systemic inequities perpetuated through institutional
structures resistant to transformative change.
`;

const BIASED_TEXT = `
The chairman made his decision. Each businessman should check his email. The policeman and
the fireman work together. A good secretary always keeps her desk organized. The cleaning lady
does her job well.
`;

const TEXT_WITH_PASSIVE_VOICE = `
The bill was passed by Congress. The decision was made by the committee. The report was written
by the analyst. The policy was implemented by the department. The reforms were opposed by the
union. The data was collected by researchers.
`;

const TEXT_WITH_CITATIONS = `
According to the Marshall Project, police departments paid $1.8 billion in settlements [1].
Research shows that qualified immunity applies in 80% of cases (Smith, 2020). The Supreme Court
ruled in Pierson v. Ray [2] that officers have immunity. Studies indicate that only 2% of officers
face consequences (Jones et al., 2021).
`;

const TEXT_WITHOUT_CITATIONS = `
Police departments paid billions in settlements. Qualified immunity applies in most cases.
The Supreme Court created this doctrine. Very few officers face consequences. Insurance companies
would change the system. Market incentives drive behavior.
`;

const REPETITIVE_TEXT = `
Police reform is important. Police accountability is important. Police training is important.
The police department must implement police reforms. Police officers need better police training.
The police union opposes police accountability. Police violence is a major problem. Police
misconduct happens frequently. Police departments protect police officers.
`;

test('analyzeReadability: returns metrics for political essay', async t => {
	const result = await analyzeReadability(SAMPLE_POLITICAL_ESSAY);

	t.truthy(result.metrics);
	t.is(typeof result.metrics.fleschKincaidGrade, 'number');
	t.is(typeof result.metrics.gunningFog, 'number');
	t.is(typeof result.metrics.wordCount, 'number');
	t.true(result.metrics.wordCount > 0);
	t.is(typeof result.metrics.estimatedReadingTimeMinutes, 'number');
	t.true(Array.isArray(result.issues));
	t.true(Array.isArray(result.recommendations));
	t.is(typeof result.passed, 'boolean');
});

test('analyzeReadability: detects simple text', async t => {
	const result = await analyzeReadability(SIMPLE_TEXT);

	t.true(result.metrics.fleschKincaidGrade < 10);
	t.true(result.recommendations.length > 0);
});

test('analyzeReadability: detects complex text', async t => {
	const result = await analyzeReadability(COMPLEX_TEXT);

	t.true(result.metrics.fleschKincaidGrade > 12);
	t.true(result.issues.length > 0);
	t.false(result.passed);
});

test('analyzeReadability: throws on empty text', async t => {
	await t.throwsAsync(async () => analyzeReadability(''), {
		message: 'Text cannot be empty',
	});
});

test('detectBias: identifies biased language', async t => {
	const result = await detectBias(BIASED_TEXT);

	t.truthy(result.metrics);
	t.true(result.metrics.issuesFound > 0);
	t.true(result.issues.length > 0);
	t.false(result.passed);
});

test('detectBias: passes clean text', async t => {
	const cleanText =
		'The committee made a decision. Business owners should check their email. Police officers and firefighters work together.';
	const result = await detectBias(cleanText);

	t.is(result.metrics.issuesFound, 0);
	t.true(result.passed);
});

test('detectBias: throws on empty text', async t => {
	await t.throwsAsync(async () => detectBias(''), {
		message: 'Text cannot be empty',
	});
});

test('analyzeStyle: calculates style metrics', async t => {
	const result = await analyzeStyle(SAMPLE_POLITICAL_ESSAY);

	t.truthy(result.metrics);
	t.is(typeof result.metrics.passiveVoicePercentage, 'number');
	t.is(typeof result.metrics.lexicalDiversity, 'number');
	t.is(typeof result.metrics.averageSentenceLength, 'number');
	t.is(typeof result.metrics.transitionDensity, 'number');
	t.true(result.metrics.lexicalDiversity > 0);
	t.true(result.metrics.lexicalDiversity <= 1);
});

test('analyzeStyle: detects excessive passive voice', async t => {
	const result = await analyzeStyle(TEXT_WITH_PASSIVE_VOICE);

	t.true(result.metrics.passiveVoicePercentage > 10);
	t.true(result.issues.some(issue => issue.type === 'style'));
});

test('analyzeStyle: throws on empty text', async t => {
	await t.throwsAsync(async () => analyzeStyle(''), {
		message: 'Text cannot be empty',
	});
});

test('analyzeStructure: analyzes document structure', async t => {
	const result = await analyzeStructure(SAMPLE_POLITICAL_ESSAY);

	t.truthy(result.metrics);
	t.is(typeof result.metrics.hasIntroduction, 'boolean');
	t.is(typeof result.metrics.hasConclusion, 'boolean');
	t.is(typeof result.metrics.bodyParagraphCount, 'number');
	t.is(typeof result.metrics.logicalFlow, 'string');
	t.true(result.metrics.hasIntroduction);
	t.true(result.metrics.hasConclusion);
});

test('analyzeStructure: identifies missing components', async t => {
	const incompleteText = 'This is just some text without structure.';
	const result = await analyzeStructure(incompleteText);

	t.true(result.issues.length > 0);
	t.false(result.passed);
});

test('checkCitations: detects citations', async t => {
	const result = await checkCitations(TEXT_WITH_CITATIONS);

	t.truthy(result.metrics);
	t.true(result.metrics.totalCitations > 0);
	t.is(typeof result.metrics.citationDensity, 'number');
	t.true(Array.isArray(result.metrics.unsubstantiatedClaims));
});

test('checkCitations: identifies missing citations', async t => {
	const result = await checkCitations(TEXT_WITHOUT_CITATIONS);

	t.true(result.metrics.unsubstantiatedClaims.length > 0);
	t.false(result.passed);
	t.true(result.issues.length > 0);
});

test('checkCitations: throws on empty text', async t => {
	await t.throwsAsync(async () => checkCitations(''), {
		message: 'Text cannot be empty',
	});
});

test('checkRepetition: identifies overused words', async t => {
	const result = await checkRepetition(REPETITIVE_TEXT);

	t.truthy(result.metrics);
	t.true(result.metrics.overusedWords.length > 0);
	t.true(result.metrics.overusedWords.some(word => word.word === 'police'));
	t.false(result.passed);
});

test('checkRepetition: passes varied text', async t => {
	const variedText = `
		Law enforcement accountability represents a critical challenge. Officers require better training.
		Departments must implement reforms. Communities deserve protection. Citizens need justice.
	`;
	const result = await checkRepetition(variedText);

	t.true(result.passed || result.metrics.overusedWords.length < 3);
});

test('checkRepetition: throws on empty text', async t => {
	await t.throwsAsync(async () => checkRepetition(''), {
		message: 'Text cannot be empty',
	});
});

/**
 * Example showing how to integrate text analysis with database storage
 */

import {evaluateSource} from '../tools/analysis/ResearchAnalysisTools.js';
import {reviewComplete} from '../tools/analysis/ReviewerAnalysisTools.js';
import {
	saveSourceAnalysis,
	saveEssayDraftAnalysis,
	getQualitySources,
	getEssayQualityTrend,
} from './analysis-storage.js';

/**
 * Example: Research Agent evaluates and stores source analysis
 */
export async function researchAgentWithStorage(
	sourceId: string,
	sourceContent: string,
	sourceUrl: string,
) {
	console.log('Analyzing source...');

	const evaluation = await evaluateSource(sourceContent, sourceUrl);

	console.log('\nCredibility Score:', evaluation.credibilityScore);
	console.log('Use for Research:', evaluation.useForResearch);

	console.log('\nSaving analysis to database...');
	await saveSourceAnalysis(sourceId, evaluation);

	console.log('✓ Source analysis saved');

	return evaluation;
}

/**
 * Example: Get high-quality sources for research
 */
export async function getResearchQualitySources() {
	console.log('Fetching high-quality sources...');

	const sources = await getQualitySources({
		minCredibility: 70,
		maxBiasIssues: 2,
		requireCitations: true,
	});

	console.log(`\nFound ${sources.length} quality sources:\n`);

	for (const source of sources) {
		console.log(`${source.title}`);
		console.log(`  Credibility: ${source.credibilityScore}/100`);
		console.log(`  Quality: ${source.overallQuality}`);
		console.log(`  URL: ${source.url}\n`);
	}

	return sources;
}

/**
 * Example: Reviewer Agent evaluates draft and saves to database
 */
export async function reviewDraftWithStorage(
	essayId: string,
	draftVersion: number,
	draftContent: string,
	outline?: string,
	sourceUrls?: string[],
) {
	console.log(`Analyzing essay draft (version ${draftVersion})...`);

	const review = await reviewComplete(draftContent, outline, sourceUrls);

	console.log('\nOverall Score:', review.overallScore, '/ 100');
	console.log('Publication Ready:', review.publicationReady);
	console.log('Critical Issues:', review.criticalIssues.length);

	if (review.criticalIssues.length > 0) {
		console.log('\nCritical Issues:');
		for (const issue of review.criticalIssues) {
			console.log(`  • ${issue.message}`);
		}
	}

	console.log('\nSaving analysis to database...');
	await saveEssayDraftAnalysis(essayId, draftVersion, review);

	console.log('✓ Essay draft analysis saved');

	return review;
}

/**
 * Example: Track quality improvements across drafts
 */
export async function showQualityProgress(essayId: string) {
	console.log('Fetching quality trend...\n');

	const trend = await getEssayQualityTrend(essayId);

	console.log('Draft Quality Progress:\n');

	for (const snapshot of trend) {
		const statusIcon = snapshot.publicationReady ? '✓' : '○';
		const criticalIcon = snapshot.criticalIssues > 0 ? '⚠' : ' ';

		console.log(
			`${statusIcon} Draft ${snapshot.draftVersion}: ${snapshot.overallScore}/100 ${criticalIcon}`,
		);

		if (snapshot.criticalIssues > 0) {
			console.log(`   ${snapshot.criticalIssues} critical issue(s) remaining`);
		}
	}

	if (trend.length > 1) {
		const improvement =
			trend[trend.length - 1].overallScore - trend[0].overallScore;
		console.log(`\nTotal improvement: +${improvement} points`);
	}

	return trend;
}

/**
 * Example: Typical workflow integrating all agents
 */
export async function fullWorkflowExample() {
	console.log('=== RESEARCH PHASE ===\n');

	const sourceId = 'example-source-id';
	const sourceContent = `
    According to the Marshall Project, police departments paid $1.8 billion
    in settlements between 2010 and 2020. However, individual officers faced
    consequences in less than 2% of cases.
  `;

	await researchAgentWithStorage(
		sourceId,
		sourceContent,
		'https://example.com/article',
	);

	console.log('\n=== GET QUALITY SOURCES ===\n');

	const qualitySources = await getResearchQualitySources();

	console.log(`\nReady to use ${qualitySources.length} high-quality sources\n`);

	console.log('=== REVIEW PHASE ===\n');

	const essayId = 'example-essay-id';
	const draftV1 = `
    # Police Reform
    Police accountability is important. Many reforms have been tried.
    Insurance could help.
  `;

	await reviewDraftWithStorage(essayId, 1, draftV1);

	console.log('\n[User revises based on recommendations]\n');

	const draftV2 = `
    # Police Liability Reform

    ## Introduction
    Police accountability represents one of the most pressing civil rights issues.
    According to the Marshall Project, departments paid $1.8 billion in settlements
    between 2010 and 2020 [1].

    ## The Problem
    Qualified immunity shields officers in over 80% of cases...

    ## The Solution
    Mandatory liability insurance creates market-based accountability...

    ## Conclusion
    By aligning financial incentives with public safety, we can create lasting change.

    [1] Marshall Project Analysis, 2020
  `;

	await reviewDraftWithStorage(essayId, 2, draftV2);

	console.log('\n=== QUALITY PROGRESS ===\n');

	await showQualityProgress(essayId);
}

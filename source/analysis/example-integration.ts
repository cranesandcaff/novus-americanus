/**
 * Example integration showing how to use the Text Analysis Toolkit
 * with Anthropic SDK for agent tool calling
 */

import Anthropic from '@anthropic-ai/sdk';
import {
	evaluateSource,
	evaluateSourceTool,
	detectSourceBiasTool,
	analyzeSourceQualityTool,
} from '../tools/analysis/ResearchAnalysisTools.js';

/**
 * Example: Research Agent using source evaluation tools
 */
export async function researchAgentExample() {
	const anthropic = new Anthropic({
		apiKey: process.env['ANTHROPIC_API_KEY'],
	});

	const tools = [
		evaluateSourceTool,
		detectSourceBiasTool,
		analyzeSourceQualityTool,
	];

	const conversation = [
		{
			role: 'user' as const,
			content:
				'I found this article about police reform. Can you evaluate its quality and credibility for my research?',
		},
	];

	const response = await anthropic.messages.create({
		model: 'claude-3-5-sonnet-20241022',
		max_tokens: 4096,
		// @ts-expect-error - Tool types are complex
		tools,
		messages: conversation,
	});

	console.log('Agent response:', response);

	if (response.stop_reason === 'tool_use') {
		for (const block of response.content) {
			if (block.type === 'tool_use' && block.name === 'evaluate_source') {
				const {content, url} = block.input as {
					content: string;
					url?: string;
				};

				const evaluation = await evaluateSource(content, url);

				console.log('\nSource Evaluation Results:');
				console.log('Credibility Score:', evaluation.credibilityScore);
				console.log('Overall Quality:', evaluation.metrics.overallQuality);
				console.log('Use for Research:', evaluation.useForResearch);
				console.log('\nBias Score:', evaluation.metrics.biasScore);
				console.log('Has Citations:', evaluation.metrics.hasCitations);
				console.log('Fact Density:', evaluation.metrics.factDensity.toFixed(2));

				if (evaluation.issues.length > 0) {
					console.log('\nIssues Found:');
					for (const issue of evaluation.issues) {
						console.log(`[${issue.severity}] ${issue.message}`);
						console.log(`  → ${issue.suggestion}`);
					}
				}

				if (evaluation.recommendations.length > 0) {
					console.log('\nRecommendations:');
					for (const recommendation of evaluation.recommendations) {
						console.log(`  • ${recommendation}`);
					}
				}
			}
		}
	}
}

/**
 * Example: Direct function call without Anthropic SDK
 */
export async function directFunctionExample() {
	const sampleArticle = `
    # Police Reform: A New Approach

    Police accountability has been a major issue in recent years. According to the
    Marshall Project, departments paid over $1.8 billion in settlements between 2010
    and 2020. However, individual officers faced consequences in less than 2% of cases.

    The doctrine of qualified immunity, established in Pierson v. Ray (1967), has created
    a system where officers are shielded from accountability. This has led to significant
    costs for taxpayers and communities.

    Mandatory liability insurance could change these dynamics by creating market-based
    accountability mechanisms. Insurance companies would assess risk and price premiums
    accordingly, creating financial incentives for better behavior.
  `;

	console.log('Evaluating source...\n');

	const result = await evaluateSource(
		sampleArticle,
		'https://example.com/article',
	);

	console.log('Credibility Score:', result.credibilityScore, '/ 100');
	console.log('Overall Quality:', result.metrics.overallQuality);
	console.log('Recommended for Research:', result.useForResearch);

	console.log('\nMetrics:');
	console.log(
		'  Reading Level:',
		result.metrics.readability.fleschKincaidGrade,
	);
	console.log('  Bias Issues:', result.metrics.biasScore);
	console.log(
		'  Fact Density:',
		(result.metrics.factDensity * 100).toFixed(1),
		'%',
	);
	console.log('  Has Citations:', result.metrics.hasCitations);
	console.log('  Has Author:', result.metrics.hasAuthorAttribution);

	console.log('\nStyle Metrics:');
	console.log(
		'  Passive Voice:',
		result.metrics.style.passiveVoicePercentage.toFixed(1),
		'%',
	);
	console.log(
		'  Lexical Diversity:',
		result.metrics.style.lexicalDiversity.toFixed(2),
	);
	console.log(
		'  Transitions:',
		result.metrics.style.transitionDensity.toFixed(1),
		'%',
	);

	if (result.recommendations.length > 0) {
		console.log('\nRecommendations:');
		for (const rec of result.recommendations) {
			console.log('  •', rec);
		}
	}
}

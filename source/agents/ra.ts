import Anthropic from "@anthropic-ai/sdk";
import { initWorkingContext, updateWorkingContext } from "../tools/context.js";
import { extractArticle } from "../tools/jina.js";
import { summarizeArticle } from "../tools/summarize.js";
import {
	createEssay,
	getEssay,
	saveResearchArticle,
} from "../tools/storage.js";
import { config } from "../config.js";

export type ResearchResult = {
	articlesFound: number;
	articlesArchived: number;
	articlesFailed: number;
};

const client = new Anthropic({
	apiKey: config.claude.apiKey,
});

async function searchWithClaude(query: string): Promise<string[]> {
	const message = await client.messages.create({
		model: "claude-sonnet-4-5-20250929",
		max_tokens: 1024,
		tools: [
			{
				type: "web_search_20250305",
				name: "web_search",
				max_uses: 5,
			},
		],
		messages: [
			{
				role: "user",
				content:
					`Search for articles about: ${query}. List all the URLs you find, one per line, with no additional text.`,
			},
		],
	});

	const urls: string[] = [];

	for (const block of message.content) {
		if (block.type === "text") {
			const lines = block.text.split("\n");
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
					urls.push(trimmed);
				} else {
					const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
					if (urlMatch) {
						urls.push(urlMatch[0]);
					}
				}
			}
		}
	}

	return urls;
}

export async function researchTopic(
	essaySlug: string,
	query: string,
	onProgress?: (status: string) => void,
): Promise<ResearchResult> {
	const progress = (msg: string) => {
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress(`Starting research for: ${essaySlug}`);

	let essay = await getEssay(essaySlug);

	if (!essay) {
		progress(`Creating new essay: ${essaySlug}`);
		const title = essaySlug
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
		essay = await createEssay(title, essaySlug);
		initWorkingContext(essaySlug, title);
	}

	if (!essay) {
		throw new Error("Failed to create or retrieve essay");
	}

	updateWorkingContext({
		research: {
			currentQuery: query,
		},
	});

	progress(`Searching for articles...`);
	const allUrls = await searchWithClaude(query);
	const urls = allUrls.slice(0, 10);
	progress(`Found ${allUrls.length} URLs, processing first ${urls.length}`);

	let articlesArchived = 0;
	let articlesFailed = 0;

	const CONCURRENCY_LIMIT = 3;
	const essayId = essay.id;

	async function processArticle(
		url: string,
		index: number,
	): Promise<{ success: boolean; title?: string; error?: string }> {
		progress(`[${index + 1}/${urls.length}] Processing: ${url}`);

		try {
			const article = await extractArticle(url);
			progress(`[${index + 1}/${urls.length}] Extracted: ${article.title}`);

			progress(
				`[${index + 1}/${urls.length}] Generating summary and key points...`,
			);
			const { summary, keyPoints } = await summarizeArticle(
				article.content,
				article.title,
			);
			progress(`[${index + 1}/${urls.length}] Summary generated`);

			await saveResearchArticle(essayId, article, summary, keyPoints);
			progress(`[${index + 1}/${urls.length}] Saved: ${article.title}`);

			return { success: true, title: article.title };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			progress(`[${index + 1}/${urls.length}] Failed: ${errorMessage}`);
			return { success: false, error: errorMessage };
		}
	}

	for (let i = 0; i < urls.length; i += CONCURRENCY_LIMIT) {
		const batch = urls.slice(i, i + CONCURRENCY_LIMIT);
		const results = await Promise.all(
			batch.map((url, batchIndex) => processArticle(url, i + batchIndex)),
		);

		for (const result of results) {
			if (result.success) {
				articlesArchived++;
			} else {
				articlesFailed++;
			}
		}
	}

	updateWorkingContext({
		research: {
			currentQuery: query,
			articlesFound: urls.length,
			articlesArchived,
			articlesFailed,
			lastUpdated: new Date().toISOString(),
		},
	});

	progress("\nResearch complete!");

	return {
		articlesFound: urls.length,
		articlesArchived,
		articlesFailed,
	};
}

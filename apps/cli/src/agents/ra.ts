import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import { initWorkingContext, updateWorkingContext } from "../tools/context.js";
import { extractArticle } from "../tools/jina.js";
import { summarizeArticle } from "../tools/summarize.js";
import {
	createEssay,
	getEssay,
	saveResearchArticle,
	getExistingUrls,
	linkExistingSource,
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
	try {
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
	} catch (error) {
		if (error instanceof Anthropic.APIError) {
			throw new Error(`Search API error (${error.status}): ${error.message}`);
		}
		throw error;
	}
}

export async function researchTopic(
	essaySlug: string,
	query: string,
	onProgress?: (status: string) => void,
	shouldCancel?: () => boolean,
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

	if (shouldCancel?.()) {
		progress("Cancellation detected before search");
		return {
			articlesFound: 0,
			articlesArchived: 0,
			articlesFailed: 0,
		};
	}

	progress(`Searching for articles...`);
	const allUrls = await searchWithClaude(query);
	const urls = allUrls.slice(0, config.research.maxArticles);
	progress(`Found ${allUrls.length} URLs, checking for duplicates...`);

	const essayId = essay.id;
	const existingUrls = await getExistingUrls(essayId);

	let articlesSkipped = 0;
	let articlesLinked = 0;
	const newUrls: string[] = [];

	for (const url of urls) {
		if (existingUrls.has(url)) {
			progress(`Skipping already processed: ${url}`);
			articlesSkipped++;
		} else {
			const wasLinked = await linkExistingSource(essayId, url);
			if (wasLinked) {
				progress(`Linked existing source: ${url}`);
				articlesLinked++;
			} else {
				newUrls.push(url);
			}
		}
	}

	progress(
		`Processing ${newUrls.length} new articles (${articlesSkipped} already in essay, ${articlesLinked} linked from other essays)`,
	);

	if (newUrls.length === 0) {
		progress("All URLs already processed, no new articles to fetch");
		return {
			articlesFound: urls.length,
			articlesArchived: articlesLinked + articlesSkipped,
			articlesFailed: 0,
		};
	}

	if (shouldCancel?.()) {
		progress("Cancellation detected after deduplication");
		return {
			articlesFound: urls.length,
			articlesArchived: articlesLinked,
			articlesFailed: 0,
		};
	}

	let articlesArchived = articlesLinked;
	let articlesFailed = 0;

	const limit = pLimit(config.research.concurrency);

	async function processArticleWithRetry(
		url: string,
		index: number,
		attempt = 1,
	): Promise<{ success: boolean; title?: string; error?: string }> {
		progress(`[${index + 1}/${newUrls.length}] Processing: ${url}`);

		try {
			const article = await extractArticle(url);
			progress(`[${index + 1}/${newUrls.length}] Extracted: ${article.title}`);

			progress(
				`[${index + 1}/${newUrls.length}] Generating summary and key points...`,
			);
			const { summary, keyPoints } = await summarizeArticle(
				article.content,
				article.title,
			);
			progress(`[${index + 1}/${newUrls.length}] Summary generated`);

			await saveResearchArticle(essayId, article, summary, keyPoints, query);
			progress(`[${index + 1}/${newUrls.length}] Saved: ${url}`);
			progress(
				`[${index + 1}/${newUrls.length}] TaskUpdate: ${url}|||${summary}`,
			);

			return { success: true, title: article.title };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			if (
				attempt < config.research.maxRetries &&
				errorMessage.includes("rate")
			) {
				const retryDelay = attempt * 5000;
				progress(
					`[${index + 1}/${newUrls.length}] Rate limited, retrying in ${retryDelay / 1000}s...`,
				);
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
				return processArticleWithRetry(url, index, attempt + 1);
			}

			progress(`[${index + 1}/${newUrls.length}] Failed: ${errorMessage}`);
			return { success: false, error: errorMessage };
		}
	}

	const tasks = newUrls.map((url, index) =>
		limit(() => processArticleWithRetry(url, index)),
	);

	for (let i = 0; i < tasks.length; i += config.research.concurrency) {
		if (shouldCancel?.()) {
			progress("Cancellation detected, stopping research...");
			break;
		}

		const batch = tasks.slice(i, i + config.research.concurrency);
		const results = await Promise.all(batch);

		for (const result of results) {
			if (result.success) {
				articlesArchived++;
			} else {
				articlesFailed++;
			}
		}

		if (i + config.research.concurrency < tasks.length) {
			if (shouldCancel?.()) {
				progress("Cancellation detected, stopping research...");
				break;
			}

			progress(
				`Rate limit cooldown (${config.research.batchDelayMs / 1000}s)...`,
			);
			await new Promise((resolve) =>
				setTimeout(resolve, config.research.batchDelayMs),
			);
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

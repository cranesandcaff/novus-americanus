import {initWorkingContext, updateWorkingContext} from '../tools/context.js';
import {searchWeb} from '../tools/search.js';
import {extractArticle} from '../tools/jina.js';
import {
	createEssay,
	getEssay,
	saveResearchArticle,
} from '../tools/storage.js';

export type ResearchResult = {
	articlesFound: number;
	articlesArchived: number;
	articlesFailed: number;
};

export async function researchTopic(
	essaySlug: string,
	query: string,
	onProgress?: (status: string) => void,
): Promise<ResearchResult> {
	const progress = (msg: string) => {
		console.log(msg);
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress(`Starting research for: ${essaySlug}`);

	let essay = await getEssay(essaySlug);

	if (!essay) {
		progress(`Creating new essay: ${essaySlug}`);
		const title = essaySlug
			.split('-')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
		essay = await createEssay(title, essaySlug);
		initWorkingContext(essaySlug, title);
	}

	updateWorkingContext({
		research: {
			currentQuery: query,
		},
	});

	progress(`Searching for articles...`);
	const urls = await searchWeb(query);
	progress(`Found ${urls.length} URLs`);

	let articlesArchived = 0;
	let articlesFailed = 0;

	for (const [index, url] of urls.entries()) {
		progress(`[${index + 1}/${urls.length}] Processing: ${url}`);

		try {
			const article = await extractArticle(url);
			progress(`   Extracted: ${article.title}`);

			await saveResearchArticle(essay.id, article);
			progress(`   Saved to database`);

			articlesArchived++;
		} catch (error) {
			progress(`   Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			articlesFailed++;
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

	progress('\nResearch complete!');

	return {
		articlesFound: urls.length,
		articlesArchived,
		articlesFailed,
	};
}

import {essays, sources, essaySources, type Essay, type Source} from '../db/index.js';
import type {Article} from './jina.js';

export async function createEssay(title: string, slug: string): Promise<Essay> {
	return essays.create({
		title,
		slug,
		status: 'research',
	});
}

export async function getEssay(slug: string): Promise<Essay | null> {
	return essays.getBySlug(slug);
}

export async function saveResearchArticle(
	essayId: string,
	article: Article,
	summary?: string,
	keyPoints?: string[],
): Promise<void> {
	const source = await sources.create({
		title: article.title,
		url: article.url,
		jina_archive_contents: article.content,
		date_accessed: new Date(),
		summary,
		key_points: keyPoints ? JSON.stringify(keyPoints) : undefined,
	});

	await essaySources.link(essayId, source.id);
}

export async function getResearchForEssay(essayId: string): Promise<Source[]> {
	return essays.getSources(essayId);
}

export async function updateEssayStatus(
	slug: string,
	status: string,
): Promise<void> {
	const essay = await essays.getBySlug(slug);

	if (!essay) {
		throw new Error(`Essay with slug "${slug}" not found`);
	}

	await essays.update(essay.id, {status});
}

export type ResearchSummary = {
	title: string;
	url: string;
	summary: string | null;
	keyPoints: string[] | null;
};

export async function getResearchSummaries(
	slug: string,
): Promise<ResearchSummary[]> {
	const essay = await essays.getBySlug(slug);

	if (!essay) {
		throw new Error(`Essay with slug "${slug}" not found`);
	}

	const sourcesData = await essays.getSources(essay.id);

	return sourcesData.map(source => ({
		title: source.title,
		url: source.url ?? '',
		summary: source.summary,
		keyPoints: source.key_points ? JSON.parse(source.key_points) : null,
	}));
}

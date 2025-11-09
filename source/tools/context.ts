import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import * as TOML from '@iarna/toml';
import {join} from 'node:path';

export type WorkingContext = {
	essay: {
		slug: string;
		title: string;
		status?: string;
	};
	research?: {
		currentQuery?: string;
		articlesFound?: number;
		articlesArchived?: number;
		articlesFailed?: number;
		lastUpdated?: string;
	};
};

const WORKING_FILE = join(process.cwd(), 'working.toml');

export function getWorkingContext(): WorkingContext | null {
	if (!existsSync(WORKING_FILE)) {
		return null;
	}

	try {
		const content = readFileSync(WORKING_FILE, 'utf-8');
		return TOML.parse(content) as WorkingContext;
	} catch (error) {
		console.error('Error reading working.toml:', error);
		return null;
	}
}

export function updateWorkingContext(updates: Partial<WorkingContext>): void {
	const current = getWorkingContext() ?? ({} as WorkingContext);
	const updated = {
		...current,
		...updates,
		essay: {
			...current.essay,
			...updates.essay,
		},
		research: {
			...current.research,
			...updates.research,
		},
	};

	try {
		const content = TOML.stringify(updated);
		writeFileSync(WORKING_FILE, content, 'utf-8');
	} catch (error) {
		console.error('Error writing working.toml:', error);
		throw error;
	}
}

export function initWorkingContext(essaySlug: string, title: string): void {
	const context: WorkingContext = {
		essay: {
			slug: essaySlug,
			title,
			status: 'research',
		},
		research: {
			articlesFound: 0,
			articlesArchived: 0,
			articlesFailed: 0,
			lastUpdated: new Date().toISOString(),
		},
	};

	try {
		const content = TOML.stringify(context);
		writeFileSync(WORKING_FILE, content, 'utf-8');
	} catch (error) {
		console.error('Error initializing working.toml:', error);
		throw error;
	}
}

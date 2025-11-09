import dotenv from 'dotenv';

dotenv.config();

type RequiredEnvVar =
	| 'JINA_AI_KEY'
	| 'SUPABASE_URL'
	| 'SUPABASE_ANON_KEY'
	| 'CLAUDE_API_KEY';

type OptionalEnvVar = 'VOYAGE_AI_API_KEY' | 'VOYAGE_AI_API_URL';

function getRequiredEnv(key: RequiredEnvVar): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}

	return value;
}

function getOptionalEnv(key: OptionalEnvVar): string | undefined {
	return process.env[key];
}

export const config = {
	jina: {
		apiKey: getRequiredEnv('JINA_AI_KEY'),
	},
	supabase: {
		url: getRequiredEnv('SUPABASE_URL'),
		anonKey: getRequiredEnv('SUPABASE_ANON_KEY'),
	},
	voyage: {
		apiKey: getOptionalEnv('VOYAGE_AI_API_KEY'),
		apiUrl: getOptionalEnv('VOYAGE_AI_API_URL'),
	},
	claude: {
		apiKey: getRequiredEnv('CLAUDE_API_KEY'),
	},
	research: {
		maxArticles: Number.parseInt(process.env.MAX_ARTICLES ?? '20', 10),
		concurrency: Number.parseInt(process.env.CONCURRENCY ?? '2', 10),
		batchDelayMs: Number.parseInt(process.env.BATCH_DELAY_MS ?? '12000', 10),
		maxRetries: Number.parseInt(process.env.MAX_RETRIES ?? '3', 10),
	},
} as const;

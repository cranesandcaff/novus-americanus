export async function searchWeb(query: string): Promise<string[]> {
	console.log(`Searching for: "${query}"`);

	const encodedQuery = encodeURIComponent(query);
	const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

	try {
		const response = await fetch(searchUrl, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
			},
		});

		if (!response.ok) {
			throw new Error(`Search failed: ${response.status}`);
		}

		const html = await response.text();

		const urlPattern = /<a[^>]+class="result__url"[^>]*href="([^"]+)"/g;
		const urls: string[] = [];
		let match;

		while ((match = urlPattern.exec(html)) !== null) {
			const url = match[1];

			if (url && url.startsWith('http')) {
				urls.push(url);
			}

			if (urls.length >= 10) {
				break;
			}
		}

		return urls;
	} catch (error) {
		console.error('Search error:', error);
		throw error;
	}
}

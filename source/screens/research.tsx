import React, {useState} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import {type Essay} from '../db/index.js';
import {researchTopic} from '../agents/ra.js';

type ResearchScreenProps = {
	essay: Essay;
	onBack: () => void;
};

type ArticleStatus = {
	url: string;
	title?: string;
	status: 'pending' | 'processing' | 'archived' | 'failed';
	error?: string;
};

export function ResearchScreen({essay, onBack}: ResearchScreenProps) {
	const [query, setQuery] = useState('');
	const [articles, setArticles] = useState<ArticleStatus[]>([]);
	const [isResearching, setIsResearching] = useState(false);
	const [statusMessage, setStatusMessage] = useState('');
	const [inputFocused, setInputFocused] = useState(true);
	const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
	const {exit} = useApp();

	useInput(
		(input, key) => {
			if (input === 'q') {
				exit();
				return;
			}

			if (input === 'b' && !isResearching) {
				onBack();
				return;
			}

			if (input === 'r' && !isResearching) {
				setQuery('');
				setArticles([]);
				setStatusMessage('');
				setInputFocused(true);
			}
		},
		{isActive: !inputFocused},
	);

	const handleSubmit = async () => {
		if (!query.trim() || isResearching) {
			return;
		}

		setInputFocused(false);
		setIsResearching(true);
		setArticles([]);
		setStatusMessage('Starting research...');
		setCurrentProcessingIndex(-1);

		try {
			await researchTopic(essay.slug, query, (progress: string) => {
				const foundMatch = progress.match(/Found (\d+) URLs/);
				if (foundMatch) {
					const count = Number.parseInt(foundMatch[1], 10);
					const newArticles: ArticleStatus[] = Array.from(
						{length: count},
						() => ({
							url: '',
							status: 'pending',
						}),
					);
					setArticles(newArticles);
					setStatusMessage(progress);
					return;
				}

				const processingMatch = progress.match(
					/\[(\d+)\/(\d+)\] Processing: (.+)/,
				);
				if (processingMatch) {
					const index = Number.parseInt(processingMatch[1], 10) - 1;
					const url = processingMatch[3];
					setCurrentProcessingIndex(index);
					setArticles(prev => {
						const updated = [...prev];
						updated[index] = {url, status: 'processing'};
						return updated;
					});
					setStatusMessage(`Processing article ${index + 1}...`);
					return;
				}

				const extractedMatch = progress.match(/^\s+Extracted: (.+)/);
				if (extractedMatch) {
					const title = extractedMatch[1];
					setArticles(prev => {
						const updated = [...prev];
						if (currentProcessingIndex !== -1) {
							updated[currentProcessingIndex] = {
								...updated[currentProcessingIndex],
								title,
							};
						}

						return updated;
					});
					return;
				}

				const savedMatch = progress.match(/^\s+Saved to database/);
				if (savedMatch) {
					setArticles(prev => {
						const updated = [...prev];
						if (currentProcessingIndex !== -1) {
							updated[currentProcessingIndex] = {
								...updated[currentProcessingIndex],
								status: 'archived',
							};
						}

						return updated;
					});
					return;
				}

				const failedMatch = progress.match(/^\s+Failed: (.+)/);
				if (failedMatch) {
					const error = failedMatch[1];
					setArticles(prev => {
						const updated = [...prev];
						if (currentProcessingIndex !== -1) {
							updated[currentProcessingIndex] = {
								...updated[currentProcessingIndex],
								status: 'failed',
								error,
							};
						}

						return updated;
					});
					return;
				}

				if (progress.includes('Research complete')) {
					setStatusMessage('Research complete!');
					return;
				}

				setStatusMessage(progress);
			});
		} catch (error) {
			setStatusMessage(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsResearching(false);
		}
	};

	const articlesArchived = articles.filter(a => a.status === 'archived').length;
	const articlesFailed = articles.filter(a => a.status === 'failed').length;

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="cyan" flexDirection="column">
				<Box paddingX={2} paddingTop={1}>
					<Text bold color="cyan">
						Research: {essay.title}
					</Text>
				</Box>

				<Box paddingX={2} paddingY={1} flexDirection="column">
					<Box marginBottom={1}>
						<Text>Query: </Text>
						<Box width={40}>
							{inputFocused ? (
								<TextInput
									value={query}
									onChange={setQuery}
									onSubmit={handleSubmit}
									placeholder="Enter research query..."
								/>
							) : (
								<Text color="gray">{query}</Text>
							)}
						</Box>
					</Box>

					{articles.length > 0 && (
						<Box flexDirection="column" marginTop={1}>
							<Text bold>
								Articles ({articles.length} found, {articlesArchived} archived
								{articlesFailed > 0 ? `, ${articlesFailed} failed` : ''})
							</Text>

							<Box
								flexDirection="column"
								marginTop={1}
								borderStyle="single"
								borderColor="gray"
								paddingX={1}
								paddingY={1}
								height={Math.min(articles.length + 2, 12)}
							>
								{articles.map((article, index) => {
									let icon = '⏳';
									let color: 'yellow' | 'green' | 'red' | 'gray' = 'yellow';

									if (article.status === 'archived') {
										icon = '✓';
										color = 'green';
									} else if (article.status === 'failed') {
										icon = '✗';
										color = 'red';
									} else if (article.status === 'pending') {
										icon = '○';
										color = 'gray';
									}

									return (
										<Box key={index}>
											<Text color={color}>
												{icon}{' '}
												{article.title ||
													article.url ||
													`Article ${index + 1}`}
												{article.error ? ` - ${article.error}` : ''}
											</Text>
										</Box>
									);
								})}
							</Box>
						</Box>
					)}

					{statusMessage && (
						<Box marginTop={1}>
							<Text color="gray">Status: {statusMessage}</Text>
						</Box>
					)}
				</Box>

				<Box paddingX={2} paddingBottom={1} borderTop borderColor="gray">
					<Text dimColor>
						{isResearching
							? 'Researching...'
							: '[B] Back  [R] New Research  [Q] Quit'}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

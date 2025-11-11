import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {type Essay} from '../db/index.js';
import {getResearchSummaries, type ResearchSummary} from '../tools/storage.js';

type SourcesListScreenProps = {
	essay: Essay;
	onBack: () => void;
};

export function SourcesListScreen({essay, onBack}: SourcesListScreenProps) {
	const [sources, setSources] = useState<ResearchSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const {exit} = useApp();

	useEffect(() => {
		const loadSources = async () => {
			try {
				setIsLoading(true);
				const data = await getResearchSummaries(essay.slug);
				setSources(data);
			} catch (error) {
				setError(
					error instanceof Error ? error.message : 'Failed to load sources',
				);
			} finally {
				setIsLoading(false);
			}
		};

		void loadSources();
	}, [essay.slug]);

	useInput((input, _key) => {
		if (input === 'q') {
			exit();
			return;
		}

		if (input === 'b') {
			onBack();
		}
	});

	if (isLoading) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="blue">Loading sources...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">Error: {error}</Text>
				<Box marginTop={1}>
					<Text color="white">[B] Back [Q] Quit</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="blue" paddingX={2} paddingY={1}>
				<Text bold color="blue">
					Sources for: {essay.title}
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Box paddingX={1} borderBottom borderColor="white" marginBottom={1}>
					<Text bold color="blue">
						{sources.length} Research Article{sources.length !== 1 ? 's' : ''}
					</Text>
				</Box>

				{sources.length === 0 ? (
					<Box padding={1}>
						<Text color="white">No sources found for this essay.</Text>
					</Box>
				) : (
					<Box flexDirection="column" paddingX={1}>
						{sources.map((source, index) => (
							<Box
								key={index}
								flexDirection="column"
								marginBottom={1}
								borderStyle="single"
								borderColor="gray"
								paddingX={1}
								paddingY={1}
							>
								<Text bold color="cyan">
									{index + 1}. {source.title}
								</Text>
								<Text color="gray" dimColor>
									{source.url}
								</Text>

								{source.summary && (
									<Box marginTop={1}>
										<Text color="white">{source.summary}</Text>
									</Box>
								)}

								{source.keyPoints && source.keyPoints.length > 0 && (
									<Box marginTop={1} flexDirection="column">
										<Text bold color="yellow">
											Key Points:
										</Text>
										{source.keyPoints.map((point, pointIndex) => (
											<Text key={pointIndex} color="white">
												  • {point}
											</Text>
										))}
									</Box>
								)}
							</Box>
						))}
					</Box>
				)}
			</Box>

			<Box
				marginTop={1}
				borderStyle="round"
				borderColor="white"
				paddingX={2}
				paddingY={1}
			>
				<Text color="white">[B] Back [Q] Quit</Text>
			</Box>
		</Box>
	);
}

import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import Spinner from 'ink-spinner';
import {backfillEmbeddings} from '../tools/index.js';

type MigrateScreenProps = {
	onBack: () => void;
};

type LogEntry = {
	type: 'info' | 'success' | 'error';
	message: string;
	timestamp: Date;
};

export function MigrateScreen({onBack}: MigrateScreenProps) {
	const [isRunning, setIsRunning] = useState(false);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [progress, setProgress] = useState<{
		completed: number;
		total: number;
		current: string;
	} | null>(null);
	const [result, setResult] = useState<{
		processedSources: number;
		skippedSources: number;
		failedSources: number;
		totalChunks: number;
	} | null>(null);
	const {exit} = useApp();

	const addLog = (type: LogEntry['type'], message: string) => {
		setLogs(prev => [
			...prev,
			{
				type,
				message,
				timestamp: new Date(),
			},
		]);
	};

	useInput((input, key) => {
		if (isRunning) {
			return;
		}

		if (input === 'q') {
			exit();
			return;
		}

		if (input === 'b' || key.escape) {
			onBack();
			return;
		}

		if (input === 'm' && !result) {
			startMigration();
		}
	});

	async function startMigration() {
		setIsRunning(true);
		setLogs([]);
		setProgress(null);
		setResult(null);

		addLog('info', 'Starting embedding migration...');
		addLog('info', 'This will process all sources with jina_archive_contents');

		try {
			const migrationResult = await backfillEmbeddings({
				skipExisting: true,
				onProgress: (completed, total, sourceTitle) => {
					setProgress({
						completed,
						total,
						current: sourceTitle,
					});

					addLog('info', sourceTitle);
				},
				onError: (sourceId, error) => {
					addLog('error', `Failed to process ${sourceId}: ${error.message}`);
				},
			});

			setResult(migrationResult);

			addLog('success', '='.repeat(60));
			addLog('success', 'Migration Complete!');
			addLog(
				'success',
				`Processed: ${migrationResult.processedSources} sources`,
			);
			addLog('success', `Chunks created: ${migrationResult.totalChunks}`);
			addLog('success', `Skipped: ${migrationResult.skippedSources}`);
			addLog('success', `Failed: ${migrationResult.failedSources}`);

			if (migrationResult.errors.length > 0) {
				addLog('error', '='.repeat(60));
				addLog('error', 'Errors encountered:');
				for (const err of migrationResult.errors) {
					addLog('error', `  ${err.sourceId}: ${err.error.message}`);
				}
			}
		} catch (error) {
			addLog(
				'error',
				`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsRunning(false);
		}
	}

	useEffect(() => {
		addLog('info', 'Embedding Migration Tool');
		addLog('info', 'Press [M] to start migration');
		addLog('info', 'This will generate vector embeddings for all sources');
		addLog('info', '');
	}, []);

	const getLogColor = (type: LogEntry['type']): string => {
		switch (type) {
			case 'success': {
				return 'green';
			}

			case 'error': {
				return 'red';
			}

			default: {
				return 'white';
			}
		}
	};

	const formatTime = (date: Date): string => {
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	};

	const visibleLogs = logs.slice(-20);

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="blue" flexDirection="column">
				<Box paddingX={2} paddingTop={1}>
					<Text bold color="blue">
						Embedding Migration
					</Text>
				</Box>

				<Box paddingX={2} paddingY={1} flexDirection="column">
					{isRunning && progress && (
						<Box marginBottom={1} flexDirection="column">
							<Box>
								<Text color="blue">
									<Spinner type="dots" />
								</Text>
								<Text color="blue">
									{' '}
									Progress: {progress.completed}/{progress.total} sources
								</Text>
							</Box>
							<Box marginTop={1}>
								<Text color="white">{progress.current}</Text>
							</Box>
						</Box>
					)}

					<Box
						flexDirection="column"
						height={16}
						borderStyle="single"
						borderColor="gray"
						paddingX={1}
					>
						{visibleLogs.map((log, index) => (
							<Box key={`${log.timestamp.getTime()}-${index}`}>
								<Text color="gray" dimColor>
									{formatTime(log.timestamp)}
								</Text>
								<Text color={getLogColor(log.type)}> {log.message}</Text>
							</Box>
						))}
					</Box>

					{result && (
						<Box marginTop={1} flexDirection="column">
							<Text bold color="green">
								Summary:
							</Text>
							<Box>
								<Text color="white">
									  Processed: {result.processedSources} sources (
									{result.totalChunks} chunks)
								</Text>
							</Box>
							<Box>
								<Text color="white">  Skipped: {result.skippedSources}</Text>
							</Box>
							{result.failedSources > 0 && (
								<Box>
									<Text color="red">  Failed: {result.failedSources}</Text>
								</Box>
							)}
						</Box>
					)}
				</Box>

				<Box paddingX={2} paddingBottom={1} borderTop borderColor="white">
					<Text color="white">
						{!isRunning && !result && '[M] Start Migration '}
						{result && '[M] Run Again '}
						[B] Back [Q] Quit
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

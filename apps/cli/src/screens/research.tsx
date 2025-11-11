import React, {useState} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import TextInput from 'ink-text-input';

import {type Essay} from '../db/index.js';
import {researchTopic} from '../agents/ra.js';
import {createOutline} from '../agents/oa.js';
import Table from '../components/Table.js';
import {SourcesListScreen} from './sources-list.js';
import {JournalistScreen} from './journalist.js';
import {EditorScreen} from './editor.js';


type ResearchScreenProps = {
	essay: Essay;
	onBack: () => void;
};

type ArticleTask = {
	label: string;
	status: 'pending' | 'loading' | 'success' | 'error';
	output?: string;
};

export function ResearchScreen({essay, onBack}: ResearchScreenProps) {
	const [query, setQuery] = useState('');
	const [tasks, setTasks] = useState<ArticleTask[]>([]);
	const [isResearching, setIsResearching] = useState(false);
	const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);
	const [inputFocused, setInputFocused] = useState(true);
	const [cancelRequested, setCancelRequested] = useState(false);
	const [showSourcesList, setShowSourcesList] = useState(false);
	const [showJournalistScreen, setShowJournalistScreen] = useState(false);
	const [showEditorScreen, setShowEditorScreen] = useState(false);
	const {exit} = useApp();
	const {stdout} = useStdout();

	const terminalWidth = stdout?.columns ?? 80;
	const leftWidth = Math.floor(terminalWidth * 0.75);
	const rightWidth = Math.floor(terminalWidth * 0.25);

	const addLog = (message: string) => {
		setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
	};

	useInput(
		(input, key) => {
			if (input === 'q') {
				exit();
				return;
			}

			if (key.escape && isResearching) {
				addLog('Cancellation requested...');
				setCancelRequested(true);
				return;
			}

			if (input === 'b' && !isResearching && !isGeneratingOutline) {
				onBack();
				return;
			}

			if (input === 'r' && !isResearching && !isGeneratingOutline) {
				setQuery('');
				setTasks([]);
				setLogs([]);
				setInputFocused(true);
			}

			if (input === 'o' && !isResearching && !isGeneratingOutline) {
				handleGenerateOutline();
			}

			if (input === 'l' && !isResearching && !isGeneratingOutline) {
				setShowSourcesList(true);
			}

			if (input === 'j' && !isResearching && !isGeneratingOutline) {
				setShowJournalistScreen(true);
			}

			if (input === 'e' && !isResearching && !isGeneratingOutline) {
				setShowEditorScreen(true);
			}
		},
		{isActive: !inputFocused},
	);

	useInput(
		(_input, key) => {
			if (key.escape && !isResearching && !isGeneratingOutline) {
				setInputFocused(false);
			}
		},
		{isActive: inputFocused},
	);

	const handleSubmit = async () => {
		if (!query.trim() || isResearching) {
			return;
		}

		setInputFocused(false);
		setIsResearching(true);
		setCancelRequested(false);
		setTasks([]);
		setLogs([]);
		addLog('Starting research...');

		try {
			await researchTopic(
				essay.slug,
				query,
				(progress: string) => {
					if (!progress.includes('TaskUpdate:')) {
						addLog(progress);
					}

				const foundMatch = progress.match(/Processing (\d+) new articles/);
				if (foundMatch && foundMatch[1]) {
					const count = Number.parseInt(foundMatch[1], 10);
					const newTasks: ArticleTask[] = Array.from({length: count}, (_, i) => ({
						label: `Article ${i + 1}`,
						status: 'pending',
					}));
					setTasks(newTasks);
					return;
				}

				const processingMatch = progress.match(/\[(\d+)\/\d+\] Processing:/);
				if (processingMatch && processingMatch[1]) {
					const articleNum = Number.parseInt(processingMatch[1], 10);
					const index = articleNum - 1;
					setTasks(prev => {
						const updated = [...prev];
						if (updated[index]) {
							updated[index] = {...updated[index], status: 'loading'};
						}

						return updated;
					});
					return;
				}

				const extractedMatch = progress.match(/\[(\d+)\/\d+\] Extracted: (.+)/);
				if (extractedMatch && extractedMatch[1] && extractedMatch[2]) {
					const articleNum = Number.parseInt(extractedMatch[1], 10);
					const title = extractedMatch[2];
					const index = articleNum - 1;
					setTasks(prev => {
						const updated = [...prev];
						if (updated[index]) {
							updated[index] = {...updated[index], label: title};
						}

						return updated;
					});
					return;
				}

				const taskUpdateMatch = progress.match(/\[(\d+)\/\d+\] TaskUpdate: (.+)/);
				if (taskUpdateMatch && taskUpdateMatch[1] && taskUpdateMatch[2]) {
					const articleNum = Number.parseInt(taskUpdateMatch[1], 10);
					const parts = taskUpdateMatch[2].split('|||');
					const url = parts[0] || 'Unknown URL';
					const summary = parts[1] || '';
					const index = articleNum - 1;

					const firstSentence = summary.split('.')[0] + '.';
					const output = summary ? firstSentence : 'Archived';

					setTasks(prev => {
						const updated = [...prev];
						if (updated[index]) {
							updated[index] = {
								label: url,
								status: 'success',
								output,
							};
						}

						return updated;
					});
					return;
				}

				const failedMatch = progress.match(/\[(\d+)\/\d+\] Failed: (.+)/);
				if (failedMatch && failedMatch[1] && failedMatch[2]) {
					const articleNum = Number.parseInt(failedMatch[1], 10);
					const errorMsg = failedMatch[2];
					const index = articleNum - 1;
					setTasks(prev => {
						const updated = [...prev];
						if (updated[index]) {
							updated[index] = {
								...updated[index],
								status: 'error',
								output: errorMsg,
							};
						}

						return updated;
					});
					return;
				}
			},
			() => cancelRequested,
		);

			if (cancelRequested) {
				addLog('Research cancelled by user');
			} else {
				addLog('Research complete!');
			}
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsResearching(false);
		}
	};

	const handleGenerateOutline = async () => {
		setIsGeneratingOutline(true);
		addLog('Starting outline generation...');

		try {
			await createOutline(essay.slug, (progress: string) => {
				addLog(progress);
			});

			addLog('Outline generation complete!');
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsGeneratingOutline(false);
		}
	};

	const tasksSucceeded = tasks.filter(t => t.status === 'success').length;
	const tasksFailed = tasks.filter(t => t.status === 'error').length;

	const recentLogs = logs.slice(-20);

	const truncate = (str: string, maxLength: number) => {
		if (str.length <= maxLength) {
			return str;
		}

		return str.substring(0, maxLength - 3) + '...';
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'success':
				return '✓';
			case 'error':
				return '✗';
			case 'loading':
				return '⋯';
			default:
				return '○';
		}
	};

	const tableData = tasks.map(task => ({
		status: getStatusIcon(task.status),
		url: truncate(task.label, 50),
		summary: task.output ? truncate(task.output, 40) : '',
	}));

	if (showSourcesList) {
		return (
			<SourcesListScreen
				essay={essay}
				onBack={() => setShowSourcesList(false)}
			/>
		);
	}

	if (showJournalistScreen) {
		return (
			<JournalistScreen
				essay={essay}
				onBack={() => setShowJournalistScreen(false)}
			/>
		);
	}

	if (showEditorScreen) {
		return (
			<EditorScreen essay={essay} onBack={() => setShowEditorScreen(false)} />
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="blue" paddingX={2} paddingY={1}>
				<Text bold color="blue">
					Research: {essay.title}
				</Text>
			</Box>

			<Box marginTop={1} marginBottom={1} paddingX={1}>
				<Text color="white">Query: </Text>
				<Box width={60} marginLeft={1}>
					{inputFocused ? (
						<TextInput
							value={query}
							onChange={setQuery}
							onSubmit={handleSubmit}
							placeholder="Enter research query..."
						/>
					) : (
						<Text color="white">{query}</Text>
					)}
				</Box>
			</Box>

			<Box flexDirection="row">
				<Box width={leftWidth} flexDirection="column" marginRight={1}>
					<Box paddingX={1} borderBottom borderColor="white">
						<Text bold color="blue">
							Research ({tasks.length} found, {tasksSucceeded} archived{tasksFailed > 0 ? `, ${tasksFailed} failed` : ''})
						</Text>
					</Box>
					{tasks.length === 0 ? (
						<Box padding={1}>
							<Text color="white">
								{isResearching
									? 'Searching for articles...'
									: 'Enter a query to start research'}
							</Text>
						</Box>
					) : (
						<Box paddingX={1}>
							<Table data={tableData} />
						</Box>
					)}
				</Box>

				<Box width={rightWidth} flexDirection="column">
					<Box paddingX={1} borderBottom borderColor="white">
						<Text bold color="blue">
							Logs
						</Text>
					</Box>
					<Box
						flexDirection="column"
						paddingX={1}
						paddingY={1}
						height={Math.min(recentLogs.length + 2, 15)}
					>
						{recentLogs.length === 0 ? (
							<Text color="white">No activity yet</Text>
						) : (
							recentLogs.map((log, index) => (
								<Text key={index} color="white" wrap="wrap">
									{log}
								</Text>
							))
						)}
					</Box>
				</Box>
			</Box>

			<Box
				marginTop={1}
				borderStyle="round"
				borderColor="white"
				paddingX={2}
				paddingY={1}
			>
				<Text color="white">
					{isResearching
						? '[ESC] Cancel  [Q] Quit'
						: isGeneratingOutline
							? 'Generating outline...  [Q] Quit'
							: inputFocused
								? '[ESC] Unfocus to access menu options  [Q] Quit'
								: '[B] Back  [R] New  [L] List  [J] Write  [E] Edit  [O] Outline  [Q] Quit'}
				</Text>
			</Box>
		</Box>
	);
}

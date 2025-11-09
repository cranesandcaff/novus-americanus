import React, {useState} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import TextInput from 'ink-text-input';
import {TaskList, Task} from 'ink-task-list';
import {type Essay} from '../db/index.js';
import {researchTopic} from '../agents/ra.js';

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
	const [logs, setLogs] = useState<string[]>([]);
	const [inputFocused, setInputFocused] = useState(true);
	const {exit} = useApp();
	const {stdout} = useStdout();

	const terminalWidth = stdout?.columns ?? 80;
	const leftWidth = Math.floor(terminalWidth * 0.6);
	const rightWidth = Math.floor(terminalWidth * 0.4);

	const addLog = (message: string) => {
		setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
	};

	useInput(
		(input, _key) => {
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
				setTasks([]);
				setLogs([]);
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
		setTasks([]);
		setLogs([]);
		addLog('Starting research...');

		try {
			await researchTopic(essay.slug, query, (progress: string) => {
				addLog(progress);

				const foundMatch = progress.match(/Found (\d+) URLs, processing first (\d+)/);
				if (foundMatch && foundMatch[2]) {
					const count = Number.parseInt(foundMatch[2], 10);
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

				const savedMatch = progress.match(/\[(\d+)\/\d+\] Saved: (.+)/);
				if (savedMatch && savedMatch[1] && savedMatch[2]) {
					const articleNum = Number.parseInt(savedMatch[1], 10);
					const title = savedMatch[2];
					const index = articleNum - 1;
					setTasks(prev => {
						const updated = [...prev];
						if (updated[index]) {
							updated[index] = {
								label: title,
								status: 'success',
								output: 'Archived with summary and key points',
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
			});

			addLog('Research complete!');
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsResearching(false);
		}
	};

	const tasksSucceeded = tasks.filter(t => t.status === 'success').length;
	const tasksFailed = tasks.filter(t => t.status === 'error').length;

	const recentLogs = logs.slice(-20);

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
				<Box width={leftWidth} flexDirection="column" borderStyle="round" borderColor="white" marginRight={1}>
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
							<TaskList>
								{tasks.map((task, index) => (
									<Task
										key={index}
										label={task.label}
										state={task.status}
										output={task.output}
										spinner={{
											interval: 80,
											frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
										}}
									/>
								))}
							</TaskList>
						</Box>
					)}
				</Box>

				<Box width={rightWidth} flexDirection="column" borderStyle="round" borderColor="white">
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
								<Text key={index} color="white">
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
						? 'Researching...'
						: '[B] Back  [R] New Research  [Q] Quit'}
				</Text>
			</Box>
		</Box>
	);
}

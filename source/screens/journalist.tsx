import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import {type Essay} from '../db/index.js';
import {writeSection, getSectionsList, type JournalistResult} from '../agents/ja.js';
import Table from '../components/Table.js';

type JournalistScreenProps = {
	essay: Essay;
	onBack: () => void;
};

type SectionStatus = 'not_started' | 'writing' | 'completed';

type SectionProgress = {
	number: number;
	title: string;
	status: SectionStatus;
	currentWords: number;
	targetWords: number;
};

export function JournalistScreen({essay, onBack}: JournalistScreenProps) {
	const [sections, setSections] = useState<SectionProgress[]>([]);
	const [selectedSection, setSelectedSection] = useState<number | null>(null);
	const [isWriting, setIsWriting] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const {exit} = useApp();
	const {stdout} = useStdout();

	const terminalWidth = stdout?.columns ?? 80;
	const leftWidth = Math.floor(terminalWidth * 0.6);
	const rightWidth = Math.floor(terminalWidth * 0.4);

	const addLog = (message: string) => {
		setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
	};

	useEffect(() => {
		const loadSections = async () => {
			try {
				setIsLoading(true);
				const sectionsList = await getSectionsList(essay.slug);

				const progress: SectionProgress[] = sectionsList.map(s => {
					const hasContent = s.currentContent.length > 0;
					const currentWords = hasContent
						? s.currentContent.split(/\s+/).filter(w => w.length > 0).length
						: 0;

					return {
						number: s.number,
						title: s.title,
						status: hasContent ? 'completed' : 'not_started',
						currentWords,
						targetWords: s.targetWords,
					};
				});

				setSections(progress);
				if (progress.length > 0 && selectedSection === null) {
					setSelectedSection(progress[0].number);
				}
			} catch (error) {
				addLog(
					`Error loading sections: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			} finally {
				setIsLoading(false);
			}
		};

		void loadSections();
	}, [essay.slug]);

	useInput(
		(input, key) => {
			if (input === 'q') {
				exit();
				return;
			}

			if (input === 'b' && !isWriting) {
				onBack();
				return;
			}

			if (key.upArrow && !isWriting && sections.length > 0) {
				setSelectedSection(prev => {
					if (prev === null) {
						return sections[0].number;
					}

					const currentIndex = sections.findIndex(s => s.number === prev);
					if (currentIndex > 0) {
						return sections[currentIndex - 1].number;
					}

					return prev;
				});
			}

			if (key.downArrow && !isWriting && sections.length > 0) {
				setSelectedSection(prev => {
					if (prev === null) {
						return sections[0].number;
					}

					const currentIndex = sections.findIndex(s => s.number === prev);
					if (currentIndex < sections.length - 1) {
						return sections[currentIndex + 1].number;
					}

					return prev;
				});
			}

			if (input === 'w' && !isWriting && selectedSection !== null) {
				handleWriteSection(selectedSection);
			}

			if (input === 'a' && !isWriting) {
				handleWriteAll();
			}
		},
	);

	const handleWriteSection = async (sectionNumber: number) => {
		setIsWriting(true);
		setLogs([]);
		addLog(`Starting to write section ${sectionNumber}...`);

		setSections(prev =>
			prev.map(s =>
				s.number === sectionNumber ? {...s, status: 'writing'} : s,
			),
		);

		try {
			const result = await writeSection(
				essay.slug,
				sectionNumber,
				(progress: string) => {
					addLog(progress);
				},
			);

			setSections(prev =>
				prev.map(s =>
					s.number === sectionNumber
						? {
								...s,
								status: 'completed',
								currentWords: result.wordsWritten,
							}
						: s,
				),
			);

			addLog(
				`Completed! ${result.wordsWritten}/${result.targetWords} words using ${result.sourcesUsed} sources`,
			);
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			setSections(prev =>
				prev.map(s =>
					s.number === sectionNumber ? {...s, status: 'not_started'} : s,
				),
			);
		} finally {
			setIsWriting(false);
		}
	};

	const handleWriteAll = async () => {
		const unwrittenSections = sections.filter(s => s.status === 'not_started');

		if (unwrittenSections.length === 0) {
			addLog('All sections are already written!');
			return;
		}

		setIsWriting(true);
		setLogs([]);
		addLog(`Writing ${unwrittenSections.length} sections...`);

		for (const section of unwrittenSections) {
			await handleWriteSection(section.number);
		}

		setIsWriting(false);
		addLog('All sections complete!');
	};

	const getStatusIcon = (status: SectionStatus) => {
		switch (status) {
			case 'completed':
				return '✓';
			case 'writing':
				return '⋯';
			default:
				return '○';
		}
	};

	const getProgress = (section: SectionProgress) => {
		if (section.currentWords === 0) {
			return '0%';
		}

		const percent = Math.round(
			(section.currentWords / section.targetWords) * 100,
		);
		return `${percent}%`;
	};

	const tableData = sections.map(section => ({
		status: getStatusIcon(section.status),
		section: `${section.number}. ${section.title.substring(0, 40)}`,
		words: `${section.currentWords}/${section.targetWords}`,
		progress: getProgress(section),
		selected: section.number === selectedSection ? '→' : ' ',
	}));

	const recentLogs = logs.slice(-15);

	const completedSections = sections.filter(s => s.status === 'completed').length;
	const totalWords = sections.reduce((acc, s) => acc + s.currentWords, 0);
	const targetTotalWords = sections.reduce((acc, s) => acc + s.targetWords, 0);

	if (isLoading) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="blue">Loading sections...</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="blue" paddingX={2} paddingY={1}>
				<Text bold color="blue">
					Writing: {essay.title}
				</Text>
			</Box>

			<Box marginTop={1} paddingX={1}>
				<Text color="white">
					Progress: {completedSections}/{sections.length} sections | {totalWords}/
					{targetTotalWords} words
				</Text>
			</Box>

			<Box flexDirection="row" marginTop={1}>
				<Box width={leftWidth} flexDirection="column" marginRight={1}>
					<Box paddingX={1} borderBottom borderColor="white">
						<Text bold color="blue">
							Sections
						</Text>
					</Box>
					{sections.length === 0 ? (
						<Box padding={1}>
							<Text color="white">No sections found. Generate an outline first.</Text>
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
					{isWriting
						? 'Writing in progress...  [Q] Quit'
						: '[↑↓] Select  [W] Write Selected  [A] Write All  [B] Back  [Q] Quit'}
				</Text>
			</Box>
		</Box>
	);
}

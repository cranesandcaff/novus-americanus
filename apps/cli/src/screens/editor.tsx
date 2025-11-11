import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import TextInput from 'ink-text-input';
import {type Essay} from '../db/index.js';
import {
	reviewOutline,
	refineOutline,
	reviewSection,
	refineSection,
	type OutlineReview,
	type SectionReview,
} from '../agents/ea.js';
import {getSectionsList} from '../agents/ja.js';

type EditorScreenProps = {
	essay: Essay;
	onBack: () => void;
};

type EditorMode = 'outline' | 'sections';

type SectionInfo = {
	number: number;
	title: string;
	hasContent: boolean;
	wordCount: number;
};

export function EditorScreen({essay, onBack}: EditorScreenProps) {
	const [mode, setMode] = useState<EditorMode>('outline');
	const [outlineReview, setOutlineReview] = useState<OutlineReview | null>(
		null,
	);
	const [sectionReview, setSectionReview] = useState<SectionReview | null>(
		null,
	);
	const [sections, setSections] = useState<SectionInfo[]>([]);
	const [selectedSection, setSelectedSection] = useState<number | null>(null);
	const [isReviewing, setIsReviewing] = useState(false);
	const [isRefining, setIsRefining] = useState(false);
	const [showRefineInput, setShowRefineInput] = useState(false);
	const [refineFeedback, setRefineFeedback] = useState('');
	const [logs, setLogs] = useState<string[]>([]);
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
				const sectionsList = await getSectionsList(essay.slug);
				const info: SectionInfo[] = sectionsList.map(s => ({
					number: s.number,
					title: s.title,
					hasContent: s.currentContent.length > 0,
					wordCount: s.currentContent.split(/\s+/).filter(w => w.length > 0)
						.length,
				}));
				setSections(info);
				if (info.length > 0 && selectedSection === null) {
					setSelectedSection(info[0].number);
				}
			} catch (error) {
				addLog(
					`Error loading sections: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
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

			if (input === 'b' && !isReviewing && !isRefining && !showRefineInput) {
				onBack();
				return;
			}

			if (
				input === 'm' &&
				!isReviewing &&
				!isRefining &&
				!showRefineInput
			) {
				setMode(prev => (prev === 'outline' ? 'sections' : 'outline'));
				setOutlineReview(null);
				setSectionReview(null);
				setShowRefineInput(false);
				return;
			}

			if (mode === 'sections' && !isReviewing && !isRefining && !showRefineInput) {
				if (key.upArrow && sections.length > 0) {
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

				if (key.downArrow && sections.length > 0) {
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
			}

			if (
				input === 'r' &&
				!isReviewing &&
				!isRefining &&
				!showRefineInput
			) {
				if (mode === 'outline') {
					handleReviewOutline();
				} else if (selectedSection !== null) {
					handleReviewSection(selectedSection);
				}
			}

			if (input === 'e' && !isReviewing && !isRefining) {
				if (showRefineInput) {
					setShowRefineInput(false);
					setRefineFeedback('');
				} else if (
					(mode === 'outline' && outlineReview) ||
					(mode === 'sections' && sectionReview)
				) {
					setShowRefineInput(true);
				}
			}
		},
		{isActive: !showRefineInput},
	);

	const handleReviewOutline = async () => {
		setIsReviewing(true);
		setLogs([]);
		addLog('Starting outline review...');

		try {
			const review = await reviewOutline(essay.slug, (progress: string) => {
				addLog(progress);
			});
			setOutlineReview(review);
			addLog(`Review complete! Score: ${review.overallScore}/10`);
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsReviewing(false);
		}
	};

	const handleReviewSection = async (sectionNumber: number) => {
		setIsReviewing(true);
		setLogs([]);
		addLog(`Starting review of section ${sectionNumber}...`);

		try {
			const review = await reviewSection(
				essay.slug,
				sectionNumber,
				(progress: string) => {
					addLog(progress);
				},
			);
			setSectionReview(review);
			addLog(`Review complete! Score: ${review.score}/10`);
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsReviewing(false);
		}
	};

	const handleRefineOutline = async () => {
		if (!refineFeedback.trim()) {
			return;
		}

		setShowRefineInput(false);
		setIsRefining(true);
		setLogs([]);
		addLog('Refining outline...');

		try {
			await refineOutline(
				essay.slug,
				refineFeedback,
				outlineReview,
				(progress: string) => {
					addLog(progress);
				},
			);
			setRefineFeedback('');
			setOutlineReview(null);
			addLog('Outline refined! Review again to see changes.');
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsRefining(false);
		}
	};

	const handleRefineSection = async () => {
		if (!refineFeedback.trim() || selectedSection === null) {
			return;
		}

		setShowRefineInput(false);
		setIsRefining(true);
		setLogs([]);
		addLog(`Refining section ${selectedSection}...`);

		try {
			await refineSection(
				essay.slug,
				selectedSection,
				refineFeedback,
				sectionReview,
				(progress: string) => {
					addLog(progress);
				},
			);
			setRefineFeedback('');
			setSectionReview(null);
			addLog('Section refined! Review again to see changes.');
		} catch (error) {
			addLog(
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		} finally {
			setIsRefining(false);
		}
	};

	const recentLogs = logs.slice(-10);

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="blue" paddingX={2} paddingY={1}>
				<Text bold color="blue">
					Editing: {essay.title}
				</Text>
			</Box>

			<Box marginTop={1} paddingX={1}>
				<Text color="white">
					Mode: {mode === 'outline' ? 'Outline Review' : 'Section Review'}
				</Text>
			</Box>

			<Box flexDirection="row" marginTop={1}>
				<Box width={leftWidth} flexDirection="column" marginRight={1}>
						{mode === 'outline' ? (
							<>
								<Box paddingX={1} borderBottom borderColor="white">
									<Text bold color="blue">
										Outline Analysis
									</Text>
								</Box>
								{outlineReview ? (
									<Box flexDirection="column" paddingX={1} paddingY={1}>
										<Box
											borderStyle="round"
											borderColor="cyan"
											paddingX={1}
											paddingY={1}
										>
											<Text bold color="cyan">
												Overall Score: {outlineReview.overallScore}/10
											</Text>
										</Box>

										<Box
											marginTop={1}
											borderStyle="round"
											borderColor="green"
											paddingX={1}
											paddingY={1}
											flexDirection="column"
										>
											<Text bold color="green">
												Strengths
											</Text>
											{outlineReview.strengths.map((strength, i) => (
												<Text key={i} color="white">
													• {strength}
												</Text>
											))}
										</Box>

										{outlineReview.weaknesses.length > 0 && (
											<Box
												marginTop={1}
												borderStyle="round"
												borderColor="red"
												paddingX={1}
												paddingY={1}
												flexDirection="column"
											>
												<Text bold color="red">
													Issues
												</Text>
												{outlineReview.weaknesses.map((weakness, i) => (
													<Text key={i} color="white">
														• {weakness}
													</Text>
												))}
											</Box>
										)}

										{outlineReview.suggestions.length > 0 && (
											<Box
												marginTop={1}
												borderStyle="round"
												borderColor="yellow"
												paddingX={1}
												paddingY={1}
												flexDirection="column"
											>
												<Text bold color="yellow">
													Suggestions
												</Text>
												{outlineReview.suggestions.map((suggestion, i) => (
													<Text key={i} color="white">
														• {suggestion}
													</Text>
												))}
											</Box>
										)}

										<Box
											marginTop={1}
											borderStyle="round"
											borderColor="cyan"
											paddingX={1}
											paddingY={1}
										>
											<Text color="cyan" italic>
												💡 Press [E] to refine the outline based on this feedback
											</Text>
										</Box>
									</Box>
								) : (
									<Box padding={1}>
										<Text color="white">
											Press [R] to review the outline
										</Text>
									</Box>
								)}
							</>
						) : (
							<>
								<Box paddingX={1} borderBottom borderColor="white">
									<Text bold color="blue">
										Sections
									</Text>
								</Box>
								<Box flexDirection="column" paddingX={1} paddingY={1}>
									{sections.map(section => (
										<Text
											key={section.number}
											color={
												section.number === selectedSection ? 'cyan' : 'white'
											}
											bold={section.number === selectedSection}
										>
											{section.number === selectedSection ? '→ ' : '  '}
											{section.hasContent ? '✓' : '○'} {section.number}.{' '}
											{section.title.substring(0, 30)}{' '}
											{section.hasContent ? `(${section.wordCount} words)` : ''}
										</Text>
									))}
								</Box>
							</>
						)}
					</Box>

					<Box width={rightWidth} flexDirection="column">
						<Box paddingX={1} borderBottom borderColor="white">
							<Text bold color="blue">
								{mode === 'sections' && sectionReview
									? 'Section Review'
									: 'Activity'}
							</Text>
						</Box>
						<Box flexDirection="column" paddingX={1} paddingY={1}>
							{mode === 'sections' && sectionReview ? (
								<>
									<Box
										borderStyle="round"
										borderColor="cyan"
										paddingX={1}
										paddingY={1}
										flexDirection="column"
									>
										<Text bold color="cyan">
											Score: {sectionReview.score}/10
										</Text>
										<Text color="white">
											Citations: {sectionReview.citationUsage}
										</Text>
									</Box>

									<Box
										marginTop={1}
										borderStyle="round"
										borderColor="green"
										paddingX={1}
										paddingY={1}
										flexDirection="column"
									>
										<Text bold color="green">
											Strengths
										</Text>
										{sectionReview.strengths.map((strength, i) => (
											<Text key={i} color="white">
												• {strength}
											</Text>
										))}
									</Box>

									{sectionReview.issues.length > 0 && (
										<Box
											marginTop={1}
											borderStyle="round"
											borderColor="red"
											paddingX={1}
											paddingY={1}
											flexDirection="column"
										>
											<Text bold color="red">
												Issues
											</Text>
											{sectionReview.issues.map((issue, i) => (
												<Text key={i} color="white">
													• {issue}
												</Text>
											))}
										</Box>
									)}

									<Box
										marginTop={1}
										borderStyle="round"
										borderColor="cyan"
										paddingX={1}
										paddingY={1}
									>
										<Text color="cyan" italic>
											💡 Press [E] to refine this section based on the feedback
										</Text>
									</Box>
								</>
							) : (
								<>
									{recentLogs.map((log, index) => (
										<Text key={index} color="white" wrap="wrap">
											{log}
										</Text>
									))}
									{recentLogs.length === 0 && (
										<Text color="white">No activity yet</Text>
									)}
								</>
							)}
						</Box>
					</Box>
				</Box>

			{showRefineInput && (
				<Box marginTop={1} flexDirection="column" paddingX={1}>
					<Text bold color="yellow">
						Refinement Feedback
					</Text>
					<Box marginTop={1}>
						<TextInput
							value={refineFeedback}
							onChange={setRefineFeedback}
							onSubmit={
								mode === 'outline' ? handleRefineOutline : handleRefineSection
							}
							placeholder="e.g., 'follow all suggestions' or 'add more detail to section 2'..."
						/>
					</Box>
					<Box marginTop={1}>
						<Text dimColor>[Enter] Submit  [E] Cancel</Text>
					</Box>
				</Box>
			)}

			<Box
				marginTop={1}
				borderStyle="round"
				borderColor="white"
				paddingX={2}
				paddingY={1}
			>
				<Text color="white">
					{isReviewing || isRefining
						? 'Processing...'
						: showRefineInput
							? 'Enter feedback and press Enter'
							: mode === 'outline'
								? '[M] Switch Mode  [R] Review  [E] Refine  [B] Back  [Q] Quit'
								: '[↑↓] Select  [M] Switch Mode  [R] Review  [E] Refine  [B] Back  [Q] Quit'}
				</Text>
			</Box>
		</Box>
	);
}

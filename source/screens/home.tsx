import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {essays, type Essay} from '../db/index.js';

type HomeScreenProps = {
	onOpenEssay: (essay: Essay) => void;
	onNewEssay: () => void;
};

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diff = now.getTime() - new Date(date).getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);

	if (weeks > 0) {
		return `${weeks}w ago`;
	}

	if (days > 0) {
		return `${days}d ago`;
	}

	if (hours > 0) {
		return `${hours}h ago`;
	}

	if (minutes > 0) {
		return `${minutes}m ago`;
	}

	return 'just now';
}

function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) {
		return str;
	}

	return str.slice(0, maxLength - 3) + '...';
}

export function HomeScreen({onOpenEssay, onNewEssay}: HomeScreenProps) {
	const [essayList, setEssayList] = useState<Essay[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const {exit} = useApp();

	useEffect(() => {
		async function loadEssays() {
			try {
				const data = await essays.getAll();
				setEssayList(data);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load essays');
			} finally {
				setIsLoading(false);
			}
		}

		loadEssays();
	}, []);

	useInput((input, key) => {
		if (isLoading) {
			return;
		}

		if (input === 'q') {
			exit();
			return;
		}

		if (input === 'n') {
			onNewEssay();
			return;
		}

		if (key.return && essayList.length > 0) {
			onOpenEssay(essayList[selectedIndex]);
			return;
		}

		if (key.upArrow) {
			setSelectedIndex(prev => (prev > 0 ? prev - 1 : essayList.length - 1));
		}

		if (key.downArrow) {
			setSelectedIndex(prev => (prev < essayList.length - 1 ? prev + 1 : 0));
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="blue" flexDirection="column">
				<Box paddingX={2} paddingTop={1}>
					<Text bold color="blue">
						Novus Americanus
					</Text>
				</Box>

				<Box paddingX={2} paddingY={1} flexDirection="column">
					<Text bold color="white">
						Essays
					</Text>

					{isLoading && (
						<Box paddingTop={1}>
							<Text color="yellowBright">Loading essays...</Text>
						</Box>
					)}

					{error && (
						<Box paddingTop={1}>
							<Text color="redBright">Error: {error}</Text>
						</Box>
					)}

					{!isLoading && !error && essayList.length === 0 && (
						<Box paddingTop={1}>
							<Text color="white">
								No essays yet. Press N to create your first essay.
							</Text>
						</Box>
					)}

					{!isLoading && !error && essayList.length > 0 && (
						<Box flexDirection="column" paddingTop={1}>
							<Box>
								<Box width={28}>
									<Text bold color="white">
										Title
									</Text>
								</Box>
								<Box width={15}>
									<Text bold color="white">
										Status
									</Text>
								</Box>
								<Box width={12}>
									<Text bold color="white">
										Updated
									</Text>
								</Box>
							</Box>

							<Box flexDirection="column">
								{essayList.map((essay, index) => (
									<Box key={essay.id}>
										<Box width={28}>
											<Text
												color={index === selectedIndex ? 'blue' : 'white'}
												bold={index === selectedIndex}
											>
												{index === selectedIndex ? '› ' : '  '}
												{truncate(essay.title, 24)}
											</Text>
										</Box>
										<Box width={15}>
											<Text
												color={index === selectedIndex ? 'blue' : 'white'}
												bold={index === selectedIndex}
											>
												{essay.status}
											</Text>
										</Box>
										<Box width={12}>
											<Text
												color={index === selectedIndex ? 'blue' : 'white'}
												bold={index === selectedIndex}
											>
												{formatRelativeTime(essay.updated_at)}
											</Text>
										</Box>
									</Box>
								))}
							</Box>
						</Box>
					)}
				</Box>

				<Box paddingX={2} paddingBottom={1} borderTop borderColor="white">
					<Text color="white">
						[N] New Essay [Enter] Open {essayList.length > 0 ? '' : ''}[Q] Quit
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

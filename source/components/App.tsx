import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import slugify from '@sindresorhus/slugify';
import {type Essay} from '../db/index.js';
import {createEssay} from '../tools/storage.js';
import {HomeScreen} from '../screens/home.js';
import {ResearchScreen} from '../screens/research.js';

type Screen = 'home' | 'research' | 'new-essay';

type NewEssayScreenProps = {
	newEssayTitle: string;
	setNewEssayTitle: (title: string) => void;
	isCreatingEssay: boolean;
	createError: string | null;
	onSubmit: () => void;
	onCancel: () => void;
};

function NewEssayScreen({
	newEssayTitle,
	setNewEssayTitle,
	isCreatingEssay,
	createError,
	onSubmit,
	onCancel,
}: NewEssayScreenProps) {
	useInput((input, key) => {
		if (key.escape && !isCreatingEssay) {
			onCancel();
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" borderColor="cyan" flexDirection="column">
				<Box paddingX={2} paddingTop={1}>
					<Text bold color="cyan">
						Create New Essay
					</Text>
				</Box>

				<Box paddingX={2} paddingY={1} flexDirection="column">
					<Box marginBottom={1}>
						<Text>Title: </Text>
						<Box width={50}>
							<TextInput
								value={newEssayTitle}
								onChange={setNewEssayTitle}
								onSubmit={onSubmit}
								placeholder="Enter essay title..."
							/>
						</Box>
					</Box>

					{createError && (
						<Box marginTop={1}>
							<Text color="red">Error: {createError}</Text>
						</Box>
					)}

					{isCreatingEssay && (
						<Box marginTop={1}>
							<Text color="gray">Creating essay...</Text>
						</Box>
					)}
				</Box>

				<Box paddingX={2} paddingBottom={1} borderTop borderColor="gray">
					<Text dimColor>
						{isCreatingEssay ? 'Creating...' : '[Enter] Create  [Esc] Cancel'}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

export default function App() {
	const [currentScreen, setCurrentScreen] = useState<Screen>('home');
	const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
	const [newEssayTitle, setNewEssayTitle] = useState('');
	const [isCreatingEssay, setIsCreatingEssay] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	const handleOpenEssay = (essay: Essay) => {
		setSelectedEssay(essay);
		setCurrentScreen('research');
	};

	const handleNewEssay = () => {
		setNewEssayTitle('');
		setCreateError(null);
		setCurrentScreen('new-essay');
	};

	const handleCreateEssay = async () => {
		if (!newEssayTitle.trim() || isCreatingEssay) {
			return;
		}

		setIsCreatingEssay(true);
		setCreateError(null);

		try {
			const slug = slugify(newEssayTitle);
			const essay = await createEssay(newEssayTitle, slug);
			setSelectedEssay(essay);
			setCurrentScreen('research');
		} catch (error) {
			setCreateError(
				error instanceof Error ? error.message : 'Failed to create essay',
			);
		} finally {
			setIsCreatingEssay(false);
		}
	};

	const handleBackToHome = () => {
		setSelectedEssay(null);
		setCurrentScreen('home');
	};

	if (currentScreen === 'home') {
		return (
			<HomeScreen onOpenEssay={handleOpenEssay} onNewEssay={handleNewEssay} />
		);
	}

	if (currentScreen === 'new-essay') {
		return <NewEssayScreen
			newEssayTitle={newEssayTitle}
			setNewEssayTitle={setNewEssayTitle}
			isCreatingEssay={isCreatingEssay}
			createError={createError}
			onSubmit={handleCreateEssay}
			onCancel={handleBackToHome}
		/>;
	}

	if (currentScreen === 'research' && selectedEssay) {
		return <ResearchScreen essay={selectedEssay} onBack={handleBackToHome} />;
	}

	return (
		<Box padding={1}>
			<Text color="red">Error: Invalid application state</Text>
		</Box>
	);
}

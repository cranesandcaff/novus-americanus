declare module 'text-readability' {
	export function fleschKincaidGrade(text: string): number;
	export function gunningFog(text: string): number;
	export function automatedReadabilityIndex(text: string): number;
	export function smog(text: string): number;
	export function daleChallReadabilityScore(text: string): number;
}

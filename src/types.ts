// Format de public/timeline.json (produit par scripts/build-timeline.mjs).
export type Easing = 'in' | 'out' | 'inOut';

export type Timeline = {
	fps: number;
	width: number;
	height: number;
	durationInFrames: number;
	estimated: boolean;
	missingVoices: string[];
	sections: {
		id: string;
		title: string;
		amount: number | null;
		from: number;
		audio: { src: string; from: number; durationInFrames: number } | null;
	}[];
	/** Intervalles [début, fin] où la voix parle, en images. */
	speech: [number, number][];
	counter: { initial: number; moves: { from: number; to: number; value: number; easing: Easing }[] };
	captions: { from: number; to: number; lines: string[] }[];
	shots: {
		section: string;
		from: number;
		durationInFrames: number;
		src: string | null;
		clipFrames: number | null;
		label: string | null;
	}[];
	overlays: OverlayEntry[];
	music: { src: string; volume: number; volumeDuringPauses: number; fadeFrames: number } | null;
};

export type OverlayEntry = {
	type: 'call' | 'balance' | 'notification' | 'agenda' | 'message' | 'people' | 'confetti';
	from: number;
	durationInFrames: number;
	props: Record<string, unknown> & { triggerFrame?: number };
};

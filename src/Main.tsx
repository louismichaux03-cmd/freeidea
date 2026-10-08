import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile } from 'remotion';
import { Background } from './components/Background';
import { Captions } from './components/Captions';
import { Counter } from './components/Counter';
import { Overlays } from './components/Overlays';
import type { Timeline } from './types';

const RAMP = 12; // images pour passer du volume « voix » au volume « pause »

// Musique discrète : plus basse quand la voix parle, remonte un peu pendant les pauses.
function musicVolume(timeline: Timeline, frame: number) {
	const music = timeline.music!;
	let speaking = 0;
	for (const [a, b] of timeline.speech) {
		const s = interpolate(frame, [a - RAMP, a, b, b + RAMP], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
		speaking = Math.max(speaking, s);
	}
	const level = interpolate(speaking, [0, 1], [music.volumeDuringPauses, music.volume]);
	const end = timeline.durationInFrames;
	const fade = interpolate(frame, [0, music.fadeFrames, end - music.fadeFrames * 1.5, end], [0, 1, 1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return level * fade;
}

export const Main: React.FC<{ timeline: Timeline | null }> = ({ timeline }) => {
	if (!timeline) return null;
	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<Background shots={timeline.shots} />
			<Overlays overlays={timeline.overlays} />
			<Counter counter={timeline.counter} />
			<Captions captions={timeline.captions} />

			{timeline.sections.map(
				(s) =>
					s.audio && (
						<Sequence key={s.id} from={s.audio.from} durationInFrames={s.audio.durationInFrames} name={`Voix ${s.id}`}>
							<Html5Audio src={staticFile(s.audio.src)} />
						</Sequence>
					),
			)}
			{timeline.music && <Html5Audio src={staticFile(timeline.music.src)} loop volume={(f) => musicVolume(timeline, f)} />}
		</AbsoluteFill>
	);
};

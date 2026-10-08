import { AbsoluteFill, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT } from '../fonts';
import type { Timeline } from '../types';

type Shot = Timeline['shots'][number];

const FADE_IN = 10;

const ShotView: React.FC<{ shot: Shot; fadeIn: boolean }> = ({ shot, fadeIn }) => {
	const frame = useCurrentFrame();
	// Léger zoom continu pour que même un plan fixe vive un peu.
	const scale = interpolate(frame, [0, shot.durationInFrames], [1.0, 1.07]);
	const opacity = fadeIn ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: 'clamp' }) : 1;

	if (!shot.src || !shot.clipFrames) {
		// Pas encore de vidéo Pexels pour ce plan : carton provisoire.
		return (
			<AbsoluteFill
				style={{
					opacity,
					background: 'radial-gradient(circle at 50% 40%, #2b3245 0%, #10131b 70%)',
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 34, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
					Plan Pexels : {shot.label}
				</div>
			</AbsoluteFill>
		);
	}

	const video = (
		<OffthreadVideo
			src={staticFile(shot.src)}
			muted
			style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
		/>
	);
	return (
		<AbsoluteFill style={{ opacity, backgroundColor: 'black' }}>
			{/* Un clip plus court que son plan repart du début. */}
			{shot.clipFrames < shot.durationInFrames ? <Loop durationInFrames={shot.clipFrames}>{video}</Loop> : video}
		</AbsoluteFill>
	);
};

export const Background: React.FC<{ shots: Timeline['shots'] }> = ({ shots }) => (
	<AbsoluteFill style={{ backgroundColor: 'black' }}>
		{shots.map((shot, i) => (
			<Sequence key={i} from={shot.from} durationInFrames={shot.durationInFrames} premountFor={30}>
				{/* Fondu au début de chaque section (changement de niveau). */}
				<ShotView shot={shot} fadeIn={i > 0 && shots[i - 1].section !== shot.section} />
			</Sequence>
		))}
		{/* Assombrit le haut (compteur) et le bas (sous-titres) pour la lisibilité. */}
		<AbsoluteFill
			style={{
				background:
					'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.05) 65%, rgba(0,0,0,0.6) 100%)',
			}}
		/>
	</AbsoluteFill>
);

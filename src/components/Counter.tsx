import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT } from '../fonts';
import type { Easing as EasingName, Timeline } from '../types';

const EASINGS: Record<EasingName, (t: number) => number> = {
	in: Easing.in(Easing.cubic),
	out: Easing.out(Easing.cubic),
	inOut: Easing.inOut(Easing.cubic),
};

// On interpole sur une échelle logarithmique signée : passer de 1 000 € à 100 milliards
// fait défiler chaque ordre de grandeur, au lieu de sauter directement au bout.
const toLog = (v: number) => Math.sign(v) * Math.log10(1 + Math.abs(v));
const fromLog = (x: number) => Math.sign(x) * (10 ** Math.abs(x) - 1);

export function counterState(counter: Timeline['counter'], frame: number) {
	let value = counter.initial;
	let moving = false;
	let lastArrival = -Infinity;
	for (const move of counter.moves) {
		if (frame < move.from) break;
		if (frame >= move.to) {
			value = move.value;
			lastArrival = move.to;
			continue;
		}
		const progress = EASINGS[move.easing]((frame - move.from) / (move.to - move.from));
		value = fromLog(interpolate(progress, [0, 1], [toLog(value), toLog(move.value)]));
		moving = true;
		break;
	}
	return { value: Math.round(value), moving, sinceArrival: frame - lastArrival };
}

const DIGIT_WIDTH = '0.64em';

export const Counter: React.FC<{ counter: Timeline['counter'] }> = ({ counter }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const { value, moving, sinceArrival } = counterState(counter, frame);
	const negative = value < 0;

	// Petit rebond quand le compteur arrive sur un montant.
	const pop = sinceArrival < fps ? spring({ frame: sinceArrival, fps, config: { damping: 9, stiffness: 180 } }) : 1;
	const scale = (moving ? 1.06 : 1) * interpolate(pop, [0, 1], [1.12, 1]);

	const groups = Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ').split(' ');
	const color = negative ? '#ff4b4b' : '#ffffff';

	return (
		<div style={{ position: 'absolute', top: 44, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
			<div
				style={{
					transform: `scale(${scale})`,
					fontFamily: FONT,
					fontWeight: 800,
					fontSize: 84,
					lineHeight: 1,
					color,
					padding: '18px 48px 20px',
					borderRadius: 999,
					background: negative ? 'rgba(70, 0, 0, 0.72)' : 'rgba(8, 10, 16, 0.66)',
					border: `3px solid ${negative ? 'rgba(255, 75, 75, 0.7)' : 'rgba(255, 255, 255, 0.16)'}`,
					boxShadow: moving ? `0 0 40px ${negative ? 'rgba(255,75,75,0.45)' : 'rgba(255,215,90,0.35)'}` : '0 10px 30px rgba(0,0,0,0.35)',
					display: 'flex',
					alignItems: 'baseline',
					whiteSpace: 'nowrap',
				}}
			>
				{negative && <span style={{ marginRight: '0.06em' }}>−</span>}
				{groups.map((g, gi) => (
					<span key={gi} style={{ marginLeft: gi ? '0.24em' : 0, display: 'flex' }}>
						{[...g].map((d, di) => (
							<span key={di} style={{ display: 'inline-block', width: DIGIT_WIDTH, textAlign: 'center' }}>
								{d}
							</span>
						))}
					</span>
				))}
				<span style={{ marginLeft: '0.28em' }}>€</span>
			</div>
		</div>
	);
};

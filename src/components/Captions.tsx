import { interpolate, useCurrentFrame } from 'remotion';
import { FONT } from '../fonts';
import type { Timeline } from '../types';

export const Captions: React.FC<{ captions: Timeline['captions'] }> = ({ captions }) => {
	const frame = useCurrentFrame();
	const cue = captions.find((c) => frame >= c.from && frame < c.to);
	if (!cue) return null;
	const opacity = interpolate(frame - cue.from, [0, 3], [0, 1], { extrapolateRight: 'clamp' });

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				bottom: 70,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 8,
				opacity,
			}}
		>
			{cue.lines.map((line, i) => (
				<div
					key={i}
					style={{
						fontFamily: FONT,
						fontWeight: 700,
						fontSize: 52,
						lineHeight: 1.18,
						color: '#ffffff',
						background: 'rgba(0, 0, 0, 0.62)',
						padding: '6px 22px 9px',
						borderRadius: 12,
						whiteSpace: 'pre',
					}}
				>
					{line}
				</div>
			))}
		</div>
	);
};

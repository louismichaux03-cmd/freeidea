// Éléments du « Visuel » que des vidéos de banque d'images ne peuvent pas montrer :
// appel « Numéro inconnu », solde bancaire, notification, agenda, message, silhouettes, confettis.
import { AbsoluteFill, interpolate, random, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT } from '../fonts';
import type { OverlayEntry, Timeline } from '../types';

type P = OverlayEntry['props'];

// Entrée par glissement + fondu, sortie par fondu sur les dernières images.
function useAppear(duration: number) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
	const exit = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return { frame, enter, opacity: Math.min(enter, exit) };
}

const card: React.CSSProperties = {
	fontFamily: FONT,
	background: 'rgba(248, 249, 252, 0.97)',
	color: '#111318',
	borderRadius: 34,
	boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
	padding: '30px 36px',
	width: 600,
};

const SideCard: React.FC<{ duration: number; children: React.ReactNode; shake?: boolean }> = ({ duration, children, shake }) => {
	const { frame, enter, opacity } = useAppear(duration);
	// Vibration du téléphone : petites secousses par salves.
	const buzz = shake && frame % 40 < 14 ? Math.sin(frame * 2.6) * 7 : 0;
	return (
		<AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: 130 }}>
			<div style={{ ...card, opacity, transform: `translateX(${(1 - enter) * 160 + buzz}px)` }}>{children}</div>
		</AbsoluteFill>
	);
};

const AppIcon: React.FC<{ color: string; children: React.ReactNode; size?: number }> = ({ color, children, size = 54 }) => (
	<div
		style={{
			width: size,
			height: size,
			borderRadius: size * 0.26,
			background: color,
			color: 'white',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			fontWeight: 800,
			fontSize: size * 0.5,
			flexShrink: 0,
		}}
	>
		{children}
	</div>
);

const Call: React.FC<{ props: P; duration: number }> = ({ props, duration }) => (
	<SideCard duration={duration} shake>
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 0' }}>
			<div style={{ width: 120, height: 120, borderRadius: 60, background: '#c7cad3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, fontWeight: 700, color: 'white' }}>
				?
			</div>
			<div style={{ fontSize: 46, fontWeight: 800 }}>{String(props.title)}</div>
			<div style={{ fontSize: 28, fontWeight: 600, color: '#6b6f7a' }}>{String(props.subtitle ?? '')}</div>
			<div style={{ display: 'flex', gap: 120, marginTop: 18 }}>
				<div style={{ width: 92, height: 92, borderRadius: 46, background: '#ff3b30' }} />
				<div style={{ width: 92, height: 92, borderRadius: 46, background: '#34c759' }} />
			</div>
		</div>
	</SideCard>
);

const Balance: React.FC<{ props: P; duration: number }> = ({ props, duration }) => (
	<SideCard duration={duration}>
		<div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26 }}>
			<AppIcon color="#1f6feb">€</AppIcon>
			<div style={{ fontSize: 28, fontWeight: 700 }}>Ma banque</div>
		</div>
		<div style={{ fontSize: 28, fontWeight: 600, color: '#6b6f7a' }}>{String(props.title)}</div>
		<div style={{ fontSize: 88, fontWeight: 800, color: props.tone === 'low' ? '#e8590c' : '#111318', marginTop: 4 }}>
			{String(props.amount)}
		</div>
	</SideCard>
);

const Notification: React.FC<{ props: P; duration: number }> = ({ props, duration }) => (
	<SideCard duration={duration}>
		<div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
			<AppIcon color="#1f6feb">€</AppIcon>
			<div style={{ flex: 1 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, fontWeight: 600, color: '#6b6f7a' }}>
					<span>{String(props.app ?? '')}</span>
					<span>maintenant</span>
				</div>
				<div style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>{String(props.title)}</div>
				{props.body ? <div style={{ fontSize: 28, fontWeight: 600, color: '#3d414c', marginTop: 6 }}>{String(props.body)}</div> : null}
			</div>
		</div>
	</SideCard>
);

const Agenda: React.FC<{ props: P; duration: number }> = ({ props, duration }) => {
	const frame = useCurrentFrame();
	const items = (props.items as string[]) ?? [];
	return (
		<SideCard duration={duration}>
			<div style={{ fontSize: 34, fontWeight: 800, marginBottom: 18 }}>{String(props.title)}</div>
			{items.map((item, i) => {
				const o = interpolate(frame, [12 + i * 10, 20 + i * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
				return (
					<div key={item} style={{ opacity: o, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: i ? '2px solid #e3e5ea' : undefined }}>
						<div style={{ width: 10, height: 44, borderRadius: 5, background: ['#1f6feb', '#e8590c', '#7048e8'][i % 3] }} />
						<div style={{ fontSize: 34, fontWeight: 700 }}>{item}</div>
					</div>
				);
			})}
		</SideCard>
	);
};

const Message: React.FC<{ props: P; duration: number }> = ({ props, duration }) => (
	<SideCard duration={duration}>
		<div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18 }}>
			<AppIcon color="#34c759">✉</AppIcon>
			<div>
				<div style={{ fontSize: 32, fontWeight: 800 }}>{String(props.from)}</div>
				<div style={{ fontSize: 22, fontWeight: 600, color: '#6b6f7a' }}>maintenant</div>
			</div>
		</div>
		<div style={{ background: '#e9e9eb', borderRadius: 26, padding: '18px 24px', fontSize: 36, fontWeight: 600, lineHeight: 1.25 }}>
			{String(props.text)}
		</div>
	</SideCard>
);

const Person: React.FC<{ color: string }> = ({ color }) => (
	<svg width="110" height="250" viewBox="0 0 110 250">
		<circle cx="55" cy="38" r="32" fill={color} />
		<path d="M10 250 V120 Q10 82 55 82 Q100 82 100 120 V250 Z" fill={color} />
	</svg>
);

// Dix silhouettes alignées ; les quatre premières passent en gris au moment du repère.
const People: React.FC<{ props: P; duration: number }> = ({ props, duration }) => {
	const { frame, enter, opacity } = useAppear(duration);
	const total = Number(props.total ?? 10);
	const grey = Number(props.grey ?? 4);
	const trigger = props.triggerFrame ?? 0;
	return (
		<AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity, backgroundColor: `rgba(0,0,0,${0.45 * enter})` }}>
			<div style={{ display: 'flex', gap: 34, transform: `translateY(${(1 - enter) * 60}px)` }}>
				{Array.from({ length: total }, (_, i) => {
					const t = interpolate(frame, [trigger + i * 5, trigger + i * 5 + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
					const isGrey = i < grey;
					return (
						<div key={i} style={{ opacity: isGrey ? 1 - 0.55 * t : 1 }}>
							<Person color={isGrey && t > 0.5 ? '#7d818c' : '#ffffff'} />
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

const COLORS = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#f783ac', '#ffffff'];

const Confetti: React.FC<{ duration: number }> = ({ duration }) => {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const fade = interpolate(frame, [duration - 20, duration], [1, 0], { extrapolateLeft: 'clamp' });
	return (
		<AbsoluteFill style={{ opacity: fade }}>
			{Array.from({ length: 90 }, (_, i) => {
				const x0 = random(`x${i}`) * width;
				const speed = 9 + random(`s${i}`) * 9;
				const drift = (random(`d${i}`) - 0.5) * 4;
				const y = -40 - random(`y${i}`) * 300 + frame * speed;
				const x = x0 + frame * drift + Math.sin((frame + i * 7) / 9) * 18;
				if (y > height + 40) return null;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: 14,
							height: 24,
							borderRadius: 3,
							background: COLORS[i % COLORS.length],
							transform: `rotate(${frame * (6 + (i % 5) * 3)}deg) scaleX(${Math.cos((frame + i) / 4)})`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

const Overlay: React.FC<{ o: OverlayEntry }> = ({ o }) => {
	const d = o.durationInFrames;
	switch (o.type) {
		case 'call':
			return <Call props={o.props} duration={d} />;
		case 'balance':
			return <Balance props={o.props} duration={d} />;
		case 'notification':
			return <Notification props={o.props} duration={d} />;
		case 'agenda':
			return <Agenda props={o.props} duration={d} />;
		case 'message':
			return <Message props={o.props} duration={d} />;
		case 'people':
			return <People props={o.props} duration={d} />;
		case 'confetti':
			return <Confetti duration={d} />;
	}
};

export const Overlays: React.FC<{ overlays: Timeline['overlays'] }> = ({ overlays }) => (
	<>
		{overlays.map((o, i) => (
			<Sequence key={i} from={o.from} durationInFrames={o.durationInFrames}>
				<Overlay o={o} />
			</Sequence>
		))}
	</>
);

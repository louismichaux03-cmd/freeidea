import { Composition, staticFile } from 'remotion';
import { Main } from './Main';
import type { Timeline } from './types';
import './fonts';

export const RemotionRoot: React.FC = () => (
	<Composition
		id="Video"
		component={Main}
		defaultProps={{ timeline: null as Timeline | null }}
		// Durée et contenu viennent de public/timeline.json (npm run timeline).
		calculateMetadata={async () => {
			const res = await fetch(staticFile('timeline.json'));
			if (!res.ok) throw new Error('public/timeline.json introuvable : lance « npm run timeline ».');
			const timeline = (await res.json()) as Timeline;
			return {
				durationInFrames: timeline.durationInFrames,
				fps: timeline.fps,
				width: timeline.width,
				height: timeline.height,
				props: { timeline },
			};
		}}
	/>
);

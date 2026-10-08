// Rendu MP4 avec Remotion.
//
//   npm run preview                        → aperçu de 30 s autour de l'entrée dans un niveau
//   npm run preview -- --around niveau-07  → aperçu autour d'une autre section
//   npm run render                         → vidéo complète (refusé si voix ou vidéos manquantes)
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { config, p, readJson } from './lib/project.mjs';

const args = process.argv.slice(2);
const option = (name) => {
	const i = args.indexOf(name);
	return i === -1 ? undefined : args[i + 1];
};
const preview = args.includes('--preview');
const timeline = readJson('public/timeline.json');
const { fps } = timeline;

let frames;
let output;
if (preview) {
	const around = option('--around') ?? config.preview.around;
	const section = timeline.sections.find((s) => s.id === around);
	if (!section) {
		console.error(`Section « ${around} » absente du montage (voix pas encore générée ?).`);
		process.exit(1);
	}
	// 30 s centrées sur le début de la section : fin de la précédente, pause + compteur, début de celle-ci.
	const length = config.preview.seconds * fps;
	const start = Math.max(0, Math.min(section.from - length / 2, timeline.durationInFrames - length));
	frames = [Math.round(start), Math.min(timeline.durationInFrames, Math.round(start + length)) - 1];
	output = `out/apercu-${around}.mp4`;
} else {
	const problems = [];
	if (timeline.missingVoices.length) problems.push(`voix manquantes : ${timeline.missingVoices.join(', ')}`);
	if (timeline.estimated) problems.push('voix estimées (montage construit avec --estimate)');
	const noClip = timeline.shots.filter((s) => !s.src).length;
	if (noClip) problems.push(`${noClip} plan(s) sans vidéo Pexels`);
	if (problems.length && !args.includes('--force')) {
		console.error(`Rendu final refusé :\n  ${problems.join('\n  ')}\n(--force pour rendre quand même)`);
		process.exit(1);
	}
	output = 'out/ta-vie-a-chaque-niveau-de-richesse.mp4';
}

mkdirSync(p('out'), { recursive: true });
const cli = [
	'remotion',
	'render',
	'src/index.ts',
	'Video',
	output,
	'--codec=h264',
	`--crf=${preview ? 22 : 18}`,
	'--audio-bitrate=192k',
	...(frames ? [`--frames=${frames[0]}-${frames[1]}`] : []),
	...(process.env.REMOTION_BROWSER_EXECUTABLE ? [`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`] : []),
];
const fmt = (f) => `${Math.floor(f / fps / 60)}:${String(Math.floor((f / fps) % 60)).padStart(2, '0')}`;
console.log(frames ? `Aperçu de ${fmt(frames[0])} à ${fmt(frames[1] + 1)} → ${output}` : `Rendu complet (${fmt(timeline.durationInFrames)}) → ${output}`);
const { status } = spawnSync('npx', cli, { cwd: p(), stdio: 'inherit' });
process.exit(status ?? 1);

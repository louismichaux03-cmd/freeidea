// Cherche et télécharge les vidéos Pexels (16:9) de chaque plan décrit dans data/visuals.json.
//
//   npm run pexels                 → complète ce qui manque (garde les choix déjà faits)
//   npm run pexels -- niveau-03    → refait la recherche pour une section
//   npm run pexels -- --force      → refait toutes les recherches
//
// Les choix sont notés dans data/media.json et les crédits des vidéastes dans CREDITS.md.
import { createWriteStream, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { apiError, config, loadEnv, loadScript, p, readJson, writeJson } from './lib/project.mjs';
import { loadAlignment, shotRanges } from './lib/plan.mjs';

const args = process.argv.slice(2);
const sections = loadScript();
const visuals = readJson('data/visuals.json');
const redo = new Set(args.includes('--force') ? sections.map((s) => s.id) : args.filter((a) => !a.startsWith('--')));
const { PEXELS_API_KEY: apiKey } = loadEnv(['PEXELS_API_KEY']);

const media = readJson('data/media.json', {});
const { clipsPerShot, minClipSeconds } = config.pexels;
const SEGMENT_SECONDS = 5; // un plan de 10 s ou plus est découpé en deux clips différents

const used = new Set();
for (const [id, shots] of Object.entries(media)) {
	if (redo.has(id)) continue;
	for (const shot of shots) for (const clip of shot?.clips ?? []) used.add(clip.id);
}

let rateLimitRemaining;
async function search(query) {
	const url = new URL('https://api.pexels.com/videos/search');
	url.search = new URLSearchParams({ query, orientation: 'landscape', size: 'medium', per_page: '40' });
	const res = await fetch(url, { headers: { Authorization: apiKey } });
	if (!res.ok) throw await apiError('Pexels', res);
	rateLimitRemaining = res.headers.get('x-ratelimit-remaining') ?? rateLimitRemaining;
	return (await res.json()).videos ?? [];
}

const is16by9 = (w, h) => w && h && Math.abs(w / h - 16 / 9) < 0.01;

// Le fichier 1920×1080 si possible, sinon le plus petit 16:9 au-dessus de 1280 px de large.
function pickFile(video) {
	const files = video.video_files.filter((f) => f.file_type === 'video/mp4' && is16by9(f.width, f.height) && f.width >= 1280);
	return (
		files.find((f) => f.width === 1920) ??
		files.filter((f) => f.width > 1920).sort((a, b) => a.width - b.width)[0] ??
		files.sort((a, b) => b.width - a.width)[0] ??
		null
	);
}

async function findClips(shot, count) {
	const clips = [];
	for (const query of [shot.query, ...(shot.alt ?? [])]) {
		for (const video of await search(query)) {
			if (clips.length >= count) break;
			if (used.has(video.id) || video.duration < minClipSeconds || !is16by9(video.width, video.height)) continue;
			const file = pickFile(video);
			if (!file) continue;
			used.add(video.id);
			clips.push({
				id: video.id,
				query,
				file: `videos/${video.id}.mp4`,
				link: file.link,
				width: file.width,
				height: file.height,
				duration: video.duration,
				url: video.url,
				author: video.user?.name,
				authorUrl: video.user?.url,
			});
		}
		if (clips.length >= count) break;
	}
	return clips;
}

async function download(clip) {
	const dest = p('public', clip.file);
	if (existsSync(dest)) return false;
	const res = await fetch(clip.link);
	if (!res.ok) throw await apiError(`Pexels (téléchargement ${clip.id})`, res);
	await pipeline(Readable.fromWeb(res.body), createWriteStream(dest + '.part'));
	renameSync(dest + '.part', dest);
	return true;
}

mkdirSync(p('public/videos'), { recursive: true });
const missing = [];
for (const [i, section] of sections.entries()) {
	const plan = visuals[section.id];
	if (!plan) throw new Error(`data/visuals.json : pas de plans pour ${section.id}`);
	const { alignment } = loadAlignment(section, { estimate: true });
	const ranges = shotRanges(section, plan.shots, alignment, {
		pauseBefore: i === 0 ? config.leadInSeconds : config.pauseSeconds,
		pauseAfter: i + 1 < sections.length ? 0 : config.tailSeconds,
	});

	const previous = redo.has(section.id) ? [] : (media[section.id] ?? []);
	media[section.id] = [];
	for (const { shot, index, from, to } of ranges) {
		if (shot.reuse) {
			media[section.id][index] = { reuse: shot.reuse, shot: shot.shot };
			continue;
		}
		const need = Math.min(clipsPerShot, Math.max(1, Math.floor((to - from) / SEGMENT_SECONDS)));
		const kept = previous[index]?.query === shot.query ? (previous[index].clips ?? []) : [];
		const clips = kept.length >= need ? kept : [...kept, ...(await findClips(shot, need - kept.length))];
		if (!clips.length) missing.push(`${section.id} plan ${index + 1} (« ${shot.query} »)`);
		media[section.id][index] = { query: shot.query, clips };
		console.log(`  ${section.id} plan ${index + 1} : ${clips.length} clip(s) — ${shot.query}`);
	}
}
writeJson('data/media.json', media);

let downloaded = 0;
for (const shots of Object.values(media)) {
	for (const shot of shots) {
		for (const clip of shot.clips ?? []) if (await download(clip)) downloaded++;
	}
}

const credits = new Map();
for (const shots of Object.values(media)) {
	for (const shot of shots) for (const c of shot.clips ?? []) credits.set(c.id, c);
}
writeFileSync(
	p('CREDITS.md'),
	'# Crédits vidéo\n\nVidéos de [Pexels](https://www.pexels.com) (licence Pexels, attribution non obligatoire mais appréciée). À coller dans la description YouTube :\n\n' +
		[...credits.values()].map((c) => `- ${c.author} — ${c.url}`).join('\n') +
		'\n',
);

console.log(`${credits.size} clips au total, ${downloaded} téléchargé(s).${rateLimitRemaining ? ` Requêtes Pexels restantes ce mois-ci : ${rateLimitRemaining}.` : ''}`);
if (missing.length) {
	console.warn(`Aucune vidéo trouvée pour :\n  ${missing.join('\n  ')}\nModifie query/alt dans data/visuals.json puis relance.`);
	process.exitCode = 1;
}

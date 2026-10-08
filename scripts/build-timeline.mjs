// Assemble tout ce que le montage Remotion lit : public/timeline.json.
// (placement des voix et des pauses, mouvements du compteur, sous-titres, plans, musique)
//
//   npm run timeline                 → avec les voix déjà générées
//   npm run timeline -- --estimate   → complète les voix manquantes par une estimation muette
//                                      (pour régler le visuel avant de payer la voix)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { config, loadScript, p, readJson, writeJson } from './lib/project.mjs';
import { anchorTime, loadAlignment, shotRanges } from './lib/plan.mjs';
import { buildCues, speechBounds, wordsFromAlignment } from './lib/timing.mjs';

const estimate = process.argv.includes('--estimate');
const { fps, width, height, leadInSeconds, pauseSeconds, tailSeconds } = config;
const roll = Math.min(config.counterRollSeconds, pauseSeconds - 0.2);
const F = (seconds) => Math.round(seconds * fps);

const allSections = loadScript();
const visuals = readJson('data/visuals.json');
const media = readJson('data/media.json', {});

function probeDuration(file) {
	const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file];
	try {
		return Number(execFileSync('ffprobe', args, { encoding: 'utf8' }).trim());
	} catch {
		return Number(execFileSync('npx', ['remotion', 'ffprobe', ...args], { encoding: 'utf8', cwd: p() }).trim());
	}
}

// On garde les sections dans l'ordre jusqu'à la première sans voix (sauf --estimate).
const sections = [];
for (const s of allSections) {
	const voice = loadAlignment(s, { estimate });
	if (!voice) break;
	sections.push({ ...s, ...voice });
}
if (!sections.length) {
	console.error('Aucune voix générée. Lance « npm run voice -- intro », ou « npm run timeline -- --estimate » pour un montage muet.');
	process.exit(1);
}

const timeline = {
	fps,
	width,
	height,
	durationInFrames: 0,
	estimated: sections.some((s) => s.estimated),
	missingVoices: allSections.slice(sections.length).map((s) => s.id),
	sections: [],
	speech: [],
	counter: { initial: 0, moves: [] },
	captions: [],
	shots: [],
	overlays: [],
	music: null,
};

let cursor = leadInSeconds; // instant où doit commencer la prochaine phrase
let previousSpeechEnd = 0;
for (const [i, s] of sections.entries()) {
	const bounds = speechBounds(s.alignment);
	const audioStart = Math.max(0, cursor - bounds.start);
	const visualStart = i === 0 ? 0 : previousSpeechEnd;
	const speechEnd = audioStart + bounds.end;
	const isLast = i === sections.length - 1;
	const at = (phrase) => audioStart + anchorTime(s.alignment, s, phrase);

	timeline.sections.push({
		id: s.id,
		title: s.title,
		amount: s.amount ?? null,
		from: F(visualStart),
		audio: s.audio && {
			src: s.audio,
			from: F(audioStart),
			durationInFrames: Math.ceil(probeDuration(p('public', s.audio)) * fps),
		},
	});
	timeline.speech.push([F(audioStart + bounds.start), F(speechEnd)]);

	// Compteur : il défile pendant la pause qui précède chaque niveau…
	let counterDone = F(visualStart);
	if (s.kind === 'level') {
		counterDone = F(visualStart + roll);
		timeline.counter.moves.push({ from: F(visualStart), to: counterDone, value: s.amount, easing: 'inOut' });
	}
	// …plus les mouvements propres à la section (intro, outro).
	for (const move of visuals[s.id]?.counter ?? []) {
		const from = at(move.at);
		const to = move.until ? at(move.until) : from + move.seconds;
		timeline.counter.moves.push({ from: F(from), to: F(to), value: move.to, easing: move.easing ?? 'inOut' });
	}

	for (const cue of buildCues(wordsFromAlignment(s.alignment), config.captions)) {
		timeline.captions.push({ from: F(audioStart + cue.start), to: F(audioStart + cue.end), lines: cue.lines });
	}

	const plan = visuals[s.id];
	const ranges = shotRanges(s, plan.shots, s.alignment, {
		pauseBefore: i === 0 ? cursor : pauseSeconds,
		pauseAfter: isLast ? tailSeconds : 0,
	});
	for (const { shot, index, from, to } of ranges) {
		const start = F(audioStart + from);
		const end = F(audioStart + to);
		let entry = media[s.id]?.[index];
		if (entry?.reuse) entry = media[entry.reuse]?.[entry.shot];
		const clips = (entry?.clips ?? []).filter((c) => existsSync(p('public', c.file)));

		// Un plan long est découpé en plusieurs clips différents.
		const parts = Math.max(1, Math.min(clips.length, Math.floor((end - start) / F(5))));
		for (let k = 0; k < parts; k++) {
			const a = start + Math.round(((end - start) * k) / parts);
			const b = start + Math.round(((end - start) * (k + 1)) / parts);
			const clip = clips[k];
			timeline.shots.push({
				section: s.id,
				from: a,
				durationInFrames: b - a,
				src: clip?.file ?? null,
				clipFrames: clip ? Math.floor(probeDuration(p('public', clip.file)) * fps) : null,
				label: clip ? null : (shot.query ?? shot.reuse),
			});
		}

		if (shot.overlay) {
			const { type, at: overlayAt, ...props } = shot.overlay;
			if (type === 'confetti') {
				timeline.overlays.push({ type, from: counterDone, durationInFrames: F(3.5), props });
				continue;
			}
			const trigger = overlayAt ? F(at(overlayAt)) : start;
			// Les silhouettes sont là dès le début du plan ; le repère déclenche le passage en gris.
			const from = type === 'people' ? start : trigger;
			timeline.overlays.push({ type, from, durationInFrames: end - from, props: { ...props, triggerFrame: trigger - from } });
		}
	}

	previousSpeechEnd = speechEnd;
	cursor = speechEnd + pauseSeconds;
}

const lastAudio = timeline.sections.at(-1).audio;
timeline.durationInFrames = Math.max(F(previousSpeechEnd + tailSeconds), lastAudio ? lastAudio.from + lastAudio.durationInFrames : 0);
timeline.counter.moves.sort((a, b) => a.from - b.from);

// Musique : le premier fichier audio trouvé dans assets/musique.
const musicDir = p('assets/musique');
const track = existsSync(musicDir)
	? readdirSync(musicDir)
			.filter((f) => /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f))
			.sort()[0]
	: undefined;
if (track) {
	mkdirSync(p('public/musique'), { recursive: true });
	copyFileSync(p('assets/musique', track), p('public/musique', track));
	timeline.music = {
		src: `musique/${track}`,
		volume: config.music.volume,
		volumeDuringPauses: config.music.volumeDuringPauses,
		fadeFrames: F(config.music.fadeSeconds),
	};
}

writeJson('public/timeline.json', timeline);

const minutes = timeline.durationInFrames / fps / 60;
const noClip = timeline.shots.filter((s) => !s.src).length;
console.log(
	`Montage : ${sections.length}/${allSections.length} sections, ${Math.floor(minutes)} min ${Math.round((minutes % 1) * 60)
		.toString()
		.padStart(2, '0')} s (${timeline.durationInFrames} images), ${timeline.captions.length} sous-titres, ${timeline.shots.length} plans` +
		(noClip ? ` dont ${noClip} sans vidéo Pexels` : '') +
		`, musique : ${track ?? 'aucune (rien dans assets/musique)'}.`,
);
if (timeline.estimated) console.log('⚠ Voix estimée (muette) pour : ' + sections.filter((s) => s.estimated).map((s) => s.id).join(', '));
if (timeline.missingVoices.length) console.log('Voix pas encore générées (montage arrêté avant) : ' + timeline.missingVoices.join(', '));

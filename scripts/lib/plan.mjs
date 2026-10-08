// Répartition des plans dans le temps, à partir de l'alignement de la voix
// (ou d'une estimation tant que la voix n'est pas générée).
import { existsSync } from 'node:fs';
import { p, readJson } from './project.mjs';
import { estimatedAlignment, phraseTime, speechBounds } from './timing.mjs';

export function loadAlignment(section, { estimate = false } = {}) {
	const voice = readJson(`data/voice/${section.id}.json`, null);
	const hasAudio = voice && existsSync(p('public/audio', `${section.id}.mp3`));
	if (hasAudio) return { alignment: voice, audio: `audio/${section.id}.mp3`, estimated: false };
	if (estimate) return { alignment: estimatedAlignment(section.text), audio: null, estimated: true };
	return null;
}

// Instant d'une phrase repère, en secondes depuis le début de l'audio de la section.
export function anchorTime(alignment, section, phrase) {
	const t = phraseTime(alignment, phrase);
	if (t === null) throw new Error(`${section.id} : phrase repère « ${phrase} » introuvable dans la voix off (data/visuals.json)`);
	return t;
}

// Début et fin (en secondes, relatives à l'audio de la section) de chaque plan.
// Le premier plan démarre pendant la pause qui précède la section.
export function shotRanges(section, shots, alignment, { pauseBefore, pauseAfter }) {
	const { end } = speechBounds(alignment);
	const starts = shots.map((shot, k) => (k === 0 ? speechBounds(alignment).start - pauseBefore : anchorTime(alignment, section, shot.at)));
	return shots.map((shot, k) => {
		const to = k + 1 < shots.length ? starts[k + 1] : end + pauseAfter;
		if (to <= starts[k]) throw new Error(`${section.id} : les plans de data/visuals.json ne sont pas dans l'ordre de la voix off (plan ${k + 1})`);
		return { shot, index: k, from: starts[k], to };
	});
}

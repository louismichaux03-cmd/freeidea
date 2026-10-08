// Calage temporel à partir de l'alignement ElevenLabs (un horodatage par caractère).

// Vitesse moyenne d'une voix ElevenLabs en français, pour estimer avant d'avoir l'audio.
export const ESTIMATED_CHARS_PER_SECOND = 15;

const NBSP = ' ';
// Ponctuation française précédée d'une espace : on la colle au mot d'avant
// pour qu'elle ne se retrouve jamais seule en début de ligne.
const CLOSING = /^[:;!?»%€]+[.,]?$/;
const OPENING = /^«$/;

export function wordsFromAlignment({ characters, starts, ends }) {
	const raw = [];
	let cur = null;
	characters.forEach((ch, i) => {
		if (/\s/.test(ch)) {
			if (cur) raw.push(cur);
			cur = null;
			return;
		}
		if (!cur) cur = { text: '', start: starts[i], end: ends[i] };
		cur.text += ch;
		cur.end = ends[i];
	});
	if (cur) raw.push(cur);

	const words = [];
	let pendingOpen = null;
	for (const w of raw) {
		if (OPENING.test(w.text)) {
			pendingOpen = w;
			continue;
		}
		if (pendingOpen) {
			w.text = pendingOpen.text + NBSP + w.text;
			w.start = pendingOpen.start;
			pendingOpen = null;
		}
		if (CLOSING.test(w.text) && words.length) {
			const prev = words.at(-1);
			prev.text += NBSP + w.text;
			prev.end = w.end;
		} else {
			words.push(w);
		}
	}
	return words;
}

// Instant (en secondes, depuis le début du fichier audio) où commence une phrase donnée.
export function phraseTime(alignment, phrase) {
	const joined = alignment.characters.join('');
	const idx = joined.indexOf(phrase);
	if (idx === -1) return null;
	return alignment.starts[idx];
}

export function speechBounds(alignment) {
	const { characters, starts, ends } = alignment;
	let first = 0;
	while (first < characters.length - 1 && /\s/.test(characters[first])) first++;
	let last = characters.length - 1;
	while (last > 0 && /\s/.test(characters[last])) last--;
	return { start: starts[first], end: ends[last] };
}

// Alignement approximatif (débit constant) quand la voix n'a pas encore été générée.
export function estimatedAlignment(text) {
	const characters = [...text];
	const step = 1 / ESTIMATED_CHARS_PER_SECOND;
	return {
		characters,
		starts: characters.map((_, i) => i * step),
		ends: characters.map((_, i) => (i + 1) * step),
	};
}

const SHORT_WORDS = new Set(
	"à de du des d' l' le la les un une et ou en au aux ton ta tes ton son sa ses ce cet cette qui que tu il on y ne pas par pour sur avec dans".split(' '),
);
const joinWords = (ws) => ws.map((w) => w.text).join(' ');

// Coupe une liste de mots en lignes de maxChars au plus (maxLines lignes au plus),
// en équilibrant la longueur des lignes. Renvoie null si c'est impossible.
export function splitLines(words, maxChars, maxLines = 2) {
	if (joinWords(words).length <= maxChars) return [joinWords(words)];
	if (maxLines < 2) return null;
	let best = null;
	for (let k = 1; k < words.length; k++) {
		const top = joinWords(words.slice(0, k));
		const bottom = joinWords(words.slice(k));
		if (top.length > maxChars || bottom.length > maxChars) continue;
		const lastTop = words[k - 1].text;
		let score = Math.max(top.length, bottom.length);
		if (/[,;:.!?»]$/.test(lastTop)) score -= 8; // couper après une ponctuation
		if (SHORT_WORDS.has(lastTop.toLowerCase()) || /['’]$/.test(lastTop)) score += 10; // pas de « de » en fin de ligne
		if (!best || score < best.score) best = { score, lines: [top, bottom] };
	}
	return best?.lines ?? null;
}

// Regroupe les mots en sous-titres de 2 lignes max : une phrase par sous-titre si elle
// tient, sinon coupée après une virgule ou là où la place manque ; les phrases très courtes
// (« Un milliard. Mille millions. ») sont regroupées.
export function buildCues(words, { maxCharsPerLine = 42, maxLines = 2, shortChars = 24 } = {}) {
	const fits = (ws) => splitLines(ws, maxCharsPerLine, maxLines) !== null;
	const len = (ws) => joinWords(ws).length;

	const sentences = [];
	let cur = [];
	for (const w of words) {
		cur.push(w);
		if (/[.!?…]$/.test(w.text)) {
			sentences.push(cur);
			cur = [];
		}
	}
	if (cur.length) sentences.push(cur);

	const groups = [];
	for (const sentence of sentences) {
		const chunks = chunkSentence(sentence, fits, len);
		chunks.forEach((chunk, i) => {
			const prev = groups.at(-1);
			const wholeShort = chunks.length === 1 && len(chunk) < shortChars;
			if (i === 0 && prev && (prev.short || wholeShort) && fits([...prev.words, ...chunk])) {
				prev.words.push(...chunk);
				prev.short = false;
			} else {
				groups.push({ words: [...chunk], short: wholeShort });
			}
		});
	}

	const cues = groups.map(({ words: ws }) => ({
		start: ws[0].start,
		end: ws.at(-1).end,
		lines: splitLines(ws, maxCharsPerLine, maxLines) ?? [joinWords(ws)],
	}));
	// Pas de clignotement entre deux sous-titres proches, et une durée minimale de lecture.
	cues.forEach((c, i) => {
		const next = cues[i + 1];
		c.end = next && next.start - c.end < 0.5 ? next.start : c.end + 0.25;
		if (c.end - c.start < 0.7) c.end = Math.min(c.start + 0.7, next?.start ?? Infinity);
	});
	return cues;
}

// Découpe optimale d'une phrase en sous-titres : le moins de sous-titres possible, puis
// des coupures après une ponctuation, puis des longueurs équilibrées.
function chunkSentence(words, fits, len) {
	const n = words.length;
	const best = Array(n + 1).fill(null);
	best[0] = { cost: 0, cuts: [] };
	for (let j = 1; j <= n; j++) {
		for (let i = 0; i < j; i++) {
			if (!best[i]) continue;
			const chunk = words.slice(i, j);
			if (chunk.length > 1 && !fits(chunk)) continue;
			const l = len(chunk);
			let cost = best[i].cost + 80 + (l * l) / 60;
			if (j < n && !/[,;:]$/.test(words[j - 1].text)) cost += 40;
			if (l < 15) cost += 60;
			if (!best[j] || cost < best[j].cost) best[j] = { cost, cuts: [...best[i].cuts, j] };
		}
	}
	const chunks = [];
	let from = 0;
	for (const to of best[n].cuts) {
		chunks.push(words.slice(from, to));
		from = to;
	}
	return chunks;
}

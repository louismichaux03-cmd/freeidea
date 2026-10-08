// Découpe le texte extrait du PDF (pdftotext -layout) en sections : intro, niveaux, outro.
// Chaque section : ligne(s) « Visuel : … » puis paragraphes de voix off.

const HEADING = /^(Intro|Outro|Niveau (\d+) : (.+)|Voix off seule.*|Sources|Infos)$/;
const PAGE_FOOTER = /^Page \d+ of \d+$/;

const normalizeSpaces = (s) => s.replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();

// Regroupe les lignes en paragraphes (séparés par des lignes vides).
// Les coupures « vingt-\nquatre » sont recollées sans espace.
export function toParagraphs(rawText, title) {
	const lines = rawText
		.split('\n')
		.map((l) => l.replace(/\f/g, '').trim())
		.filter((l) => !PAGE_FOOTER.test(l) && l !== title);

	const paragraphs = [];
	let current = '';
	for (const line of lines) {
		if (line === '') {
			if (current) paragraphs.push(current);
			current = '';
			continue;
		}
		// Un titre de section est toujours un paragraphe à part.
		if (HEADING.test(line)) {
			if (current) paragraphs.push(current);
			paragraphs.push(line);
			current = '';
			continue;
		}
		if (!current) current = line;
		else if (/\p{L}-$/u.test(current)) current += line;
		else current += ' ' + line;
	}
	if (current) paragraphs.push(current);
	return paragraphs.map(normalizeSpaces);
}

// « moins 10 000 € » → -10000 ; « 1 milliard € » → 1e9 ; « 100 milliards € » → 1e11
export function parseAmount(label) {
	const m = normalizeSpaces(label).match(/^(moins\s+)?([\d ]+?)\s*(milliards?|millions?)?\s*€$/i);
	if (!m) throw new Error(`Montant illisible : « ${label} »`);
	const base = Number(m[2].replace(/ /g, ''));
	const unit = m[3] ? (m[3].startsWith('milliard') ? 1e9 : 1e6) : 1;
	return (m[1] ? -1 : 1) * base * unit;
}

export function parseScript(rawText) {
	const title = normalizeSpaces(rawText.split('\n').find((l) => l.trim()) ?? '');
	const paragraphs = toParagraphs(rawText, title);

	const sections = [];
	const voiceOnly = [];
	let current = null; // section en cours de lecture
	let inVoiceOnly = false;
	for (const p of paragraphs) {
		const h = p.match(HEADING);
		if (h) {
			current = null;
			inVoiceOnly = p.startsWith('Voix off seule');
			if (p === 'Intro' || p === 'Outro') {
				current = { id: p.toLowerCase(), kind: p.toLowerCase(), title: p, visual: '', paragraphs: [] };
			} else if (h[2]) {
				const level = Number(h[2]);
				current = {
					id: `niveau-${String(level).padStart(2, '0')}`,
					kind: 'level',
					level,
					title: `Niveau ${level}`,
					amountLabel: h[3],
					amount: parseAmount(h[3]),
					visual: '',
					paragraphs: [],
				};
			}
			if (current) sections.push(current);
			continue;
		}
		if (current) {
			if (p.startsWith('Visuel :')) current.visual = p.replace(/^Visuel :\s*/, '');
			else current.paragraphs.push(p);
		} else if (inVoiceOnly) {
			voiceOnly.push(p);
		}
	}

	for (const s of sections) {
		s.text = s.paragraphs.join('\n\n');
		if (!s.visual) throw new Error(`Pas de ligne « Visuel : » dans ${s.title}`);
		if (!s.text) throw new Error(`Pas de voix off dans ${s.title}`);
	}
	return { title, sections, voiceOnly };
}

// Vérifie que les sections mises bout à bout redonnent le bloc « Voix off seule ».
// Le bloc commence par une phrase d'explication : on démarre au premier paragraphe de l'intro.
export function checkAgainstVoiceOnly(sections, voiceOnly) {
	const start = voiceOnly.indexOf(sections[0].paragraphs[0]);
	if (start === -1) return { ok: false, reason: "Début de l'intro introuvable dans « Voix off seule »" };
	const flat = (s) => s.replace(/\s+/g, ' ').trim();
	const expected = flat(voiceOnly.slice(start).join(' '));
	const actual = flat(sections.map((s) => s.paragraphs.join(' ')).join(' '));
	if (expected === actual) return { ok: true };
	let i = 0;
	while (i < Math.min(expected.length, actual.length) && expected[i] === actual[i]) i++;
	return {
		ok: false,
		reason: `Différence au caractère ${i} : sections « …${actual.slice(i - 30, i + 40)} » / voix off seule « …${expected.slice(i - 30, i + 40)} »`,
	};
}

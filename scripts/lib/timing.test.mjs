import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCues, estimatedAlignment, phraseTime, splitLines, wordsFromAlignment } from './timing.mjs';
import { parseAmount } from './script-parser.mjs';

const sample =
	"Le pire, c'est qu'être fauché coûte cher. Frais bancaires, intérêts, pénalités de retard : chaque mois, tu payes juste pour rester au même endroit.\n\nUn milliard. Mille millions.";

test('les montants des titres de niveau', () => {
	assert.equal(parseAmount('moins 10 000 €'), -10000);
	assert.equal(parseAmount('0 €'), 0);
	assert.equal(parseAmount('1 000 000 €'), 1e6);
	assert.equal(parseAmount('1 milliard €'), 1e9);
	assert.equal(parseAmount('100 milliards €'), 1e11);
});

test('la ponctuation française reste collée au mot précédent', () => {
	const words = wordsFromAlignment(estimatedAlignment(sample));
	assert.ok(words.some((w) => w.text === 'retard :'));
	assert.ok(!words.some((w) => w.text === ':'));
});

test('sous-titres : 2 lignes de 42 caractères maximum, sans perdre de mot', () => {
	const words = wordsFromAlignment(estimatedAlignment(sample));
	const cues = buildCues(words, { maxCharsPerLine: 42, maxLines: 2 });
	for (const c of cues) {
		assert.ok(c.lines.length <= 2, JSON.stringify(c.lines));
		for (const l of c.lines) assert.ok(l.length <= 42, l);
		assert.ok(c.end > c.start);
	}
	const flat = (s) => s.replace(/\s+/g, ' ').trim();
	assert.equal(flat(cues.flatMap((c) => c.lines).join(' ')), flat(sample));
	for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start >= cues[i - 1].end - 1e-9);
});

test('les lignes sont équilibrées', () => {
	const words = 'Tu fais tes courses avec la calculatrice du téléphone ouverte, et tu connais'.split(' ').map((text) => ({ text }));
	const [top, bottom] = splitLines(words, 42, 2);
	assert.ok(Math.abs(top.length - bottom.length) < 20, `${top} / ${bottom}`);
});

test('instant de début d’une phrase', () => {
	const a = estimatedAlignment(sample);
	assert.ok(phraseTime(a, 'Un milliard') > phraseTime(a, 'Frais bancaires'));
	assert.equal(phraseTime(a, 'introuvable'), null);
});

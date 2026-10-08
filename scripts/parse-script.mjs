// script.pdf → data/script.json (sections, visuels, textes de voix off)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseScript, checkAgainstVoiceOnly } from './lib/script-parser.mjs';

const pdf = process.argv[2] ?? 'script.pdf';
let raw;
try {
	raw = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8' });
} catch (err) {
	console.error(`Impossible de lire ${pdf} avec pdftotext (paquet poppler-utils) : ${err.message}`);
	process.exit(1);
}

const { title, sections, voiceOnly } = parseScript(raw);
const check = checkAgainstVoiceOnly(sections, voiceOnly);
if (!check.ok) {
	console.error(`Les sections ne correspondent pas au bloc « Voix off seule » :\n${check.reason}`);
	process.exit(1);
}

mkdirSync('data', { recursive: true });
writeFileSync('data/script.json', JSON.stringify({ title, sections }, null, '\t') + '\n');

const words = sections.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
const chars = sections.reduce((n, s) => n + s.text.length, 0);
console.log(`${title} : ${sections.length} sections, ${words} mots, ${chars} caractères (identique au bloc « Voix off seule »).`);
for (const s of sections) {
	const amount = s.kind === 'level' ? ` → ${s.amount.toLocaleString('fr-FR')} €` : '';
	console.log(`  ${s.id.padEnd(10)} ${String(s.text.split(/\s+/).length).padStart(4)} mots${amount}`);
}

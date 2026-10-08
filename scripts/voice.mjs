// Génère la voix off avec ElevenLabs : un MP3 par section + l'alignement des caractères
// (horodatage de chaque lettre) qui sert à synchroniser les sous-titres.
//
//   npm run voice -- intro            → l'intro seule, pour valider la voix
//   npm run voice -- --all            → toutes les sections (celles déjà faites sont gardées)
//   npm run voice -- niveau-03 --force → régénère une section
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { apiError, config, loadEnv, loadScript, p, readJson, writeJson } from './lib/project.mjs';

const API = 'https://api.elevenlabs.io/v1';

const args = process.argv.slice(2);
const force = args.includes('--force');
const sections = loadScript();
const wanted = args.includes('--all') ? sections.map((s) => s.id) : args.filter((a) => !a.startsWith('--'));

if (!wanted.length) {
	console.log(`Usage : npm run voice -- <section…> | --all [--force]\nSections : ${sections.map((s) => s.id).join(', ')}`);
	process.exit(1);
}
const unknown = wanted.filter((id) => !sections.some((s) => s.id === id));
if (unknown.length) {
	console.error(`Section(s) inconnue(s) : ${unknown.join(', ')}`);
	process.exit(1);
}

const { ELEVENLABS_API_KEY: apiKey, ELEVENLABS_VOICE_ID: voiceId } = loadEnv(['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID']);
const { modelId, outputFormat, voiceSettings, seed } = config.voice;
const headers = { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };

// Le texte des sections voisines est passé en contexte pour garder une intonation continue
// d'un fichier à l'autre (il n'est pas lu).
function requestFor(index) {
	const section = sections[index];
	const body = {
		text: section.text,
		model_id: modelId,
		voice_settings: voiceSettings,
		seed,
		previous_text: sections[index - 1]?.paragraphs.at(-1),
		next_text: sections[index + 1]?.paragraphs[0],
	};
	const hash = createHash('sha256').update(JSON.stringify({ body, voiceId, outputFormat })).digest('hex').slice(0, 16);
	return { section, body, hash };
}

async function printCredits() {
	const res = await fetch(`${API}/user/subscription`, { headers });
	if (!res.ok) return; // clé sans la permission « user_read » : pas bloquant
	const sub = await res.json();
	const left = sub.character_limit - sub.character_count;
	console.log(`Crédit ElevenLabs : ${left.toLocaleString('fr-FR')} caractères restants.`);
	return left;
}

const todo = wanted
	.map((id) => requestFor(sections.findIndex((s) => s.id === id)))
	.filter(({ section, hash }) => {
		const meta = readJson(`data/voice/${section.id}.json`, null);
		const done = !force && meta?.hash === hash && existsSync(p('public/audio', `${section.id}.mp3`));
		if (done) console.log(`  ${section.id} : déjà générée, gardée (--force pour refaire).`);
		return !done;
	});

if (!todo.length) process.exit(0);

const needed = todo.reduce((n, t) => n + t.body.text.length, 0);
const left = await printCredits();
console.log(`À générer : ${todo.length} section(s), ${needed.toLocaleString('fr-FR')} caractères, modèle ${modelId}.`);
if (left !== undefined && left < needed) {
	console.error('Crédit insuffisant, rien n’a été généré.');
	process.exit(1);
}

mkdirSync(p('public/audio'), { recursive: true });
for (const { section, body, hash } of todo) {
	process.stdout.write(`  ${section.id} … `);
	const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${outputFormat}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		console.log('échec');
		throw await apiError('ElevenLabs', res);
	}
	const { audio_base64, alignment } = await res.json();
	if (!audio_base64 || !alignment?.characters?.length) throw new Error(`ElevenLabs : réponse sans audio ou sans alignement pour ${section.id}`);

	writeFileSync(p('public/audio', `${section.id}.mp3`), Buffer.from(audio_base64, 'base64'));
	writeJson(`data/voice/${section.id}.json`, {
		hash,
		modelId,
		text: section.text,
		// Horodatage de chaque caractère du texte d'origine, en secondes.
		characters: alignment.characters,
		starts: alignment.character_start_times_seconds,
		ends: alignment.character_end_times_seconds,
	});
	const seconds = alignment.character_end_times_seconds.at(-1);
	const words = section.text.split(/\s+/).length;
	console.log(`${seconds.toFixed(1)} s (${Math.round((words / seconds) * 60)} mots/min)`);
}

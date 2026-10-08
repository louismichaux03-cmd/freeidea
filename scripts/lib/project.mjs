// Chemins du projet, configuration et lecture des clés (uniquement depuis .env).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const p = (...parts) => join(ROOT, ...parts);

export const config = JSON.parse(readFileSync(p('video.config.json'), 'utf8'));

// Les clés ne viennent que du fichier .env (jamais des variables d'environnement
// du shell) et ne sont jamais affichées : en cas d'erreur, seuls les noms sortent.
export function loadEnv(required) {
	const file = p('.env');
	if (!existsSync(file)) {
		throw new Error(`Fichier .env introuvable. Copie .env.example vers .env et remplis : ${required.join(', ')}`);
	}
	const env = parse(readFileSync(file));
	const missing = required.filter((k) => !env[k]?.trim());
	if (missing.length) throw new Error(`À renseigner dans .env : ${missing.join(', ')}`);
	return Object.fromEntries(required.map((k) => [k, env[k].trim()]));
}

export function readJson(rel, fallback) {
	const file = p(rel);
	if (!existsSync(file)) {
		if (fallback !== undefined) return fallback;
		throw new Error(`${rel} introuvable`);
	}
	return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(rel, data) {
	const file = p(rel);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(data, null, '\t') + '\n');
}

export function loadScript() {
	return readJson('data/script.json').sections;
}

// Lit le corps d'une réponse d'erreur d'API sans jamais renvoyer les en-têtes de la requête.
export async function apiError(service, res) {
	let detail = '';
	try {
		const body = await res.text();
		try {
			const j = JSON.parse(body);
			detail = j.detail?.message ?? j.detail?.status ?? j.error ?? j.message ?? body;
			if (typeof detail !== 'string') detail = JSON.stringify(detail);
		} catch {
			detail = body;
		}
	} catch {}
	return new Error(`${service} : HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
}

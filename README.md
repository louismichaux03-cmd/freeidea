# Ta vie à chaque niveau de richesse

Montage automatique de la vidéo YouTube (≈ 7 min, 1920×1080, 30 i/s) à partir de `script.pdf` :
voix ElevenLabs, plans Pexels, compteur de richesse, sous-titres et musique, avec Remotion.

## Prérequis

- Node 20+ et `npm install`
- `pdftotext` (paquet poppler-utils) pour lire le PDF
- Un fichier `.env` (copie de `.env.example`) avec `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` et `PEXELS_API_KEY`.
  Les clés ne sont lues que depuis ce fichier, ne sont jamais affichées, et `.env` n'est pas versionné.

## Étapes

```bash
npm run parse                 # script.pdf → data/script.json (vérifié contre le bloc « Voix off seule »)
npm run voice -- intro        # 1. l'intro seule, pour valider la voix
npm run voice -- --all        # 2. le reste (les sections déjà faites ne sont pas refacturées)
npm run pexels                # 3. vidéos 16:9 pour chaque plan → public/videos, data/media.json, CREDITS.md
npm run timeline              # 4. calage : pauses, compteur, sous-titres, plans, musique
npm run preview               # 5. aperçu de 30 s → out/apercu-niveau-01.mp4
npm run render                # 6. vidéo finale → out/ta-vie-a-chaque-niveau-de-richesse.mp4
```

`npm run studio` ouvre Remotion Studio pour parcourir le montage image par image.
`npm run timeline -- --estimate` monte sans voix (débit estimé) pour régler le visuel avant de payer la voix.

## Réglages

- `video.config.json` : modèle et réglages de voix (`eleven_multilingual_v2`), durée des pauses entre niveaux (1,6 s),
  durée du défilement du compteur, sous-titres (2 lignes de 42 caractères max), volume de la musique, fenêtre d'aperçu.
- `data/visuals.json` : les plans de chaque section, tirés des lignes « Visuel » du script. Pour chaque plan :
  la recherche Pexels (en anglais), des recherches de secours, la phrase de la voix off où le plan commence,
  et éventuellement un élément dessiné par-dessus (appel « Numéro inconnu », solde, notification, agenda, message,
  silhouettes, confettis). Pour changer une vidéo : modifier la recherche puis `npm run pexels -- niveau-03`.
- Musique : déposer un fichier (mp3, wav, m4a…) dans `assets/musique/`, puis `npm run timeline`. Elle tourne en
  boucle, baisse sous la voix et remonte un peu pendant les pauses.

## Ce qui est versionné

Le code, les données de calage (`data/`) et les voix générées (`public/audio/`, qui coûtent des crédits).
Les vidéos Pexels (`public/videos/`) se retéléchargent avec `npm run pexels` à partir de `data/media.json`.

import { loadFont } from '@remotion/fonts';
import w600 from '@fontsource/montserrat/files/montserrat-latin-600-normal.woff2';
import w700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2';
import w800 from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2';

export const FONT = 'Montserrat';

for (const [weight, url] of [
	['600', w600],
	['700', w700],
	['800', w800],
] as const) {
	loadFont({ family: FONT, url, weight });
}

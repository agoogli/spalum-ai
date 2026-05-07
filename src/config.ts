import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

export interface Config {
	targetUrl: string;
	ntfyTopic: string;
	ntfyServer: string;
	cookiesFile: string;
	minPreavvisoNotifica: number;
	pausaPranzo: number;
}

export function caricaConfig(): Config {
	const required = (key: string): string => {
		const val = process.env[key];
		if (!val)
			throw new Error(
				`Variabile d'ambiente obbligatoria mancante: ${key}`
			);
		return val;
	};

	const fileCookies = process.env.COOKIES_FILE ?? 'cookies.json';
	if (!fs.existsSync(fileCookies)) {
		throw new Error(
			`File cookie non trovato: ${fileCookies}\n` +
				`Esporta i cookie da Chrome (estensione "Get cookies.txt LOCALLY" → formato JSON)\n` +
				`e monta il file con: -v /percorso/cookies.json:cookies.json:ro,z`
		);
	}

	return {
		targetUrl: required('TARGET_URL'),
		ntfyTopic: required('NTFY_TOPIC'),
		ntfyServer: process.env.NTFY_SERVER ?? 'https://ntfy.sh',
		cookiesFile: fileCookies,
		minPreavvisoNotifica: parseInt(
			process.env.MIN_PREAVVISO_NOTIFICA_PUSH ?? '5',
			10
		),
		pausaPranzo: parseInt(
			process.env.PAUSA_PRANZO ?? '10',
			10
		),
	};
}

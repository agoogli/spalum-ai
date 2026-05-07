import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

export interface Config {
	targetUrl: string;
	ntfyTopic: string;
	ntfyServer: string;
	cookiesFile: string;
	notifyMinutesBefore: number;
}

export function loadConfig(): Config {
	const required = (key: string): string => {
		const val = process.env[key];
		if (!val)
			throw new Error(
				`Variabile d'ambiente obbligatoria mancante: ${key}`
			);
		return val;
	};

	const cookiesFile = process.env.COOKIES_FILE ?? 'cookies.json';
	if (!fs.existsSync(cookiesFile)) {
		throw new Error(
			`File cookie non trovato: ${cookiesFile}\n` +
				`Esporta i cookie da Chrome (estensione "Get cookies.txt LOCALLY" → formato JSON)\n` +
				`e monta il file con: -v /percorso/cookies.json:cookies.json:ro,z`
		);
	}

	return {
		targetUrl: required('TARGET_URL'),
		ntfyTopic: required('NTFY_TOPIC'),
		ntfyServer: process.env.NTFY_SERVER ?? 'https://ntfy.sh',
		cookiesFile,
		notifyMinutesBefore: parseInt(
			process.env.NOTIFY_MINUTES_BEFORE ?? '5',
			10
		),
	};
}

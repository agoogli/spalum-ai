/**
 * work-timer — entry point
 *
 * Flusso:
 *  1. Carica config + cookie
 *  2. Apre Chromium headless, inietta i cookie, naviga alla pagina
 *  3. Legge #ext-element-96 (debito orario) e #ext-element-120 (timbrature)
 *  4. Chiude il browser
 *  5. Calcola esattamente quando inviare la notifica:
 *       uscita_teorica = entrata + debito
 *       notifica_at    = uscita_teorica - NOTIFY_MINUTES_BEFORE
 *  6. Attende con un singolo setTimeout fino a quell'istante
 *  7. Manda la notifica e termina
 */

import { chromium } from 'playwright';
import { loadConfig } from './config';
import { loadCookies } from './cookies';
import { parseTimbrature, parseDebitoMs, fmt } from './parser';
import { sendNotification } from './notifier';

const SCRAPE_RETRY_INTERVAL_MS = 5 * 60 * 1000; // riprova ogni 5 min se entrata non trovata

async function scrapePresenze(config: ReturnType<typeof loadConfig>) {
	const cookies = loadCookies(config.cookiesFile);
	console.log(`[scraper] Cookie caricati: ${cookies.length}`);

	const browser = await chromium.launch({
		headless: true,
		executablePath: '/usr/bin/chromium-browser',
		args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
	});

	try {
		const context = await browser.newContext({
			userAgent:
				'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
				'(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
		});

		await context.addCookies(cookies);
		const page = await context.newPage();

		console.log(`[scraper] Navigazione: ${config.targetUrl}`);
		await page.goto(config.targetUrl, {
			waitUntil: 'networkidle',
			timeout: 30_000,
		});

		const debitoRaw =
			(
				await page
					.locator('#ext-element-96')
					.textContent({ timeout: 10_000 })
			)?.trim() ?? '';
		const timbratureRaw =
			(
				await page
					.locator('#ext-element-120')
					.textContent({ timeout: 10_000 })
			)?.trim() ?? '';

		console.log(`[scraper] #ext-element-96  (debito):     "${debitoRaw}"`);
		console.log(
			`[scraper] #ext-element-120 (timbrature): "${timbratureRaw}"`
		);

		return { debitoRaw, timbratureRaw };
	} finally {
		await browser.close();
	}
}

async function main() {
	const config = loadConfig();

	// ── Leggi la pagina (con retry se l'utente non ha ancora timbrato l'entrata) ──
	let debitoRaw = '';
	let timbratureRaw = '';
	let timbrature = null as ReturnType<typeof parseTimbrature> | null;

	while (true) {
		({ debitoRaw, timbratureRaw } = await scrapePresenze(config));
		timbrature = parseTimbrature(timbratureRaw);

		if (timbrature.entrata !== null) break;

		console.log(
			`[main] Entrata non ancora presente. ` +
				`Riprovo tra ${SCRAPE_RETRY_INTERVAL_MS / 60_000} minuti...`
		);
		await sleep(SCRAPE_RETRY_INTERVAL_MS);
	}

	// ── Se uscita già timbrata, notifica e termina ──
	if (timbrature!.uscita !== null) {
		await sendNotification({
			server: config.ntfyServer,
			topic: config.ntfyTopic,
			title: 'Uscita già timbrata',
			message: `Uscita registrata alle ${fmt(timbrature!.uscita)}.`,
			priority: 'low',
			tags: ['white_check_mark'],
		});
		return;
	}

	// ── Calcola orario uscita teorico ──
	const debitoMs = parseDebitoMs(debitoRaw);
	const entrata = timbrature!.entrata!;
	const uscitaTeorica = new Date(entrata.getTime() + debitoMs);
	const notificaAt = new Date(
		uscitaTeorica.getTime() - config.notifyMinutesBefore * 60_000
	);
	const now = Date.now();
	const waitMs = notificaAt.getTime() - now;

	console.log(
		`[main] Entrata:        ${fmt(entrata)}\n` +
			`[main] Debito:         ${msToHHMM(debitoMs)}\n` +
			`[main] Uscita teorica: ${fmt(uscitaTeorica)}\n` +
			`[main] Notifica alle:  ${fmt(notificaAt)}` +
			(waitMs > 0
				? `  (tra ${msToHHMM(waitMs)})`
				: `  ← già passata! Invio subito.`)
	);

	// ── Attendi esattamente fino all'orario di notifica ──
	if (waitMs > 0) {
		console.log(`[main] Processo in sleep per ${msToHHMM(waitMs)}...`);
		await sleep(waitMs);
	}

	// ── Manda la notifica ──
	const isOverdue = waitMs < 0;
	await sendNotification({
		server: config.ntfyServer,
		topic: config.ntfyTopic,
		title:
			waitMs <= 0
				? 'Puoi uscire adesso!'
				: `Uscita tra ${config.notifyMinutesBefore} min`,
		message:
			`Entrata:        ${fmt(entrata)}\n` +
			`Debito:         ${msToHHMM(debitoMs)}\n` +
			`Uscita teorica: ${fmt(uscitaTeorica)}` +
			(isOverdue
				? `\n(${Math.abs(Math.round(waitMs / 60_000))} min di ritardo)`
				: ''),
		priority: 'urgent',
		tags: ['tada', 'door'],
	});

	console.log('[main] Notifica inviata. Uscita dal processo.');
}

// ── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function msToHHMM(ms: number): string {
	const totalMin = Math.round(Math.abs(ms) / 60_000);
	const h = Math.floor(totalMin / 60);
	const m = totalMin % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
	console.error('[FATAL]', err instanceof Error ? err.message : err);
	process.exit(1);
});

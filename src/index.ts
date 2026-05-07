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
 *       notifica_at    = uscita_teorica - MIN_PREAVVISO_NOTIFICA_PUSH
 *  6. Attende con un singolo setTimeout fino a quell'istante
 *  7. Manda la notifica e termina
 */

import { caricaConfig } from './config';
import { parseTimbrature, parseDebitoMs, fmt } from './parser';
import { inviaNotification } from './notifier';
import { scrapePresenze } from './scraper';

const MS_INTERVALLO_CHECK = 5 * 60 * 1000; // riprova ogni 5 min se entrata non trovata

async function main() {
	const config = caricaConfig();

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
			`Riprovo tra ${MS_INTERVALLO_CHECK / 60_000} minuti...`
		);
		await sleep(MS_INTERVALLO_CHECK);
	}

	// ── Se uscita già timbrata, notifica e termina ──	
	if (timbrature!.uscita !== null) {
		await inviaNotification({
			server: config.ntfyServer,
			topic: config.ntfyTopic,
			title: 'Uscita timbrata',
			message: `Uscita registrata alle ${fmt(timbrature!.uscita)}.`,
			priority: 'urgent',
			tags: ['white_check_mark'],
		});
		return;
	}

	// ── Calcola orario uscita teorico ──
	const debitoMs = parseDebitoMs(debitoRaw);
	const entrata = timbrature!.entrata!;

	// Aggiungi pausa pranzo se debito > 6 ore
	const pausaPranzoMs = debitoMs > 6 * 60 * 60 * 1000
		? config.pausaPranzo * 60 * 1000
		: 0;

	const uscitaTeorica = new Date(entrata.getTime() + debitoMs + pausaPranzoMs);
	const notificaAt = new Date(
		uscitaTeorica.getTime() - config.minPreavvisoNotifica * 60_000
	);
	const now = Date.now();
	const waitMs = notificaAt.getTime() - now;

	console.log(
		`[main] Entrata:        ${fmt(entrata)}\n` +
		`[main] Debito:         ${msToHHMM(debitoMs)}\n` +
		(pausaPranzoMs > 0 ? `[main] Pausa pranzo:   ${msToHHMM(pausaPranzoMs)}\n` : '') +
		`[main] Uscita teorica: ${fmt(uscitaTeorica)}\n` +
		`[main] Notifica alle:  ${fmt(notificaAt)}` +
		(waitMs > 0
			? `  (tra ${msToHHMM(waitMs)})`
			: `  ← già passata! Invio subito.`)
	);

	// ── Attendi esattamente fino all'orario di notifica ──
	if (waitMs > 0) {
		console.log(`[main] Processo in attesa per ${msToHHMM(waitMs)}...`);
		await sleep(waitMs);
	}

	// ── Manda la notifica ──
	const isRitardo = waitMs < 0;
	await inviaNotification({
		server: config.ntfyServer,
		topic: config.ntfyTopic,
		title:
			waitMs <= 0
				? 'Puoi uscire adesso!'
				: `Uscita tra ${config.minPreavvisoNotifica} min`,
		message:
			`Entrata:        ${fmt(entrata)}\n` +
			`Debito:         ${msToHHMM(debitoMs)}\n` +
			(pausaPranzoMs > 0 ? `Pausa pranzo:   ${msToHHMM(pausaPranzoMs)}\n` : '') +
			`Uscita teorica: ${fmt(uscitaTeorica)}` +
			(isRitardo
				? `\n(${Math.abs(Math.round(waitMs / 60_000))} min di ritardo)`
				: ''),
		priority: 'urgent',
		tags: ['dove_of_peace', 'dove_of_peace', 'tada', 'door'],
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

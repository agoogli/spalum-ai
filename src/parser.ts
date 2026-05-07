/**
 * Parser per i div del portale presenze.
 *
 * #ext-element-96  → debito orario giornata, es: "8:00" | "07.30" | "8h00"
 * #ext-element-120 → timbrature,             es: "E07.33@01 U--.--"
 *                    E = Entrata, U = Uscita (@NN = id rilevatore)
 */

export interface Timbrature {
	entrata: Date | null;
	uscita: Date | null;
	raw: string;
}

/**
 * Parsifica "E07.33@01 U--.--" → { entrata: Date, uscita: Date | null }
 */
export function parseTimbrature(raw: string): Timbrature {
	const result: Timbrature = { entrata: null, uscita: null, raw };

	// Entrata: E<HH>.<MM>@<id>
	const mEntrata = raw.match(/E(\d{2})\.(\d{2})@\d+/);
	if (mEntrata) {
		result.entrata = todayAt(
			parseInt(mEntrata[1], 10),
			parseInt(mEntrata[2], 10)
		);
		console.log(`[parser] Entrata rilevata: ${fmt(result.entrata)}`);
	}

	// Uscita: U<HH>.<MM>  (solo se non è U--.-- )
	const mUscita = raw.match(/U(\d{2})\.(\d{2})/);
	if (mUscita) {
		result.uscita = todayAt(
			parseInt(mUscita[1], 10),
			parseInt(mUscita[2], 10)
		);
		console.log(`[parser] Uscita rilevata: ${fmt(result.uscita)}`);
	} else {
		console.log(
			"[parser] Uscita non ancora registrata (U--.--) — bene, calcolo l'orario teorico"
		);
	}

	return result;
}

/**
 * Parsifica il debito orario: "8:00" | "07.30" | "8h00" | "8" → ms
 */
export function parseDebitoMs(raw: string): number {
	const s = raw.trim();

	// HH:MM  o  HH.MM  o  HHhMM
	const m = s.match(/(\d{1,2})[:.,h](\d{2})/);
	if (m) {
		const ore = parseInt(m[1], 10);
		const min = parseInt(m[2], 10);
		console.log(`[parser] Debito orario: ${ore}h ${min}m`);
		return (ore * 60 + min) * 60_000;
	}

	// Solo ore intere (fallback)
	const m2 = s.match(/(\d{1,2})/);
	if (m2) {
		const ore = parseInt(m2[1], 10);
		console.log(`[parser] Debito orario (solo ore): ${ore}h`);
		return ore * 3_600_000;
	}

	throw new Error(`Formato debito orario non riconosciuto: "${raw}"`);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function todayAt(h: number, m: number): Date {
	const d = new Date();
	d.setHours(h, m, 0, 0);
	return d;
}

export function fmt(d: Date): string {
	return d.toTimeString().slice(0, 5); // "HH:MM"
}

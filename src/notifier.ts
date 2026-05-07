/**
 * Invia notifiche push via ntfy usando fetch nativo di Node 18+.
 * Nessuna dipendenza extra necessaria.
 */

export interface NtfyOptions {
	server: string;
	topic: string;
	title: string;
	message: string;
	priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
	tags?: string[];
}

export async function inviaNotification(opts: NtfyOptions): Promise<void> {
	const url = `${opts.server}/${opts.topic}`;

	const headers: Record<string, string> = {
		'Content-Type': 'text/plain; charset=utf-8',
		Title: opts.title,
		Priority: opts.priority ?? 'high',
		Tags: (opts.tags ?? ['office_worker', 'clock2']).join(','),
	};

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: opts.message,
	});

	if (!response.ok) {
		throw new Error(
			`ntfy HTTP ${response.status}: ${await response.text()}`
		);
	}

	console.log(`[ntfy] Notifica inviata: "${opts.title}"`);
}

import { chromium } from 'playwright';
import { loadCookies } from './cookies';

const MS_RETRY_GOTO = 60 * 1000; // riprova ogni 60 secondi in caso di timeout page.goto

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapePresenze(config: { targetUrl: string; cookiesFile: string }) {
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

		console.log(`[scraper] Chromium: ${config.targetUrl}`);

		// Retry loop per page.goto in caso di timeout
		while (true) {
			try {
				await page.goto(config.targetUrl, {
					waitUntil: 'networkidle',
					timeout: 30_000,
				});
				break; // Successo, esci dal loop
			} catch (error) {
				console.log(`[scraper] Errore durante page.goto. Riprovo tra ${MS_RETRY_GOTO / 1000} secondi...`);
				await sleep(MS_RETRY_GOTO);
			}
		}

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

		console.log(`[scraper] (campo debito): "${debitoRaw}"`);
		console.log(
			`[scraper] (campo timbrature): "${timbratureRaw}"`
		);

		return { debitoRaw, timbratureRaw };
	} finally {
		await browser.close();
	}
}

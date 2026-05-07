import * as fs from 'fs';

/** Formato esportato da EditThisCookie / Cookie-Editor / Get cookies.txt LOCALLY */
interface RawCookie {
	name: string;
	value: string;
	domain: string;
	path?: string;
	secure?: boolean;
	httpOnly?: boolean;
	expirationDate?: number;
	expires?: number;
	sameSite?: string;
}

/** Formato atteso da Playwright */
export interface PlaywrightCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	secure?: boolean;
	httpOnly?: boolean;
	expires?: number;
	sameSite?: 'Strict' | 'Lax' | 'None';
}

export function loadCookies(filePath: string): PlaywrightCookie[] {
	const raw: RawCookie[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

	return raw.map((c): PlaywrightCookie => {
		const cookie: PlaywrightCookie = {
			name: c.name,
			value: c.value,
			domain: c.domain,
			path: c.path ?? '/',
		};

		if (c.secure !== undefined) cookie.secure = Boolean(c.secure);
		if (c.httpOnly !== undefined) cookie.httpOnly = Boolean(c.httpOnly);

		const expiry = c.expirationDate ?? c.expires;
		if (typeof expiry === 'number' && expiry > 0) cookie.expires = expiry;

		if (c.sameSite) {
			const normalized =
				c.sameSite.charAt(0).toUpperCase() +
				c.sameSite.slice(1).toLowerCase();
			if (['Strict', 'Lax', 'None'].includes(normalized)) {
				cookie.sameSite = normalized as PlaywrightCookie['sameSite'];
			}
		}

		return cookie;
	});
}

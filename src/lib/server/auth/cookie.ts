import type { Cookies } from '@sveltejs/kit';
import type { Session } from './service';

export const sessionCookie = 'pacerr_session';

// Pacerr's default deployment is plain HTTP on a LAN, where a `Secure` cookie would never be sent
// back and the login would appear to silently fail.
const scope = (url: URL) =>
	({ path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' }) as const;

export function rememberSession(cookies: Cookies, url: URL, session: Session): void {
	cookies.set(sessionCookie, session.id, { ...scope(url), expires: session.expiresAt });
}

export function forgetSession(cookies: Cookies, url: URL): void {
	cookies.delete(sessionCookie, scope(url));
}

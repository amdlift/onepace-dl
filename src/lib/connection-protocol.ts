import type { IncomingMessage } from 'node:http';

/** The header name `PROTOCOL_HEADER` must be set to for {@link declareConnectionProtocol} to land. */
export const protocolHeader = 'x-forwarded-proto';

/**
 * adapter-node assumes `https` when it derives an origin, so SvelteKit's CSRF check rejects every
 * form submission to a plain-http LAN deployment. Tell it what the connection actually is, unless
 * a reverse proxy already has.
 */
export function declareConnectionProtocol(request: IncomingMessage): void {
	request.headers[protocolHeader] ??= (
		request.socket as typeof request.socket & { encrypted?: boolean }
	).encrypted
		? 'https'
		: 'http';
}

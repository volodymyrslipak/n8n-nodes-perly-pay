/**
 * Talking to Perly Pay's REST API (https://pay.perly.io/api/v1, the OpenAPI
 * document at /api/v1/openapi.json): the secret key as a Bearer token, and the
 * API's one error shape turned into a sentence in the execution log.
 *
 *   { "error": { "type": "invalid_request_error", "code": "parameter_invalid", "message": "…", "param": "amount" } }
 *
 * Nothing here imports n8n: the requests the nodes send are built by
 * requests.ts from plain values, so Perly Pay's own test suite can hold each
 * one to the API's schemas (test/api.drift.test.ts).
 */

export const DEFAULT_API_URL = 'https://pay.perly.io/api/v1';

/** This machine, as a browser or a container on it names it. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']);

export type Method = 'GET' | 'POST' | 'DELETE';

/** One call to the API, before n8n sends it: a path under /api/v1, its query and its JSON body. */
export interface ApiRequest {
	method: Method;
	path: string;
	qs?: Record<string, string | number>;
	body?: Record<string, unknown>;
}

/**
 * The API's base URL from the credential's (hidden) API URL. Only https to a
 * perly.io host, or this machine (plain http allowed there): a credential
 * someone else wrote must not be able to carry the secret key away.
 */
export function apiBaseOf(raw: unknown): string {
	const text = typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_API_URL;
	let url: URL | null = null;
	try {
		url = new URL(text);
	} catch {
		url = null;
	}
	if (!url) throw new Error(`The API URL is not a URL: ${text}`);
	const local = LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith('.localhost');
	if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
		throw new Error('The API URL must be https (plain http only to this machine).');
	}
	if (!local && url.hostname !== 'perly.io' && !url.hostname.endsWith('.perly.io')) {
		throw new Error(
			`The API URL points at ${url.hostname}, and your secret key would go there. Only perly.io and this machine are allowed.`,
		);
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new Error('The API URL must be a plain address, without a user, a query or a fragment.');
	}
	const path = url.pathname.replace(/\/+$/, '');
	return `${url.origin}${path.endsWith('/api/v1') ? path : `${path}/api/v1`}`;
}

/** The mode a key works in, from its prefix: sk_test_… or sk_live_…. */
export function keyMode(key: unknown): 'test' | 'live' | null {
	const k = typeof key === 'string' ? key.trim() : '';
	if (k.startsWith('sk_live_')) return 'live';
	if (k.startsWith('sk_test_')) return 'test';
	return null;
}

/** A path segment for an id the user typed: trimmed, and never able to leave its segment. */
export function segment(id: unknown, what: string): string {
	const text = typeof id === 'string' ? id.trim() : '';
	if (!text) throw new Error(`Give the ${what}.`);
	return encodeURIComponent(text);
}

interface ApiError {
	message?: unknown;
	code?: unknown;
	param?: unknown;
}

/** The sentence for a refused call: Perly Pay's own message and the field it names, or the status. */
export function errorOf(status: number, body: unknown): { message: string; code: string | null } {
	const error =
		body &&
		typeof body === 'object' &&
		'error' in body &&
		body.error &&
		typeof body.error === 'object'
			? (body.error as ApiError)
			: null;
	if (status === 401) {
		return {
			message:
				'Perly Pay refused the secret key. Paste a current one from Dashboard → Developers → API keys.',
			code: 'authentication_failed',
		};
	}
	const message =
		typeof error?.message === 'string' && error.message
			? error.message
			: `Perly Pay answered ${status}.`;
	const field = typeof error?.param === 'string' && error.param ? ` (${error.param})` : '';
	return {
		message: `${message}${field}`,
		code: typeof error?.code === 'string' ? error.code : null,
	};
}

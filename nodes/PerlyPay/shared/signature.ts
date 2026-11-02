/**
 * Perly-Signature, as Perly Pay signs every webhook:
 *
 *   Perly-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, t + "." + raw body)>
 *
 * The same check as the Node SDK's `webhooks.verify` (packages/sdk/src/webhooks.ts),
 * written out with node:crypto because a verified n8n node may carry no
 * dependency. Perly Pay's test suite holds the two to the same answers.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'Perly-Signature';
export const TOLERANCE_SECONDS = 300;

export type Verdict = 'ok' | 'stale' | 'bad';

export function parseSignatureHeader(
	header: unknown,
): { timestamp: number; signatures: string[] } | null {
	if (typeof header !== 'string') return null;
	let timestamp: number | null = null;
	const signatures: string[] = [];
	for (const part of header.split(',')) {
		const at = part.indexOf('=');
		if (at < 0) continue;
		const key = part.slice(0, at).trim();
		const value = part.slice(at + 1).trim();
		if (key === 't' && /^\d{1,12}$/.test(value)) timestamp = Number(value);
		else if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
	}
	return timestamp === null || signatures.length === 0 ? null : { timestamp, signatures };
}

export function sign(body: string, secret: string, timestamp: number): string {
	const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
	return `t=${timestamp},v1=${mac}`;
}

/**
 * `body` is the raw request body, as bytes or as the string they spell.
 * "ok" when the header signs this exact body with this secret and is fresh;
 * "stale" when it signs it but is older (or newer) than the tolerance;
 * "bad" when it is missing, malformed or does not match.
 */
export function check(
	body: unknown,
	header: unknown,
	secret: unknown,
	nowSeconds = Math.floor(Date.now() / 1000),
	tolerance = TOLERANCE_SECONDS,
): Verdict {
	const raw = typeof body === 'string' ? body : body instanceof Uint8Array ? body : null;
	if (raw === null || typeof secret !== 'string' || !secret) return 'bad';
	const parsed = parseSignatureHeader(header);
	if (!parsed) return 'bad';
	// The bytes as they arrived: a body parsed and written out again no longer matches.
	const expected = Buffer.from(
		createHmac('sha256', secret).update(`${parsed.timestamp}.`).update(raw).digest('hex'),
	);
	const matches = parsed.signatures.some((s) => {
		const given = Buffer.from(s);
		return given.length === expected.length && timingSafeEqual(given, expected);
	});
	if (!matches) return 'bad';
	return Math.abs(nowSeconds - parsed.timestamp) > tolerance ? 'stale' : 'ok';
}

/** A header of the incoming request, whatever its case; the first when it came twice. */
export function headerOf(headers: unknown, name: string): string | undefined {
	if (!headers || typeof headers !== 'object') return undefined;
	const wanted = name.toLowerCase();
	for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
		if (key.toLowerCase() !== wanted) continue;
		const first: unknown = Array.isArray(value) ? value[0] : value;
		return typeof first === 'string' ? first : undefined;
	}
	return undefined;
}

/**
 * Every request the two nodes send, built from plain values. The nodes read
 * their parameters, call one of these, and hand the result to n8n's
 * authenticated request helper; Perly Pay's test suite calls the same
 * functions (and drives the nodes themselves) and holds each request to the
 * API's own schemas, so the package cannot drift from the API.
 *
 * Only the fields that were filled go out: the API refuses unknown and
 * empty ones alike. Amounts typed as "29.90" go out as 2990.
 */
import { segment, type ApiRequest } from './api';
import { fromMinor, toMinor } from './money';

const trimmed = (value: unknown): string | undefined =>
	typeof value === 'string' && value.trim() ? value.trim() : undefined;

function compact(object: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(object).filter(([, v]) => v !== undefined && v !== null && v !== ''),
	);
}

/** n8n's key–value list → the API's metadata: string values, empty pairs left out, nothing at all when none are left. */
export function metadataOf(pairs: unknown): Record<string, string> | undefined {
	if (!Array.isArray(pairs)) return undefined;
	const kept = pairs
		.filter((p): p is { key?: unknown; value?: unknown } => !!p && typeof p === 'object')
		.map((p) => [
			String(p.key ?? '').trim(),
			p.value === undefined || p.value === null ? '' : String(p.value),
		])
		.filter(([k, v]) => k && v !== '');
	return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

export const CURRENCIES = ['USD', 'EUR'] as const;

/** '' (the account's currency), USD or EUR; anything else is refused before it is sent. */
function currencyOf(value: unknown): string | undefined {
	const code = trimmed(value)?.toUpperCase();
	if (code === undefined) return undefined;
	if (!(CURRENCIES as readonly string[]).includes(code)) {
		throw new Error(`Perly Pay prices invoices in USD or EUR only, not ${code}.`);
	}
	return code;
}

function limitOf(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isInteger(n) && n >= 1 ? Math.min(n, 100) : 10;
}

// ── Credentials ──────────────────────────────────────────────────────────

/** The credential test: proves the key works and that it may make the trigger's webhook endpoints. */
export const testCredentials = (): ApiRequest => ({
	method: 'GET',
	path: '/webhook_endpoints',
	qs: { limit: 1 },
});

// ── Invoices ─────────────────────────────────────────────────────────────

export interface InvoiceInput {
	amount: unknown;
	description: unknown;
	currency?: unknown;
	customerEmail?: unknown;
	returnUrl?: unknown;
	expiresInMinutes?: unknown;
	metadata?: unknown;
}

export function createInvoice(input: InvoiceInput): ApiRequest {
	const description = trimmed(input.description);
	if (!description)
		throw new Error('Give a description: what the invoice is for. The buyer sees it.');
	const expires = Number(input.expiresInMinutes);
	return {
		method: 'POST',
		path: '/invoices',
		body: compact({
			amount: toMinor(input.amount),
			description,
			currency: currencyOf(input.currency),
			customer_email: trimmed(input.customerEmail),
			return_url: trimmed(input.returnUrl),
			expires_in_minutes: Number.isInteger(expires) && expires > 0 ? expires : undefined,
			metadata: metadataOf(input.metadata),
		}),
	};
}

export const getInvoice = (id: unknown): ApiRequest => ({
	method: 'GET',
	path: `/invoices/${segment(id, 'invoice ID')}`,
});

export const INVOICE_STATUSES = [
	'open',
	'seen',
	'underpaid',
	'paid',
	'overpaid',
	'review',
	'expired',
	'canceled',
	'refunded',
	'partially_refunded',
] as const;

export function listInvoices(input: {
	limit?: unknown;
	status?: unknown;
	customer?: unknown;
	cursor?: string;
}): ApiRequest {
	const status = trimmed(input.status);
	if (status !== undefined && !(INVOICE_STATUSES as readonly string[]).includes(status)) {
		throw new Error(`"${status}" is not an invoice status.`);
	}
	return {
		method: 'GET',
		path: '/invoices',
		qs: compact({
			limit: limitOf(input.limit),
			status,
			customer: trimmed(input.customer),
			cursor: input.cursor,
		}) as Record<string, string | number>,
	};
}

// ── Customers ────────────────────────────────────────────────────────────

export const searchCustomers = (input: {
	email?: unknown;
	limit?: unknown;
	cursor?: string;
}): ApiRequest => ({
	method: 'GET',
	path: '/customers',
	qs: compact({
		email: trimmed(input.email),
		limit: limitOf(input.limit),
		cursor: input.cursor,
	}) as Record<string, string | number>,
});

// ── Payment links ────────────────────────────────────────────────────────

/** A new product for a payment link made from a name and an amount. */
export function createProduct(name: unknown): ApiRequest {
	const text = trimmed(name);
	if (!text) throw new Error('Give the new product a name, or choose an existing price.');
	return { method: 'POST', path: '/products', body: { name: text } };
}

/** Its one-time price. */
export const createPrice = (input: {
	product: string;
	amount: unknown;
	currency?: unknown;
}): ApiRequest => ({
	method: 'POST',
	path: '/prices',
	body: compact({
		product: input.product,
		model: 'one_time',
		unit_amount: toMinor(input.amount),
		currency: currencyOf(input.currency),
	}),
});

export function createPaymentLink(input: { price: unknown; successUrl?: unknown }): ApiRequest {
	const price = trimmed(input.price);
	if (!price) throw new Error('Choose a price.');
	return {
		method: 'POST',
		path: '/payment_links',
		body: compact({ price, success_url: trimmed(input.successUrl) }),
	};
}

/** The price dropdown: the active prices, and the products that name them. */
export const listActivePrices = (): ApiRequest => ({
	method: 'GET',
	path: '/prices',
	qs: { active: 'true', limit: 100 },
});
export const listProducts = (): ApiRequest => ({
	method: 'GET',
	path: '/products',
	qs: { limit: 100 },
});

// ── Webhooks (the trigger) ───────────────────────────────────────────────

export function createWebhookEndpoint(input: {
	url: string;
	events: string[];
	description: string;
}): ApiRequest {
	if (input.events.length === 0) throw new Error('Choose at least one event.');
	return {
		method: 'POST',
		path: '/webhook_endpoints',
		body: {
			url: input.url,
			enabled_events: [...input.events],
			description: input.description.slice(0, 200) || 'n8n',
		},
	};
}

export const getWebhookEndpoint = (id: unknown): ApiRequest => ({
	method: 'GET',
	path: `/webhook_endpoints/${segment(id, 'webhook endpoint ID')}`,
});

export const deleteWebhookEndpoint = (id: unknown): ApiRequest => ({
	method: 'DELETE',
	path: `/webhook_endpoints/${segment(id, 'webhook endpoint ID')}`,
});

/** An event as Perly Pay holds it, by its id (evt_ and digits): what the trigger trusts when a signature cannot say. */
export function getEvent(id: unknown): ApiRequest {
	if (typeof id !== 'string' || !/^evt_\d{1,16}$/.test(id))
		throw new Error('That is not a Perly Pay event ID.');
	return { method: 'GET', path: `/events/${id}` };
}

/** Price label in the dropdown: "1,000 API credits · 12.00 USD" (and " / month" for a subscription). */
export function priceLabel(
	price: Record<string, unknown>,
	productName: string | undefined,
): string {
	const custom = price.custom_amount as { minimum?: unknown } | null | undefined;
	const amount =
		price.unit_amount != null
			? `${fromMinor(price.unit_amount)} ${String(price.currency)}`
			: custom
				? `from ${fromMinor(custom.minimum)} ${String(price.currency)}`
				: String(price.currency);
	const recurring = price.recurring as { interval?: unknown } | null | undefined;
	const every = recurring ? ` / ${String(recurring.interval)}` : '';
	return [productName, price.nickname, `${amount}${every}`]
		.filter((p) => typeof p === 'string' && p)
		.join(' · ');
}

/** Invoice label in the Invoice list: "49.00 USD · paid · ada@example.com · Course: Bitcoin for builders". */
export function invoiceLabel(invoice: Record<string, unknown>): string {
	const lines = Array.isArray(invoice.lines) ? (invoice.lines as { description?: unknown }[]) : [];
	const what =
		lines.length > 0
			? lines.map((l) => String(l.description ?? '')).join(', ')
			: invoice.description;
	return [
		`${fromMinor(invoice.total) ?? '?'} ${String(invoice.currency ?? '')}`,
		invoice.status,
		invoice.customer_email,
		what,
	]
		.filter((p) => typeof p === 'string' && p)
		.join(' · ');
}

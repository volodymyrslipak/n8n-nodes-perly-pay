/**
 * What a workflow sees. Perly Pay sends amounts as integers (cents; crypto in
 * its smallest unit); a spreadsheet wants "49.00". Every object keeps the
 * API's own fields and gains `*_decimal` twins of its amounts, as in the
 * Zapier app (plugins/zapier/lib/shape.js), so the two read alike.
 */
import { formatUnits, fromMinor } from './money';

export type Json = Record<string, unknown>;

const FIAT: Record<string, string[]> = {
	invoice: ['subtotal', 'discount', 'total', 'total_usd', 'received_usd', 'pending_usd'],
	price: ['unit_amount'],
};

const isObject = (value: unknown): value is Json =>
	!!value && typeof value === 'object' && !Array.isArray(value);

export function decorate(kind: string, object: unknown): unknown {
	if (!isObject(object)) return object;
	const out: Json = { ...object };
	for (const field of FIAT[kind] ?? []) {
		if (typeof object[field] === 'number') out[`${field}_decimal`] = fromMinor(object[field]);
	}
	// An invoice made from one amount keeps its description on its line: say what was bought either way.
	if (kind === 'invoice' && Array.isArray(object.lines)) {
		out.items = object.lines
			.filter(isObject)
			.map((l) =>
				typeof l.quantity === 'number' && l.quantity > 1
					? `${l.quantity} × ${String(l.description)}`
					: String(l.description),
			)
			.join(', ');
	}
	if (kind === 'invoice' && isObject(object.payment)) {
		out.amount_received_decimal = formatUnits(object.amount_received, object.payment.decimals);
		out.payment = {
			...object.payment,
			amount_due_decimal: formatUnits(object.payment.amount_due, object.payment.decimals),
		};
	}
	if (kind === 'refund') {
		for (const field of ['amount', 'network_fee', 'amount_to_send']) {
			out[`${field}_decimal`] =
				object[field] == null ? null : formatUnits(object[field], object.decimals);
		}
	}
	return out;
}

/**
 * A webhook event → one item: the event's id (unique per event: the key to
 * skip a delivery seen before), its type and time, the object under its own
 * name (`invoice`, `refund`, `subscription`, `customer`…) and what else the
 * event recorded under `details`.
 */
export function eventOutput(event: Json): Json {
	const kind =
		typeof event.object_type === 'string' && event.object_type ? event.object_type : 'object';
	const { object, ...details } = isObject(event.data) ? event.data : ({} as Json);
	return {
		id: event.id,
		type: event.type,
		livemode: event.livemode,
		created: event.created,
		[kind]: decorate(kind, object ?? null),
		details,
	};
}

/**
 * The ten fields most workflows use, flat, for 'Simplify' (n8n's rule for objects of more than ten
 * fields). Invoices and payment links have more; customers have ten and are never simplified.
 */
export function simplify(kind: string, object: unknown): unknown {
	if (!isObject(object)) return object;
	if (kind === 'invoice') {
		const payment = isObject(object.payment) ? object.payment : {};
		const decorated = decorate('invoice', object) as Json;
		return {
			id: object.id,
			status: object.status,
			url: object.url,
			currency: object.currency,
			total_decimal: decorated.total_decimal,
			customer_email: object.customer_email,
			network: payment.chain ?? null,
			coin: payment.asset ?? null,
			paid_at: object.paid_at,
			metadata: object.metadata,
		};
	}
	if (kind === 'payment_link') {
		return {
			id: object.id,
			url: object.url,
			price: object.price,
			quantity: object.quantity,
			active: object.active,
			success_url: object.success_url,
			metadata: object.metadata,
			created: object.created,
		};
	}
	return decorate(kind, object);
}

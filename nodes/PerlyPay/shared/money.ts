/**
 * Money as Perly Pay keeps it: integers. Fiat amounts are minor units (cents)
 * with a currency; crypto amounts are integer strings in the asset's smallest
 * unit with its `decimals`. A workflow's user types "29.90"; the API wants
 * 2990. Never through a float. (The Zapier app's lib/money.js, in TypeScript.)
 */

/** "29.90", "29,9", "1500", 29.9 → 2990, 2990, 150000, 2990. Throws a plain sentence on anything else. */
export function toMinor(input: unknown): number {
	const text = String(input ?? '')
		.trim()
		.replace(/\s+/g, '');
	const match = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec(text);
	if (!match) throw new Error(`"${String(input ?? '')}" is not an amount. Write it like 29.90.`);
	const minor = BigInt(match[1] ?? '0') * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'));
	if (minor < BigInt(1)) throw new Error('The amount must be more than zero.');
	if (minor > BigInt(100_000_000_000)) throw new Error('The amount is too large.');
	return Number(minor);
}

/** 2990 → "29.90". */
export function fromMinor(minor: unknown): string | null {
	if (typeof minor !== 'number' || !Number.isInteger(minor)) return null;
	const sign = minor < 0 ? '-' : '';
	const abs = BigInt(Math.abs(minor));
	return `${sign}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, '0')}`;
}

/** ("1500000", 6) → "1.5"; ("12345", 8) → "0.00012345". */
export function formatUnits(units: unknown, decimals: unknown): string | null {
	if (typeof units !== 'string' || !/^-?\d+$/.test(units)) return null;
	if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0) return null;
	const negative = units.startsWith('-');
	const digits = (negative ? units.slice(1) : units).replace(/^0+(?=\d)/, '');
	if (decimals === 0) return `${negative ? '-' : ''}${digits}`;
	const padded = digits.padStart(decimals + 1, '0');
	const whole = padded.slice(0, -decimals);
	const fraction = padded.slice(-decimals).replace(/0+$/, '');
	return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

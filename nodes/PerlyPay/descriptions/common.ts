import type { INodeProperties } from 'n8n-workflow';

export const CURRENCY_FIELD: INodeProperties = {
	displayName: 'Currency',
	name: 'currency',
	type: 'options',
	default: '',
	description: 'Perly Pay prices in US dollars or euros; the buyer pays the equivalent in coins',
	options: [
		{ name: 'Account Default', value: '' },
		{ name: 'EUR', value: 'EUR' },
		{ name: 'USD', value: 'USD' },
	],
};

export const RETURN_ALL_FIELD: INodeProperties = {
	displayName: 'Return All',
	name: 'returnAll',
	type: 'boolean',
	default: false,
	description: 'Whether to return all results or only up to a given limit',
};

export const LIMIT_FIELD: INodeProperties = {
	displayName: 'Limit',
	name: 'limit',
	type: 'number',
	typeOptions: { minValue: 1 },
	default: 50,
	description: 'Max number of results to return',
};

export const SIMPLIFY_FIELD: INodeProperties = {
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	description:
		'Whether to return a simplified version of the response instead of the raw data (ten fields, flat)',
};

import type { INodeProperties } from 'n8n-workflow';
import { CURRENCY_FIELD, SIMPLIFY_FIELD } from './common';

const showFor = (operation: string[], extra: Record<string, string[]> = {}) => ({
	show: { resource: ['paymentLink'], operation, ...extra },
});

export const paymentLinkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['paymentLink'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a payment link: a shareable payment page for one price',
				action: 'Create payment link',
			},
		],
		default: 'create',
	},
];

export const paymentLinkFields: INodeProperties[] = [
	{
		displayName: 'Price Source',
		name: 'priceMode',
		type: 'options',
		noDataExpression: true,
		default: 'existing',
		options: [
			{
				name: 'Existing Price',
				value: 'existing',
				description: 'One of your active prices',
			},
			{
				name: 'New One-Time Price',
				value: 'new',
				description: 'A new product and price from a name and an amount',
			},
		],
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Price',
		name: 'price',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'list', value: '' },
		description: 'The price the link sells',
		displayOptions: showFor(['create'], { priceMode: ['existing'] }),
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchPrices', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. price_2b3c4d5e6f708192a3b4c5d6e7f8091a',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^price_[0-9a-f]{32}$',
							errorMessage: 'A price ID starts with price_',
						},
					},
				],
			},
		],
	},
	{
		displayName: 'Product Name',
		name: 'productName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 1,000 API credits',
		description: 'What you sell',
		displayOptions: showFor(['create'], { priceMode: ['new'] }),
	},
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 12.00',
		description: 'The price, paid once',
		displayOptions: showFor(['create'], { priceMode: ['new'] }),
	},
	{ ...CURRENCY_FIELD, displayOptions: showFor(['create'], { priceMode: ['new'] }) },
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['create']),
		options: [
			{
				displayName: 'Success URL',
				name: 'successUrl',
				type: 'string',
				placeholder: 'e.g. https://example.com/thanks',
				default: '',
				description: 'Where the buyer goes after paying',
			},
		],
	},
	{ ...SIMPLIFY_FIELD, displayOptions: showFor(['create']) },
];

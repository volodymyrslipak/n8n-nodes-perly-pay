import type { INodeProperties } from 'n8n-workflow';
import { CURRENCY_FIELD, LIMIT_FIELD, RETURN_ALL_FIELD, SIMPLIFY_FIELD } from './common';

const showFor = (operation: string[]) => ({ show: { resource: ['invoice'], operation } });

export const invoiceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['invoice'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create an invoice and get its payment page, where the buyer pays in crypto',
				action: 'Create invoice',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get an invoice: its status, what arrived and on which network',
				action: 'Get invoice',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many invoices, newest first',
				action: 'Get many invoices',
			},
		],
		default: 'create',
	},
];

export const invoiceFields: INodeProperties[] = [
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 49.00',
		description:
			'What the buyer pays, in the currency below. They choose the coin and network on the payment page.',
		displayOptions: showFor(['create']),
	},
	{ ...CURRENCY_FIELD, displayOptions: showFor(['create']) },
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Course: Bitcoin for builders',
		description: 'What the invoice is for. The buyer sees it.',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['create']),
		options: [
			{
				displayName: 'Customer Email',
				name: 'customerEmail',
				type: 'string',
				placeholder: 'e.g. nathan@example.com',
				default: '',
				description: 'Finds the customer by email, or adds them. Perly Pay emails their receipt.',
			},
			{
				displayName: 'Expires In (Minutes)',
				name: 'expiresInMinutes',
				type: 'number',
				typeOptions: { minValue: 30, maxValue: 129600 },
				default: 60,
				description:
					'How long the buyer has to choose a coin and network, from 30 minutes to 90 days',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'fixedCollection',
				placeholder: 'Add Field',
				typeOptions: { multipleValues: true },
				default: {},
				description:
					'Your own fields, like an order ID. They come back on every event about this invoice.',
				options: [
					{
						displayName: 'Field',
						name: 'pair',
						values: [
							{
								displayName: 'Name',
								name: 'key',
								type: 'string',
								placeholder: 'e.g. orderId',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Return URL',
				name: 'returnUrl',
				type: 'string',
				placeholder: 'e.g. https://example.com/thanks',
				default: '',
				description: 'Where the payment page sends the buyer back',
			},
		],
	},
	{
		displayName: 'Invoice',
		name: 'invoiceId',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'list', value: '' },
		description: 'The invoice to get',
		displayOptions: showFor(['get']),
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchInvoices', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. inv_3f2a9c1e7b6d4a5f8e9c0b1a2d3e4f50',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^inv_[0-9a-f]{32}$',
							errorMessage: 'An invoice ID starts with inv_',
						},
					},
				],
			},
		],
	},
	{ ...RETURN_ALL_FIELD, displayOptions: showFor(['getAll']) },
	{
		...LIMIT_FIELD,
		displayOptions: { show: { resource: ['invoice'], operation: ['getAll'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getAll']),
		options: [
			{
				displayName: 'Customer ID',
				name: 'customer',
				type: 'string',
				placeholder: 'e.g. cus_8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
				default: '',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'paid',
				options: [
					{ name: 'Canceled', value: 'canceled' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Open', value: 'open' },
					{ name: 'Overpaid', value: 'overpaid' },
					{ name: 'Paid', value: 'paid' },
					{ name: 'Partially Refunded', value: 'partially_refunded' },
					{ name: 'Refunded', value: 'refunded' },
					{ name: 'Review', value: 'review' },
					{ name: 'Seen', value: 'seen' },
					{ name: 'Underpaid', value: 'underpaid' },
				],
			},
		],
	},
	{ ...SIMPLIFY_FIELD, displayOptions: showFor(['create', 'get', 'getAll']) },
];

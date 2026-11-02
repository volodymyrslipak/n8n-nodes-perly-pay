import type { INodeProperties } from 'n8n-workflow';
import { LIMIT_FIELD, RETURN_ALL_FIELD } from './common';

const showFor = (operation: string[]) => ({ show: { resource: ['customer'], operation } });

export const customerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customer'] } },
		options: [
			{
				name: 'Search',
				value: 'search',
				description: 'Search customers by email, or list them newest first',
				action: 'Search customers',
			},
		],
		default: 'search',
	},
];

export const customerFields: INodeProperties[] = [
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'e.g. nathan@example.com',
		default: '',
		description: 'Leave empty to list every customer',
		displayOptions: showFor(['search']),
	},
	{ ...RETURN_ALL_FIELD, displayOptions: showFor(['search']) },
	{
		...LIMIT_FIELD,
		displayOptions: { show: { resource: ['customer'], operation: ['search'], returnAll: [false] } },
	},
];

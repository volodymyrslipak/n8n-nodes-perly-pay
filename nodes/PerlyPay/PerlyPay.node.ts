import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type { ApiRequest } from './shared/api';
import * as R from './shared/requests';
import { decorate, simplify } from './shared/shape';
import { call } from './shared/transport';
import { customerFields, customerOperations } from './descriptions/customer';
import { invoiceFields, invoiceOperations } from './descriptions/invoice';
import { paymentLinkFields, paymentLinkOperations } from './descriptions/paymentLink';

/**
 * Perly Pay's actions: create and read invoices, search customers, make a
 * payment link. Each one builds its request in shared/requests.ts and sends
 * it with the credential; every object comes back as the API sends it, with
 * `*_decimal` twins of its amounts, or with 'Simplify' as its ten most used
 * fields.
 */
export class PerlyPay implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Perly Pay',
		name: 'perlyPay',
		icon: { light: 'file:../../icons/perlyPay.svg', dark: 'file:../../icons/perlyPay.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Take bitcoin and stablecoin payments straight to your own wallet with Perly Pay',
		defaults: {
			name: 'Perly Pay',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'perlyPayApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Customer',
						value: 'customer',
					},
					{
						name: 'Invoice',
						value: 'invoice',
					},
					{
						name: 'Payment Link',
						value: 'paymentLink',
					},
				],
				default: 'invoice',
			},
			...customerOperations,
			...customerFields,
			...invoiceOperations,
			...invoiceFields,
			...paymentLinkOperations,
			...paymentLinkFields,
		],
	};

	methods = {
		listSearch: {
			/** Invoices for the Invoice list, newest first, a page at a time; the search matches what the label shows. */
			async searchInvoices(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const page = await call.call(this, R.listInvoices({ limit: 100, cursor: paginationToken }));
				const results = listOf(page)
					.filter((inv) => typeof inv.id === 'string')
					.map((inv) => ({
						name: R.invoiceLabel(inv),
						value: inv.id as string,
						url: inv.url as string,
					}))
					.filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()));
				const next =
					page.has_more === true && typeof page.next_cursor === 'string'
						? page.next_cursor
						: undefined;
				return { results, paginationToken: next };
			},

			/** The active prices for the Price list, named by their products. */
			async searchPrices(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const [prices, products] = await Promise.all([
					call.call(this, R.listActivePrices()),
					call.call(this, R.listProducts()),
				]);
				const names = new Map<string, string>();
				for (const p of listOf(products)) {
					if (typeof p.id === 'string' && typeof p.name === 'string') names.set(p.id, p.name);
				}
				const results = listOf(prices)
					.filter((p) => typeof p.id === 'string')
					.map((p) => ({
						name: R.priceLabel(p, typeof p.product === 'string' ? names.get(p.product) : undefined),
						value: p.id as string,
					}))
					.filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()));
				return { results };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const results = await run.call(this, resource, operation, i);
				for (const json of results) out.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Perly Pay's refusals arrive as NodeApiError with the item already named; anything else is wrapped.
				const failure =
					error instanceof NodeApiError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				throw failure;
			}
		}
		return [out];
	}
}

type Json = Record<string, unknown>;

function listOf(page: Json): Json[] {
	return Array.isArray(page.data)
		? (page.data.filter((x) => x && typeof x === 'object') as Json[])
		: [];
}

/** What one input item asks for, as API objects. */
async function run(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	const param = (name: string, fallback?: unknown) => this.getNodeParameter(name, i, fallback);
	const shape = (kind: string, object: unknown) =>
		(param('simplify', false) ? simplify(kind, object) : decorate(kind, object)) as IDataObject;
	const one = async (kind: string, request: ApiRequest) => [
		shape(kind, await call.call(this, request, i)),
	];

	if (resource === 'invoice' && operation === 'create') {
		const extra = param('additionalFields', {}) as IDataObject;
		return one(
			'invoice',
			R.createInvoice({
				amount: param('amount'),
				description: param('description'),
				currency: param('currency', ''),
				customerEmail: extra.customerEmail,
				returnUrl: extra.returnUrl,
				expiresInMinutes: extra.expiresInMinutes,
				metadata: (extra.metadata as IDataObject | undefined)?.pair,
			}),
		);
	}
	if (resource === 'invoice' && operation === 'get') {
		return one(
			'invoice',
			R.getInvoice(this.getNodeParameter('invoiceId', i, '', { extractValue: true })),
		);
	}
	if (resource === 'invoice' && operation === 'getAll') {
		const filters = param('filters', {}) as IDataObject;
		return all
			.call(this, i, (limit, cursor) =>
				R.listInvoices({ limit, cursor, status: filters.status, customer: filters.customer }),
			)
			.then((list) => list.map((inv) => shape('invoice', inv)));
	}
	if (resource === 'customer' && operation === 'search') {
		const email = param('email', '');
		return all.call(this, i, (limit, cursor) => R.searchCustomers({ email, limit, cursor }));
	}
	if (resource === 'paymentLink' && operation === 'create') {
		let price: unknown =
			param('priceMode', 'existing') === 'existing'
				? this.getNodeParameter('price', i, '', { extractValue: true })
				: undefined;
		if (price === undefined) {
			const product = await call.call(this, R.createProduct(param('productName')), i);
			const made = await call.call(
				this,
				R.createPrice({
					product: String(product.id),
					amount: param('amount'),
					currency: param('currency', ''),
				}),
				i,
			);
			price = made.id;
		}
		const extra = param('additionalFields', {}) as IDataObject;
		return one('payment_link', R.createPaymentLink({ price, successUrl: extra.successUrl }));
	}
	throw new NodeOperationError(
		this.getNode(),
		`"${operation}" on "${resource}" is not something this node does.`,
		{
			itemIndex: i,
		},
	);
}

/** A list operation: one page up to Limit, or every page with Return All. */
async function all(
	this: IExecuteFunctions,
	i: number,
	page: (limit: number, cursor?: string) => ApiRequest,
): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
	const wanted = returnAll ? Infinity : (this.getNodeParameter('limit', i, 10) as number);
	const results: IDataObject[] = [];
	let cursor: string | undefined;
	do {
		const body = await call.call(this, page(Math.min(100, wanted - results.length), cursor), i);
		for (const object of listOf(body)) {
			if (results.length < wanted) results.push(object as IDataObject);
		}
		cursor =
			body.has_more === true && typeof body.next_cursor === 'string' ? body.next_cursor : undefined;
	} while (cursor && results.length < wanted);
	return results;
}

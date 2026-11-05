import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import * as R from '../PerlyPay/shared/requests';
import { TRIGGER_EVENTS } from '../PerlyPay/shared/events';
import { eventOutput } from '../PerlyPay/shared/shape';
import { SIGNATURE_HEADER, check, headerOf } from '../PerlyPay/shared/signature';
import { call, refusal, send } from '../PerlyPay/shared/transport';

/**
 * Starts a workflow on Perly Pay's events. Activating the workflow makes a
 * webhook endpoint in Perly Pay for the chosen events, pointing at this
 * node's URL (POST /webhook_endpoints), and keeps its id and signing secret
 * in the workflow's static data; deactivating it deletes the endpoint
 * (DELETE /webhook_endpoints/{id}; already gone is fine).
 *
 * Every delivery is checked before it starts the workflow:
 *   - signed with that secret and fresh → used as sent;
 *   - signed but older than five minutes (a queued or replayed delivery), or
 *     n8n did not keep the raw body → the event is read back from Perly Pay
 *     by its id with the credential's key, and that copy is used;
 *   - not signed with that secret → answered 401, nothing runs;
 *   - an event this trigger did not ask for → answered 200, nothing runs.
 */
export class PerlyPayTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Perly Pay Trigger',
		name: 'perlyPayTrigger',
		icon: { light: 'file:../../icons/perlyPay.svg', dark: 'file:../../icons/perlyPay.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Perly Pay sends an event, like a paid invoice',
		defaults: {
			name: 'Perly Pay Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'perlyPayApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['invoice.fulfilled'],
				description:
					'The events to start the workflow. Invoice Paid is the one to deliver on: paid in full, confirmed and screened.',
				options: [...TRIGGER_EVENTS].sort((a, b) => a.name.localeCompare(b.name)),
			},
			{
				displayName:
					'With a sk_live_… key, Perly Pay sends events only to a public https address: n8n must be reachable from the internet.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	webhookMethods = {
		default: {
			/** Whether Perly Pay still has this node's endpoint, at this URL, for these events; one that differs is deleted to be made again. */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (typeof data.endpointId !== 'string') return false;
				const response = await send.call(this, R.getWebhookEndpoint(data.endpointId));
				if (response.status === 404) {
					forget(data);
					return false;
				}
				if (response.status >= 400) throw refusal(this, response);
				const endpoint = (response.body ?? {}) as IDataObject;
				const same =
					endpoint.url === this.getNodeWebhookUrl('default') &&
					sameEvents(endpoint.enabled_events, chosenEvents(this)) &&
					typeof data.secret === 'string';
				if (same) return true;
				await removeEndpoint.call(this, data.endpointId);
				forget(data);
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default');
				if (!url) return false;
				const workflow = this.getWorkflow();
				const endpoint = await call.call(
					this,
					R.createWebhookEndpoint({
						url,
						events: chosenEvents(this),
						description: `n8n: ${workflow.name ?? workflow.id ?? 'workflow'}`,
					}),
				);
				if (typeof endpoint.id !== 'string' || typeof endpoint.secret !== 'string') {
					throw refusal(this, {
						status: 502,
						body: { error: { message: 'Perly Pay made the webhook but sent no secret.' } },
					});
				}
				const data = this.getWorkflowStaticData('node');
				data.endpointId = endpoint.id;
				data.secret = endpoint.secret;
				data.events = chosenEvents(this);
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (typeof data.endpointId === 'string') await removeEndpoint.call(this, data.endpointId);
				forget(data);
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const data = this.getWorkflowStaticData('node');
		const raw: unknown = request.rawBody;
		const hasRaw = (Buffer.isBuffer(raw) || typeof raw === 'string') && raw.length > 0;
		let id: unknown;
		if (hasRaw) {
			const verdict = check(raw, headerOf(this.getHeaderData(), SIGNATURE_HEADER), data.secret);
			if (verdict === 'bad')
				return refuse(this, "Not signed by Perly Pay with this workflow's webhook secret.");
			id = parse(raw as Buffer | string)?.id;
		} else {
			id = this.getBodyData().id;
		}
		// Every delivery is claimed once before it runs, signed or not: one posted again
		// (a replay of a signed one, or an old event id) runs nothing.
		const claimed = await claim.call(this, data.endpointId, id);
		if (claimed === 'taken') return { webhookResponse: { received: true } };
		const event = claimed;
		if (!event) return refuse(this, 'Perly Pay has no such event for this key.');
		const wanted = Array.isArray(data.events) ? (data.events as string[]) : chosenEvents(this);
		if (
			event.object !== 'event' ||
			typeof event.type !== 'string' ||
			!wanted.includes(event.type)
		) {
			return { webhookResponse: { received: true } };
		}
		return { workflowData: [this.helpers.returnJsonArray([eventOutput(event) as IDataObject])] };
	}
}

function chosenEvents(context: IHookFunctions | IWebhookFunctions): string[] {
	const events = context.getNodeParameter('events', []) as string[];
	return [...new Set(events)].sort();
}

function sameEvents(have: unknown, want: string[]): boolean {
	return Array.isArray(have) && JSON.stringify([...have].sort()) === JSON.stringify(want);
}

function forget(data: IDataObject): void {
	delete data.endpointId;
	delete data.secret;
	delete data.events;
}

/** DELETE the endpoint; already deleted (in Perly Pay's dashboard) is fine, anything else is an error. */
async function removeEndpoint(this: IHookFunctions, id: string): Promise<void> {
	const response = await send.call(this, R.deleteWebhookEndpoint(id));
	if (response.status >= 400 && response.status !== 404) throw refusal(this, response);
}

function parse(raw: Buffer | string): IDataObject | null {
	try {
		const value: unknown = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
		return value && typeof value === 'object' ? (value as IDataObject) : null;
	} catch {
		return null;
	}
}

/** This endpoint's delivery of the event, taken with the credential's key: the event, 'taken' when it ran before, null when Perly Pay never sent it here. */
async function claim(this: IWebhookFunctions, endpointId: unknown, id: unknown): Promise<IDataObject | 'taken' | null> {
	if (typeof endpointId !== 'string' || typeof id !== 'string' || !/^evt_[1-9]\d{0,15}$/.test(id)) return null;
	const response = await send.call(this, R.claimDelivery(endpointId, id));
	if (response.status === 409) return 'taken';
	if (response.status === 404) return null;
	if (response.status >= 400) throw refusal(this, response);
	return response.body && typeof response.body === 'object' ? (response.body as IDataObject) : null;
}

function refuse(context: IWebhookFunctions, message: string): IWebhookResponseData {
	context.getResponseObject().status(401).json({ error: message });
	return { noWebhookResponse: true };
}

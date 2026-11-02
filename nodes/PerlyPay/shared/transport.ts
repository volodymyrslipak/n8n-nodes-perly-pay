/**
 * Sending an ApiRequest (requests.ts) with the credential: n8n's
 * authenticated helper adds `Authorization: Bearer <secret key>`, and a refusal
 * becomes a NodeApiError carrying Perly Pay's own sentence. The key never
 * goes anywhere but the API URL that apiBaseOf allows, and never into a
 * message.
 */
import type {
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { apiBaseOf, errorOf, type ApiRequest } from './api';

export const CREDENTIAL = 'perlyPayApi';

type Context = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

export interface ApiResponse {
	status: number;
	body: unknown;
}

/** The answer whatever its status; for callers that treat a 404 as an answer (an endpoint already deleted). */
export async function send(this: Context, request: ApiRequest): Promise<ApiResponse> {
	const credentials = await this.getCredentials(CREDENTIAL);
	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${apiBaseOf(credentials.apiUrl)}${request.path}`,
		qs: request.qs,
		body: request.body,
		json: true,
		headers: { Accept: 'application/json' },
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		CREDENTIAL,
		options,
	)) as {
		statusCode?: number;
		body?: unknown;
	};
	return { status: Number(response.statusCode ?? 0), body: response.body };
}

/** The answer's body; a refusal throws with Perly Pay's message. */
export async function call(
	this: Context,
	request: ApiRequest,
	itemIndex?: number,
): Promise<Record<string, unknown>> {
	const response = await send.call(this, request);
	if (response.status >= 200 && response.status < 300) {
		return response.body && typeof response.body === 'object'
			? (response.body as Record<string, unknown>)
			: {};
	}
	throw refusal(this, response, itemIndex);
}

export function refusal(context: Context, response: ApiResponse, itemIndex?: number): NodeApiError {
	const { message, code } = errorOf(response.status, response.body);
	const body =
		response.body && typeof response.body === 'object' ? (response.body as JsonObject) : {};
	return new NodeApiError(context.getNode(), body, {
		message,
		description: code ? `Perly Pay's code for this: ${code}` : undefined,
		httpCode: String(response.status),
		itemIndex,
	});
}

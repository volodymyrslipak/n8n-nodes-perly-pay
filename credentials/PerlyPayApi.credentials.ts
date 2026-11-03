import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Connect with a secret key. The key decides the mode — sk_test_… works on
 * test networks only, sk_live_… with real money — so a workflow built on a
 * test credential can never move real money. The test lists webhook
 * endpoints: it proves the key works and that it may make the endpoints the
 * trigger subscribes with.
 */
export class PerlyPayApi implements ICredentialType {
	name = 'perlyPayApi';

	displayName = 'Perly Pay API';

	icon: Icon = { light: 'file:../icons/perlyPay.svg', dark: 'file:../icons/perlyPay.dark.svg' };

	documentationUrl = 'https://github.com/volodymyrslipak/n8n-nodes-perly-pay#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'sk_test_…',
			description:
				'From Dashboard → Developers → API keys in Perly Pay. A sk_test_… key works in test mode (test coins only); sk_live_… takes real payments. Full access, or Restricted with Webhook endpoints ticked: the triggers add their own webhooks.',
		},
		{
			// Perly Pay is hosted at one address; the field lets Perly Pay's own tests point a credential at a local copy.
			// The nodes send the key only to perly.io or this machine (shared/api.ts).
			displayName: 'API URL',
			name: 'apiUrl',
			type: 'hidden',
			default: 'https://pay.perly.io/api/v1',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.secretKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.apiUrl}}',
			url: '/webhook_endpoints',
			qs: { limit: 1 },
			method: 'GET',
		},
	};
}

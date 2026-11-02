/**
 * The events the trigger offers, from Perly Pay's own list (src/core/events.ts
 * in Perly Pay; its test suite checks each one is real). The first eight are
 * the Zapier and Make apps' triggers; the rest are what a workflow most often
 * waits for besides. `invoice.fulfilled` is the one to deliver on: paid in
 * full, confirmed on its network and screened.
 */
export interface TriggerEvent {
	value: string;
	name: string;
	description: string;
}

export const TRIGGER_EVENTS: TriggerEvent[] = [
	{
		value: 'invoice.fulfilled',
		name: 'Invoice Paid',
		description: 'Paid in full, confirmed on its network and screened: the moment to deliver',
	},
	{
		value: 'invoice.underpaid',
		name: 'Payment Underpaid',
		description: 'Less than the invoice arrived. The buyer can send the rest.',
	},
	{
		value: 'refund.requested',
		name: 'Refund Opened',
		description: 'A refund was opened. Perly Pay asks the buyer for an address.',
	},
	{
		value: 'refund.confirmed',
		name: 'Refund Confirmed',
		description: 'The refund you sent from your wallet is confirmed on chain',
	},
	{
		value: 'subscription.created',
		name: 'Subscription Started',
		description: 'A subscription started',
	},
	{
		value: 'subscription.renewed',
		name: 'Subscription Renewed',
		description: 'A subscriber paid for the next period',
	},
	{
		value: 'subscription.ended',
		name: 'Subscription Ended',
		description: 'A subscription ended: the moment to take access away',
	},
	{ value: 'customer.created', name: 'New Customer', description: 'A new buyer was added' },
	{
		value: 'invoice.created',
		name: 'Invoice Created',
		description: 'An invoice was made, by you or by a checkout',
	},
	{ value: 'invoice.expired', name: 'Invoice Expired', description: 'Nothing arrived in time' },
	{
		value: 'invoice.review',
		name: 'Invoice Held for Review',
		description: 'A payment waits for your review before it counts',
	},
	{
		value: 'payment.received',
		name: 'Payment Seen',
		description: 'A transfer was seen on chain, not yet confirmed',
	},
	{
		value: 'checkout.completed',
		name: 'Checkout Completed',
		description: 'A checkout session was paid',
	},
	{
		value: 'subscription.past_due',
		name: 'Subscription Past Due',
		description: 'A renewal was not paid on time',
	},
	{
		value: 'subscription.canceled',
		name: 'Subscription Canceled',
		description: 'A subscription was canceled; it may run to the end of its period',
	},
	{
		value: 'entitlement.granted',
		name: 'Access Granted',
		description: 'A buyer was given access to a product',
	},
	{
		value: 'entitlement.revoked',
		name: 'Access Revoked',
		description: "A buyer's access to a product ended",
	},
	{
		value: 'license.created',
		name: 'License Key Issued',
		description: 'A license key was issued for a purchase',
	},
	{
		value: 'credits.low',
		name: 'Credits Low',
		description: "A customer's credits fell to the low-balance threshold",
	},
];

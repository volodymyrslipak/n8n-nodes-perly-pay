# n8n-nodes-perly-pay

This is an n8n community node. It lets you use [Perly Pay](https://pay.perly.io) in your n8n workflows.

Perly Pay is a non-custodial crypto checkout. Buyers pay in bitcoin on-chain, USDC on Base, Arbitrum, Optimism or Ethereum, USDT on Ethereum or TRON, or USDT0 on Arbitrum or Optimism, straight to your own wallet. You connect public keys only: Perly Pay never holds or moves the money. It costs 2.5¢ a payment, never more than 0.5% of it, billed after the month; a month of up to 21 payments costs nothing.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation) ·
[Operations](#operations) ·
[Credentials](#credentials) ·
[Compatibility](#compatibility) ·
[Usage](#usage) ·
[Test without money](#test-without-money) ·
[Security](#security) ·
[Resources](#resources) ·
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-perly-pay`. It has no dependencies of its own.

## Operations

**Perly Pay** (also usable as a tool by n8n's AI Agent)

| Resource | Operation | What it does |
| --- | --- | --- |
| Invoice | Create | Makes an invoice for an amount in USD or EUR and returns its payment page (`url`), where the buyer picks a coin and network. Optional: the buyer's email, a return URL, how long the buyer has to choose, and your own metadata. |
| Invoice | Get | An invoice by its ID: its status, what arrived and on which network. |
| Invoice | Get Many | Invoices, newest first, by status or customer. |
| Customer | Search | Customers by email, or all of them, newest first. |
| Payment Link | Create | A shareable payment page for one of your prices, or for a new one-time price made from a name and an amount. |

**Perly Pay Trigger** starts a workflow on the events you choose, among them:

| Event | When |
| --- | --- |
| Invoice Paid (`invoice.fulfilled`) | Paid in full, confirmed on its network and screened. The one to deliver on. |
| Payment Underpaid (`invoice.underpaid`) | Less than the invoice arrived; the buyer can send the rest. |
| Payment Seen (`payment.received`) | A transfer is on chain, not yet confirmed. |
| Invoice Expired, Invoice Held for Review, Invoice Created | |
| Refund Opened, Refund Confirmed | |
| Subscription Started, Renewed, Past Due, Canceled, Ended | |
| New Customer, Checkout Completed, Access Granted, Access Revoked, License Key Issued, Credits Low | |

Amounts come as Perly Pay sends them, as integers (cents; coins in their smallest unit), and each one also as a decimal string beside it: `total` is `4900` and `total_decimal` is `"49.00"`; `payment.amount_due` is `"49000000"` and `payment.amount_due_decimal` is `"49"`. An invoice also gets `items`, a line saying what was bought.

## Credentials

1. Sign up at [pay.perly.io](https://pay.perly.io) and connect your wallet's public keys ([how](https://pay.perly.io/docs/wallets)).
2. In Perly Pay, open **Dashboard → Developers → API keys** and copy a secret key: `sk_test_…` for test mode (test coins only), `sk_live_…` for real payments. The key decides the mode, so a workflow built with a test key can never move real money.
3. In n8n, add a **Perly Pay API** credential and paste the key. n8n tests it by listing your webhook endpoints, which also proves the key may make the trigger's.

## Compatibility

Built with `@n8n/node-cli` (`n8nNodesApiVersion` 1). Tested end to end on n8n 2.45.7 (`docker.n8n.io/n8nio/n8n:2.45.7`).

## Usage

**Deliver after a payment.** Perly Pay Trigger (Invoice Paid) → your step: grant access, email a download link, add a row to a sheet. Put your own order or user ID in the invoice's metadata when you create it; it comes back on every event about that invoice (`invoice.metadata`).

**Sell from anywhere.** A form, a chat bot or a CRM step → Perly Pay (Create Invoice) → send `url` to the buyer.

**How the trigger works.** Activating the workflow makes a webhook endpoint in your Perly Pay account for the chosen events, pointing at the workflow's production URL; deactivating it deletes the endpoint. Perly Pay sends events only to an address it can reach: with a `sk_live_…` key that must be a public `https` address, so n8n has to be reachable from the internet (n8n Cloud is). Use **Listen for test event** in the editor with a `sk_test_…` key on the same terms.

Each event has a unique `id`. Perly Pay retries a delivery that is not answered for up to 72 hours, so a step that must happen once (an email, a licence) can skip an `id` it has already seen.

## Test without money

With a `sk_test_…` key, invoices are paid with test coins on test networks (Bitcoin testnet4, Base Sepolia, Sepolia…). To mark one paid without sending anything, call `POST https://pay.perly.io/api/v1/invoices/{id}/simulate` with the same key (an HTTP Request node will do): the trigger then receives `invoice.fulfilled` as it would for a real payment. See [Test mode](https://pay.perly.io/docs/test-mode).

## Security

- Every delivery is checked before it starts the workflow: its `Perly-Signature` header must be an HMAC-SHA256 of the raw body with the endpoint's signing secret, at most five minutes old, compared in constant time. A delivery that fails is answered 401 and starts nothing. One that is signed but older (a queued retry) is read back from Perly Pay by its event ID with your key, and that copy is used.
- The signing secret is kept in the workflow's static data, never in a node's output. The secret key stays in n8n's encrypted credentials and is sent only to `pay.perly.io`.
- The package has no runtime dependencies, reads no environment variables and no files.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Perly Pay API reference](https://pay.perly.io/docs/api)
- [Webhooks and events](https://pay.perly.io/docs/webhooks)
- [Quick start](https://pay.perly.io/docs/quick-start)

## Version history

- **0.1.0**: Perly Pay (Create, Get and Get Many invoices; Search customers; Create payment links) and Perly Pay Trigger.

## License

[MIT](LICENSE.md)

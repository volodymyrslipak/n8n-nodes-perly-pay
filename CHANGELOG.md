# Changelog

## 0.1.1

- Perly Pay Trigger: claims each delivery once from Perly Pay before it starts the workflow, signed or not, so a delivery posted to the webhook URL again (a replay, or an old event ID) starts nothing.

## 0.1.0

- Perly Pay node: Create, Get and Get Many invoices; Search customers; Create payment links (from an existing price, or a new one-time price). Usable as a tool by n8n's AI Agent.
- Perly Pay Trigger: starts a workflow on the Perly Pay events you choose, checking each delivery's `Perly-Signature`; makes its webhook endpoint in Perly Pay on activation and deletes it on deactivation.

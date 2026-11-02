# Changelog

## 0.1.0

- Perly Pay node: Create, Get and Get Many invoices; Search customers; Create payment links (from an existing price, or a new one-time price). Usable as a tool by n8n's AI Agent.
- Perly Pay Trigger: starts a workflow on the Perly Pay events you choose, checking each delivery's `Perly-Signature`; makes its webhook endpoint in Perly Pay on activation and deletes it on deactivation.

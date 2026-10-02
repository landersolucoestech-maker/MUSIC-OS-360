# AI runtime

Scope: the AI features of the product (agents, skills, workflows, automations, prompts, context, memory,
retrieval) and the agents that engineer and review them (domain `ai-engineering`). The policies are
`.claude/policies/ai-runtime.json` and `.claude/policies/ai-tools.json`.

- **Trust boundary.** Documents, emails, web pages, retrieved text, user text, provider payloads and transcripts
  are untrusted data. They are delimited in prompts and can never change instructions, permissions or approvals
  or authorize a tool call.
- **Model output is a proposal.** It is validated for structure, enums, ranges and referenced ids before it is
  stored or acted on; amounts, percentages, check digits and legal or financial statements are computed by
  deterministic code, not accepted from the model (`structured-output-validation`).
- **Tools.** Unknown tools are denied; arguments are validated on the server and scoped to the tenant; each tool
  has an approval class (`tool-policy-validation`). An agent never holds a tool above its ceiling.
- **Providers.** Only providers the repository already supports; no provider is added without owner
  authorization; secrets come from the validated environment schema.
- **Memory and context.** Bounded, sourced, expirable and per tenant; memory is never authority; context
  carries only the fields a feature needs, labeled by source and date.
- **Evaluation.** A prompt, model or context change needs an evaluation run compared with its baseline
  (`ai-evaluation`, `ai-regression-audit`).

Agents: 27 in `ai-engineering` (see [agents-map.md](./agents-map.md)); skills: the 22 `ai-*` skills and
`structured-output-validation`, `tool-policy-validation`, `human-approval-validation`.

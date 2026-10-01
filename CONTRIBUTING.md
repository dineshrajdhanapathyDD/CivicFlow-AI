# Contributing to CivicFlow AI

Thanks for your interest in contributing. CivicFlow AI is a multimodal community
issue-to-action platform on AWS. This guide covers how to set up the project, the
conventions we follow, and how to propose changes.

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).

## Ways to contribute

- Report bugs or suggest features via GitHub Issues.
- Improve documentation (anything under `docs/`).
- Submit code changes via pull requests (bug fixes, tests, features).
- Improve accessibility, performance, or developer experience.

## Project layout

```
/infra          AWS CDK app (TypeScript) — all infrastructure
/backend        Node.js/TypeScript Lambda — API, AI pipeline, clustering, seed
/backend-agent  Python Lambda — AWS Strands Agents SDK (Ask CivicFlow)
/frontend       React + Vite + TypeScript + Tailwind SPA
/docs           Architecture, API, pipeline, deployment, demo, submission, diagrams
/.kiro/specs    Spec-driven requirements, design, and tasks
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.12+ (for the Strands agent)
- AWS CDK v2 and an AWS account (only needed to deploy)
- Docker (only needed for the Python Lambda bundle during deploy)

## Local setup

```bash
# Backend (API + AI pipeline)
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Infra (CDK)
cd ../infra && npm install

# Agent (Python)
cd ../backend-agent && pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill values as needed. Never commit real secrets.

## Running checks

Run these before opening a pull request:

```bash
# Backend: type-check + unit tests
cd backend && npx tsc -p tsconfig.json --noEmit && npm test

# Frontend: build + unit tests
cd ../frontend && npm run build && npm test

# Infra: synth must succeed
cd ../infra && npx cdk synth --quiet
```

All of the above should pass. Add or update tests for any behavior you change.

## Coding conventions

- **TypeScript:** strict mode. Keep shared types/schemas in `backend/src/shared`. Validate
  all external input with zod. Never expose internal AWS errors to API clients.
- **Python (agent):** keep tools deterministic and read-only; the agent must never invent
  data. Add a clear docstring to every `@tool` — the model reads it.
- **Infra:** least-privilege IAM. No hard-coded account ids or secrets. Prefer CDK
  constructs over manual resources.
- **Frontend:** follow the existing design language (trust-first, single locked accent,
  accessible contrast, loading/empty/error states). See `.kiro/skills/taste-skill`.
- **Security:** no credentials in code or commits; validate uploads (type + size);
  sanitize user content; keep CloudWatch logging free of sensitive data.
- **AI:** keep observed evidence separate from interpretation; handle malformed model
  output gracefully (validate, repair, or fall back) — the app must never crash on a bad
  AI response.

## Commit and pull request guidelines

- Use clear, present-tense commit messages (e.g. "Add location filter to issues list").
- Keep PRs focused; one logical change per PR.
- In the PR description, include: what changed, why, how you tested it, and any follow-ups.
- Reference related issues (e.g. "Closes #12").
- Do not commit build output, `node_modules`, `cdk.out`, or `.env` files (see `.gitignore`).

## Reporting a bug

Open an issue with:
- What you expected vs. what happened
- Steps to reproduce
- Environment (OS, Node/Python versions)
- Relevant logs (redact any secrets)

## Security issues

Please do not open a public issue for security vulnerabilities. Instead, contact the
maintainer privately so the issue can be addressed before disclosure.

## Code of conduct

Be respectful and constructive. We want CivicFlow to be a welcoming project for
contributors of all backgrounds and experience levels.

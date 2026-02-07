# Creator AI Hub v2

Monorepo for Creator AI Hub with Next.js frontend and Fastify backend.

## Project Structure

```
creator-ai-hub-v2/
├── backend/          # Fastify API server
│   ├── src/
│   └── tests/
├── frontend/         # Next.js application
│   ├── src/
│   └── tests/
├── infra/           # Infrastructure configuration
├── docs/            # Documentation
├── .github/         # GitHub Actions workflows
└── .devcontainer/   # Dev container configuration
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 10+

### Installation

```bash
# Install dependencies for all workspaces
npm install
```

### Development

```bash
# Start both backend and frontend dev servers
npm run dev
```

This will start:
- Backend: Placeholder (to be implemented in Phase 2)
- Frontend: Placeholder (to be implemented in Phase 3)

## Commands

- `npm run dev` - Start development servers for backend and frontend
- `npm test` - Run tests across all workspaces
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run linters

## AI Development

This repo uses AI-assisted development workflows:
1. Copy `ai/` into any repo
2. In Copilot Chat, start with: "Read ai/rules.md and follow it. Then follow ai/workflows.md."

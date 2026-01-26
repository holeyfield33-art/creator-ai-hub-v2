# AI Rules (Always Follow)

## Non-negotiables
- No new features unless explicitly requested.
- Prefer the smallest change that fixes the issue.
- Never change APIs, DB schemas, or auth flows "just because".
- No hardcoded secrets. Never commit .env files.

## Coding Standards
- TypeScript strict mindset: validate inputs, handle errors, no any unless unavoidable.
- Keep files small and cohesive. If a file grows too large, refactor.
- Prefer pure functions. Avoid hidden global state.
- Add logging only when it helps debug, remove noisy logs after fix.

## Git Workflow
- main is deployable.
- work on feature branches: feature/<short-name>
- commit messages:
  - feat: ...
  - fix: ...
  - chore: ...
  - docs: ...
- Every PR must include:
  - what changed
  - how to test
  - risks/rollbacks

## Testing
- Add/adjust tests for anything non-trivial.
- If tests are too hard right now, write a minimal smoke test or a script to validate the behavior.

# Workflows

## /plan
1) Restate the goal in one sentence.
2) List files to touch.
3) List steps to implement.
4) List test plan.
5) List rollback plan.

## /build-fix
1) Reproduce error.
2) Identify failing file/line.
3) Add targeted logs (temporary).
4) Make smallest fix.
5) Add test or validation script.
6) Re-run build + tests.

## /verify
- Run typecheck
- Run unit tests
- Run lint (if configured)
- Run minimal manual smoke steps

# Project Scaffolding Plan: Creator AI Hub v2

## Goal
Scaffold a monorepo with Next.js frontend, Fastify backend, and Prisma/Postgres database following AI rules and Creator AI Hub specifications.

---

## Files to Create

### Root Configuration
- `/package.json` - Update with workspaces configuration
- `/tsconfig.json` - Root TypeScript config
- `/.gitignore` - Add node_modules, .env, dist, .next, etc.
- `/.env.example` - Template for environment variables
- `/docker-compose.yml` - Postgres container for local dev
- `/turbo.json` - Turborepo configuration (optional, for monorepo builds)

### Backend (`/backend`)
- `/backend/package.json` - Fastify + Prisma dependencies
- `/backend/tsconfig.json` - Backend-specific TS config
- `/backend/src/index.ts` - Fastify server entry point
- `/backend/src/routes/index.ts` - Route registration
- `/backend/src/routes/health.ts` - Health check endpoint
- `/backend/src/config/env.ts` - Environment variable validation
- `/backend/src/utils/logger.ts` - Structured logging
- `/backend/prisma/schema.prisma` - Database schema
- `/backend/.env.example` - Backend environment template
- `/backend/README.md` - Backend setup instructions

### Frontend (`/frontend`)
- `/frontend/package.json` - Next.js dependencies
- `/frontend/tsconfig.json` - Frontend-specific TS config
- `/frontend/next.config.js` - Next.js configuration
- `/frontend/src/app/layout.tsx` - Root layout
- `/frontend/src/app/page.tsx` - Home page
- `/frontend/src/lib/api.ts` - Backend API client
- `/frontend/.env.local.example` - Frontend environment template
- `/frontend/README.md` - Frontend setup instructions

### Documentation
- `/docs/architecture.md` - System architecture overview
- `/docs/api.md` - API documentation template
- `/docs/database.md` - Database schema documentation

---

## Implementation Steps

### Phase 1: Repository Structure
1. Update root `package.json` with npm workspaces (`backend`, `frontend`)
2. Create `.gitignore` with comprehensive exclusions
3. Create `.env.example` with all required variables
4. Create `docker-compose.yml` for Postgres

### Phase 2: Backend Scaffolding
1. Create `/backend` directory structure
2. Initialize backend `package.json` with dependencies:
   - `fastify` - Web framework
   - `@fastify/cors` - CORS support
   - `@fastify/helmet` - Security headers
   - `@prisma/client` - Database ORM
   - `zod` - Runtime validation
   - `pino` - Logging
   - Dev: `prisma`, `tsx`, `@types/node`
3. Create TypeScript configuration (strict mode)
4. Implement Fastify server with:
   - Environment validation
   - CORS configuration
   - Error handling
   - Structured logging
   - Health check endpoint
5. Initialize Prisma with basic schema
6. Create npm scripts: `dev`, `build`, `start`, `prisma:migrate`, `prisma:generate`

### Phase 3: Frontend Scaffolding
1. Create `/frontend` directory structure
2. Initialize Next.js with App Router
3. Setup `package.json` with dependencies:
   - `next`, `react`, `react-dom`
   - `typescript`, `@types/react`, `@types/node`
   - Optional: `tailwindcss` for styling
4. Create TypeScript configuration
5. Implement basic pages:
   - Root layout with metadata
   - Home page with health check
6. Create API client utility for backend communication
7. Create npm scripts: `dev`, `build`, `start`, `lint`

### Phase 4: Integration & Documentation
1. Add root-level npm scripts:
   - `dev` - Start both backend and frontend
   - `build` - Build both projects
   - `test` - Run all tests
   - `typecheck` - Run TypeScript checks
   - `lint` - Run linters
2. Create `docker-compose.yml` for local Postgres
3. Document architecture in `/docs/architecture.md`
4. Create API documentation template
5. Document database schema

### Phase 5: Validation Setup
1. Add minimal smoke tests for backend
2. Add minimal smoke tests for frontend
3. Create validation script to verify setup
4. Document local development workflow

---

## Test Plan

### Backend Tests
1. **Health Check**: `curl http://localhost:3001/health` returns `{"status":"ok"}`
2. **TypeScript**: `cd backend && npm run typecheck` passes
3. **Build**: `cd backend && npm run build` succeeds
4. **Prisma**: `cd backend && npm run prisma:generate` succeeds
5. **Environment**: Server fails gracefully with missing env vars

### Frontend Tests
1. **Dev Server**: `cd frontend && npm run dev` starts successfully
2. **Build**: `cd frontend && npm run build` succeeds
3. **TypeScript**: `cd frontend && npm run typecheck` passes
4. **Lint**: `cd frontend && npm run lint` passes
5. **Page Load**: Navigate to `http://localhost:3000` renders home page

### Integration Tests
1. **Database**: Docker Compose starts Postgres successfully
2. **API Connection**: Frontend can call backend health endpoint
3. **Workspaces**: Root `npm install` installs all dependencies
4. **Scripts**: Root `npm run dev` starts both services

### Validation Script
Create `/scripts/validate-setup.sh`:
- Check all required files exist
- Verify npm workspaces configuration
- Verify environment files are not committed
- Run typecheck on both projects
- Verify Docker Compose configuration

---

## Rollback Plan

### If scaffolding fails at any phase:
1. **Phase 1 failure**: Delete root configuration files, restore original `package.json`
2. **Phase 2 failure**: Delete `/backend` directory entirely
3. **Phase 3 failure**: Delete `/frontend` directory entirely
4. **Phase 4/5 failure**: Remove documentation files, keep core scaffolding

### Git Strategy:
- All work done on `feature/scaffold-monorepo` branch
- Each phase committed separately with clear messages
- Can cherry-pick working phases if needed
- Main branch remains unchanged until PR approval

### Verification Before Merge:
- All tests pass
- Both services start successfully
- Documentation is complete
- No secrets committed
- `.gitignore` properly configured

---

## Environment Variables Required

### Backend (`.env`)
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/creator_hub
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Docker (used in `docker-compose.yml`)
```
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=creator_hub
```

---

## Success Criteria

✅ Monorepo structure with npm workspaces
✅ Backend Fastify server running on port 3001
✅ Frontend Next.js app running on port 3000
✅ Postgres database running via Docker Compose
✅ TypeScript strict mode enabled everywhere
✅ All builds pass without errors
✅ Health check endpoint functional
✅ API client can communicate with backend
✅ No hardcoded secrets or committed .env files
✅ Documentation explains architecture and setup
✅ Follows all AI rules from `ai/rules.md`

---

## Next Steps After Plan Approval
1. Create feature branch: `feature/scaffold-monorepo`
2. Implement Phase 1
3. Commit with message: `chore: setup monorepo structure`
4. Continue through phases sequentially
5. Run validation script
6. Create PR to develop branch

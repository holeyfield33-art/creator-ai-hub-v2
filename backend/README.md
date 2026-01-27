# Creator AI Hub - Backend

Fastify API server with Prisma and PostgreSQL.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database

Copy `.env.example` to `.env` and update the `DATABASE_URL`:

```bash
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:

```
DATABASE_URL="postgresql://username:password@localhost:5432/creator_ai_hub?schema=public"
```

**Important:** Replace `username`, `password`, `localhost`, and `5432` with your actual PostgreSQL credentials and connection details.

### 3. Run Database Migrations

```bash
npx prisma migrate dev
```

This will:
- Create the database if it doesn't exist
- Run all migrations
- Generate the Prisma Client

### 4. Generate Prisma Client

If you need to regenerate the client manually:

```bash
npx prisma generate
```

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will start on http://localhost:3001

## API Endpoints

- `GET /health` - Health check endpoint

## Database Schema

The application uses the following models:

- **User** - User accounts
- **Campaign** - Marketing campaigns
- **CampaignSource** - Content sources for campaigns
- **CampaignAnalysis** - AI analysis results
- **GeneratedAsset** - AI-generated content assets
- **Job** - Background job queue

## Prisma Commands

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

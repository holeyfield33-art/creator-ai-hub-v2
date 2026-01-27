# Railway Configuration

## Backend Service

### Environment Variables

```env
DATABASE_URL=postgresql://postgres.ynrlnviwvukuvtqbcsyi:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.ynrlnviwvukuvtqbcsyi:password@aws-1-us-east-2.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://ynrlnviwvukuvtqbcsyi.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_API_KEY=sk-your-openai-api-key
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
PORT=$PORT
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
X_CLIENT_ID=your-twitter-client-id
X_CLIENT_SECRET=your-twitter-client-secret
X_CALLBACK_URL=https://your-backend.up.railway.app/api/social/x/callback
```

### Settings

- **Root Directory**: `backend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Watch Paths**: `backend/**`

### Worker Service (Optional - separate service)

Same environment variables, but:
- **Start Command**: `npm run start:worker`

## Render Configuration

### Web Service

- **Environment**: Node
- **Build Command**: `cd backend && npm install && npm run build`
- **Start Command**: `cd backend && npm run start`
- **Environment Variables**: Same as Railway above

### Background Worker (Optional)

- **Type**: Background Worker
- **Build Command**: `cd backend && npm install && npm run build`
- **Start Command**: `cd backend && npm run start:worker`

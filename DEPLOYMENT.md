# Deployment Guide

## Supabase Configuration

### Authentication URLs

#### Local Development
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**:
  - `http://localhost:3000/login`
  - `http://localhost:3000/app/dashboard`

#### Production (Vercel)
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**:
  - `https://your-app.vercel.app/login`
  - `https://your-app.vercel.app/app/*`

### Steps to Configure in Supabase Dashboard

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL
3. Click **Add URL** under **Redirect URLs** and add:
   - `http://localhost:3000/*` (for development)
   - `https://your-app.vercel.app/*` (for production)
4. Click **Save changes**

## Environment Variables

### Frontend (Vercel)

Set these in Vercel Dashboard → Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ynrlnviwvukuvtqbcsyi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Backend (Railway/Render)

```env
DATABASE_URL=postgresql://postgres.ynrlnviwvukuvtqbcsyi:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.ynrlnviwvukuvtqbcsyi:password@aws-1-us-east-2.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://ynrlnviwvukuvtqbcsyi.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_API_KEY=sk-your-openai-api-key
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
X_CLIENT_ID=your-twitter-client-id
X_CLIENT_SECRET=your-twitter-client-secret
X_CALLBACK_URL=https://your-backend.railway.app/api/social/x/callback
```

## OpenAI API Setup

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add to backend environment variables as `AI_API_KEY`
4. Update `AI_MODEL` to use `gpt-4o-mini` or `gpt-4o` for production

## Vercel Deployment

### Option 1: Deploy from GitHub

1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Set framework preset to **Next.js**
5. Set root directory to `frontend`
6. Add environment variables
7. Click **Deploy**

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_API_URL production
```

## Backend Deployment (Railway)

### Option 1: Deploy from GitHub

1. Go to https://railway.app/new
2. Select **Deploy from GitHub repo**
3. Choose your repository
4. Set root directory to `backend`
5. Add all environment variables
6. Click **Deploy**

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd backend
railway init

# Add environment variables
railway variables set DATABASE_URL=...
railway variables set AI_API_KEY=...
# ... add all other variables

# Deploy
railway up
```

## Post-Deployment Checklist

- [ ] Update Supabase Site URL to production domain
- [ ] Add production redirect URLs to Supabase
- [ ] Set all environment variables in Vercel
- [ ] Set all environment variables in Railway
- [ ] Test authentication flow
- [ ] Test API endpoints
- [ ] Run database migrations
- [ ] Test social media OAuth
- [ ] Monitor error logs

## Database Migrations

After deploying backend:

```bash
# SSH into backend or use Railway CLI
cd backend
npx prisma migrate deploy
```

## Custom Domains

### Vercel (Frontend)
1. Go to your project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Railway (Backend)
1. Go to your service → Settings → Networking
2. Generate domain or add custom domain
3. Update `NEXT_PUBLIC_API_URL` in Vercel to use this domain

## Monitoring

- **Frontend**: Check Vercel Analytics and Runtime Logs
- **Backend**: Check Railway logs and metrics
- **Database**: Monitor Supabase dashboard for queries and performance

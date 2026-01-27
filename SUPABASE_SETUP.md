# Supabase Authentication Setup

## Current Configuration Needed

Based on your screenshot, update these settings in the Supabase Dashboard:

### Navigation
Go to: **Authentication** → **URL Configuration**

---

## 1. Site URL

### Development
```
http://localhost:3000
```

### Production (after Vercel deployment)
```
https://your-app.vercel.app
```

💡 **Tip**: Update this after deploying to Vercel with your actual domain

---

## 2. Redirect URLs

Click **"Add URL"** and add these one by one:

### For Local Development
```
http://localhost:3000/*
http://localhost:3000/app/*
http://localhost:3000/app/dashboard
http://localhost:3000/login
```

### For Production (Vercel)
```
https://your-app.vercel.app/*
https://your-app.vercel.app/app/*
https://your-app.vercel.app/app/dashboard
https://your-app.vercel.app/login
```

### For Social OAuth (Twitter/X)
```
http://localhost:3001/api/social/x/callback
https://your-backend.railway.app/api/social/x/callback
```

---

## 3. Click "Save changes"

After adding all URLs, click the green **"Save changes"** button at the top right.

---

## Testing Checklist

After configuration:

- [ ] Test local login at `http://localhost:3000/login`
- [ ] Verify redirect to dashboard after login
- [ ] Test logout functionality
- [ ] Check session persistence on page reload

---

## Current Status

✅ **Backend configured**: Environment variables set  
✅ **Frontend configured**: Supabase client initialized  
⚠️ **Supabase URLs**: Need to be added in dashboard (per screenshot)

---

## Next Steps

1. **Add the redirect URLs above to your Supabase dashboard**
2. **Get OpenAI API key**: https://platform.openai.com/api-keys
   - Update `AI_API_KEY` in `backend/.env`
3. **Deploy to Vercel** (see DEPLOYMENT.md)
4. **Update production URLs** in Supabase after deployment

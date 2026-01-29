# Source Content Upload Setup

## Overview
This feature enables users to upload video files as campaign source content. After upload, the backend creates a stub analysis that unlocks the "Generate Assets" functionality.

## Environment Variables

### Frontend (.env.local)
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration  
NEXT_PUBLIC_API_URL=http://localhost:3001

# UploadThing Configuration (Sign up at https://uploadthing.com)
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=your-app-id
```

### Backend (.env)
No additional variables required for this feature. Backend already has:
```bash
DATABASE_URL=...
DIRECT_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Setup Instructions

### 1. UploadThing Setup
1. Go to https://uploadthing.com and create an account
2. Create a new app
3. Copy your App ID and Secret Key
4. Add them to frontend/.env.local as shown above

### 2. Install Dependencies
```bash
cd frontend
npm install
```

### 3. Start Development Servers
```bash
# Terminal 1 - Backend (from repo root)
cd backend
npm run dev

# Terminal 2 - Frontend (from repo root)
cd frontend
npm run dev
```

## Testing the Feature

1. **Login**: Go to http://localhost:3000/login
2. **Create Campaign**: Click "New Campaign", enter name and description
3. **Upload Video**: 
   - Click into the campaign
   - In the "Source Content" section, drag & drop a video file or click to browse
   - Supported formats: MP4, MOV, WEBM (max 512MB)
   - Wait for upload to complete
4. **Verify Upload**:
   - Source content section should show "1 uploaded"
   - Stub analysis should appear with summary and key points
   - Campaign status should change to "ready"
5. **Generate Assets**:
   - "Generate Assets" section should now be enabled
   - Select channels and click "Generate Assets"

## API Endpoints

### POST /api/campaigns/:id/sources
Registers an uploaded video source and creates stub analysis.

**Request Body:**
```json
{
  "sourceType": "video",
  "sourceUrl": "https://uploadthing.com/...",
  "fileName": "my-video.mp4",
  "mimeType": "video/mp4",
  "size": 12345678
}
```

**Response:**
```json
{
  "source": { /* CampaignSource object */ },
  "analysis": { /* CampaignAnalysis object */ },
  "campaign": { "status": "ready" }
}
```

## Troubleshooting

### "Upload failed" error
- Check that UPLOADTHING_SECRET and UPLOADTHING_APP_ID are set in .env.local
- Verify the file is under 512MB
- Check browser console for detailed error messages

### "Failed to register source" error
- Ensure backend is running on port 3001
- Check that NEXT_PUBLIC_API_URL is set correctly
- Verify you're logged in (check Supabase auth)

### "Network error / Unable to reach server"
- Backend must be running on http://localhost:3001
- Frontend must be running on http://localhost:3000
- Check that NEXT_PUBLIC_API_URL uses 'http://localhost:3001' (not 'http://localhost:3000')

## Architecture Notes

### File Upload Flow
1. User selects video file in UI
2. UploadThing uploads file directly to their CDN
3. UploadThing returns file URL
4. Frontend calls `/api/campaigns/:id/sources` with the URL
5. Backend creates CampaignSource record
6. Backend creates stub CampaignAnalysis (placeholder for future AI)
7. Backend updates Campaign status to "ready"
8. Frontend reloads campaign data
9. UI shows uploaded source and unlocks Generate Assets

### Why Two Upload Mechanisms?
- **uploadCampaignSource** (original): For text content, handles job creation
- **registerCampaignSource** (new): For video files uploaded via UploadThing

### Stub Analysis
Currently creates placeholder analysis data to unblock the UI flow:
```javascript
{
  summary: "Video content uploaded and ready for processing...",
  key_points: ["Video file successfully uploaded", ...],
  hooks: ["Engaging video content detected", ...]
}
```

This will be replaced with real AI video analysis in a future phase.

## Next Steps / TODOs
- [ ] Add real video transcription (Whisper API or similar)
- [ ] Replace stub analysis with actual AI analysis
- [ ] Add progress indicator during backend processing
- [ ] Support batch video uploads
- [ ] Add video preview/thumbnail
- [ ] Implement video editing/trimming

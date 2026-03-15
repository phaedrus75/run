# Deployment Guide

---

## CRITICAL: Vercel Project Mapping

| Vercel Project | Domain         | Content           |
|----------------|----------------|-------------------|
| `run`          | **zenrun.co**  | ZenRun website    |
| `website`      | endura.eco     | Endura website    |
| `web`          | live2read.co   | Live2Read website |

**NEVER deploy ZenRun changes to the `website` project. Always use the `run` project.**

To deploy the ZenRun website:
```bash
cd /Users/munshi/Downloads/Run
vercel link --project run --yes   # only needed once, or if .vercel/project.json is wrong
vercel --prod --yes               # deploy from project root (root dir setting = "website")
```

The `run` project has its root directory set to `website/` in Vercel settings,
so you must run `vercel` from the project root (`/Users/munshi/Downloads/Run`), not from `website/`.

---

## Overview

You'll need to deploy two things:
1. **Backend** (Python API) → Railway (project: `positive-clarity`)
2. **Frontend** (React Native App) → Expo EAS
3. **Website** (Next.js) → Vercel (project: `run`, domain: zenrun.co)

---

## Part 1: Deploy the Backend

### Option A: Railway (Recommended for Beginners)

Railway is super easy and has a generous free tier.

#### Step 1: Create a Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

#### Step 2: Prepare Your Backend
Create a `Procfile` in the backend folder:

```bash
cd backend
echo "web: uvicorn main:app --host 0.0.0.0 --port \$PORT" > Procfile
```

Update `database.py` to use PostgreSQL in production:

```python
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./zenrun.db")

# Railway uses postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
```

Update `requirements.txt` to add PostgreSQL support:
```
psycopg2-binary==2.9.9
```

#### Step 3: Deploy
1. Push your code to GitHub
2. In Railway, click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repo and the `backend` folder
5. Railway auto-detects Python and deploys!

#### Step 4: Add PostgreSQL
1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway automatically connects it!

Your API will be live at: `https://your-app.railway.app`

---

### Option B: Render

Render is another excellent free option.

#### Step 1: Create a Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

#### Step 2: Create a Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub repo
3. Configure:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

#### Step 3: Add PostgreSQL
1. Click "New" → "PostgreSQL"
2. Copy the Internal Database URL
3. Add as environment variable: `DATABASE_URL`

---

## 📱 Part 2: Deploy the Frontend

### Using Expo EAS (Recommended)

Expo EAS builds your app for iOS and Android.

#### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

#### Step 2: Login to Expo
```bash
eas login
```

#### Step 3: Configure Your App
```bash
cd frontend
eas build:configure
```

#### Step 4: Update API URL
In `services/api.ts`, change the API URL to your deployed backend:

```typescript
const API_BASE_URL = 'https://your-app.railway.app';
```

#### Step 5: Build for iOS/Android

**Development Build (for testing):**
```bash
eas build --profile development --platform all
```

**Production Build:**
```bash
eas build --profile production --platform all
```

#### Step 6: Submit to App Stores (Optional)
```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

---

## 🔧 Environment Variables

### Backend (Railway/Render)
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway |
| `SECRET_KEY` | For future auth features | Generate a random string |

### Frontend
| Variable | Description |
|----------|-------------|
| `API_BASE_URL` | Your deployed backend URL |

---

## 🧪 Testing Your Deployment

1. **Test the API**: Visit `https://your-backend-url/docs`
2. **Test the App**: Download from Expo, scan QR code

---

## 💰 Cost Breakdown

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Railway | 500 hours/month | Plenty for hobby projects |
| Render | 750 hours/month | Spins down after inactivity |
| Expo EAS | 30 builds/month | More than enough |
| PostgreSQL | 1GB storage | Included free |

**Total Cost: $0/month** for a hobby project! 🎉

---

## 🆘 Troubleshooting

### "API not responding"
- Check if the backend is deployed and running
- Verify the API URL in the frontend
- Check Railway/Render logs for errors

### "Database errors"
- Make sure PostgreSQL addon is attached
- Check DATABASE_URL environment variable

### "Build failed"
- Check the build logs in EAS dashboard
- Make sure all dependencies are listed in package.json

---

## Part 3: Deploy the Website

The ZenRun website is a Next.js static export hosted on Vercel.

### Deploy
```bash
cd /Users/munshi/Downloads/Run
vercel link --project run --yes   # if not already linked
vercel --prod --yes
```

Confirm the output shows `Aliased: https://zenrun.co` — NOT endura.eco.

### Rollback
```bash
vercel ls --scope phaedrus75s-projects website   # for endura
vercel ls --scope phaedrus75s-projects run        # for zenrun
vercel promote <deployment-url> --yes
```

---

## Railway Backend Deployment

```bash
cd /Users/munshi/Downloads/Run
railway link --project "positive-clarity"
railway service Run
railway up
railway logs
```

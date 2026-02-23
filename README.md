# 🏃 ZenRun - Your Personal Running Companion

A mobile app to plan, track, and celebrate your runs!

## 🎯 What You'll Learn

This project teaches you:
- **Python**: Backend development with FastAPI (modern, fast, easy to learn)
- **React Native**: Mobile app development with Expo
- **SQL**: Database design and queries with SQLite

---

## 📁 Project Structure

```
Run/
├── backend/                 # Python API server
│   ├── main.py             # Entry point - start here!
│   ├── database.py         # Database connection & setup
│   ├── models.py           # Data models (what our data looks like)
│   ├── schemas.py          # API schemas (what we send/receive)
│   ├── crud.py             # Create, Read, Update, Delete operations
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # React Native mobile app
│   ├── App.tsx            # Main app component
│   ├── screens/           # App screens (pages)
│   ├── components/        # Reusable UI pieces
│   ├── services/          # API calls
│   └── package.json       # JavaScript dependencies
│
└── README.md              # You are here!
```

---

## 🚀 Quick Start

### Step 1: Start the Backend

```bash
# Navigate to backend folder
cd backend

# Create a virtual environment (keeps dependencies isolated)
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server!
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit http://localhost:8000/docs to see your API documentation!

### Step 2: Start the Frontend

```bash
# In a new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Start the app
npx expo start
```

Scan the QR code with Expo Go app on your phone!

---

## 📚 Learning Path

### Week 1: Understand the Backend
1. Read `backend/main.py` - understand how APIs work
2. Read `backend/models.py` - learn about databases
3. Try the API at http://localhost:8000/docs

### Week 2: Understand the Frontend
1. Read `frontend/App.tsx` - the app entry point
2. Explore `frontend/screens/` - each screen is a page
3. Look at `frontend/components/` - reusable pieces

### Week 3: Make Changes!
1. Add a new run type (25k?)
2. Change colors or fonts
3. Add a new motivational quote

---

## 🌐 Deployment Options

| Platform | Backend | Frontend | Difficulty | Cost |
|----------|---------|----------|------------|------|
| **Railway** | ✅ Python | ❌ | Easy | Free tier |
| **Render** | ✅ Python | ❌ | Easy | Free tier |
| **Expo EAS** | ❌ | ✅ React Native | Easy | Free tier |
| **Vercel** | ✅ (with adapter) | ❌ | Medium | Free tier |

**Recommended Setup:**
- Backend: **Railway** or **Render** (free Python hosting)
- Frontend: **Expo EAS** (builds your app for iOS/Android)

See `DEPLOYMENT.md` for step-by-step instructions!

---

## 💡 Key Concepts Explained

### What is an API?
Think of it like a waiter at a restaurant. You (the app) ask for something, the waiter (API) goes to the kitchen (database), and brings back your food (data).

### What is React Native?
Write JavaScript/TypeScript once, run on both iPhone and Android!

### What is FastAPI?
A modern Python framework for building APIs. It's fast to write and fast to run.

---

## 🎨 App Features

- ⏱️ **Run Timer**: Tap to start, tap to stop
- 📊 **Statistics**: See your weekly/monthly progress
- 🎯 **Planning**: Set your weekly run goals
- 🎉 **Motivation**: Encouraging messages and celebrations

Happy Running! 🏃‍♀️🏃‍♂️

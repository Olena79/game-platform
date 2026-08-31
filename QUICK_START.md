# Quick Start Guide — Games of Senses

**Goal**: Get the development environment running in 10 minutes.

---

## 🎯 Prerequisites

- ✅ Node.js 18+ (verify: `node -v`)
- ✅ npm or yarn (verify: `npm -v`)
- ✅ Git (verify: `git -v`)
- ✅ MongoDB Atlas account (free tier ok) or local MongoDB running

---

## 📦 Step 1: Clone & Install (2 minutes)

```bash
# Clone repo
git clone <repository-url>
cd game-platform

# Install backend
cd back
npm install

# Install frontend (in new terminal window)
cd front
npm install
```

---

## 🔑 Step 2: Environment Variables (3 minutes)

### Backend Setup
```bash
cd back
cp .env.example .env
```

Edit `back/.env`:
```bash
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://testuser:testpass@cluster0.xxxxx.mongodb.net/game?retryWrites=true
JWT_SECRET=your-secret-key-min-32-chars-long-here-abc123xyz
CLIENT_URL=http://localhost:3000
EMAIL_ENABLED=false
LIVEKIT_URL=https://your-livekit.example.com
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
```

**For local MongoDB** (instead of Atlas):
```bash
# If MongoDB running locally on default port
MONGO_URI=mongodb://localhost:27017/game
```

### Frontend Setup
```bash
cd front
cp .env.example .env
```

Edit `front/.env`:
```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
VITE_API_URL=http://localhost:5000
```

---

## 🚀 Step 3: Start Development Servers (3 minutes)

### Terminal 1 — Backend
```bash
cd back
npm run dev
```

Expected output:
```
Server running on http://localhost:5000
MongoDB connected
```

### Terminal 2 — Frontend
```bash
cd front
npm run dev
```

Expected output:
```
  VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## ✅ Step 4: Verify It Works (2 minutes)

1. Open browser: **http://localhost:5173**
2. See home page with "Games of Senses" title
3. Try login/register (or skip with Google OAuth if configured)
4. Click "Create Game" or browse "Our Games"

**Backend check**: Open http://localhost:5000 → see `{ status: 'ok' }`

---

## 🛠️ Common Development Tasks

### Add a new API endpoint
```bash
# 1. Create handler in back/src/routes/newFeature.ts
# 2. Mount route in back/src/app.ts:
#    app.use('/api/newFeature', newFeatureRoutes)
# 3. Restart backend (auto-restarts with nodemon)
```

### Add a new React page
```bash
# 1. Create component: front/src/components/pages/NewPage.tsx
# 2. Add route in front/src/App.tsx
# 3. Add link in front/src/components/layout/Header.tsx
# 4. Frontend auto-reloads with Vite HMR
```

### View Socket.IO events
```bash
# Browser DevTools → Console:
socket.on('*', (event, data) => console.log('Socket event:', event, data))
```

### Check database
```bash
# MongoDB Atlas dashboard: https://cloud.mongodb.com
# Find your cluster → Collections tab → browse data
```

---

## 🐛 Troubleshooting

### "Cannot find module 'express'"
```bash
cd back
npm install
npm run dev
```

### "Port 5000 already in use"
```bash
# Change PORT in back/.env or kill process:
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows
```

### "MongoDB connection failed"
- Check `MONGO_URI` in `.env`
- Verify IP address is whitelisted in MongoDB Atlas
- Test: `ping cluster0.xxxxx.mongodb.net`

### "VITE_GOOGLE_CLIENT_ID not working"
- Verify env var in `front/.env` (not `.env.example`)
- Check variable name: must start with `VITE_`
- Restart Vite dev server after changing

### Socket.IO not connecting
- Check browser DevTools → Network → WS tab
- Verify `VITE_API_URL` points to correct backend URL
- Ensure backend is running on port 5000

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Project overview, setup, deployment |
| [CLAUDE.md](CLAUDE.md) | Complete project context for Claude (database schema, API routes, Socket.IO events) |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | Security audit, issues found, deployment checklist |
| [QUICK_START.md](QUICK_START.md) | This file — get running in 10 minutes |

---

## 🎮 Try This First

After startup, test the app end-to-end:

1. **Go to home page**: http://localhost:3000
2. **Sign up**: Register with email (or Google)
3. **Create a game**: Click "Create Game" button
4. **Share room code**: Copy URL and open in another browser window
5. **Chat together**: Send messages in game room
6. **Try reactions**: Send emoji reactions
7. **View community**: Check feed on Community page

---

## 📞 Getting Help

- **Backend errors**: Check terminal 1 (server logs)
- **Frontend errors**: Check browser DevTools Console (F12)
- **Database errors**: Check MongoDB Atlas logs
- **Socket.IO issues**: Check Network tab in DevTools (WS filter)

---

## 🚢 When Ready to Deploy

See [README.md → Deployment](README.md#%EF%B8%8F-deployment) section.

---

**Good luck! Happy coding! 🚀**

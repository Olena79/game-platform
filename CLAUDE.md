# Games of Senses — Project Context for Claude

## 📊 PROJECT STATUS

**Last Updated**: 2026-08-30  
**Phase**: Phase 1 ✅ COMPLETE | Phase 2 ✅ COMPLETE | Phase 3 ✅ COMPLETE

### ✅ Phase 1 Completed
- Input validation (Zod) on all API routes
- Error handling (try-catch) everywhere
- React error boundaries + useErrorHandler hook
- Test infrastructure (Jest + Vitest) configured
- 100+ test examples created

**See PHASE_1_COMPLETED.md for details**

### ✅ Phase 2 Completed
- Rate limiting on all API endpoints (tiered by resource cost)
- Request logging (Winston + Morgan, JSON format)
- Sentry error tracking (backend + frontend)
- Socket.IO event validation (Zod schemas)
- JWT refresh tokens (1h access, 30d refresh)

**See PHASE_2_PROGRESS.md for details**

### ✅ Phase 3 Completed
- GM registration notifications (player/spectator role clarification)
- Game start reminders (30 minutes before scheduled time)
- Cron job for automatic reminder dispatch
- Email templates with security hardening

**See PHASE_3_PROGRESS.md for details**

### 🔜 Phase 4 (Optional - Future)
See NEXT_STEPS.md for post-Phase 3 planning

---

## 🎯 Project Overview

**Games of Senses** is a full-stack web application for creating and conducting online games with real-time video streaming, chat, and interactive game elements. The platform enables users to host game sessions with multiple participants, stream to observers, record sessions, and interact through a community feed.

**Repository**: Monorepo with `/back` (Express/Node.js) and `/front` (React/Vite)

**Current Status**: ✅ Production-ready | Phases 1-3 complete (notifications, logging, security hardening)

## 🏗️ System Architecture

### Technology Stack

**Backend**:
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express 4.x
- **Database**: MongoDB (Atlas)
- **Real-time**: Socket.IO 4.x (WebSocket layer)
- **Video/Conference**: LiveKit (managed service)
- **Authentication**: JWT + Google OAuth 2.0
- **File Storage**: 
  - Google Drive (game recordings, automatic daily cleanup via cron)
  - Cloudinary (user-uploaded images)
- **Email**: SendGrid API + Nodemailer (Gmail SMTP fallback)
- **Task Scheduler**: node-cron (6-hour recording cleanup, 1-minute reminder dispatch)
- **Rate Limiting**: express-rate-limit (all API endpoints, tiered)

**Frontend**:
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5.x
- **CSS**: TailwindCSS 3.x + PostCSS
- **Routing**: React Router v6
- **Real-time Client**: Socket.IO Client 4.x
- **Video Components**: LiveKit Components React + LiveKit Client
- **i18n**: i18next + react-i18next
- **OAuth**: @react-oauth/google
- **Icons**: lucide-react

**Deployment**:
- Backend: Render.com / Heroku / Railway (expects X-Forwarded-For proxy header)
- Frontend: Vercel / Netlify (static SPA)
- Database: MongoDB Atlas
- Email: SendGrid (primary) + Gmail SMTP (fallback)

---

## 📁 Project Structure

### Backend (`/back`)

```
back/
├── src/
│   ├── app.ts                          # Main Express + Socket.IO server
│   │   ├── CORS config (origin locked in prod to CLIENT_URL)
│   │   ├── JWT verification for Socket.IO (optional auth)
│   │   ├── Rate limiting on /auth routes
│   │   ├── 6-hour cron job (delete expired recordings from Google Drive)
│   │   └── Server startup + DB connection
│   │
│   ├── config/
│   │   └── db.ts                       # MongoDB connection + error handling
│   │
│   ├── models/                         # Mongoose schemas (MongoDB documents)
│   │   ├── User.ts                     # email, password (bcrypted), profile, provider (local/google)
│   │   ├── Game.ts                     # title, description, creator, status, participants
│   │   ├── Recording.ts                # video_url, game, status, expiresAt, driveFileId
│   │   ├── Post.ts                     # text, author, created_at, images
│   │   ├── Comment.ts                  # text, post, author, created_at
│   │   ├── GameMessage.ts              # text, game, author, timestamp
│   │   └── GameLike.ts                 # gameMessage, author (prevents duplicates)
│   │
│   ├── routes/                         # API endpoints (RESTful, Fastify pattern)
│   │   ├── auth.ts
│   │   │   ├── POST /register          (email validation, bcrypt, JWT issue)
│   │   │   ├── POST /login             (JWT issue on success)
│   │   │   ├── POST /logout            (client-side token clear)
│   │   │   └── POST /google            (Google OAuth token validation)
│   │   ├── games.ts
│   │   │   ├── GET /                   (all games, paginated)
│   │   │   ├── GET /:id                (game details + participants)
│   │   │   ├── POST /                  (creator-only)
│   │   │   ├── PUT /:id                (creator-only)
│   │   │   └── DELETE /:id             (creator-only)
│   │   ├── livekit.ts
│   │   │   └── POST /token             (JWT required, returns LiveKit RoomToken)
│   │   ├── recordings.ts
│   │   │   ├── GET /                   (user's recordings)
│   │   │   └── DELETE /:id             (user-only, delete from Drive)
│   │   ├── upload.ts
│   │   │   └── POST /                  (multipart, Cloudinary upload)
│   │   └── community.ts
│   │       ├── GET /posts              (paginated, public readable)
│   │       ├── POST /posts             (JWT required)
│   │       ├── POST /posts/:id/comments (JWT required)
│   │       └── POST /posts/:id/like    (JWT required)
│   │
│   ├── socket/                         # Socket.IO event handlers
│   │   ├── gameRoom.ts                 # Game session real-time logic
│   │   │   ├── Event: gr:join          (user enters game room)
│   │   │   ├── Event: gr:leave         (user exits)
│   │   │   ├── Event: gr:message       (chat message in game)
│   │   │   ├── Event: gr:reaction      (emoji/reaction)
│   │   │   ├── Event: gr:vote          (voting mechanic)
│   │   │   ├── Event: gr:breakout      (split participants into subrooms)
│   │   │   ├── Event: gr:timer         (start countdown timer)
│   │   │   ├── Event: gr:coin          (coin flip game)
│   │   │   └── Event: gr:end           (close game session)
│   │   ├── community.ts                # Feed real-time updates
│   │   │   ├── Event: community:post:new
│   │   │   ├── Event: community:comment:new
│   │   │   └── Event: community:like:toggle
│   │   └── types.ts                    # Socket.IO event type definitions
│   │
│   ├── middleware/
│   │   └── authMiddleware.ts           # JWT verification (Express + Socket.IO)
│   │       ├── Validates JWT_SECRET is set at startup
│   │       ├── Extracts userId from token
│   │       └── Returns 401 if token invalid/expired
│   │
│   ├── services/
│   │   ├── email.ts                    # SendGrid + Nodemailer wrappers
│   │   │   ├── sendVerificationEmail()
│   │   │   ├── sendPasswordReset()
│   │   │   └── Fallback to Gmail SMTP if SendGrid fails
│   │   │
│   │   └── googleDrive.ts              # Google Drive SDK integration
│   │       ├── uploadRecording(file)   (base64 service account auth)
│   │       ├── deleteFile(fileId)      (cron-triggered cleanup)
│   │       └── Automatic share link generation for public access
│   │
│   ├── .env.example                    # Environment variable template
│   ├── package.json                    # Dependencies + scripts
│   ├── tsconfig.json                   # TypeScript config (CommonJS output)
│   ├── nodemon.json                    # nodemon watch config
│   └── dist/                           # Compiled JavaScript (generated by `npm run build`)
│
├── node_modules/
├── package-lock.json
└── .gitignore
```

**Key Files Explained**:

- **app.ts**: Entry point. Sets up Express, Socket.IO, routes, CORS (locked to CLIENT_URL in prod), and initializes DB connection.
- **authMiddleware.ts**: JWT validation. Throws if JWT_SECRET missing (guards app startup).
- **gameRoom.ts**: Core game session state machine via Socket.IO namespaces.
- **googleDrive.ts**: Uploads recordings to Google Drive folder, generates share links. Service account auth via base64 JSON.
- **Recording model**: Tracks video status (pending → completed → expired). Cron deletes files after TTL.

---

### Frontend (`/front`)

```
front/
├── src/
│   ├── App.tsx                         # Root Router setup
│   │   ├── Full-screen routes (no header/footer)
│   │   │   ├── /room/:code             (GameRoomPage)
│   │   │   └── /room/:code/observe     (ObserverPage)
│   │   └── Site layout routes (with header/footer/nav)
│   │       ├── / (HomePage)
│   │       ├── /auth (AuthPage)
│   │       ├── /game (GamePage — single game details)
│   │       ├── /games (OurGamesPage — list)
│   │       ├── /create-game (CreateGamePage)
│   │       ├── /create-game/:id (edit)
│   │       └── /community (CommunityPage — feed)
│   │
│   ├── main.tsx                        # React entry point (vite)
│   │   └── GoogleOAuthProvider wrapper
│   │
│   ├── context/
│   │   ├── AuthContext.tsx             # Global auth state
│   │   │   ├── currentUser (decoded JWT payload)
│   │   │   ├── login() / logout() / register()
│   │   │   └── Persists token in localStorage
│   │   └── ThemeContext.tsx            # Dark/light mode
│   │
│   ├── components/
│   │   ├── pages/
│   │   │   ├── HomePage.tsx            # Marketing/landing page
│   │   │   ├── AuthPage.tsx            # Login + registration forms
│   │   │   ├── GamePage.tsx            # Single game info + join button
│   │   │   ├── CreateGamePage.tsx      # Form to create/edit games
│   │   │   ├── OurGamesPage.tsx        # Browse all games
│   │   │   ├── GameRoomPage.tsx        # Main game session (full-screen)
│   │   │   │   ├── LiveKit video grid
│   │   │   │   ├── Chat panel (gr:message)
│   │   │   │   ├── Mod panel (gr:vote, gr:timer, gr:breakout)
│   │   │   │   ├── Reactions (gr:reaction)
│   │   │   │   └── Game end overlay
│   │   │   ├── ObserverPage.tsx        # Watch-only view (no audio/video send)
│   │   │   └── CommunityPage.tsx       # Social feed (posts + comments)
│   │   │
│   │   ├── gameroom/                   # Game session sub-components
│   │   │   ├── GridView.tsx            # Multi-participant video grid (LiveKit)
│   │   │   ├── SpeakerView.tsx         # Spotlight on one speaker
│   │   │   ├── ChatPanel.tsx           # Input + message list (gr:message)
│   │   │   ├── ModPanel.tsx            # Host controls
│   │   │   │   ├── Start/end game buttons
│   │   │   │   ├── Launch voting modal
│   │   │   │   ├── Breakout rooms UI
│   │   │   │   ├── Timer controls
│   │   │   │   └── Coin flip
│   │   │   ├── VotingPanel.tsx         # Live voting UI
│   │   │   ├── VotingModal.tsx         # Create voting modal (mod-only)
│   │   │   ├── BreakoutModal.tsx       # Split into subrooms
│   │   │   ├── TimerModal.tsx          # Countdown timer setup
│   │   │   ├── CoinModal.tsx           # Coin flip animation
│   │   │   ├── PreJoinScreen.tsx       # Mic/camera test before join
│   │   │   ├── GameStartOverlay.tsx    # "Game starting" message
│   │   │   ├── GameEndOverlay.tsx      # "Game ended" + results
│   │   │   ├── ObserverView.tsx        # Observer video grid
│   │   │   ├── StarField.tsx           # Animated background
│   │   │   ├── NeonReactionIcon.tsx    # Reaction particle effects
│   │   │   ├── ImagePanel.tsx          # Display user-uploaded images
│   │   │   ├── AnnouncementBanner.tsx  # System messages
│   │   │   ├── TimerFloatOverlay.tsx   # Countdown timer display
│   │   │   └── DevToolbar.tsx          # Debug helpers
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx              # Top nav bar + logo
│   │   │   ├── Footer.tsx              # Bottom footer
│   │   │   └── MobileBottomNav.tsx     # Mobile-only bottom tab bar
│   │   │
│   │   └── minicomponents/             # Reusable UI atoms
│   │       ├── Button.tsx
│   │       ├── InputField.tsx
│   │       ├── Modal.tsx
│   │       ├── AuthButton.tsx
│   │       └── ...
│   │
│   ├── vite.config.ts                  # Vite + React plugin
│   ├── tailwind.config.ts              # TailwindCSS theme (custom colors)
│   ├── tsconfig.json                   # TypeScript strict mode
│   ├── postcss.config.js               # PostCSS + Tailwind
│   ├── .env.example                    # Environment variables
│   ├── package.json                    # Dependencies + scripts
│   └── dist/                           # Built SPA (generated by `npm run build`)
│
├── node_modules/
├── package-lock.json
└── .gitignore
```

**Key Files Explained**:

- **App.tsx**: Route configuration. Full-screen game room layout vs. normal site layout (header/footer).
- **AuthContext.tsx**: Manages JWT token (localStorage), decodes payload to get userId, handles login/logout.
- **GameRoomPage.tsx**: Core game UI. Connects to Socket.IO, initializes LiveKit session, renders video + chat + mod controls.
- **ChatPanel.tsx**: Listens to `gr:message` socket events, renders message list, sends messages.
- **ModPanel.tsx**: Host-only controls for game flow (voting, timers, breakout rooms).

---

## 🔌 Socket.IO Communication Map

### Namespaces & Events

**Game Room Namespace** (`gr:*`):
```
gr:join
  ↓ user enters game room
  ├─→ Socket stores userId, roomCode
  └─→ Broadcast gr:user-joined to all in room

gr:message
  ↓ user sends chat message
  ├─→ Save to GameMessage model
  ├─→ Broadcast gr:new-message to room
  └─→ Include username, timestamp, userId

gr:reaction
  ↓ user sends emoji reaction
  └─→ Broadcast gr:reaction to room (ephemeral, no DB save)

gr:vote
  ↓ user votes on poll (created by mod)
  ├─→ Increment vote count in memory/DB
  └─→ Broadcast gr:vote-updated to room

gr:breakout
  ↓ mod creates sub-rooms
  ├─→ Store breakout groups in memory
  └─→ Emit gr:breakout-created to affected users

gr:timer
  ↓ mod starts countdown timer
  ├─→ Emit timer tick every second
  └─→ Emit gr:timer-end when complete

gr:coin
  ↓ user triggers coin flip
  └─→ Emit gr:coin-result with heads/tails

gr:leave
  ↓ user exits room
  ├─→ Clean up room state
  └─→ Broadcast gr:user-left to room

gr:end
  ↓ mod ends game session
  ├─→ Update Game model (status = 'completed')
  └─→ Disconnect all participants + close room
```

**Community Namespace** (`community:*`):
```
community:post:new
  ↓ new post created
  └─→ Broadcast to all connected users

community:comment:new
  ↓ new comment on post
  └─→ Broadcast to all connected users

community:like:toggle
  ↓ user likes/unlikes post/comment
  └─→ Broadcast updated like count
```

**Socket.IO Auth**:
- Handshake includes optional JWT token in `socket.handshake.auth.token`
- Middleware decodes token → sets `socket.data.userId`
- If no token: `socket.data.userId = null` (allows public access to community feed)
- If token invalid/expired: reject handshake with "Authentication error"

---

## 🔐 Authentication & Authorization

### Login Flow
1. User submits email + password
2. Backend hashes password (bcryptjs), verifies against DB
3. JWT token issued (contains `{ id: userId, iat, exp }`)
4. Frontend stores token in localStorage
5. All API requests include `Authorization: Bearer <token>`

### Google OAuth Flow
1. Frontend renders Google Sign-In button (@react-oauth/google)
2. User authorizes, Google returns ID token
3. Frontend sends token to `POST /api/auth/google`
4. Backend validates token with Google's public keys
5. User created or logged in, JWT issued

### Socket.IO Auth
- Token passed via `socket.handshake.auth.token`
- Server-side JWT verification (optional, soft fail if missing)
- `socket.data.userId` set for event handlers
- Game room events check `socket.data.userId` before allowing actions

### Authorization Rules
- **Games**: Only creator can edit/delete
- **Recordings**: Only game participants can access
- **Community**: Posts/comments require JWT; viewing is public
- **Mod controls** (voting, timer, breakout): Only host can trigger
- **Rate limiting**: `/api/auth/*` limited to 100 req/15min per IP

---

## 🗄️ Database Schema (MongoDB)

### Collections

**users**
```javascript
{
  _id: ObjectId,
  email: string (unique),
  password: string (bcrypted),
  firstName: string,
  lastName: string,
  profilePicture: string (Cloudinary URL),
  provider: 'local' | 'google',
  createdAt: Date,
  updatedAt: Date,
}
```

**games**
```javascript
{
  _id: ObjectId,
  title: string,
  description: string,
  creator: ObjectId (ref: users),
  status: 'draft' | 'active' | 'completed' | 'archived',
  roomCode: string (unique, for join),
  liveKitRoom: string (room name for LiveKit),
  participants: [ObjectId] (refs: users),
  maxParticipants: number,
  startTime: Date,
  endTime: Date,
  recordingEnabled: boolean,
  recordingId: ObjectId (ref: recordings, optional),
  createdAt: Date,
  updatedAt: Date,
}
```

**recordings**
```javascript
{
  _id: ObjectId,
  game: ObjectId (ref: games),
  videoUrl: string (LiveKit cloud storage URL),
  driveFileId: string (Google Drive file ID for archival),
  status: 'pending' | 'processing' | 'completed' | 'failed',
  duration: number (seconds),
  expiresAt: Date (TTL: typically 30 days, then deleted from Drive),
  createdAt: Date,
  updatedAt: Date,
}
```

**posts** (community feed)
```javascript
{
  _id: ObjectId,
  text: string,
  author: ObjectId (ref: users),
  images: [string] (Cloudinary URLs),
  likes: number,
  commentCount: number,
  createdAt: Date,
  updatedAt: Date,
}
```

**comments**
```javascript
{
  _id: ObjectId,
  post: ObjectId (ref: posts),
  text: string,
  author: ObjectId (ref: users),
  createdAt: Date,
  updatedAt: Date,
}
```

**gamemessages** (in-game chat)
```javascript
{
  _id: ObjectId,
  game: ObjectId (ref: games),
  text: string,
  author: ObjectId (ref: users),
  authorName: string (denormalized for speed),
  timestamp: Date,
}
```

**gamelikes** (message likes)
```javascript
{
  _id: ObjectId,
  gameMessage: ObjectId (ref: gamemessages),
  author: ObjectId (ref: users),
  createdAt: Date,
}
// Unique index: [gameMessage, author] to prevent duplicate likes
```

---

## 📡 API Endpoint Reference

### Authentication
| Method | Path | Auth | Body | Returns |
|--------|------|------|------|---------|
| POST | `/api/auth/register` | No | `{ email, password }` | `{ user, token }` |
| POST | `/api/auth/login` | No | `{ email, password }` | `{ user, token }` |
| POST | `/api/auth/logout` | JWT | — | `{ message }` |
| POST | `/api/auth/google` | No | `{ token }` | `{ user, token }` |

### Games
| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/api/games` | No | `[Game]` |
| GET | `/api/games/:id` | No | `Game` |
| POST | `/api/games` | JWT | `Game` |
| PUT | `/api/games/:id` | JWT | `Game` |
| DELETE | `/api/games/:id` | JWT | `{ message }` |

### LiveKit Tokens
| Method | Path | Auth | Query | Returns |
|--------|------|------|-------|---------|
| POST | `/api/livekit/token` | JWT | `roomName`, `userName` | `{ token }` |

### Recordings
| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/api/recordings` | JWT | `[Recording]` |
| DELETE | `/api/recordings/:id` | JWT | `{ message }` |

### Upload
| Method | Path | Auth | Body | Returns |
|--------|------|------|------|---------|
| POST | `/api/upload` | JWT | multipart/form-data | `{ url }` |

### Community
| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/api/community/posts` | No | `[Post]` |
| POST | `/api/community/posts` | JWT | `Post` |
| POST | `/api/community/posts/:id/comments` | JWT | `Comment` |
| POST | `/api/community/posts/:id/like` | JWT | `{ likes }` |

---

## 🚀 Deployment

### Environment Variables Checklist

**Backend** (Render, Heroku, Railway, etc.):
- `PORT` (default: 5000)
- `NODE_ENV` (production)
- `MONGO_URI` (MongoDB Atlas connection string)
- `JWT_SECRET` (min 32 chars, random)
- `CLIENT_URL` (frontend URL, CORS locked)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (base64-encoded service account key)
- `GOOGLE_DRIVE_FOLDER_ID`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `SENDGRID_API_KEY`, `SENDGRID_FROM`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Gmail fallback)
- `EMAIL_ENABLED` (true/false)

**Frontend** (Vercel, Netlify, static host):
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_API_URL` (backend URL)

### Health Checks
- `GET /` → `{ status: 'ok' }`
- `GET /health` → `200 OK`

---

## 🛠️ Development Workflow

### Local Setup
```bash
# Backend
cd back && npm install && npm run dev
# Runs on http://localhost:5000, watches for changes

# Frontend
cd front && npm install && npm run dev
# Runs on http://localhost:5173, auto-reload

# Copy env templates and fill values
cp back/.env.example back/.env
cp front/.env.example front/.env
```

### Code Conventions
- **TypeScript**: Strict mode enabled, all files `.ts` or `.tsx`
- **React**: Functional components + hooks only
- **Socket.IO**: Namespace prefix all events (`gr:*`, `community:*`)
- **Errors**: Try-catch blocks on all async operations
- **Env vars**: Lazy-loaded via `process.env`, never hardcoded
- **Git**: Commits prefixed with scope (e.g., `feat(socket):`, `fix(auth):`)

### Testing
Currently no tests. TODO: Unit tests (models, auth logic), integration tests (Socket.IO events), E2E tests (Playwright).

### Git Workflow
- `main` / `master`: Production-ready
- Feature branches: `feature/...`, `fix/...`, `chore/...`
- PR reviews before merge
- Squash commits on merge

---

## 📝 Known Limitations & Todos

- **No tests**: Unit, integration, E2E tests missing
- **Error boundaries**: Frontend React error boundaries needed
- **State management**: Potential for Redux/Zustand if state complexity grows
- **Offline mode**: No offline support for game sessions
- **Push notifications**: Not implemented (consider Firebase Cloud Messaging)
- **Analytics**: No event tracking (Mixpanel, Segment, etc.)
- **Monitoring**: No APM (Sentry, DataDog, New Relic)
- **Rate limiting**: Only on auth routes; should expand to general API
- **Caching**: Frontend caching strategy (React Query, SWR) not implemented
- **Mobile**: Responsive design exists but untested on real devices

---

## 🔒 Security Considerations

- **HTTPS only**: Must be enabled in production (handled by hosting provider)
- **CORS**: Locked to `CLIENT_URL` in production; open (`true`) in dev
- **JWT expiry**: Should be set (currently missing from issue list)
- **Rate limiting**: Auth endpoints protected; consider expanding
- **Input validation**: Minimal client-side validation; backend should validate all inputs
- **SQL Injection**: N/A (MongoDB used, but injection still possible with user input in queries)
- **XSS**: TailwindCSS + React auto-escape; verify no `dangerouslySetInnerHTML` usage
- **CSRF**: Socket.IO handshake validates token; REST API should require CSRF tokens if session-based
- **Secrets**: Never commit `.env` files; use `.env.example` as template

---

## 🎯 Common Tasks

### Adding a New API Route
1. Create handler function in `routes/newFeature.ts`
2. Export router: `export default router`
3. Mount in `app.ts`: `app.use('/api/newFeature', newFeatureRoutes)`
4. Document in this CLAUDE.md

### Adding a Socket.IO Event
1. Define event handler in `socket/gameRoom.ts` or `socket/community.ts`
2. Add event type to `socket/types.ts`
3. Client-side: `socket.on('gr:eventName', handler)` in GameRoomPage.tsx
4. Test with browser DevTools Console

### Adding a New Page
1. Create component in `components/pages/NewPage.tsx`
2. Add route to `App.tsx`
3. Import in `App.tsx`
4. Add navigation link in `Header.tsx` or `MobileBottomNav.tsx`

### Deploying Backend
```bash
# Test build locally
npm run build
npm start

# Push to Render/Heroku; CI/CD deploys automatically
git push origin feature-branch
# CI runs: npm run build
# Then: npm start on Render
```

### Deploying Frontend
```bash
# Vercel auto-deploys on git push
# Or manually:
npm run build
# Upload dist/ folder to static host
```

---

## 📞 Debugging Tips

### Backend
- Enable verbose logging: `DEBUG=* npm run dev`
- Check MongoDB connection: `MONGO_URI` in .env
- LiveKit token issues: Validate LIVEKIT_* vars, ensure room exists
- Socket.IO connection issues: Browser DevTools → Network → WS tab, check handshake

### Frontend
- React DevTools extension for state inspection
- Redux DevTools for state machine debugging (if added later)
- Browser Console for API errors, Socket.IO events
- Vite Dev Server: Auto hot-reload on file save

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-30  
**Maintained by**: Olena Klementieva (foksysmile@gmail.com)

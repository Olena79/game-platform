# Games of Senses — Project Context for Claude

**Last Updated**: 2026-09-25

This file describes the code as it is. It once described features that were
never built, which is part of how real bugs survived to release — keep it
honest when you change the code. Endpoint and event details live in
[API_REFERENCE.md](API_REFERENCE.md).

## 📊 Status

Second audit (2026-09-25) fixed: spectators taking a voiced seat, the
Telegram link that could never connect anyone, unauthorised recording
uploads, Google sign-in trusting unverified emails, reset links working as
sessions, sessions dying on a token refresh, and the browser recorder
(replaced by LiveKit Egress). Tests: backend 7 suites / 104 tests, frontend
2 files / 27 tests.

### What exists
- **Auth**: email + password, Google sign-in (audience and `email_verified`
  checked), rotating single-use refresh tokens, `tokenVersion` on the user
  (bumped by a password reset — older access tokens are refused), password
  recovery over **Telegram** (there is no email service; do not add one
  without being asked).
- **Telegram bot**: linked with a 32-char single-use `/start` token (Telegram
  drops longer or non-`[A-Za-z0-9_-]` payloads). Sends game codes on
  registration, GM notes after a game, recording links, reset links.
- **Game room**: Socket.IO state machine + LiveKit media. See "Access" below.
- **Recording**: LiveKit Egress (room composite, `grid` layout, MP4) straight
  into a **Cloudflare R2** bucket. GM presses start/stop in the room; the
  server polls LiveKit every minute (`syncRecordings`), sends the GM a
  Telegram link (presigned, valid until expiry), deletes file + row 7 days
  after the start (`cleanupExpiredRecordings`). Survives a closed tab and a
  server restart. Only the main room is recorded, not breakout rooms.
- **Account**: data export and deletion (`routes/account.ts`,
  `services/accountDeletion.ts`). Deletion removes games, recordings, likes;
  posts/comments stay anonymised.
- **Community feed** with live updates.

### Deliberate decisions (do not "fix" these)
- **The game code is the pass.** The entry code grants a seat with a voice;
  the spectator code grants a silent one. Registering on the site is *not*
  required — at ~50 members, ~10 per game, the GM hands out a place minutes
  before a game.
  **Revisit at ~100 members**: then require registration, so a forwarded
  code cannot bring a stranger in. The single place for that is
  `resolveSeat()` in `back/src/services/roomAccess.ts`.
  What must never come back: a seat for a room the caller merely named
  without presenting a code, or the spectator code leading to the entry code.
- **The GM's card number** is shown to registered participants
  (`/games/:id/payment-details`) and its last 4 digits publicly. Intended.
- **Recording links open for anyone holding them** (7 days) — the GM forwards
  them to players. Decided 2026-09-25.
- **`EMAIL_EXISTS` on registration** tells whether an address has an account.
  Accepted: without an email service there is no "check your inbox" flow.
- **One backend instance.** Room state, GM notes drafts, the user-check
  cache and Telegram long-polling live in process memory. A second instance
  splits rooms and steals the bot (`TELEGRAM_POLLING=off` on extra ones).

### Access to a room (who may speak)
`resolveSeat(code, userId)` decides, on the server, from the **presented**
code only: creator → GM; entry code → player; spectator code → spectator,
unless the user is a registered player. Both `gr:join` and
`POST /api/livekit/token` use it. Therefore:
- `GET /api/games/resolve/:code` returns only `{ isSpectator, title }`.
- `gr:state` never carries the entry code, the scenario or the GM's image
  deck (those go to the GM in `gr:gm-state`).
- LiveKit rooms are named `mindflow-<gameId>[-<breakoutId>]`, never after a
  code (a token shows its room name). Spectator tokens cannot publish.
- After `gr:join`, every socket event acts on the socket's own room and
  ignores the `gameCode` in the payload.
- Display names come from the account, not from the client.

### Not implemented (do not assume otherwise)
- No email of any kind.
- No scheduled game reminders (`scheduledAt` is display-only).
- No notification to the GM when a player registers.
- No pagination on `GET /api/games` (fine at this size).
- No Content-Security-Policy yet (other security headers are set: helmet on
  the API, `front/vercel.json` on the site).

## 🏗️ Stack

**Backend** (`/back`): Node 18+, Express 4, TypeScript (CommonJS), MongoDB via
Mongoose 8, Socket.IO 4, `livekit-server-sdk` (tokens, Egress, room service),
`@aws-sdk/client-s3` (R2), zod 4, helmet, express-rate-limit, winston,
Sentry, node-cron, google-auth-library (ID token check), Cloudinary (images).

**Frontend** (`/front`): React 18, TypeScript, Vite, TailwindCSS, React
Router 6, socket.io-client, LiveKit Components, i18next (`ua`, `en`),
@react-oauth/google, Sentry. Heavy routes (game room, create game, community,
account, legal pages) are lazy-loaded.

## 📁 Structure

```
back/src/
  app.ts                  Express + Socket.IO, CORS, helmet, limiters, crons, startup probes
  config/                 db, logger (winston), sentry
  middleware/
    authMiddleware.ts     authenticateAccessToken(): purpose/version/existence checks (REST + socket)
    rateLimitMiddleware.ts  per-section limits; login keyed by email+IP; forgot-password per email
    validationMiddleware.ts zod body/params/query
    requestLogger.ts      morgan → winston
  models/                 User, Game, GameLike, GameMessage, Post, Comment, Recording, RefreshToken
  routes/                 auth, account, telegram, games, livekit, upload, community
  services/
    tokenService.ts       access/refresh tokens, reset tokens (bound to the password hash), Telegram link tokens
    roomAccess.ts         resolveSeat() — who may sit where
    livekit.ts            RoomServiceClient/EgressClient, roomNameFor(), server-side mute
    recording.ts          Egress start/stop/sync, Telegram link, 7-day cleanup
    storage.ts            R2: Egress upload target, presigned links, deletion, startup probe
    telegramBot.ts        long-polling bot and all outgoing messages
    notesDelivery.ts      GM notes → Telegram
    accountDeletion.ts    export + delete
  socket/
    gameRoom.ts           the room (gr:*), in-memory state, close-out when the GM ends or leaves
    community.ts          com:join / com:leave
    eventValidation.ts    zod + 20 events/s per socket
  validation/schemas.ts   all zod schemas
back/tests/               jest (no DB needed; tests/setupEnv.ts sets env)

front/src/
  App.tsx                 routes (/room/:code is full-screen)
  context/AuthContext.tsx tokens, refresh scheduled from the token's real expiry, cross-tab sync
  hooks/useGameRoom.ts    socket + LiveKit tokens for the room
  hooks/useTelegramLink.ts bot deep link
  components/pages/       Home, Auth, ResetPassword, Account, Game, OurGames, CreateGame, GameRoom, Community, legal
  components/gameroom/    GridView, SpeakerView, ChatPanel, ModPanel (incl. recording controls), modals, overlays
  translation/{ua,en}.json
```

## 🎬 Game room lifecycle

1. `/room/:code` → `GET /games/resolve/:code` (seat kind for the UI) →
   socket `gr:join { gameCode: code }` → `POST /livekit/token { code }`.
2. GM runs the game (`gr:start`, votes, timers, breakouts, images, coins…).
3. End: `gr:end`, or the GM gone for 90 s (`scheduleGmAwayCloseOut`). Both
   run `closeOutSession`: stop the recording, deliver notes to Telegram
   (`gr:notes-delivered` lets the browser drop its copy), release the room
   (60 s after a proper end; 10 min after the last person leaves otherwise).
4. Deleting a game closes its room and stops its recording.

## 🔐 Security notes

- Access tokens are refused if they carry a `purpose` (reset tokens share the
  secret), if the account is gone, or if `tv` ≠ the user's `tokenVersion`.
  Checks are cached 60 s (`seenUsers`).
- A failed refresh because of the network is retried; only a rejected refresh
  token signs the tab out. `logout` (on purpose) revokes all refresh tokens.
- Game codes come from `crypto.randomInt`, unique across entry and spectator.
- GM mutes are enforced by LiveKit (`mutePublishedTrack`), not just requested.

## 🚀 Deployment & environment

Backend env (see `back/.env.example`): `MONGO_URI`, `JWT_SECRET`,
`CLIENT_URL` (comma-separated; first is used in reset links),
`GOOGLE_CLIENT_ID`, `LIVEKIT_URL/API_KEY/API_SECRET`,
`R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET`,
`CLOUDINARY_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
`TELEGRAM_POLLING`, `SENTRY_DSN_BACKEND`, `DEFAULT_LANGUAGE`.

Frontend env: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`,
`VITE_TELEGRAM_BOT_USERNAME`, `VITE_SENTRY_DSN_FRONTEND`.

Startup logs say whether R2 is usable ("Recording storage ready / NOT
usable"). Egress minutes are billed by LiveKit Cloud per plan — check the
plan covers the club's weekly games.

## 🛠️ Workflow

```bash
cd back  && npm ci && npm run dev    # :5000
cd front && npm ci && npm run dev    # :5173
cd back  && npm test && npx tsc --noEmit
cd front && npx vitest run && npx tsc --noEmit && npm run build
```

**Git: commit and push straight to `master`. Never create branches** — there
is one developer on this project. Lockfiles must stay in sync (`npm ci` is
what deploys run). Commits use a scope prefix (`fix(room):`, `feat(recording):`). Not covered by tests and
checked by hand against a running server: the Egress recording chain, notes
delivery, Telegram linking, the session close-out.

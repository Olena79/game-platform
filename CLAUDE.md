# Games of Senses — Project Context for Claude

**Last Updated**: 2026-09-26

This file describes the code as it is. It once described features that were
never built, which is part of how real bugs survived to release — keep it
honest when you change the code. Endpoint and event details live in
[API_REFERENCE.md](API_REFERENCE.md).

## 📊 Status

Second audit (2026-09-25) fixed: spectators taking a voiced seat, the
Telegram link that could never connect anyone, unauthorised recording
uploads, Google sign-in trusting unverified emails, reset links working as
sessions, sessions dying on a token refresh. Recording was then rebuilt to
run in the gamemaster's browser for free, phones included (see below).
The admin panel was added on 2026-09-26 (see "Administrator").
Tests: backend 16 suites / 145 tests, frontend 3 files / 29 tests.

### What exists
- **Auth**: email + password, Google sign-in (audience and `email_verified`
  checked), rotating single-use refresh tokens, `tokenVersion` on the user
  (bumped by a password reset — older access tokens are refused), password
  recovery over **Telegram** (there is no email service; do not add one
  without being asked).
- **Telegram bot** — news only, not for conversation (it says so to anyone
  who writes to it). Linked with a 32-char single-use `/start` token
  (Telegram drops longer or non-`[A-Za-z0-9_-]` payloads). Sends: an
  **announcement of every new game** to all linked members except its GM
  (title, full description, date/time in Kyiv, paid/free, GM; with the cover
  as a photo when it fits), entry codes on registration (player or spectator
  code), GM notes after a game (only when something was written: spaces,
  invisible characters and a player name inserted with nothing after it do
  not count — `cleanNotes`, same rule in the browser and on the server),
  recording links, reset links, a **reminder 10 minutes before a game** to
  everyone registered for it and its GM (`services/gameReminders.ts`, cron
  every minute, `Game.reminderSentAt`, cleared when the time changes), and
  the administrator's broadcasts. `/stop` turns
  announcements off (`User.newsOptOut`), `/news` back on; personal messages
  always come. A chat that blocked the bot is unlinked. When an account is linked to a
  different chat, the old chat is warned (a takeover would otherwise move
  codes and reset links silently). The bot's
  description, short description and command menu are set on every start
  (`describeBot`). If Telegram cannot be reached at startup, the bot retries
  (5 s, 15 s, 30 s, then every minute) instead of staying deaf until the
  next deploy.
- **Game room**: Socket.IO state machine + LiveKit media. See "Access" below.
- **Recording** — into a **Cloudflare R2** bucket, 7 days, link to the GM's
  Telegram. Two modes, `RECORDING_MODE`:
  - **`browser` (default, free)** — `front/src/recording/RoomRecorder.ts`:
    the GM's browser draws everyone's camera into a grid on a canvas, mixes
    voices with WebAudio, records with MediaRecorder (webm, or mp4 on
    Safari) and uploads **8 MiB parts** in order to `/api/recordings`
    (R2 multipart upload). No screen capture, so it works on phones. The
    recorder lives outside `LiveKitRoom` and follows the GM into breakout
    rooms. Parts sit in R2 as they arrive; a browser silent for 3 min (a
    heartbeat is sent every minute) is closed from its parts by
    `syncRecordings`, marked interrupted. "Voice only" mode for weak phones
    (default on low-power mobiles). The room tab must stay open and in front.
    CORS must allow the `X-Final` header (`back/src/config/cors.ts`, tested):
    without it every part is refused by the browser's preflight and nothing
    is saved — that is how recordings died after a few minutes on 2026-09-26.
  - **`egress`** — LiveKit Egress (room composite, grid, MP4) straight to R2.
    Needs a paid LiveKit plan: the free Build plan allows 60 min/month and
    refuses beyond (checked 2026-09-25: Ship $50/mo includes 600 min).
  A shared screen is recorded large with the cameras in a strip beside it.
  Everyone sees a marker while recording (`isRecording` in room state).
  GMs are told what recording asks of their device on the create-game page
  (`RecordingInfoCard`) and once per device before the first recording.
- **Account**: data export and deletion (`routes/account.ts`,
  `services/accountDeletion.ts`). Deletion removes games, recordings, likes;
  posts/comments stay anonymised.
- **Screen sharing**: players and the GM (never spectators — their token
  cannot publish). Desktop browsers only; phones are told it cannot work
  there. Starting a share switches everyone to the speaker view, where the
  screen is shown; failures (macOS permission, unsupported) are explained.
- **Room dialogs** (timer, coins, breakout, votes, announce…) use
  `.room-modal-overlay`, which sits in the visible viewport (`--vvh`/`--vvt`
  from `useVisualViewportHeight`), so a phone keyboard never hides the
  buttons. Number fields (`NumberField`) can be emptied; confirm buttons stay
  disabled until a number is there. The timer has "Set and start".
- **Community feed** with live updates.
- **Administrator** — one person, `/admin` (invisible button at the end of
  the footer links). See "Administrator" below.

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
- **Recording runs in the GM's browser**, not on LiveKit, because the club
  cannot pay for LiveKit Egress yet. Its costs (warm phone, tab in front,
  quality of the GM's connection) are told to GMs up front. Switch with
  `RECORDING_MODE=egress` once there is a paid plan — no code change.
- **`EMAIL_EXISTS` on registration** tells whether an address has an account.
  Accepted: without an email service there is no "check your inbox" flow.
- **One backend instance.** Room state, GM notes drafts, the user-check
  cache, admin sessions and Telegram long-polling live in process memory. A second instance
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
- No notification to the GM when a player registers.
- No pagination on `GET /api/games` (fine at this size).
- No Content-Security-Policy yet (other security headers are set: helmet on
  the API, `front/vercel.json` on the site).

### Administrator
- **Who**: the account whose email is `ADMIN_EMAIL`. Nothing in the database
  makes anyone an administrator. Everything under `/api/admin` answers 404 to
  any other account.
- **Getting in** (`services/adminAuth.ts`, `routes/admin.ts`): signed-in
  account → passphrase (server keeps only `ADMIN_PASSPHRASE_HASH`,
  `pbkdf2$600000$<salt b64>$<hash b64>`, SHA-256, NFC + trimmed) → 6-digit
  code sent to the administrator's Telegram (5 min, 3 tries) → a session
  token (1 h, in process memory; a restart signs out) sent as `X-Admin-Token`
  with the normal bearer token. 5 failures lock sign-in for an hour. Every
  failure and every entry is reported to the administrator's Telegram and
  written to `AdminLog`. The front keeps the session in `sessionStorage`
  (`AdminContext`).
- **Making the hash**: in a desktop browser, on any https page, open the
  console and run (Chrome may ask to type "allow pasting" first):
  ```js
  (async () => { const p = prompt('Парольна фраза'); if (!p) return; const s = crypto.getRandomValues(new Uint8Array(16)); const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(p.normalize('NFC').trim()), 'PBKDF2', false, ['deriveBits']); const h = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: s, iterations: 600000 }, k, 256); const b = u => btoa(String.fromCharCode(...new Uint8Array(u))); console.log('pbkdf2$600000$' + b(s) + '$' + b(h)) })()
  ```
  `tests/adminAuth.test.ts` checks the server accepts exactly this.
- **Can**: block / unblock (`User.blockedAt`: token version bumped, refresh
  tokens revoked, sockets closed, removed from LiveKit; login, Google and
  refresh answer `ACCOUNT_BLOCKED`), stop someone writing in the community
  (`User.communityMuted` → `COMMUNITY_MUTED`), delete an account
  (`deleteAccount`), delete a game (`services/gameDeletion.ts`, shared with
  the GM's delete), see and end live rooms (`listRooms`, `endRoomAsAdmin`),
  list / delete recordings (`deleteRecording`), delete any post or comment
  (also from the Community page while in admin mode), message everyone with
  Telegram (`broadcastToAll`, ignores `/stop`, skips blocked), stats, journal.
  The administrator's own account cannot be blocked or deleted from there.
- **Hears about** (`services/adminNotify.ts`, only ever to the chat linked
  to the ADMIN_EMAIL account — `tests/adminNotify.test.ts`): a new account (with whether Telegram is linked), a member
  linking Telegram, a new game (who, title, date), a recording starting and
  ending (with the link), sign-in attempts. Their own games and recordings
  are not reported. GMs are told in the recording notes that the club's
  administrator is notified when a recording starts (the link to the
  administrator is not mentioned there — decided 2026-09-26).

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
  models/                 User, Game, GameLike, GameMessage, Post, Comment, Recording, RefreshToken, AdminLog
  routes/                 auth, account, telegram, games, livekit, recordings, upload, community, admin
  services/
    tokenService.ts       access/refresh tokens, reset tokens (bound to the password hash), Telegram link tokens
    roomAccess.ts         resolveSeat() — who may sit where
    livekit.ts            RoomServiceClient/EgressClient, roomNameFor(), server-side mute
    recording.ts          both modes: start, parts, finish, silence/egress sync, Telegram link, 7-day cleanup
    storage.ts            R2: multipart parts, Egress upload target, presigned links, deletion, startup probe
    telegramBot.ts        long-polling bot: commands, all outgoing messages, new-game announcements
    notesDelivery.ts      GM notes → Telegram
    accountDeletion.ts    export + delete
    adminAuth.ts          admin passphrase / Telegram code / sessions / lockout
    adminNotify.ts        notices to the administrator's Telegram
    gameReminders.ts      "starts in 10 minutes"
    gameDeletion.ts       deleting a game (GM or administrator)
  socket/
    gameRoom.ts           the room (gr:*), in-memory state, close-out when the GM ends or leaves
    community.ts          com:join / com:leave
    eventValidation.ts    zod + 20 events/s per socket
  validation/schemas.ts   all zod schemas
back/tests/               jest (no DB needed; tests/setupEnv.ts sets env)

front/src/
  App.tsx                 routes (/room/:code is full-screen)
  context/AuthContext.tsx tokens, refresh scheduled from the token's real expiry, cross-tab sync
  context/AdminContext.tsx the admin session (sessionStorage) and adminFetch
  hooks/useGameRoom.ts    socket + LiveKit tokens for the room
  hooks/useTelegramLink.ts bot deep link
  recording/RoomRecorder.ts the in-browser recorder (canvas grid + audio mix → parts)
  components/pages/       Home, Auth, ResetPassword, Account, Game, OurGames, CreateGame, GameRoom, Community, Admin, legal
  components/gameroom/    GridView, SpeakerView, ChatPanel, ModPanel, RecordingControls (+ explainer), modals, overlays
  components/RecordingInfoCard.tsx  recording notes for GMs on the create-game page
  translation/{ua,en}.json
```

## 🎬 Game room lifecycle

1. `/room/:code` → `GET /games/resolve/:code` (seat kind for the UI) →
   socket `gr:join { gameCode: code }` → `POST /livekit/token { code }`.
2. GM runs the game (`gr:start`, votes, timers, breakouts, images, coins…).
3. End: `gr:end`, or the GM gone for 90 s (`scheduleGmAwayCloseOut`). Both
   run `closeOutSession`: stop the recording (egress: stopped; browser: the
   GM's browser gets `gr:record-stop` and uploads its last part), deliver notes to Telegram
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
`RECORDING_MODE` (`browser` default | `egress`), `R2_ENDPOINT` (local S3
emulator only),
`CLOUDINARY_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
`TELEGRAM_POLLING`, `SENTRY_DSN_BACKEND`, `DEFAULT_LANGUAGE`,
`ADMIN_EMAIL`, `ADMIN_PASSPHRASE_HASH` (both empty → no admin panel).

Frontend env: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`,
`VITE_TELEGRAM_BOT_USERNAME`, `VITE_SENTRY_DSN_FRONTEND`.

Startup logs say whether R2 is usable ("Recording storage ready / NOT
usable").

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
checked by hand against a running server: recording on real devices
(especially iPhone Safari), the Egress chain, notes delivery, Telegram
linking, the session close-out, the admin panel against real data (its
screens were checked in headless Chromium with a mocked API, 2026-09-26). The recorder and the R2 calls were exercised
in headless Chromium and against an S3 emulator when written (2026-09-25).

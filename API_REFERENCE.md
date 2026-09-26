# API Reference — Games of Senses

Base URL: the backend origin (`VITE_API_URL` on the frontend). All bodies are
JSON unless stated otherwise. Authenticated routes take
`Authorization: Bearer <accessToken>`.

Access tokens live 1 hour, refresh tokens 30 days (single use — each refresh
returns a new pair). An access token is refused once the account is deleted,
blocked, or its password is reset.

Errors look like `{ "message": "..." }`; validation errors add
`{ "error": "Validation error", "details": [{ "field", "message" }] }`.

---

## Auth — `/api/auth`

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/register` | — | `{ email, password (≥8), name?, surname? }` | `201 { accessToken, refreshToken, user }` · `400 EMAIL_EXISTS` |
| POST | `/login` | — | `{ email, password }` | `{ accessToken, refreshToken, user }` · `400 INVALID_CREDENTIALS` · `403 ACCOUNT_BLOCKED` |
| POST | `/google` | — | `{ token }` (Google ID token) | `{ accessToken, refreshToken, user }` — the Google email must be verified |
| GET | `/me` | JWT | — | `user` |
| POST | `/refresh` | — | `{ refreshToken }` | `{ accessToken, refreshToken }` · `401` |
| POST | `/logout` | JWT | — | `{ message }` — revokes every refresh token of the account |
| POST | `/forgot-password` | — | `{ email }` | always `{ ok: true }`; a reset link goes to the account's Telegram if linked |
| POST | `/reset-password` | — | `{ token, password }` | `{ ok: true }` · `400 INVALID_OR_EXPIRED_TOKEN` — a link works once, for 30 min |

`user` = `{ id, email, name, surname, telegramConnected }`.

Limits: sign-in 10 failed attempts / 15 min per account and address;
reset links 3 / hour per address; the whole section 100 requests / 15 min per IP.

## Account — `/api/account`

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/export` | JWT | — | JSON download of everything held about the caller |
| DELETE | `/` | JWT | `{ confirm: true, password? }` | `{ ok, ...summary }` · `403 INVALID_PASSWORD` — password required when the account has one |

Deleting removes the account, its games, recordings and likes; posts and
comments stay, anonymised.

## Telegram — `/api/telegram`

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/link-token` | JWT | `{ token }` — 32 url-safe chars, 15 min, single use; the link is `https://t.me/<bot>?start=<token>` |
| GET | `/status` | JWT | `{ telegramConnected }` |

The chat is attached when the person presses **Start** in the bot.

The bot answers `/start` (welcome, or confirmation when the link token is
valid), `/stop` (no new-game announcements), `/news` (announcements back on)
and `/help`; anything else gets "I only send news". Creating a game
(`POST /api/games`) announces it to every linked member except its creator.
Ten minutes before a game's `scheduledAt`, everyone registered for it and
its GM get a reminder with their code and the room link.

## Games — `/api/games`

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/` | optional | `[Game]` (public view; codes only for those entitled, see below) |
| GET | `/resolve/:code` | — | `{ isSpectator, title }` · `404` — never reveals the entry code |
| GET | `/:id` | optional | `Game` |
| GET | `/:id/edit` | JWT (creator) | full game document |
| GET | `/:id/payment-details` | JWT (creator / registered) | `{ gmCardNumber, gmCardFormatted, hasGmCard, participationCost }` |
| POST | `/` | JWT | `201 Game` (creator view, with both codes) |
| PUT | `/:id` | JWT (creator) | `Game` · `400 MAX_BELOW_REGISTERED` |
| DELETE | `/:id` | JWT (creator) | `{ ok }` — also closes an open room, stops its recording |
| POST | `/:id/register` | JWT | `{ gameCode, registeredPlayers }` · `400 MAX_PLAYERS_REACHED / ALREADY_REGISTERED / CREATOR_CANNOT_REGISTER` |
| DELETE | `/:id/register` | JWT | `{ registeredPlayers }` |
| POST | `/:id/register-spectator` | JWT | `{ spectators, spectatorCode }` |
| DELETE | `/:id/register-spectator` | JWT | `{ spectators }` |
| POST / DELETE | `/:id/like` | JWT | `{ likesCount, isLiked }` |
| POST | `/send-notes` | JWT | `{ notes, gameTitle? }` → `{ delivered, reason? }` — to the caller's own Telegram |

Public game view: title, description, player limits, coins/influence setup,
cost, schedule, images, likes, counts, `hasGmCard`/`gmCardLast4`,
`isRegistered`/`isSpectatorRegistered`. The creator additionally gets both
codes, participant lists, scenario, notes; a registered player gets the entry
code, a registered spectator the spectator code.

## LiveKit — `/api/livekit`

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/token` | JWT | `{ code, breakoutId? }` | `{ token, url, roomName }` · `403` |

`code` is the code the person was given. The server decides the room (named
after the game id) and whether the seat may publish: the spectator code gives
a subscribe-only token. A breakout token needs an invitation from the GM.

## Recordings — `/api/recordings` (RECORDING_MODE=browser)

The gamemaster's browser records the room and uploads it here while the game
runs. Only the game's creator may record it.

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/initiate` | JWT (GM) | `{ code, contentType }` (`video/webm`, `video/mp4`, `audio/webm`, `audio/mp4`, …) | `{ recordingId, partSize }` — an open recording of the same game is closed first |
| POST | `/:id/parts/:n` | JWT (GM) | raw bytes; header `X-Final: 1` on the last part | `{ bytes, complete }` · `400 { message, expectedPart }` · `409` closed |
| POST | `/:id/alive` | JWT (GM) | — | `{ ok }` · `409` closed — send every minute |

Parts are numbered from 1, sent in order, each exactly `partSize` (8 MiB)
except the last, which may be shorter or empty. Resending a stored part is
acknowledged. The final part closes the file and sends the Telegram link.
After 3 minutes without a part or heartbeat the server closes the file from
the parts it has (marked interrupted). Limit: 8 GB per recording.

## Admin — `/api/admin`

Only for the account named by `ADMIN_EMAIL`; any other account gets `404`.
After sign-in every request carries `Authorization: Bearer <accessToken>`
**and** `X-Admin-Token: <admin session token>`; without a live session:
`401 ADMIN_SESSION_REQUIRED`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/login` | `{ passphrase }` | `{ ok }` (code sent to Telegram) · `401 WRONG_PASSWORD` · `409 NO_TELEGRAM` · `429 LOCKED { until }` |
| POST | `/verify` | `{ code }` (6 digits) | `{ token, expiresAt }` (1 h) · `401 WRONG_CODE / CODE_EXPIRED` · `429` |
| GET | `/session` | — | `{ ok, expiresAt }` |
| POST | `/logout` | — | `{ ok }` |
| GET | `/stats` | — | counts: users, telegram, blocked, muted, newUsers, games, upcoming, posts, comments, recordings, recordingBytes, openRooms, activeRooms |
| GET | `/users?q=&filter=blocked\|muted\|no-telegram` | — | `[user]` (≤300, newest first) with flags and game counts |
| POST | `/users/:id/block` | `{ reason? }` | `{ ok }` — signs them out everywhere, closes their sockets |
| POST | `/users/:id/unblock`, `/users/:id/mute`, `/users/:id/unmute` | — | `{ ok }` |
| DELETE | `/users/:id` | — | `{ ok, ...deletion summary }` |
| GET | `/games` · DELETE `/games/:id` | — | list · `{ ok }` |
| GET | `/rooms` · POST `/rooms/:gameId/close` | — | rooms in memory · `{ ok }` (ends the session for everyone) |
| GET | `/recordings` · DELETE `/recordings/:id` | — | list with links · `{ ok }` |
| DELETE | `/posts/:id`, `/comments/:id` | — | `{ ok }` (live `com:*-deleted` events) |
| POST | `/broadcast` | `{ text (≤3500) }` | `{ ok, recipients }` — sent in the background; the summary goes to the administrator's Telegram |
| GET | `/log` | — | last 300 journal entries |

The administrator's own account cannot be blocked, muted or deleted here.
Five failed sign-in steps lock `/login` and `/verify` for an hour.

## Upload — `/api/upload`

`POST /` (JWT, `multipart/form-data`, field `file`, images ≤ 10 MB) → `{ url }` (Cloudinary).

## Community — `/api/community`

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/posts?sort=new\|popular&skip&limit(≤50)` | optional | `{ posts, total, hasMore }` |
| POST | `/posts` | JWT | `{ text (≤1000), topic? }` → post · `403 COMMUNITY_MUTED` |
| PUT | `/posts/:id` | JWT (author) | `{ text?, topic? }` → post |
| DELETE | `/posts/:id` | JWT (author) | `{ ok }` |
| POST / DELETE | `/posts/:id/like` | JWT | `{ postId, likesCount, isLiked }` |
| GET | `/posts/:id/comments` | optional | `[comment]` |
| POST | `/posts/:id/comments` | JWT | `{ text (≤500) }` → comment |
| PUT / DELETE | `/comments/:id` | JWT (author) | comment / `{ ok }` |
| POST / DELETE | `/comments/:id/like` | JWT | `{ commentId, likesCount, isLiked }` |

Live updates: join with `com:join`; events `com:post-new`, `com:post-updated`,
`com:post-deleted`, `com:post-likes`, `com:comment-new`, `com:comment-updated`,
`com:comment-deleted`, `com:comment-likes`.

---

## Socket.IO — game room

Handshake: `auth: { token: <accessToken> }` (optional for the community feed,
required for the room). Every client event carries `gameCode` — the code the
person holds; after `gr:join` the server acts on the room that code opened
and ignores the field. At most 20 events per second per socket.

### Client → server

| Event | Who | Payload |
|---|---|---|
| `gr:join` | anyone with a code | `{ gameCode }` |
| `gr:chat` | everyone (spectators: public only) | `{ text (≤500), recipients?: userId[] }` |
| `gr:react` | everyone | `{ emoji }` (one of the room's reactions) |
| `gr:hand` | players | `{ raised }` |
| `gr:role` | GM (or self) | `{ targetUserId, role }` |
| `gr:coins-transfer` / `gr:coins-bank` | players | `{ toUserId, amount }` / `{ amount }` |
| `gr:vote-cast` / `gr:spectator-vote-cast` | players / spectators | `{ optionIds }` |
| `gr:breakout-join` / `gr:breakout-leave` | invited | `{ roomId }` / — |
| `gr:start`, `gr:end`, `gr:notes { notes }`, `gr:announce { text\|null }`, `gr:timer { action, label?, seconds? }`, `gr:vote-create/close/clear`, `gr:spectator-vote-create/close/clear`, `gr:breakout-create/invite/end`, `gr:image-show { imageUrl\|null }`, `gr:influence`, `gr:bank-give { toUserId, amount }` (from the bank to a player), `gr:mute-all`, `gr:mute-player { targetUserId }`, `gr:record-control { action: 'start'\|'stop' }` (egress mode) | GM | |

### Server → client

| Event | To | Payload |
|---|---|---|
| `gr:state` | room | public state — no entry code, no scenario, no image deck; anonymous votes without voter ids; `isRecording`, `serverNow` |
| `gr:gm-state` | GM | `{ scenario, images, recordingMode: 'browser'\|'egress' }` |
| `gr:chat`, `gr:chat-history` | room / sender+recipients | message(s) |
| `gr:my-vote` | voter | `{ voteId, optionIds }` |
| `gr:reactions`, `gr:player-reacted` | room | |
| `gr:influence-changed` | room | `{ userId, delta }` — for the ⚡ flash only |
| `gr:coins-moved` | room | `{ from, to, amount }` — `from`/`to` a user id or `'bank'`; for the animation only |
| `gr:breakout-invited`, `gr:breakout-return` | player | |
| `gr:mute-all`, `gr:mute-player` | room / player | the media server mutes as well |
| `gr:record-status` | GM | `{ status: 'recording'\|'stopping'\|'done'\|'error'\|'idle', detail? }` |
| `gr:record-stop` | GM | browser mode: the game is over, finish the recording |
| `gr:notes-delivered` | GM | the server sent the notes to Telegram |
| `gr:end-anim`, `gr:rejoin` | room | |
| `gr:error` | socket | the room cannot be used (`Room not found`, `Unauthorized`) |
| `gr:action-error` | socket | a single command was refused |

### Recording

`RECORDING_MODE=browser` (default): the GM's browser records (see
`/api/recordings` above); `gr:record-control` is refused.
`RECORDING_MODE=egress`: `gr:record-control start` asks LiveKit Egress to
record the main room (grid) into R2; the server follows the job to the end.

Either way the GM gets a Telegram message with a link valid until the file is
deleted, 7 days after the recording started, and everyone sees `isRecording`.

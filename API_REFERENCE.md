# API Reference — Games of Senses

**Quick reference for all API endpoints and Socket.IO events.**

---

## 🔐 Authentication

### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

# Response (201)
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

# Response (200)
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Google OAuth
```bash
POST /api/auth/google
Content-Type: application/json

{
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6InNvbWVfa2V5In0..."
}

# Response (200 or 201)
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout
```bash
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Response (200)
{
  "message": "Logged out successfully"
}
```

---

## 🎮 Games

### List All Games
```bash
GET /api/games?skip=0&limit=20

# Response (200)
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Trivia Night",
    "description": "Test your knowledge",
    "creator": { "id": "...", "firstName": "John" },
    "status": "active",
    "roomCode": "ABC123",
    "participants": ["507f...", "508f..."],
    "maxParticipants": 10,
    "recordingEnabled": true,
    "createdAt": "2026-08-30T10:00:00Z"
  }
]
```

### Get Single Game
```bash
GET /api/games/507f1f77bcf86cd799439011

# Response (200)
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Trivia Night",
  ...
}
```

### Create Game
```bash
POST /api/games
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "New Game",
  "description": "Game description",
  "maxParticipants": 8,
  "recordingEnabled": true
}

# Response (201)
{
  "_id": "507f...",
  "roomCode": "XYZ789",
  "status": "draft",
  ...
}
```

### Update Game
```bash
PUT /api/games/507f1f77bcf86cd799439011
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description"
}

# Response (200)
{ ... }
```

### Delete Game
```bash
DELETE /api/games/507f1f77bcf86cd799439011
Authorization: Bearer <token>

# Response (200)
{
  "message": "Game deleted successfully"
}
```

---

## 🎥 LiveKit Video

### Get Room Token
```bash
POST /api/livekit/token
Authorization: Bearer <token>
Content-Type: application/json

{
  "roomName": "game_507f",
  "userName": "john_doe"
}

# Response (200)
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 📹 Recordings

### List User's Recordings
```bash
GET /api/recordings
Authorization: Bearer <token>

# Response (200)
[
  {
    "_id": "607f...",
    "game": { "_id": "...", "title": "Trivia Night" },
    "status": "completed",
    "videoUrl": "https://livekit-recording-url...",
    "driveFileId": "1abc123def456",
    "duration": 1800,
    "expiresAt": "2026-09-30T10:00:00Z",
    "createdAt": "2026-08-30T10:00:00Z"
  }
]
```

### Delete Recording
```bash
DELETE /api/recordings/607f...
Authorization: Bearer <token>

# Response (200)
{
  "message": "Recording deleted"
}
```

---

## 📤 File Upload

### Upload Image to Cloudinary
```bash
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary image data>

# Response (200)
{
  "url": "https://res.cloudinary.com/..."
}
```

---

## 💬 Community

### Get Posts
```bash
GET /api/community/posts?skip=0&limit=10

# Response (200)
[
  {
    "_id": "707f...",
    "text": "Had a great game session!",
    "author": { "id": "...", "firstName": "Jane" },
    "images": ["https://cloudinary-url..."],
    "likes": 5,
    "commentCount": 2,
    "createdAt": "2026-08-30T10:00:00Z"
  }
]
```

### Create Post
```bash
POST /api/community/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Great game session!",
  "images": ["https://cloudinary-url..."]
}

# Response (201)
{
  "_id": "707f...",
  ...
}
```

### Add Comment
```bash
POST /api/community/posts/707f.../comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "I agree!"
}

# Response (201)
{
  "_id": "808f...",
  "text": "I agree!",
  "author": { ... },
  "createdAt": "..."
}
```

### Like/Unlike Post
```bash
POST /api/community/posts/707f.../like
Authorization: Bearer <token>

# Response (200)
{
  "likes": 6,
  "liked": true
}
```

---

## 🔌 Socket.IO Events

### Connection
```javascript
// Frontend
import io from 'socket.io-client'

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('token')
  }
})

socket.on('connect', () => console.log('Connected'))
socket.on('disconnect', () => console.log('Disconnected'))
```

### Game Room Events

#### Join Room
```javascript
// Client sends
socket.emit('gr:join', {
  roomCode: 'ABC123',
  userId: 'user_id'
})

// Server broadcasts
socket.on('gr:user-joined', { userId, userName, count })
```

#### Send Message
```javascript
// Client sends
socket.emit('gr:message', {
  text: 'Hello everyone!'
})

// Server broadcasts to room
socket.on('gr:new-message', {
  id: 'msg_id',
  text: 'Hello everyone!',
  author: 'John',
  authorId: 'user_id',
  timestamp: '2026-08-30T10:00:00Z'
})
```

#### Send Reaction
```javascript
// Client sends
socket.emit('gr:reaction', {
  emoji: '👍',
  userId: 'user_id'
})

// Server broadcasts (ephemeral, no persistence)
socket.on('gr:reaction', {
  emoji: '👍',
  userId: 'user_id',
  userName: 'John'
})
```

#### Vote
```javascript
// Client sends
socket.emit('gr:vote', {
  pollId: 'poll_123',
  option: 0  // index
})

// Server broadcasts updated results
socket.on('gr:vote-updated', {
  pollId: 'poll_123',
  results: [10, 5, 3],  // vote counts per option
  totalVotes: 18
})
```

#### Create Voting Poll
```javascript
// Mod sends
socket.emit('gr:vote', {
  create: true,
  question: 'Which game next?',
  options: ['Trivia', 'Charades', 'Pictionary']
})

// Server broadcasts to all
socket.on('gr:vote-started', {
  pollId: 'poll_123',
  question: 'Which game next?',
  options: ['Trivia', 'Charades', 'Pictionary'],
  timeLimit: 30  // seconds
})
```

#### Breakout Rooms
```javascript
// Mod sends
socket.emit('gr:breakout', {
  groups: [
    ['user_1', 'user_2'],
    ['user_3', 'user_4']
  ],
  duration: 600  // 10 minutes
})

// Server broadcasts
socket.on('gr:breakout-created', {
  groups: [...],
  duration: 600,
  startsAt: '2026-08-30T10:00:00Z'
})
```

#### Timer
```javascript
// Mod sends
socket.emit('gr:timer', {
  duration: 60  // 1 minute
})

// Server broadcasts every second
socket.on('gr:timer-tick', { remaining: 59 })
socket.on('gr:timer-tick', { remaining: 58 })
// ...
socket.on('gr:timer-end', { message: 'Time up!' })
```

#### Coin Flip
```javascript
// User sends
socket.emit('gr:coin')

// Server broadcasts result
socket.on('gr:coin-result', {
  result: 'heads',  // or 'tails'
  animation: true
})
```

#### Leave Room
```javascript
// Client sends
socket.emit('gr:leave')

// Server broadcasts
socket.on('gr:user-left', { userId, userName, count })
```

#### End Game
```javascript
// Mod sends
socket.emit('gr:end', {
  message: 'Game finished!'
})

// Server broadcasts + closes room
socket.on('gr:game-ended', {
  message: 'Game finished!',
  recordingUrl: 'https://...'  // if recording enabled
})
```

---

## 🌍 Community Live Events

#### New Post
```javascript
socket.on('community:post:new', {
  post: { _id: '707f...', text: '...', author: {...} }
})
```

#### New Comment
```javascript
socket.on('community:comment:new', {
  postId: '707f...',
  comment: { _id: '808f...', text: '...' }
})
```

#### Like Toggle
```javascript
socket.on('community:like:toggle', {
  postId: '707f...',
  likes: 6
})
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request body"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing or invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "Only game creator can delete"
}
```

### 404 Not Found
```json
{
  "error": "Game not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests from this IP, please try again in 15 minutes."
}
```

### 500 Server Error
```json
{
  "error": "Internal server error"
}
```

---

## 🔑 JWT Token Format

```javascript
// Payload
{
  "id": "507f1f77bcf86cd799439011",
  "iat": 1693302000,
  "exp": 1693305600  // 1 hour from now (TODO: add this)
}

// Usage in requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImlhdCI6MTY5MzMwMjAwMH0.xxxx
```

---

## 📊 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/register` | 100 | 15 min |
| `/api/auth/login` | 100 | 15 min |
| Other `/api/*` | Unlimited* | — |

*Rate limiting on general API endpoints is TODO.

---

## 🧪 Testing with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Create Game
```bash
curl -X POST http://localhost:5000/api/games \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Test Game","maxParticipants":8}'
```

### Get Games
```bash
curl http://localhost:5000/api/games
```

---

**Last Updated**: 2026-08-30

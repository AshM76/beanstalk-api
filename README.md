# 🌱 Beanstalk API

**Financial literacy platform — Node.js REST API + WebSocket server**

Backend API powering the Beanstalk mobile app and web portal.

## Features
- JWT authentication (mobile app users + web portal educators)
- Lesson session tracking
- Quiz results and scoring
- Course and content management
- Real-time chat via Socket.io
- Push notifications via OneSignal + Firebase
- File/image uploads via Google Cloud Storage
- Analytics via Google BigQuery

## Tech stack
- Node.js / Express 4.18
- Google Cloud BigQuery (analytics & data store)
- Google Cloud Storage (media uploads)
- Firebase Admin SDK (push notifications)
- Socket.io 4.7 (real-time chat)
- jsonwebtoken (authentication)
- nodemailer (email)

## Getting started

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Fill in all required values (see .env.example)

# Run in development
npm run dev

# Run in production
npm start
```

## API routes

### Mobile app (`/api`)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/signin` | Sign in |
| GET  | `/api/user/profile` | Get user profile |
| POST | `/api/session` | Log a lesson session |
| GET  | `/api/session` | Get lesson history |
| GET  | `/api/stores` | Browse course providers |
| GET  | `/api/clinicians` | Browse mentors |
| GET  | `/api/deals` | Get available rewards |
| POST | `/api/chat` | Send chat message |

### Web portal (`/api`)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/web/auth/signin` | Educator sign in |
| GET  | `/api/web/dispensary` | Get educator profile |
| PUT  | `/api/web/dispensary` | Update educator profile |
| GET  | `/api/web/stores` | Manage course locations |
| GET  | `/api/web/clinicians` | Manage mentor accounts |

## Security
- All secrets are loaded from environment variables — never hardcoded
- See `.env.example` for required variables
- GCP and Firebase credentials are loaded from file paths set in env vars
- JWT secret must be a strong random string (minimum 48 chars)
  ```bash
  openssl rand -base64 48
  ```

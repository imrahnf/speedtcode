# Speed(t)Code

> The ultimate typing speed test for developers. Race against time (and others) by typing real code snippets.

Improve your syntax muscle memory, track your WPM, and climb the leaderboards.

[**🏆 View the Hall of Fame**](#hall-of-fame) | [**🐞 Report a Bug**](https://forms.gle/GYKk7RmLJgxepnrz6) | [**▶️ Join a Lobby**](https://speedtcode.dev)

---

## Core Features

- **Real Code Challenges** - Type actual code snippets from popular problems
- **Real-Time Multiplayer** - Race against friends in live lobbies with WebSockets
- **Performance Tracking** - Track your WPM, accuracy, and personal records
- **Leaderboards** - Compete globally on the leaderboards
- **User Profiles** - View your stats and search your performance history
- **GitHub Authentication** - Sign in seamlessly with Firebase Auth

---

## Tech Stack

### Frontend
- Next.js
- Tailwind CSS
- SWR
- WebSockets

### Backend
- FastAPI
- Redis (Upstash)
- Firebase Admin
- WebSockets

### Deployment
- Google Cloud Run
- Vercel
- Docker

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Firebase project with GitHub auth enabled
- Upstash Redis database

### 1. Clone and Setup

```bash
git clone https://github.com/imrahnf/speedtcode.git
cd speedtcode
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\Activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (see Environment Setup below)
# Then run
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### 3. Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

### 4. Environment Setup

**Root `.env` (Backend)**
Get your Redis connection string from the [Upstash Console](https://console.upstash.com/).
```env
REDIS_URL=rediss://default:PASSWORD@HOST:6379
```

**Root `firebase-credentials.json`** (Backend)
Required for the backend to verify tokens.
1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service accounts.
2. Click **Generate new private key**.
3. Rename the file to `firebase-credentials.json` and place it in the root.

**`frontend/.env.local`** (Frontend)
Get these from Firebase Console → Project Settings → General → Your apps (Web).
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /healthz` | Health check | Server status |
| `GET /api/problems` | Get all problems | List of coding challenges |
| `GET /api/problems/{id}` | Get problem details | Problem metadata + code |
| `GET /api/problems/{id}/content/{lang}` | Get problem content | Specific language content |
| `POST /api/lobbies` | Create lobby | Multiplayer room creation |
| `GET /api/lobbies/{id}` | Get lobby info | Lobby details and players |
| `WS /ws/lobby/{id}/{userId}/{username}` | WebSocket | Real-time lobby connection |
| `POST /api/results` | Submit result | Save typing performance |
| `GET /api/leaderboard/{id}` | Get leaderboard | Top scores for problem |
| `GET /api/users/{username}` | Get user stats | User profile and stats |
| `GET /api/users/{username}/problems/{id}` | Get user problem stats | Performance on specific problem |
| `GET /api/users/me/stats` | Get my stats | Current user stats |

---

## Project Structure

```
speedtcode/
├── backend/
│   ├── main.py                    # FastAPI app & startup
│   ├── routers/
│   │   ├── general.py             # Health check
│   │   ├── problems.py            # Problem endpoints
│   │   ├── lobbies.py             # Multiplayer lobbies
│   │   ├── results.py             # Performance tracking
│   │   └── users.py               # User profiles
│   ├── services/
│   │   ├── redis_service.py       # Redis client wrapper
│   │   └── lobby_manager.py       # Lobby state management
│   ├── models/
│   │   └── problem_manager.py     # Problem loading
│   ├── problems/                  # Actual challenge files
│   │   ├── python/
│   │   ├── javascript/
│   │   └── cpp/
│   ├── Dockerfile                 # Container config
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js            # Landing page
│   │   │   ├── play/              # Singleplayer mode
│   │   │   ├── lobby/             # Multiplayer mode
│   │   │   └── profile/           # User profile
│   │   ├── components/
│   │   │   ├── typing/
│   │   │   │   └── TypingEngine.tsx   # Core typing logic
│   │   │   └── lobby/
│   │   │       ├── LobbySidebar.tsx
│   │   │       └── HostControls.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # Firebase auth state
│   │   └── lib/
│   │       └── firebase.ts        # Firebase config
│   └── package.json
│
├── cloudbuild.yaml                # Cloud Build config
└── README.md
```

---

## Docker Testing

Test the containerized backend locally before deploying:

```powershell
# Build image
docker build -f backend/Dockerfile -t speedtcode-backend:latest .

# Run container
docker run --rm -p 8000:8000 \
  --env-file .env \
  -v "${PWD}/firebase-credentials.json:/app/firebase-credentials.json:ro" \
  speedtcode-backend:latest
```

Verify: `curl http://localhost:8000/docs`

---

## Deployment

### Google Cloud Run (Backend)

**1. Setup**
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

**2. Create `cloud-run-env.yaml`**
Use the same values as your local setup. For `FIREBASE_CREDENTIALS_JSON`, paste the key file into one line.
```yaml
REDIS_URL: "rediss://default:PASSWORD@HOST:6379"
FIREBASE_CREDENTIALS_JSON: '{"type":"service_account",...}'
```

**3. Build & Deploy**
```bash
# Build in cloud
gcloud builds submit --config cloudbuild.yaml .

# Deploy
gcloud run deploy speedtcode-backend \
  --image gcr.io/YOUR_PROJECT_ID/speedtcode-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file cloud-run-env.yaml \
  --timeout 3600 \
  --min-instances 0 \
  --max-instances 1
```

## Help Improve Speed(t)Code
Have you tested the app? I'm looking for technical feedback on the stability and typing engine latency.
➣ **[Submit your Feedback & Bug Reports here](https://forms.gle/GYKk7RmLJgxepnrz6)**

*By submitting the form, you can opt-in to be featured in the Hall of Fame below!*

## Hall of Fame

A massive thank you to everyone who helped stress test the game and try to break the typing engine!

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/imrahnf">
        <img src="https://github.com/imrahnf.png" width="100px;" alt="User 1"/><br />
        <sub><b>imrahnf</b></sub>
      </a><br />
      Me!
    </td>
    <td align="center">
      <a href="https://github.com/imankamrann">
        <img src="https://github.com/imankamrann.png" width="100px;" alt="User 1"/><br />
        <sub><b>imankamrann</b></sub>
      </a><br />
      Tester
    </td>
        <td align="center">
      <a href="https://github.com/burhanf">
        <img src="https://github.com/burhanf.png" width="100px;" alt="User 1"/><br />
        <sub><b>burhanf</b></sub>
      </a><br />
      Tester
    </td>
        <td align="center">
      <a href="https://github.com/HARSHEE04">
        <img src="https://github.com/HARSHEE04.png" width="100px;" alt="User 1"/><br />
        <sub><b>HARSHEE04</b></sub>
      </a><br />
      Tester
    </td>
        <td align="center">
      <a href="https://github.com/MaryamElhamidi">
        <img src="https://github.com/MaryamElhamidi.png" width="100px;" alt="User 1"/><br />
        <sub><b>MaryamElhamidi</b></sub>
      </a><br />
      Tester
    </td>
    </td>
        <td align="center">
      <a href="https://github.com/MornTHEMorning">
        <img src="https://github.com/MornTHEMorning.png" width="100px;" alt="User 1"/><br />
        <sub><b>MornTHEMorning</b></sub>
      </a><br />
      Tester
    </td>  
  </tr>
</table>

---

Built with ❤️ by [Omrahn Faqiri](https://omrahnfaqiri.com)

# 🍽 Munchscene

AI-powered fairness engine for group restaurant decisions.

Instead of majority voting, Munchscene selects restaurants that maximize balanced group satisfaction — ensuring no one gets screwed over.

Built for a 24-hour hackathon.

---

## 🚀 Features

- Real-time group rooms (up to 10 users)
- Strict dietary filtering
- Budget & distance constraints
- Fairness-based scoring algorithm
- Ranked restaurant recommendations
- Conversational AI explanation (Gemini Flash)
- Clean + playful UI

---

## 🧠 How It Works

1. Users join a room.
2. Each enters preferences:
   - Budget
   - Dietary restrictions
   - Cuisine
   - Vibe
   - Distance radius
3. Munchscene:
   - Fetches restaurants from Google Places
   - Filters by hard constraints
   - Calculates per-user satisfaction
   - Applies fairness penalty (variance-based)
   - Ranks restaurants
4. Gemini Flash generates a friendly explanation.
5. Top result is highlighted.

---

## ⚖ Fairness Model

For each restaurant:

FinalScore = Mean(UserScores)  
             - λ × Variance(UserScores)  
             - μ × LowFloorPenalty  

This ensures:
- Balanced satisfaction
- No single user disproportionately unhappy

---

## 🛠 Tech Stack

Frontend:
- React (Vite)

Realtime:
- Firebase Realtime Database

Backend:
- Node.js + Express

APIs:
- Google Places API
- Gemini Flash (AI explanation)

---

## 📦 Installation

### 1. Clone repo

```bash
git clone https://github.com/your-org/munchscene.git
cd stormhacks
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start each app

Frontend:
```bash
npm run dev:client
```

Backend:
```bash
npm run dev:server
```

---

## 🔐 Environment Variables

Create a root `.env` from [`.env.example`](/Users/abhi/stormhacks/.env.example):

```
GOOGLE_PLACES_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
VITE_FIREBASE_API_KEY=your_client_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🎯 Demo Script

Scenario:

- Vegetarian user
- Budget-constrained user
- User who wants hype vibe
- User who prefers Italian

Munchscene:
- Eliminates restaurants violating constraints
- Ranks remaining options
- Explains compromise conversationally

Close with:

"Munchscene doesn't choose what most people want. It chooses what's fairest."

---

## 🛣 Post-Hackathon Roadmap

- Persistent profiles
- Preference learning
- Review mining
- Compromise history tracking
- Restaurant partnerships

---

## 👥 Team

Built by:
- Abhinav Badesha
- Binod Dayal
- Dilshan Dadrao
- Jeevan Bhullar

# 🍽 Munch Scene

AI-powered fairness engine for group restaurant decisions.

Instead of majority voting, Munch Scene selects restaurants that maximize balanced group satisfaction — ensuring no one gets screwed over.

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
3. Munch Scene:
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
cd munch-scene
```

### 2. Install dependencies

Frontend:
```bash
cd client
npm install
npm run dev
```

Backend:
```bash
cd server
npm install
node index.js
```

---

## 🔐 Environment Variables

Create `.env` in server:

```
GOOGLE_PLACES_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
FIREBASE_CONFIG=your_config_here
```

---

## 🎯 Demo Script

Scenario:

- Vegetarian user
- Budget-constrained user
- User who wants hype vibe
- User who prefers Italian

Munch Scene:
- Eliminates restaurants violating constraints
- Ranks remaining options
- Explains compromise conversationally

Close with:

"Munch Scene doesn't choose what most people want. It chooses what's fairest."

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

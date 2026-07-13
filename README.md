<div align="center">
  <img src="https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png" alt="React" width="60" />
  <img src="https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/nodejs/nodejs.png" alt="Node.js" width="60" />
  <h1>Mindcraft</h1>
  <p><strong>Your Academic Playground Awaits. Learn Together, Level Up.</strong></p>
  <p>A highly scalable, peer-to-peer college tutoring platform driven by Graph Databases, AI Voice Search, and Distributed Workflows.</p>
</div>

---

## 🚀 Overview

Mindcraft gamifies peer learning by connecting students based on what they want to learn and what they can teach. It transforms isolated academic struggles into a collaborative learning platform, unlock badges, maintain streaks, and ask doubts in their native languages using **Sarvam Voice AI**. 

Under the hood, Mindcraft is a production-grade monorepo featuring a **React (Vite)** frontend, an **Expo React Native** mobile app, and a robust **Node.js/Express** backend powered entirely by **Neo4j AuraDB**.

---

## 🏆 HackHazards '26: Partner Tracks Eligibility

Mindcraft was engineered from day one to natively leverage the technologies required for the following Partner Tracks:

### 1. Neo4j Track (Primary Database)
**AuraDB is not just an optional add-on; it is the core nervous system of Mindcraft.**
- **Graph Modeling:** Users, Skills, Departments, Matches, Chat Threads, Forums, and Badges are all mapped as nodes and relationships.
- **Why Graph?** Finding a peer tutor isn't a simple relational query. Mindcraft uses Neo4j to compute complex compatibility scores based on graph proximity (Shared Skills, Same College, Teaching/Learning intersections).
- **Core Role:** AuraDB handles *all* data persistence, chat logs, streak tracking, and the gamification engine.

### 2. Sarvam Track (Core AI Experience)
**Multilingual Voice AI and Automated Hint Generation.**
- **Vernacular Voice Search:** Students often struggle to type complex technical doubts. Using Sarvam's Speech-to-Text API, students can tap the microphone on the Find Mate screen and speak their queries in Indic languages (e.g., Hindi/English mix).
- **Automated Study Hints:** When a student posts a question in the Doubt Forum, the backend triggers Sarvam's Chat API (`sarvam-30b` / `105b`) to instantly generate a bilingual study hint, drastically reducing wait times for peer responses.

### 3. Render Workflows Track (Background Orchestration)
**Distributed Data Processing.**
- **Weekly Warrior Audit:** Calculating weekly streaks for thousands of users simultaneously would crash a simple API. 
- **The Workflow:** We utilize `@renderinc/sdk/workflows` to orchestrate a distributed pipeline (`src/workflows/weeklyAudit.js`). 
  - Stage 1: Fetches all active users.
  - Stage 2: Parallel execution (`evaluateUserWeeklyStreak`) processing 7-day login histories via Neo4j.
  - Stage 3: Batch update (`awardWeeklyWarriors`) minting new badges idempotently.

---

## 🛠 Tech Stack

- **Frontend:** React (Vite), Tailwind CSS, Framer Motion, Context API
- **Mobile:** React Native (Expo)
- **Backend:** Node.js, Express.js
- **Database:** Neo4j AuraDB (Primary), Firebase Auth (Authentication Identity)
- **AI / NLP:** Sarvam AI (Speech-to-Text, LLM Completions)
- **Real-Time:** WebSockets (Unified Notification & Chat Context)
- **DevOps/Orchestration:** Render, Vercel

---

## 📂 Repository Architecture

```txt
Mind-Craft/
├── backend/              # Node.js + Express API, Neo4j Graph, Render Workflows
│   ├── src/config/       # Neo4j & Firebase initializers
│   ├── src/routes/       # API endpoints (users, matching, doubts, chat)
│   ├── src/services/     # Sarvam AI wrappers, Badge logic, Matching logic
│   └── src/workflows/    # Render Workflows (weeklyAudit.js)
├── frontend-react/       # Vite React Web App
│   ├── src/context/      # AuthContext, NotificationContext (WebSockets)
│   ├── src/pages/        # Dashboard, Chat, Profile, Doubt Forum
│   └── mobile/           # Expo Native App codebase
├── render.yaml           # Blueprint for seamless Render API deployment
└── render.free.yaml      # Fallback blueprint for Render Free Tier
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js `v20+`
- Neo4j AuraDB instance
- Firebase Project (Auth enabled)
- Sarvam AI API Key

### 1. Environment Configuration

Clone the repository and set up the `.env` variables for both `backend/` and `frontend-react/`.

**Backend (`backend/.env`):**
```env
PORT=3000
NODE_ENV=development
NEO4J_URI=neo4j+s://<your-instance>.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>
SARVAM_API_KEY=<your-sarvam-key>
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

**Frontend (`frontend-react/.env`):**
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_FIREBASE_API_KEY=<firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
```

### 2. Installation & Running Locally

Install dependencies for the workspaces:

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Web Frontend
cd frontend-react
npm install
npm run dev

# Terminal 3: Mobile App (Optional)
cd frontend-react/mobile
npm install
npm start
```

---

## ☁️ Deployment

**Backend (Render):**
The backend is fully configured for Render via the `render.yaml` blueprint. Connect the repository in the Render Dashboard, select "Blueprint", and it will automatically provision the Node server and the Weekly Audit background workflow.

**Frontend (Vercel):**
Connect the `frontend-react` subdirectory to Vercel. Ensure you override the build command to standard Vite builds and supply the `VITE_API_BASE_URL` pointing to your Render backend.

---

## 📄 License
This project is licensed under the MIT License. Built for HackHazards '26.

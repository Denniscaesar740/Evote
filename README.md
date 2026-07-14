# 🗳️ UniVote: Cryptographic Blockchain E-Voting System
### ACSES UMaT Student Representative Elections Platform

UniVote is a secure, modern, end-to-end verifiable university e-voting application. It leverages a tamper-proof SHA-256 blockchain ledger to record voter ballots, ensuring voter anonymity and ledger immutability.

---

## 🚀 Key Production Features
1. **Cryptographic Ledger**: Proof-of-Work (PoW) mining for all ballots to guarantee tamper-free voter records.
2. **End-to-End Verifiability**: Auditor dashboard with instant cryptographic ledger integrity checks (verifies index sequentiality, hash continuity, and proof-of-work nonces).
3. **Single-Port Production Serving**: The Express backend is configured to automatically serve the built React client (`dist`) on a single port for easy deployment.
4. **Resilient Persistence**: Optimized SQLite backend using a transaction-safe, synchronous file-writing state manager.
5. **Real-time Live Simulation**: Live-mode simulations for active elections, including real-time charts, turnout percentages, and vote shares.

---

## 🛠️ Production Setup & Deployment

### 1. Build the Frontend
Compile the React SPA assets to the `dist` folder:
```bash
npm run build
```

### 2. Configure Environment Variables
Create or modify the `server/.env` file with your production parameters:
```env
PORT=5000
JWT_SECRET=your-secure-production-jwt-secret-key
JWT_EXPIRES_IN=15m
DB_PATH=./data/univote.db
UPLOAD_DIR=./uploads
CORS_ORIGIN=https://yourdomain.com,http://localhost:5000
```

### 3. Seed the Database
Initialize the production database with clean starting schemas, departments, administrative/auditor users, and the genesis block:
```bash
npm run seed
```

### 4. Run the Production Server
Start the unified application (Express server serving both the API and the React frontend):
```bash
npm run start
```
Once started, open **`http://localhost:5000`** in your browser.

---

## 🔐 Credentials & Seed Accounts

The seeding script generates the following default accounts for verification:

| Role | Student ID / Username | Password |
|------|------------------------|----------|
| **Admin** | `UMaT/ADM/001` | `admin123` |
| **Auditor** | `UMaT/AUD/001` | `audit123` |
| **Voter** | `UMaT/CSE/21/001` | `voter123` |

---

## 📈 System Architecture & Tech Stack
- **Frontend**: React 19, Recharts (Analytical Graphs), TailwindCSS, Lucide icons.
- **Backend**: Node.js, Express, SQL.js (SQLite file-buffered engine).
- **Blockchain**: SHA-256 Hash Chain with proof-of-work mining (mining difficulty target = `00` prefix).

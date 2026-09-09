# Quickstart & Validation Guide: CF Tracker Rebuild

**Feature**: `001-rebuild-cf-tracker` | **Date**: 2026-09-09

This guide provides end-to-end instructions for spinning up the modernized CF Tracker environment and validating all core capabilities against the specification and contracts.

---

## 1. Prerequisites

- **Python 3.11+**
- **Node.js 18+** & `npm` / `pnpm`
- **Docker & Docker Compose** (for PostgreSQL 15 and Redis 7)
- **Git**

---

## 2. Infrastructure Setup (Docker Compose)

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Verify services are healthy:
```bash
docker compose ps
```

- PostgreSQL will be running on `localhost:5432` (database: `cf_tracker`, user: `postgres`, password: `postgres_password`).
- Redis will be running on `localhost:6379`.

---

## 3. Backend Setup & Startup

1. **Navigate to backend and create virtual environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure Environment (`.env`)**:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:postgres_password@localhost:5432/cf_tracker
   REDIS_URL=redis://localhost:6379/0
   CF_API_KEY=your_key_here          # Optional
   CF_API_SECRET=your_secret_here    # Optional
   CF_RATE_LIMIT_DELAY=2.0
   ```

3. **Run Database Migrations**:
   ```bash
   alembic upgrade head
   ```

4. **Start the Celery Background Worker**:
   ```bash
   celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
   ```

5. **Start the FastAPI Development Server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

Interactive API docs will be available at: `http://localhost:8000/docs`.

---

## 4. Frontend Setup & Startup

1. **Navigate to frontend and install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment (`.env.local`)**:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   ```

3. **Start the Next.js Development Server**:
   ```bash
   npm run dev
   ```

The web application will be accessible at `http://localhost:3000`.

---

## 5. End-to-End Validation Scenarios

### Scenario A: Dashboard & Training Group Creation
1. Open `http://localhost:3000`. Verify summary cards display initial zeros or seeded counts.
2. Navigate to **Groups** -> Click **Create Group**. Enter name: `"Level 1 Training"`, description: `"ICPC Division 1"`, and default handles: `tourist, Petr, Radewoosh`.
3. Submit and verify the group appears in the group grid.

### Scenario B: Participant & Attendance Spreadsheet Upload
1. Navigate to **Spreadsheets** -> Click **Upload Spreadsheet**.
2. Select a sample CSV file containing columns `Name, Codeforces Handle, WhatsApp Number, University`.
3. Select type **Participants**, specify handle column as `"Codeforces Handle"`, and phone column as `"WhatsApp Number"`.
4. Upload an attendance sheet with type **Attendance**.
5. Link both spreadsheets to `"Level 1 Training"` via the group settings modal.

### Scenario C: Contest Addition & Asynchronous Standings Sync
1. Open `"Level 1 Training"` -> Click **Add Contest**.
2. Input Codeforces Contest ID: `1980` (Codeforces Round 950 Div. 3).
3. Set minimum solved to `3` (absolute) or `50%` (percentage).
4. Click **Add Contest**. Verify contest metadata (name, total problems) is retrieved and displayed.
5. Click **Refresh Results**. Verify that:
   - The UI immediately displays a non-blocking progress indicator (`HTTP 202 Accepted` task dispatch).
   - Celery worker executes the Codeforces fetch adhering to the 2.0-second rate limiter.
   - Contest results update with categorized counts: **Passed**, **Failed**, **Not Entered**.
6. Switch between **Results** (filtering passed/failed), **Standings** (ranked leaderboard with top 3 highlights), and **Progress** (historical charts).

### Scenario D: Virtualized Overview Matrix Verification
1. Open the group's **Overview** tab.
2. Verify the virtualized matrix table renders:
   - Sticky participant rank and handle columns on the left.
   - Horizontally scrollable contest score cells (`✅`, `❌`, `⚪`).
   - Summary columns for Passes, Solved, Attendance, and Points:
     $$\text{Points} = (\text{Passes} \times 5) + (\text{Solved} \times 1) + (\text{Attendance} \times 1)$$
3. Toggle contest filter chips (All, None, individual). Verify points and sums recalculate instantly in memory.
4. Click the spreadsheet details icon (`📋`) next to a participant handle. Verify the metadata drawer displays full student details.
5. Click on a participant's handle. Verify it opens a WhatsApp link formatted with `https://wa.me/20...` if a phone number exists, or their Codeforces profile if absent.

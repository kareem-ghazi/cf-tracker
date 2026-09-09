# Research & Technical Decisions: CF Tracker Rebuild

**Feature**: `001-rebuild-cf-tracker` | **Date**: 2026-09-09

This document consolidates the technical research, architecture evaluations, and decisions for migrating CF Tracker from a synchronous Flask/SQLite application to a decoupled, production-grade system powered by FastAPI, PostgreSQL, Redis/Celery, and Next.js.

---

## 1. Persistence Layer: PostgreSQL & Async SQLAlchemy 2.0

### Decision
Migrate from SQLite (`instance/`, `cf_tracker.db`) to PostgreSQL 15+ using **Async SQLAlchemy 2.0** (`AsyncSession`, `create_async_engine`) and the **`asyncpg`** driver. Use **Alembic** for schema migrations and PostgreSQL's native **`CITEXT`** extension for case-insensitive Codeforces handles.

### Rationale
- **Asynchronous I/O**: `asyncpg` is the fastest PostgreSQL driver for Python, preventing worker thread starvation during high-concurrency read/write operations.
- **Declarative 2.0 Standards**: Modern SQLAlchemy 2.0 typed syntax (`Mapped[...]`, `mapped_column(...)`) provides full static typing integration with mypy/pyright and Pydantic v2.
- **Native Case-Insensitive Handles (`CITEXT`)**: Codeforces treats handles case-insensitively (e.g., `tourist` equals `Tourist`). In SQLite, legacy code used Python `.lower()` calls ad-hoc, leading to potential discrepancies. Using PostgreSQL `CITEXT` makes handle comparisons, primary/foreign key lookups, and unique constraints natively case-insensitive without manual lowercasing.
- **JSONB for Spreadsheets**: Legacy `models/database.py` stored spreadsheet data as a raw text string. PostgreSQL `JSONB` provides indexed, structured document storage for arbitrary CSV headers and rows.

### Alternatives Considered
- **Tortoise ORM**: Simple Django-like async ORM, but lacks the robust migration tooling (Alembic) and enterprise reliability of SQLAlchemy.
- **SQLModel**: Good Pydantic/SQLAlchemy hybrid, but lags behind modern SQLAlchemy 2.0 async engine releases and adds an unnecessary abstraction layer.
- **Manual Python `.lower()` on raw `VARCHAR`**: Prone to bugs when joining tables or executing raw queries. `CITEXT` enforces consistency at the database engine level.

---

## 2. Background Task Queue & Rate Limiting (Redis + Celery)

### Decision
Implement **Celery** with **Redis 7+** as the message broker and result backend. Outbound Codeforces API calls are strictly governed by a Redis-based distributed token bucket rate limiter enforcing a minimum delay of **2.0 seconds** per request (max 0.5 req/s).

### Rationale
- **Non-Blocking Web Operations**: In the legacy Flask app, `/api/contests/<id>/refresh` called Codeforces synchronously inside the HTTP request. For large contests, this resulted in 10–30 second request pauses and HTTP gateway timeouts.
- **Codeforces Rate Limiting**: Codeforces enforces strict rate limits (IP bans on rapid consecutive calls). The worker queue guarantees that regardless of how many coaches trigger contest refreshes concurrently, outgoing calls to `codeforces.com/api` never exceed 1 request per 2 seconds.
- **Asynchronous Task Polling**: Endpoints triggering contest refreshes or batch imports return `HTTP 202 Accepted` with a `task_id`. The client polls `/api/v1/tasks/{task_id}` for progress updates (`PENDING`, `PROGRESS`, `SUCCESS`, `FAILURE`).

### Alternatives Considered
- **FastAPI `BackgroundTasks`**: In-process background tasks run in the web application process. If the server restarts, tasks are lost. They cannot enforce rate limits across multiple web worker processes or multiple server instances.
- **ARQ**: Lightweight async Redis queue. While elegant, Celery provides richer features for task retries with exponential backoff, rate limiting decorators (`rate_limit='30/m'`), and battle-tested monitoring via Flower.

---

## 3. Codeforces Client Modernization (Async HTTPX)

### Decision
Replace synchronous `requests` in `api/codeforces.py` with an asynchronous client using **`httpx.AsyncClient`**, maintaining HMAC-SHA512 request signing (`apiSig`), unofficial contestant handling, and exponential backoff retry logic.

### Rationale
- **Non-Blocking Network Calls**: Async HTTP client ensures worker threads remain unblocked during Codeforces network latency.
- **HMAC-SHA512 API Signing**: Preserves the existing authenticated request signature algorithm (`f"{rand}/{method}?{param_str}#{api_secret}"` hashed with SHA-512) for higher API limits and gym access.
- **Resilience**: Configured with a 30-second timeout, maximum 3 retries, and jittered exponential backoff for HTTP 429 (Too Many Requests) or 503 (Service Unavailable).

### Alternatives Considered
- **`aiohttp`**: Powerful, but `httpx` has cleaner integration with FastAPI/Starlette test clients and native support for both sync and async paradigms with identical API interfaces.

---

## 4. High-Performance Virtualized Overview Matrix (Next.js + TanStack Table)

### Decision
Replace legacy server-rendered Jinja2 loops in `templates/groups.html` with a modern React component utilizing **`@tanstack/react-table` v8** and **`@tanstack/react-virtual`** for 2D (row and column) virtualization.

### Rationale
- **Elimination of DOM Bloat**: A group with 300 participants and 40 contests creates over 15,000 table cells in raw HTML, causing severe scrolling stutter and memory bloat. Virtualization renders only the ~25 rows and ~10 columns visible in the viewport, maintaining a flat 60fps rendering speed.
- **Sticky Handle Column**: The participant rank and handle columns remain pinned (`position: sticky; left: 0; z-index: 10`) while the contest score matrix scrolls horizontally.
- **Client-Side State Reactivity**: Interactive chip filters (All / None / Toggle Contests) and column visibility switches (Passes, Solved, Attendance, Points) dynamically recompute totals in memory without network refetches:
  $$\text{Points} = (\text{Passes} \times 5) + (\text{Solved} \times 1) + (\text{Attendance} \times 1)$$

### Alternatives Considered
- **Plain HTML Table with CSS Scroll**: Causes severe performance degradation on large rosters.
- **AG Grid / Handsontable**: Heavy enterprise grid libraries with significant bundle size overhead and restrictive commercial licenses for advanced features. TanStack Table is headless, lightweight, and perfectly custom-styled with Tailwind CSS.

---

## 5. Metadata Integration & WhatsApp Communication

### Decision
Port and expand the legacy Egyptian phone formatting logic into a dedicated utility (`formatEgyptPhone`), generating direct WhatsApp deep links (`https://wa.me/20...`) with participant metadata modal drawers.

### Rationale
- Coaches frequently communicate urgent contest results, attendance reminders, and qualification notices to Egyptian university participants via WhatsApp.
- Normalizes diverse inputs (`010...`, `+2010...`, `002010...`, dashes, spaces) into clean E.164-compatible numbers prefixed with `20`.
- Clicking a participant's handle triggers WhatsApp directly if a phone number exists, or seamlessly falls back to opening their Codeforces profile page (`https://codeforces.com/profile/{handle}`).

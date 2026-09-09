<!--
Sync Impact Report:
- Version Change: Unratified Scaffold -> 1.0.0
- Principles Defined:
  - Principle I: Decoupled Target Architecture (FastAPI & Next.js) [Added]
  - Principle II: Legacy Inspection & Parity Fidelity [Added]
  - Principle III: Modern Persistence & Case-Insensitive Identity (PostgreSQL & Async SQLAlchemy 2.0) [Added]
  - Principle IV: Asynchronous Background Processing & Strict Rate Limiting (Redis + Celery/ARQ) [Added]
  - Principle V: Modern Virtualized Dark-Mode UI Standard (Next.js, Tailwind CSS, Shadcn UI, TanStack Table) [Added]
- Added Sections:
  - Technology Stack & Implementation Constraints
  - Migration & Development Workflow
  - Governance
- Removed Sections: None (replaced unratified template placeholders)
- Follow-up TODOs: None. All constitutional parameters are fully specified.
-->

# CF Tracker Constitution

## Core Principles

### Principle I: Decoupled Target Architecture (FastAPI & Next.js)
- The application MUST be architected as two decoupled systems: a backend REST API service built with FastAPI (Python 3.11+) and a frontend client application built with Next.js (TypeScript).
- The FastAPI backend MUST serve as the authoritative system for domain business logic, data persistence, Codeforces API communication, and background worker coordination. It MUST expose typed REST endpoints defined with Pydantic v2 schemas and OpenAPI documentation.
- The Next.js frontend MUST communicate with the backend strictly through HTTP REST APIs. Server-side HTML template rendering (Jinja2) on the backend is PROHIBITED. All UI state, page routing, and view presentation MUST reside in the frontend application.
- *Rationale*: Decoupling presentation from domain services enables independent scaling, prevents blocking web worker threads during third-party API calls, and allows modern client-side state management for real-time contest tracking.

### Principle II: Legacy Inspection & Parity Fidelity
- Prior to implementing any replacement component, developers MUST thoroughly inspect the existing legacy codebase to preserve operational fidelity:
  - Inspect existing ORM models in `models/database.py` (`Spreadsheet`, `Group`, `Contest`, `CachedResult`, `FetchHistory`, and `group_attendance`) to replicate exact data schemas, column types, relationships, constraints, and cascade delete semantics.
  - Inspect API client calls in `api/codeforces.py` to replicate Codeforces endpoint interactions (`contest.list`, `contest.standings`, `user.info`, `user.status`), HMAC-SHA512 signature generation (`apiSig`), caching rules, and problem scoring algorithms.
  - Inspect Flask route handlers in `app.py` to preserve all functional API contracts, request payloads, query parameters, CSV spreadsheet parsing rules, and pass/fail calculation criteria (both threshold counts and percentage-based rules).
- *Rationale*: The rebuild is an architectural modernization, not a change in business requirements. Rigorous legacy inspection ensures zero functional regression for competitive programming coaches and training groups.

### Principle III: Modern Persistence & Case-Insensitive Identity (PostgreSQL & Async SQLAlchemy 2.0)
- The persistence layer MUST migrate from SQLite (`instance/`, `cf_tracker.db`) to PostgreSQL, interfaced exclusively via Async SQLAlchemy 2.0 (`AsyncSession`, modern 2.0 query syntax) and `asyncpg`. Database migrations MUST be tracked and applied via Alembic.
- Codeforces handles across all tables (`contests.participants`, `cached_results.handle`, `groups.default_participants`, and parsed spreadsheet rows) MUST be treated case-insensitively across lookups, filtering, and uniqueness constraints (using PostgreSQL `CITEXT` or explicit case-insensitive indexing and normalization).
- Relational integrity MUST be strictly enforced with explicit foreign key constraints, high-performance indexes on query paths (e.g., `cf_contest_id`, `handle`, `group_id`), and UTC timestamp auditing (`created_at`, `cached_at`, `last_refreshed`).
- *Rationale*: SQLite cannot reliably support concurrent background worker writes and asynchronous web queries. Furthermore, Codeforces handles are case-insensitive in platform APIs, making database-level case insensitivity essential to prevent duplicate participant records and mismatched standings.

### Principle IV: Asynchronous Background Processing & Strict Rate Limiting (Redis + Celery/ARQ)
- Synchronous Codeforces API polling inside HTTP request lifecycles (formerly present in `app.py`) is STRICTLY PROHIBITED. All contest standings synchronization, participant auto-imports, batch additions, and periodic refreshes MUST execute asynchronously via a background task queue powered by Redis and Celery or ARQ.
- The background task system MUST enforce a strict rate limit of at least 2.0 seconds between successive outbound requests to the Codeforces API (maximum 1 request per 2 seconds). The task worker MUST implement exponential backoff with jitter when encountering HTTP 429, 503, or connection timeouts.
- Endpoints initiating refresh or sync operations MUST return an HTTP 202 Accepted response with a trackable task ID. The backend MUST provide job status endpoints allowing the frontend to monitor task progress without blocking HTTP connections.
- *Rationale*: Synchronous requests to Codeforces lead to request timeouts, web server worker exhaustion, and IP bans due to rate-limit violations. A centralized Redis-backed task queue guarantees rate-limit compliance while keeping the web API instantly responsive.

### Principle V: Modern Virtualized Dark-Mode UI Standard (Next.js, Tailwind CSS, Shadcn UI, TanStack Table)
- The user interface MUST implement a modern dark-mode first design system built with Next.js (App Router), TypeScript, Tailwind CSS, and Shadcn UI components.
- Matrix table views (replacing legacy template loops in `templates/groups.html` and `templates/contest.html`) MUST utilize `@tanstack/react-table` with row and column virtualization via `@tanstack/react-virtual` to ensure 60fps scrolling and rapid interaction across large participant rosters and multiple contests.
- The interface MUST provide seamless client-side filtering (filtering by passed, failed, or not entered status), real-time handle search, column toggles (e.g., Passes vs. Solved counts), spreadsheet drawer inspection, and clipboard export without full-page reloads.
- *Rationale*: Legacy Jinja2 templates create heavy DOM trees that degrade browser performance when displaying large rosters across multiple contests. Table virtualization combined with client-side state guarantees a fluid, responsive desktop experience.

## Technology Stack & Implementation Constraints

- **Backend Stack**:
  - Language & Runtime: Python 3.11+
  - Web Framework: FastAPI with Pydantic v2
  - ORM & Driver: SQLAlchemy 2.0 (Async) + `asyncpg`
  - Migrations: Alembic
  - Background Tasks: Celery or ARQ with Redis 7+
  - HTTP Client: HTTPX (Async)
- **Frontend Stack**:
  - Framework: Next.js 14+ (App Router)
  - Language: TypeScript (Strict mode enabled)
  - Styling & Components: Tailwind CSS, Shadcn UI, Lucide Icons
  - Table & Virtualization: `@tanstack/react-table` v8, `@tanstack/react-virtual`
  - State & Data Fetching: TanStack React Query (SWR / React Query)
- **Security & Configuration**:
  - Secrets and credentials (`CF_API_KEY`, `CF_API_SECRET`, database URIs, Redis URLs) MUST be loaded exclusively via environment variables and typed Pydantic Settings.
  - No secret tokens, credentials, or sensitive SQLite database files may be committed to version control.
- **API Standards**:
  - All REST endpoints MUST use standardized JSON responses with consistent error structures (`{"detail": "..."}` or `{"error": "...", "status_code": ...}`).
  - Endpoints MUST be versioned with an `/api/v1` prefix.

## Migration & Development Workflow

1. **Legacy Code Inspection & Contract Mapping**:
   - Audit `models/database.py`, `api/codeforces.py`, and `app.py`. Document all legacy API contracts, JSON structures, and business logic.
2. **Database & Persistence Layer Setup**:
   - Establish PostgreSQL database, define Async SQLAlchemy 2.0 models, configure Alembic migrations, and implement case-insensitive handle handling.
3. **Background Worker & Codeforces Client**:
   - Configure Redis, setup Celery/ARQ worker, and build the async Codeforces API client with the mandatory 2s rate limiter.
4. **FastAPI REST API Service**:
   - Implement `/api/v1` endpoints mirroring legacy routes with Pydantic schemas, asynchronous handlers, and task status polling.
5. **Next.js Frontend & Virtualized UI**:
   - Construct modern dark-mode application using Tailwind CSS and Shadcn UI. Implement virtualized matrix views with `@tanstack/react-table` and `@tanstack/react-virtual`.
6. **Parity Validation & Verification**:
   - Perform end-to-end verification comparing results, pass/fail threshold computations, and spreadsheet links against legacy behavior.

## Governance

- **Authority**: This constitution is the binding architectural and technical standard for CF Tracker. All technical decisions, specifications, plans, and implementations MUST strictly adhere to these principles.
- **Amendment Procedure**:
  - Any change to core principles, technology stack, or architectural constraints requires an explicit amendment proposal.
  - Amendments must document rationale, impact analysis, and migration steps for any existing code.
  - The constitution version MUST be updated in lockstep with amendments.
- **Versioning Policy**:
  - **MAJOR (X.0.0)**: Incompatible architectural shifts, principle deletions, or fundamental governance changes.
  - **MINOR (1.X.0)**: Addition of new principles, new sections, or materially expanded guidelines.
  - **PATCH (1.0.X)**: Wording clarifications, typo fixes, and non-semantic refinements.
- **Compliance & Quality Gates**:
  - Every specification generated via Spec Kit commands (`/speckit-specify`, `/speckit-plan`, `/speckit-tasks`) MUST verify compliance with this constitution before proceeding to implementation.
  - Code reviews and test gates MUST reject any PR that re-introduces synchronous external API polling, unvirtualized large matrix rendering, or case-sensitive handle bugs.

**Version**: 1.0.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-09

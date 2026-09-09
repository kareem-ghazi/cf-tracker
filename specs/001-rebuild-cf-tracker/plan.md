# Implementation Plan: CF Tracker Rebuild

**Branch**: `001-rebuild-cf-tracker` | **Date**: 2026-09-09 | **Spec**: [spec.md](file:///c:/Users/kareemghazi/Desktop/ICPC%20NMU/cf-tracker/specs/001-rebuild-cf-tracker/spec.md)

**Input**: Feature specification from `specs/001-rebuild-cf-tracker/spec.md`

## Summary

Rebuild CF Tracker from a legacy, synchronous Flask/SQLite prototype into a modern, production-grade decoupled web application. The backend is re-architected into an asynchronous FastAPI service utilizing PostgreSQL 15+ with Async SQLAlchemy 2.0 (`asyncpg`) and Redis-backed Celery workers enforcing strict Codeforces API rate limiting (1 request per 2s). The frontend is rebuilt as a Next.js 14+ application with TypeScript, Tailwind CSS, Shadcn UI, and high-performance virtualized matrix tables (`@tanstack/react-table` + `@tanstack/react-virtual`).

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.0+ / Node.js 18+ (Frontend)

**Primary Dependencies**:
- **Backend**: FastAPI, Pydantic v2, SQLAlchemy 2.0 (Async), `asyncpg`, Alembic, Celery, Redis, HTTPX
- **Frontend**: Next.js 14+ (App Router), React 18+, Tailwind CSS, Shadcn UI, Lucide Icons, `@tanstack/react-table` v8, `@tanstack/react-virtual`, TanStack React Query

**Storage**: PostgreSQL 15+ (with `citext` extension for case-insensitive handles and `jsonb` for spreadsheet datasets), Redis 7+ (message broker & distributed rate limiting)

**Testing**: `pytest`, `pytest-asyncio`, `pytest-mock` (Backend); Jest, React Testing Library (Frontend)

**Target Platform**: Dockerized Linux service containers, accessible via modern desktop and laptop web browsers

**Project Type**: Decoupled Web Application (FastAPI REST API + Next.js App Router Client)

**Performance Goals**:
- Virtualized overview matrix table renders 300+ participants and 40+ contests at 60fps scrolling speed without DOM stutter.
- Backend API response times < 100ms for cached contest results and overview matrix queries.
- Dashboard analytics response time < 500ms.

**Constraints**:
- Outbound Codeforces API calls MUST enforce at least a 2.0-second delay between consecutive requests to prevent IP bans.
- Zero server-side Jinja2 template rendering in backend; all views reside in Next.js frontend.
- All Codeforces handles across default lists, spreadsheets, and contest results MUST match case-insensitively.
- Egyptian phone numbers MUST be normalized to `20...` for WhatsApp deep links.

**Scale/Scope**: Support 50+ training groups, 500+ participants per group, and 100+ contests with seamless historical tracking.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Requirement | Status | Verification & Design Compliance |
|---|---|---|---|
| **Principle I: Decoupled Architecture** | FastAPI backend + Next.js frontend; no Jinja2 templates on backend. | **PASS** | Clear physical separation between `backend/` and `frontend/`. Backend exposes only JSON REST APIs at `/api/v1`. |
| **Principle II: Legacy Inspection Fidelity** | Preserve schemas in `models/`, endpoints/logic in `app.py`, CF client in `api/`. | **PASS** | All legacy routes mapped to FastAPI routers. Models, formulas, and pass threshold options replicated with 100% parity. |
| **Principle III: Modern Persistence** | PostgreSQL + Async SQLAlchemy 2.0 + `CITEXT` case-insensitivity. | **PASS** | `CITEXT` extension used on `cached_results.handle`. Async SQLAlchemy 2.0 declarative models with Alembic migrations. |
| **Principle IV: Background Processing** | Redis + Celery/ARQ with $\ge$ 2.0s Codeforces rate limiter; HTTP 202 task dispatch. | **PASS** | Outbound Codeforces fetches offloaded to Celery worker with Redis token-bucket limiter. Async task status polling endpoint. |
| **Principle V: Virtualized Dark UI** | Next.js + Tailwind + Shadcn UI + TanStack Table/Virtual 2D matrix. | **PASS** | `@tanstack/react-table` with `@tanstack/react-virtual` for sticky handle column and row/column virtualization. |

## Project Structure

### Documentation (this feature)

```text
specs/001-rebuild-cf-tracker/
├── plan.md              # This file (Implementation plan)
├── research.md          # Technical decisions & architecture research
├── data-model.md        # Relational schema, models, indexes, and scoring rules
├── quickstart.md        # End-to-end setup and validation guide
├── contracts/           # API interface contracts
│   └── api-contracts.md # REST endpoints & OpenAPI schemas
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository layout)

```text
cf-tracker/
├── backend/
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── router.py
│   │   │   │   └── endpoints/
│   │   │   │       ├── analytics.py
│   │   │   │       ├── groups.py
│   │   │   │       ├── contests.py
│   │   │   │       ├── spreadsheets.py
│   │   │   │       ├── tasks.py
│   │   │   │       └── codeforces.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── rate_limiter.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── group.py
│   │   │   ├── contest.py
│   │   │   ├── result.py
│   │   │   ├── spreadsheet.py
│   │   │   └── association.py
│   │   ├── schemas/
│   │   │   ├── analytics.py
│   │   │   ├── group.py
│   │   │   ├── contest.py
│   │   │   ├── result.py
│   │   │   ├── spreadsheet.py
│   │   │   └── task.py
│   │   ├── services/
│   │   │   ├── codeforces.py
│   │   │   ├── scoring.py
│   │   │   ├── spreadsheet_parser.py
│   │   │   └── matrix_builder.py
│   │   ├── workers/
│   │   │   ├── celery_app.py
│   │   │   └── tasks.py
│   │   └── main.py
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── conftest.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic.ini
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Analytics Dashboard
│   │   │   ├── groups/
│   │   │   │   ├── page.tsx          # Training Groups List
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # Group Management & Overview Matrix
│   │   │   ├── contests/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # Contest Results, Standings & Progress
│   │   │   └── spreadsheets/
│   │   │       └── page.tsx          # CSV Spreadsheets Management
│   │   ├── components/
│   │   │   ├── ui/                   # Shadcn UI primitives
│   │   │   ├── matrix/               # Virtualized Overview Matrix Table
│   │   │   ├── contest/              # Results, Standings, Progress Chart
│   │   │   ├── spreadsheet/          # CSV Upload modal, Column mapper, Drawer
│   │   │   └── layout/               # App Header, Nav, Theme Provider
│   │   ├── hooks/                    # Custom data-fetching & matrix hooks
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Axios/Fetch wrapper for /api/v1
│   │   │   ├── utils.ts
│   │   │   └── phone-formatter.ts    # Egypt phone formatter (+20) & WhatsApp link
│   │   └── types/                    # TypeScript interfaces matching API schemas
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml                # PostgreSQL, Redis, Backend, Worker, Frontend
└── specs/
    └── 001-rebuild-cf-tracker/
```

**Structure Decision**: A decoupled two-tier web application architecture (`backend/` and `frontend/`) with Docker Compose orchestrating PostgreSQL and Redis. This strictly separates presentation concerns from data services, guarantees horizontal scalability, and allows independent development and testing of backend endpoints and frontend virtualized components.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No constitutional violations identified. The architecture strictly adheres to all 5 core principles.*

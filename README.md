# AIMS — AI-Powered Multi-Agent Inventory Reconciliation System

> **Enterprise-grade inventory governance platform** that uses multi-agent AI (Google Gemini + LangGraph) to automatically discover, reconcile, and audit infrastructure asset discrepancies between authoritative CMDB registers and live network scan snapshots.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [User Roles & Permissions](#user-roles--permissions)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Running with Docker (Recommended)](#running-with-docker-recommended)
  - [Running Locally (Development)](#running-locally-development)
- [Test Data](#test-data)
- [PDF Report Download Fix](#pdf-report-download-fix)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

AIMS is a full-stack inventory reconciliation system built for enterprise IT governance and compliance. It automates the comparison of:

- **Baseline CMDB files** (CSV) — the authoritative source-of-truth registry of all IT assets
- **Live network scanner snapshots** (JSON) — real-time discovery output of active infrastructure

The system identifies four categories of discrepancies, scores governance posture, generates AI-powered executive reports, and maintains a full audit trail of all user actions.

---

## Key Features

| Feature | Description |
|---|---|
| 🤖 **Multi-Agent AI Reconciliation** | LangGraph agent graph powered by Google Gemini 1.5 Flash for deep discrepancy analysis |
| 📊 **Executive PDF Reports** | ReportLab-generated formal compliance audit PDFs with 9 governance sections |
| 🔐 **Role-Based Access Control** | Three-tier RBAC: Administrator, Analyst, Auditor, Viewer |
| 📜 **Full Audit Trail** | Every user action (login, upload, reconciliation, report download) is logged |
| 💬 **AI Chatbot** | Context-aware Gemini-powered chatbot for querying reconciliation results |
| 📁 **CSV & JSON Upload** | Drag-and-drop file upload with validation and parsing |
| 🏥 **Asset Health Scoring** | Automated governance score, audit readiness index, and risk exposure score |
| 🔄 **Real-Time Status** | Live reconciliation status polling with detailed discrepancy tables |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│              React + TypeScript + Vite SPA                      │
│              (Port 80 via Nginx reverse proxy)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/REST (proxied /api/v1)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX REVERSE PROXY                         │
│   /api/v1/* → backend:8000    /  → index.html (SPA fallback)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (Port 8000)                │
│                                                               │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ /auth     │  │ /users    │  │ /inventory│  │ /reports  │   │
│  │ JWT login │  │ RBAC CRUD │  │ Upload,   │  │ Generate, │   │
│  │ /me       │  │ Management│  │ Reconcile │  │ Download  │   │
│  └───────────┘  └───────────┘  │ Chatbot   │  └───────────┘   │
│                                └───────────┘                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           MULTI-AGENT AI PIPELINE (LangGraph)           │  │
│  │  Discovery → Analysis → Severity → Recommendations →    │  │
│  │  Executive Summary → Report Compilation                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           REPORTLAB PDF ENGINE                          │  │
│  │  9-section executive audit report (Times New Roman)     │  │
│  │  Stored to Docker volume: backend_reports               │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                           │ SQLAlchemy ORM
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL 15 Database (Port 5432)                 │
│  Tables: users, audit_logs, inventory_uploads, assets,          │
│          reconciliations, discrepancies, reports                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| Web Framework | FastAPI 0.109.0 |
| ORM | SQLAlchemy 2.0.25 |
| Database | PostgreSQL 15 (via psycopg2) |
| Auth | JWT (python-jose), passlib/bcrypt |
| AI / LLM | Google Gemini 1.5 Flash (`google-generativeai 0.8.5`) |
| Agent Graph | LangGraph 0.2.60 + LangChain Google GenAI |
| PDF Engine | ReportLab 4.1.0 |
| Data Processing | Pandas 2.1.4 |
| ASGI Server | Uvicorn |
| Settings | Pydantic Settings v2 |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Routing | React Router v6 |
| HTTP Client | Axios |
| State Management | Zustand |
| Animations | Framer Motion |
| Icons | Lucide React |
| Styling | Tailwind CSS |

### Infrastructure
| Component | Technology |
|---|---|
| Containerisation | Docker + Docker Compose |
| Frontend Server | Nginx Alpine |
| Database | PostgreSQL 15 Alpine |
| Volumes | `backend_uploads`, `backend_reports`, `postgres_data` |

---

## Project Structure

```
Project/
│
├── docker-compose.yml              # Orchestrates db, backend, frontend containers
├── .env.example                    # Example environment variables template
├── .gitignore
│
├── backend/
│   ├── Dockerfile                  # Python 3.11-slim build
│   ├── requirements.txt            # All Python dependencies
│   ├── .env                        # Backend environment variables (JWT, DB, Gemini API)
│   │
│   └── app/
│       ├── main.py                 # FastAPI app entry, CORS, router inclusion, seeding
│       │
│       ├── core/
│       │   ├── config.py           # Pydantic Settings (env vars reader)
│       │   ├── database.py         # SQLAlchemy engine, Base, SessionLocal
│       │   └── security.py         # JWT creation/verification, RBAC dependencies
│       │
│       ├── models/
│       │   ├── user.py             # User, UserRole SQLAlchemy models
│       │   ├── inventory.py        # InventoryUpload, Asset, Reconciliation,
│       │   │                       #   Discrepancy, Report, ReconciliationStatus,
│       │   │                       #   DiscrepancyType models
│       │   └── audit.py            # AuditLog, AuditActionType models
│       │
│       ├── schemas/
│       │   ├── user.py             # Pydantic request/response schemas for users
│       │   └── inventory.py        # Pydantic schemas for inventory & reconciliation
│       │
│       ├── api/
│       │   └── routes/
│       │       ├── __init__.py
│       │       ├── auth.py         # POST /auth/login, GET /auth/me
│       │       ├── users.py        # CRUD /users/, password reset, status toggle
│       │       ├── inventory.py    # Upload CSV/JSON, reconcile, list reconciliations,
│       │       │                   #   chatbot endpoint
│       │       ├── reports.py      # POST /generate/:id, GET /download/:id, GET /list
│       │       └── audit.py        # GET /audit/logs with filters
│       │
│       └── services/
│           ├── ai_service.py       # LangGraph multi-agent pipeline:
│           │                       #   Discovery → Analysis → Severity →
│           │                       #   Recommendations → Executive Summary
│           ├── reconciliation_service.py  # CSV/JSON comparison engine,
│           │                             #   discrepancy detection & DB persistence
│           ├── report_service.py   # ReportLab PDF 9-section generator,
│           │                       #   auto-cleanup of old reports (keeps latest 5)
│           ├── upload_service.py   # Multipart file saving to /uploads volume
│           ├── user_service.py     # User CRUD, password hashing
│           └── audit_service.py    # Audit log insertion helper
│
├── frontend/
│   ├── Dockerfile                  # Node 20 build + Nginx Alpine production stage
│   ├── nginx.conf                  # Nginx: /api/ proxy, SPA fallback
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx                # React root entry
│       ├── App.tsx                 # Router definition, protected route wrapper
│       ├── index.css               # Global Tailwind + custom design tokens
│       ├── vite-env.d.ts
│       │
│       ├── pages/
│       │   ├── LoginPage.tsx           # JWT login form
│       │   ├── DashboardPage.tsx       # System overview, KPIs, agent status
│       │   ├── UploadPage.tsx          # CSV + JSON file upload, reconciliation trigger
│       │   ├── ReconciliationPage.tsx  # Reconciliation history, discrepancy tables,
│       │   │                          #   PDF download per run
│       │   ├── ReportsPage.tsx         # Executive Reporting Center, preview modal,
│       │   │                          #   PDF download
│       │   ├── AuditLogsPage.tsx       # Paginated audit logs, deep-link to reports
│       │   ├── ChatbotPage.tsx         # AI chatbot with context-aware queries
│       │   └── UserManagementPage.tsx  # Admin-only IAM panel
│       │
│       ├── components/
│       │   ├── Layout.tsx          # Sidebar navigation, top bar, route shell
│       │   ├── LoadingSpinner.tsx  # Shared loading indicator
│       │   └── ProtectedRoute.tsx  # Route guard: checks auth token
│       │
│       ├── services/
│       │   ├── api.ts              # Axios instance, auth interceptor,
│       │   │                       #   authAPI, usersAPI, inventoryAPI,
│       │   │                       #   reportsAPI, auditAPI
│       │   └── downloadService.ts  # Centralised PDF download helper:
│       │                           #   header logging, UUID→business name mapping,
│       │                           #   %PDF signature validation, forced filename
│       │
│       ├── stores/
│       │   ├── authStore.ts        # Zustand store: user, token, login/logout
│       │   └── reconStore.ts       # Zustand store: reconciliations list, fetching
│       │
│       ├── types/
│       │   └── index.ts            # TypeScript interfaces: User, Report,
│       │                           #   Reconciliation, Discrepancy, AuditLog
│       │
│       └── utils/
│           └── helpers.ts          # formatDate, getSeverityColor,
│                                   #   getDiscrepancyLabel, getDiscrepancyColor
│
└── test_data/
    ├── baseline.csv                # Sample CMDB register (3 assets)
    └── scanner.json                # Sample live scan snapshot (3 assets, 1 drift)
```

---

## Database Schema

```
users
  id, username, email, full_name, hashed_password, role,
  is_active, status, must_change_password, created_at

audit_logs
  id, user_id → users, action (AuditActionType enum),
  action_category, details, created_at, username

inventory_uploads
  id, filename, upload_type (CSV|JSON), uploaded_by_id → users,
  total_records, upload_date

assets
  id, source_upload_id → inventory_uploads, asset_id, asset_name,
  asset_type, location, status, configuration (JSON), raw_data (JSON)

reconciliations
  id, csv_upload_id → inventory_uploads, json_upload_id → inventory_uploads,
  initiated_by_id → users, status (PENDING|IN_PROGRESS|COMPLETED|FAILED),
  total_csv_assets, total_json_assets, missing_assets_count,
  untracked_assets_count, config_mismatch_count, naming_mismatch_count,
  ai_analysis (Text), recommendations (JSON), executive_summary (Text),
  started_at, completed_at

discrepancies
  id, reconciliation_id → reconciliations,
  discrepancy_type (MISSING_ASSET|UNTRACKED_ASSET|CONFIG_MISMATCH|NAMING_MISMATCH),
  csv_asset_id, json_asset_id, csv_data (JSON), json_data (JSON),
  severity, details, root_cause, recommended_action,
  business_impact, estimated_effort, expected_risk_reduction, created_at

reports
  id, reconciliation_id → reconciliations, generated_by_id → users,
  report_type (PDF), file_path, executive_summary (Text), generated_at
```

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | ❌ | Obtain JWT token |
| `GET` | `/auth/me` | ✅ | Get current user profile |
| `POST` | `/auth/change-password` | ✅ | Change own password |

### Users

| Method | Endpoint | Auth | Role |
|---|---|---|---|
| `GET` | `/users/` | ✅ | Administrator |
| `POST` | `/users/` | ✅ | Administrator |
| `GET` | `/users/{id}` | ✅ | Administrator |
| `PUT` | `/users/{id}` | ✅ | Administrator |
| `POST` | `/users/{id}/reset-password` | ✅ | Administrator |
| `POST` | `/users/{id}/status` | ✅ | Administrator |
| `DELETE` | `/users/{id}` | ✅ | Administrator |

### Inventory

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/inventory/upload-csv` | ✅ | Upload baseline CMDB CSV |
| `POST` | `/inventory/upload-json` | ✅ | Upload live scanner JSON |
| `GET` | `/inventory/uploads` | ✅ | List uploaded files |
| `POST` | `/inventory/reconcile` | ✅ | Trigger reconciliation run |
| `GET` | `/inventory/reconciliations` | ✅ | List all reconciliation runs |
| `GET` | `/inventory/reconciliations/{id}` | ✅ | Get single reconciliation detail |
| `POST` | `/inventory/chatbot` | ✅ | Query AI chatbot |

### Reports

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/reports/generate/{recon_id}` | ✅ | Generate PDF report for reconciliation |
| `GET` | `/reports/download/{report_id}` | ✅ | Download PDF as `FileResponse` with `Content-Disposition: attachment; filename="AIMS_Report_<id>.pdf"` |
| `GET` | `/reports/` | ✅ | List all generated reports |

### Audit

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/audit/logs` | ✅ | Paginated audit log with filters |

---

## User Roles & Permissions

| Feature | Administrator | Analyst | Auditor | Viewer |
|---|:---:|:---:|:---:|:---:|
| Upload CSV/JSON | ✅ | ✅ | ❌ | ❌ |
| Run Reconciliation | ✅ | ✅ | ❌ | ❌ |
| Generate Reports | ✅ | ✅ | ✅ | ❌ |
| Download Reports | ✅ | ✅ | ✅ | ✅ |
| View Audit Logs | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| AI Chatbot | ✅ | ✅ | ✅ | ✅ |

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/) (included with Docker Desktop)
- A **Google Gemini API key** (for AI analysis and chatbot)

### Environment Configuration

1. Copy the example env file:
   ```bash
   cp .env.example backend/.env
   ```

2. Edit `backend/.env` and fill in your Gemini API key:
   ```dotenv
   JWT_SECRET_KEY=your-strong-jwt-secret-key-here
   JWT_ALGORITHM=HS256
   JWT_EXPIRATION_HOURS=24

   GEMINI_API_KEY=your-google-gemini-api-key

   DATABASE_URL=postgresql://postgres:postgres@db:5432/inventory_db

   BACKEND_HOST=0.0.0.0
   BACKEND_PORT=8000
   DEBUG=false
   ```

   > **Get a Gemini API key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and generate a free key.

### Running with Docker (Recommended)

```bash
# Clone / extract the repository
cd Project/

# Build and start all services (db, backend, frontend)
docker compose up --build -d

# Check all containers are healthy
docker ps
```

Access the application at: **http://localhost**

**Default admin credentials:**
| Username | Password |
|---|---|
| `admin` | `admin123` |

> ⚠️ You will be prompted to change the password on first login.

**Port mapping:**
| Service | Internal Port | Host Port |
|---|---|---|
| Frontend (Nginx) | 80 | **80** |
| Backend (Uvicorn) | 8000 | **8001** |
| Database (PostgreSQL) | 5432 | **5433** |

### Running Locally (Development)

**Backend:**
```bash
cd Project/backend

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your local Postgres URL

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd Project/frontend

# Install dependencies
npm install

# Set the API base URL
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local

# Start the dev server
npm run dev
```

Access the dev frontend at: **http://localhost:5173**

---

## Test Data

The `test_data/` directory includes ready-to-use sample files:

### `baseline.csv` — CMDB Registry (3 assets)
```csv
asset_id,asset_name,asset_type,environment
srv-web-01,Web Server 01,Server,Production
vm-db-02,Database VM 02,VM,Staging
db-sql-03,SQL Server 03,Database,Production
```

### `scanner.json` — Live Scan Snapshot (3 assets)
```json
[
  { "asset_id": "srv-web-01", "asset_name": "Web Server 01", ... },
  { "asset_id": "vm-db-02",   "asset_name": "Database VM 02 Drifted", ... },
  { "asset_id": "net-switch-04", "asset_name": "Core Switch 04", ... }
]
```

**Expected discrepancies after reconciliation:**
| Type | Asset | Detail |
|---|---|---|
| `NAMING_MISMATCH` | `vm-db-02` | Name drifted from "Database VM 02" → "Database VM 02 Drifted" |
| `MISSING_ASSET` | `db-sql-03` | Present in CMDB, missing from live scan |
| `UNTRACKED_ASSET` | `net-switch-04` | Present in live scan, not in CMDB |

**Usage:**
1. Upload `baseline.csv` as CSV Baseline on the **Workspace** page
2. Upload `scanner.json` as JSON Scanner Snapshot
3. Click **Run Reconciliation** — AI agents will analyse and score the run
4. Navigate to **Reports** → **Compile PDF Report** → **Download PDF**

---

## PDF Report Download Fix

The download flow was audited and hardened in v1.1:

- **Root cause verified**: Backend always returned `FileResponse` with `Content-Disposition: attachment; filename="AIMS_Report_{id}.pdf"`. The UUID-looking filenames reported were OS-generated fallback names when the browser failed to read the `Content-Disposition` header.
- **Fix 1 — Backend CORS**: Added `expose_headers=["Content-Disposition"]` to `CORSMiddleware` in `main.py` so the header is accessible from the browser.
- **Fix 2 — Shared Download Service**: Introduced `frontend/src/services/downloadService.ts` which:
  - Logs response headers and blob type/size to the browser console
  - Reads the `Content-Disposition` header and maps UUID names → `AIMS_Report_{id}.pdf`
  - Forces filename to `AIMS_Report_{id}.pdf` as a final safeguard
  - Validates the first 4 bytes of the blob for the `%PDF` magic number
  - No `window.open()` or direct URL navigation — always uses `Blob → Object URL → <a>` trigger
- **Fix 3 — Centralised**: `ReportsPage.tsx`, `ReconciliationPage.tsx` all use the same `downloadReportFile(reportId)` service. Audit log deep-links redirect to `ReportsPage` which uses the same service.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `Container inventory_backend` fails health check | Wait 30–60 seconds for the backend to initialise the DB schema |
| Gemini AI returns quota errors | Add or rotate your `GEMINI_API_KEY` in `backend/.env` and rebuild |
| PDF download saves as unnamed/UUID file | Ensure the backend is rebuilt with the latest `main.py` (CORS fix) and the frontend uses `downloadService.ts` |
| Cannot login after password change | Clear `localStorage` in the browser and reload |
| `docker compose up` fails on Windows | Ensure Docker Desktop is running and WSL2 is enabled |
| Port 80 already in use | Change `"80:80"` to `"8080:80"` in `docker-compose.yml` and access at `http://localhost:8080` |

---

## License

This project is for educational and demonstration purposes. All AI analysis is powered by Google Gemini and is subject to [Google's Generative AI Terms of Service](https://ai.google.dev/terms).

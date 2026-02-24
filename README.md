# BizOps AI

**Owner & sole contributor:** AJ (Ahmed Jouini)

---

AI-powered business operations dashboard: connect to business data, surface real-time KPIs, detect anomalies, and use natural language Q&A over your data with an LLM.

## Features

- **Backend (FastAPI)**: REST API for data ingestion, KPI tracking, and LLM integration.
- **Anomaly Detection (Scikit-Learn)**: Uses `IsolationForest` to flag unusual patterns in sales and traffic.
- **BIZOPS Assist (LangChain + OpenAI/Ollama)**: Natural language Q&A over the SQL database.
- **Frontend (React + Tailwind + Recharts)**: Dark-mode dashboard with interactive charts and glassmorphism.
- **Dockerized**: One-command setup for Postgres, Redis, Backend, and Frontend.

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, Pandas, Scikit-Learn, LangChain, OpenAI/Ollama.
- **Frontend**: React, Tailwind CSS, Recharts, Lucide icons.
- **Infrastructure**: PostgreSQL, Redis, Docker, Nginx (prod).

## Quick Start

1. **Clone the repository**
2. **Setup environment variables**:
   - Copy `.env.example` to `.env`
   - Add your `OPENAI_API_KEY` to `.env` (or use Ollama in Settings).
3. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```
   Or use **`start-dashboard.bat`** for local testing (SQLite, no Docker).
4. **Access the application**:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8000`
   - API Docs: `http://localhost:8000/docs`

## Data Ingestion

The system ingests sample data from `data/sample_data.csv` on first startup if the database is empty. You can replace this file with your own metrics or use the upload API.

## Project Structure

- `backend/`: FastAPI application code.
- `frontend/`: React application code.
- `data/`: CSV data sources.
- `docker-compose.yml`: Service orchestration.

---

## Attribution & contributors

All contributions and ownership: **AJ (Ahmed Jouini)**.

See [AUTHORS](AUTHORS) and [CONTRIBUTORS](CONTRIBUTORS) for details.

---

**BizOps AI** — by AJ (Ahmed Jouini).

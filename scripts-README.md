# BizOps AI – Dashboard scripts (testing & development)

## Start the dashboard (no Docker)

**`start-dashboard.bat`** – Double-click or run from the project root.

- Creates a Python venv in `backend\venv` if missing and installs backend deps.
- Installs frontend npm packages if `frontend\node_modules` is missing.
- Starts the **backend** in a new window (port 8000) and the **frontend** in another (port 5173).
- Uses **SQLite** so you don’t need Postgres or Redis.
- Creates `.env` from `.env.example` if `.env` doesn’t exist.
- Opens `http://localhost:5173` in your browser.

**Requirements:** Python 3.11+ and Node.js 18+ on `PATH`.

---

## Start with Docker (full stack)

**`start-dashboard-docker.bat`** – For Postgres + Redis + backend + frontend.

- Runs `docker-compose up --build`.
- Ensure `.env` exists (copy from `.env.example` and set `OPENAI_API_KEY`, etc.).

---

## Update dependencies (development)

**`update-dashboard.bat`** – Run when you pull new code or change dependencies.

- Updates backend: `pip install -r backend/requirements.txt`.
- Updates frontend: `npm install` in `frontend/`.
- Optional: uncomment the `git pull` lines in the script to pull latest code before updating.

---

## Stopping

- **Without Docker:** Close the “BizOps Backend” and “BizOps Frontend” command windows.
- **With Docker:** `Ctrl+C` in the Docker window, or `docker-compose down` in the project folder.

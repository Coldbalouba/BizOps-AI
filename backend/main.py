from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from typing import List, Optional
import bcrypt

from database import engine, Base, get_db, SessionLocal
from services.data_service import ingest_csv_data, get_all_metrics
from services.anomaly_service import detect_anomalies
from services.chat_service import get_chat_response
from services.upload_service import process_spreadsheet, process_pdf
from models import DailyMetric, Anomaly, User, UserSettings
from schemas import DailyMetricSchema, AnomalySchema, ChatRequest

# app = FastAPI...
app = FastAPI(title="BizOps AI - API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Ingest sample data if db is empty
    db = SessionLocal()
    try:
        if db.query(DailyMetric).count() == 0:
            csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "sample_data.csv")
            ingest_csv_data(db, csv_path)
            detect_anomalies(db)
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "BizOps AI API is running"}

@app.get("/api/metrics", response_model=List[DailyMetricSchema])
async def read_metrics(db: Session = Depends(get_db)):
    return get_all_metrics(db)

@app.get("/api/anomalies", response_model=List[AnomalySchema])
async def read_anomalies(db: Session = Depends(get_db)):
    return db.query(Anomaly).order_by(Anomaly.metric_date.desc()).all()

@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    metrics = db.query(DailyMetric).all()
    if not metrics:
        return {"total_revenue": 0, "total_orders": 0, "active_customers": 0}
    
    total_rev = sum(m.revenue for m in metrics)
    total_orders = sum(m.orders for m in metrics)
    total_customers = sum(m.customers for m in metrics)
    
    return {
        "total_revenue": total_rev,
        "total_orders": total_orders,
        "active_customers": total_customers
    }

@app.get("/api/chat")
async def chat_get(
    query: str,
    user_id: Optional[int] = None,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
    api_base_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """GET variant: same as POST but params in query string (for proxies/caches that only allow GET)."""
    user_settings = _build_chat_settings(
        db, user_id=user_id, llm_provider=llm_provider, llm_model=llm_model, api_base_url=api_base_url
    )
    if not user_settings:
        raise HTTPException(
            status_code=400,
            detail="Add query params: llm_provider=ollama&llm_model=llama3.2&api_base_url=http://localhost:11434",
        )
    try:
        response = get_chat_response(query, user_settings)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/chat/{user_id_path}")
async def chat_get_with_id(
    user_id_path: int,
    query: str,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
    api_base_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """GET /api/chat/1 etc.: user_id from path so requests to /api/chat/1 don't 405."""
    user_settings = _build_chat_settings(
        db, user_id=user_id_path, llm_provider=llm_provider, llm_model=llm_model, api_base_url=api_base_url
    )
    if not user_settings:
        raise HTTPException(status_code=400, detail="Add query params: llm_provider=ollama&llm_model=llama3.2&api_base_url=http://localhost:11434")
    try:
        response = get_chat_response(query, user_settings)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _build_chat_settings(db: Session, user_id: Optional[int] = None, llm_provider: Optional[str] = None, llm_model: Optional[str] = None, api_base_url: Optional[str] = None):
    """Build user_settings dict for chat from query/path params or DB."""
    if llm_provider is not None or llm_model is not None or api_base_url is not None:
        return {
            "llm_provider": (llm_provider or "ollama").strip().lower() if llm_provider else "ollama",
            "llm_model": (llm_model or "llama3.2").strip() if llm_model else "llama3.2",
            "api_key": None,
            "api_base_url": (api_base_url or "http://localhost:11434").strip() if api_base_url else "http://localhost:11434",
        }
    if user_id is not None:
        row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        if row:
            return {
                "llm_provider": row.llm_provider or "ollama",
                "llm_model": row.llm_model or "llama3.2",
                "api_key": row.api_key,
                "api_base_url": row.api_base_url or "http://localhost:11434",
            }
    return None


@app.post("/api/chat")
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    """
    BIZOPS Assist: send query + current UI settings (llm_provider, llm_model, api_base_url for Ollama; api_key for OpenAI).
    Backend uses exactly what you send — no hidden OpenAI default.
    """
    user_settings = _chat_settings_from_body(db, body)
    if not user_settings:
        raise HTTPException(
            status_code=400,
            detail="Send llm_provider and llm_model (and api_base_url for Ollama). Go to Configurations, select Ollama, pick a model, then Deploy.",
        )
    try:
        response = get_chat_response(body.query, user_settings)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/{user_id_path}")
async def chat_post_with_id(user_id_path: int, body: ChatRequest, db: Session = Depends(get_db)):
    """POST /api/chat/1 etc.: same as POST /api/chat, user_id from path if not in body."""
    user_settings = _chat_settings_from_body(db, body, user_id_override=user_id_path)
    if not user_settings:
        raise HTTPException(status_code=400, detail="Send llm_provider and llm_model (and api_base_url for Ollama).")
    try:
        response = get_chat_response(body.query, user_settings)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _chat_settings_from_body(db: Session, body: ChatRequest, user_id_override: Optional[int] = None):
    """Build user_settings from POST body or DB. For Ollama, api_key is never set."""
    user_id = body.user_id if body.user_id is not None else user_id_override
    user_settings = None
    if (
        body.llm_provider is not None
        or body.llm_model is not None
        or body.api_base_url is not None
        or body.api_key is not None
    ):
        provider = (body.llm_provider or "ollama").strip().lower()
        model = (body.llm_model or "").strip() or ("llama3.2" if provider == "ollama" else "gpt-4o")
        base_url = (body.api_base_url or "").strip() if body.api_base_url else None
        if provider == "ollama":
            base_url = base_url or "http://localhost:11434"
        user_settings = {
            "llm_provider": provider,
            "llm_model": model,
            "api_key": None if provider == "ollama" else (body.api_key or "").strip() or None,
            "api_base_url": base_url,
        }
    elif user_id is not None:
        row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        if row:
            prov = (row.llm_provider or "ollama").strip().lower()
            user_settings = {
                "llm_provider": prov,
                "llm_model": (row.llm_model or "llama3.2").strip() or "llama3.2",
                "api_key": None if prov == "ollama" else (row.api_key or "").strip() or None,
                "api_base_url": (row.api_base_url or "http://localhost:11434").strip() if row.api_base_url else "http://localhost:11434",
            }
    return user_settings

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        if filename.endswith(('.csv', '.xlsx', '.xls')):
            count = process_spreadsheet(db, content, filename)
            message = f"Successfully ingested {count} metrics from spreadsheet."
        elif filename.endswith('.pdf'):
            count = process_pdf(db, content)
            message = f"Successfully extracted {count} metrics from PDF."
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
        
        # Trigger anomaly detection after new data
        detect_anomalies(db)
        return {"message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/register")
async def register(username: str, password: str, full_name: str, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(username=username, hashed_password=hashed, full_name=full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create default settings
    settings = UserSettings(user_id=user.id)
    db.add(settings)
    db.commit()
    
    return {"id": user.id, "username": user.username, "full_name": user.full_name}

@app.post("/api/auth/login")
async def login(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.hashed_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {"id": user.id, "username": user.username, "full_name": user.full_name}

@app.get("/api/settings/{user_id}")
async def get_settings(user_id: int, db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

ALLOWED_SETTINGS_KEYS = {"llm_provider", "llm_model", "api_base_url", "api_key"}

@app.post("/api/settings/{user_id}")
async def update_settings(user_id: int, payload: dict, db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not settings:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
    
    for key, value in payload.items():
        if key in ALLOWED_SETTINGS_KEYS and hasattr(settings, key):
            setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    return {"status": "success"}

@app.get("/api/ollama/models")
async def get_ollama_models(base_url: Optional[str] = None):
    """List Ollama models. Returns empty list on connection error (no 500)."""
    import httpx
    url = (base_url or "http://localhost:11434").strip().rstrip("/")
    if not url:
        url = "http://localhost:11434"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{url}/api/tags")
            if response.status_code != 200:
                return []
            data = response.json()
            models = data.get("models") or []
            names = []
            for m in models:
                name = m.get("name") or m.get("model")
                if name and isinstance(name, str):
                    names.append(name)
            return names
    except Exception:
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

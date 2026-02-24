import pandas as pd
import os
from sqlalchemy.orm import Session
from datetime import datetime
from pypdf import PdfReader
import io
from models import DailyMetric
from services.chat_service import get_chat_response # We can reuse LLM logic to parse PDFs
import json

def process_spreadsheet(db: Session, file_content: bytes, filename: str):
    file_extension = os.path.splitext(filename)[1].lower()
    
    if file_extension == '.csv':
        df = pd.read_csv(io.BytesIO(file_content))
    elif file_extension in ['.xlsx', '.xls']:
        df = pd.read_excel(io.BytesIO(file_content))
    else:
        raise ValueError("Unsupported spreadsheet format")

    ingested_count = 0
    for _, row in df.iterrows():
        # Expected columns: date, revenue, orders, customers, avg_order_value
        date_str = str(row['date'])
        try:
            date_obj = pd.to_datetime(date_str).date()
        except:
            continue
            
        existing = db.query(DailyMetric).filter(DailyMetric.date == date_obj).first()
        if not existing:
            metric = DailyMetric(
                date=date_obj,
                revenue=float(row.get('revenue', 0)),
                orders=int(row.get('orders', 0)),
                customers=int(row.get('customers', 0)),
                avg_order_value=float(row.get('avg_order_value', 0))
            )
            db.add(metric)
            ingested_count += 1
    
    db.commit()
    return ingested_count

def process_pdf(db: Session, file_content: bytes):
    reader = PdfReader(io.BytesIO(file_content))
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    
    # Use LLM to extract structured data from text
    # This is a powerful feature: "Analyze this PDF and extract daily metrics"
    prompt = f"""
    Extract business metrics from the following text and return them as a JSON list of objects.
    Each object must have: "date" (YYYY-MM-DD), "revenue" (float), "orders" (int), "customers" (int), "avg_order_value" (float).
    If a metric is missing, use 0 or null.
    
    Text:
    {text[:4000]} # Limit text for LLM
    
    Return ONLY valid JSON.
    """
    
    llm_response = get_chat_response(prompt)
    try:
        # Try to find JSON in response
        import re
        json_match = re.search(r'\[.*\]', llm_response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(llm_response)
            
        ingested_count = 0
        for item in data:
            date_obj = datetime.strptime(item['date'], '%Y-%m-%d').date()
            existing = db.query(DailyMetric).filter(DailyMetric.date == date_obj).first()
            if not existing:
                metric = DailyMetric(
                    date=date_obj,
                    revenue=float(item.get('revenue', 0)),
                    orders=int(item.get('orders', 0)),
                    customers=int(item.get('customers', 0)),
                    avg_order_value=float(item.get('avg_order_value', 0))
                )
                db.add(metric)
                ingested_count += 1
        
        db.commit()
        return ingested_count
    except Exception as e:
        print(f"Error parsing PDF data: {e}")
        return 0

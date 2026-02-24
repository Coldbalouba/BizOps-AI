import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime
from models import DailyMetric
import os

def ingest_csv_data(db: Session, csv_path: str):
    if not os.path.exists(csv_path):
        print(f"CSV file not found at {csv_path}")
        return
    
    df = pd.read_csv(csv_path)
    
    for _, row in df.iterrows():
        # Check if record already exists
        date_obj = datetime.strptime(row['date'], '%Y-%m-%d').date()
        existing = db.query(DailyMetric).filter(DailyMetric.date == date_obj).first()
        
        if not existing:
            metric = DailyMetric(
                date=date_obj,
                revenue=float(row['revenue']),
                orders=int(row['orders']),
                customers=int(row['customers']),
                avg_order_value=float(row['avg_order_value'])
            )
            db.add(metric)
    
    db.commit()
    print(f"Ingested {len(df)} rows from {csv_path}")

def get_all_metrics(db: Session):
    return db.query(DailyMetric).order_by(DailyMetric.date).all()

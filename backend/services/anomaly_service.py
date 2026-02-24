import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from models import DailyMetric, Anomaly

def detect_anomalies(db: Session):
    metrics = db.query(DailyMetric).order_by(DailyMetric.date).all()
    if len(metrics) < 10:
        return # Need more data for reliable detection
    
    data = []
    for m in metrics:
        data.append({
            'date': m.date,
            'revenue': m.revenue,
            'orders': m.orders,
            'customers': m.customers,
            'aov': m.avg_order_value
        })
    
    df = pd.DataFrame(data)
    
    # Feature for Isolation Forest
    features = ['revenue', 'orders', 'customers', 'aov']
    model = IsolationForest(contamination=0.1, random_state=42)
    df['anomaly_score'] = model.fit_predict(df[features])
    
    # -1 means anomaly, 1 means normal
    anomalies = df[df['anomaly_score'] == -1]
    
    # Clear old anomalies for these dates (simplification)
    db.query(Anomaly).delete()
    
    for _, row in anomalies.iterrows():
        # Simple logic to determine what went wrong
        mean_revenue = df['revenue'].mean()
        if row['revenue'] < mean_revenue * 0.5:
            desc = "Significant revenue drop detected."
            severity = "high"
        elif row['revenue'] > mean_revenue * 1.5:
            desc = "Unusual revenue spike detected."
            severity = "medium"
        else:
            desc = "Mathematical anomaly in performance metrics."
            severity = "low"
            
        anomaly_record = Anomaly(
            metric_date=row['date'],
            metric_name="multi-metric",
            actual_value=row['revenue'],
            expected_value=mean_revenue,
            severity=severity,
            description=desc
        )
        db.add(anomaly_record)
    
    db.commit()
    return len(anomalies)

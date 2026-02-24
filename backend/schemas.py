from pydantic import BaseModel
from datetime import date
from typing import List, Optional

class DailyMetricSchema(BaseModel):
    date: date
    revenue: float
    orders: int
    customers: int
    avg_order_value: float

    class Config:
        from_attributes = True

class AnomalySchema(BaseModel):
    metric_date: date
    metric_name: str
    actual_value: float
    expected_value: float
    severity: str
    description: str

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_revenue: float
    total_orders: int
    avg_conversion: float
    active_customers: int
    recent_anomalies: List[AnomalySchema]


class ChatRequest(BaseModel):
    query: str
    user_id: Optional[int] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None

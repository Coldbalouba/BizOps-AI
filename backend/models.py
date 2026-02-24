from sqlalchemy import Column, Integer, Float, Date, String
from database import Base

class DailyMetric(Base):
    __tablename__ = "daily_metrics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True)
    revenue = Column(Float)
    orders = Column(Integer)
    customers = Column(Integer)
    avg_order_value = Column(Float)

class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    metric_date = Column(Date)
    metric_name = Column(String)
    actual_value = Column(Float)
    expected_value = Column(Float)
    severity = Column(String) # low, medium, high
    description = Column(String)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    avatar_url = Column(String, nullable=True)

class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True)
    llm_provider = Column(String, default="openai") # openai, ollama, anthropic
    llm_model = Column(String, default="gpt-4o")
    api_base_url = Column(String, nullable=True)
    api_key = Column(String, nullable=True)

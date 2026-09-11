# backend/models.py
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from backend.database import Base

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    plant_id = Column(String(255), nullable=True)
    email = Column(String(100), unique=True, nullable=False)

class MaterialRequest(Base):
    __tablename__ = "material_requests"

    request_id = Column(Integer, primary_key=True, index=True)
    material_type = Column(String(10), nullable=False)
    plant_id = Column(String(10), nullable=False)
    storage_location = Column(String(10), nullable=False)
    sales_org = Column(String(10), nullable=True)
    dist_channel = Column(String(10), nullable=True)
    material_description = Column(String(40), nullable=False)
    base_unit_of_measure = Column(String(10), nullable=False)
    material_group = Column(String(20), nullable=False)
    control_code_gst = Column(String(20), nullable=True)
    purchasing_group = Column(String(10), nullable=True)
    valuation_category = Column(String(10), nullable=True)
    valuation_class = Column(String(10), nullable=True)
    long_description = Column(Text, nullable=True)
    
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    status = Column(String(20), default="Pending")
    current_stage = Column(String(30), default="Plant_Head")
    generated_material_code = Column(String(30), nullable=True)
    latest_note = Column(Text, nullable=True)
    return_to_stage = Column(String(50), nullable=True)
    redirected_from = Column(String(50), nullable=True)
    
    # ✅ FIX 1: Remove timezone=True — MS SQL DATETIME doesn't support it
    # Use DateTime without timezone, or use DATETIME2 explicitly
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class WorkflowLog(Base):
    __tablename__ = "workflow_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, index=True, nullable=True)
    action_by = Column(Integer, nullable=True)
    username = Column(String(50), nullable=True)
    action_type = Column(String(50), nullable=True)
    # ✅ FIX 1 applied here too
    timestamp = Column(DateTime, server_default=func.now())
    comments = Column(Text, nullable=True)
    # ✅ FIX 2: JSON is not native in MS SQL — use Text and parse manually
    changes_diff = Column(Text, nullable=True)

class MasterDataLibrary(Base):
    __tablename__ = "master_data_library"

    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(50), unique=True, nullable=False)
    material_description = Column(String(255), nullable=False, index=True)
    UOM = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
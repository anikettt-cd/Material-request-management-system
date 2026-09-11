# backend/schemas.py
import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any
from datetime import datetime

# --- AUTHENTICATION SCHEMAS ---
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    plant_id: Optional[str] = None

# --- MATERIAL REQUEST SCHEMAS ---
class MaterialRequestCreate(BaseModel):
    # Mandatory Fields
    material_type: str          # MTART
    plant_id: str               # WERKS
    storage_location: str       # LGORT
    material_description: str   # MAKTX
    base_unit_of_measure: str   # MEINS
    material_group: str         # MATKL
    
    # Optional Commercial/Tax Fields
    sales_org: Optional[str] = None          # VKORG
    dist_channel: Optional[str] = None       # VTWEG
    control_code_gst: Optional[str] = None   # STEUC
    purchasing_group: Optional[str] = None   # EKGRP
    valuation_category: Optional[str] = None # BWTTY
    valuation_class: Optional[str] = None    # BKLAS
    long_description: Optional[str] = Field(None, max_length=400)

    # 🎯 BACKEND GUARDRAIL 1: Protects the initial creation payload
    @field_validator('control_code_gst')
    @classmethod
    def validate_gst_create(cls, value):
        if not value:
            return value
        clean_value = value.strip()
        if not re.match(r"^\d{4,8}$", clean_value):
            raise ValueError("Control Code (STEUC) must contain only numbers and be between 4 and 8 digits.")
        return clean_value

# 🎯 NEW: Full Response Schema (Matches SQL material_requests table perfectly)
class MaterialRequestResponse(MaterialRequestCreate):
    request_id: int
    created_by: int
    status: str
    current_stage: str
    generated_material_code: Optional[str] = None
    latest_note: Optional[str] = None             # Added from live DB
    return_to_stage: Optional[str] = None         # Added from live DB
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 🎯 NEW: Used when returning/updating request state
class MaterialRequestUpdate(BaseModel):
    status: Optional[str] = None
    current_stage: Optional[str] = None
    latest_note: Optional[str] = None
    return_to_stage: Optional[str] = None
    generated_material_code: Optional[str] = None

# --- WORKFLOW LOG (AUDIT) SCHEMAS ---
# 🎯 NEW: Matches SQL workflow_logs table perfectly
class WorkflowLogCreate(BaseModel):
    request_id: int
    action_by: int
    username: str                                 # Track exact user
    action_type: str                              # e.g., 'APPROVED', 'RETURNED'
    comments: str
    changes_diff: Optional[Dict[str, Any]] = None # JSON tracking for edits

class WorkflowLogResponse(WorkflowLogCreate):
    log_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# --- WORKFLOW ACTION SCHEMAS ---
class ActionSubmit(BaseModel):
    comments: str = "Approved by Workflow Node"

class ActionNote(BaseModel):
    note: str    

class PurchaseApprovalPayload(BaseModel):
    comments: Optional[str] = None
    base_unit_of_measure: Optional[str] = None
    purchasing_group: Optional[str] = None

class GSTEdit(BaseModel):
    steuc: Optional[str] = None  # Control Code/HSN
    comments: str

    # 🎯 BACKEND GUARDRAIL 2: Protects the GST approval workflow
    @field_validator('steuc')
    @classmethod
    def validate_steuc(cls, value):
        if not value:
            return value
        clean_value = value.strip()
        if not re.match(r"^\d{4,8}$", clean_value):
            raise ValueError("Control Code (STEUC) must contain only numbers and be between 4 and 8 digits.")
        return clean_value

class StoreEdit(BaseModel):
    material_type: Optional[str] = None
    material_group: Optional[str] = None
    purchasing_group: Optional[str] = None
    base_unit_of_measure: Optional[str] = None
    material_description: Optional[str] = None  
    long_description: Optional[str] = None
    comments: str = "Master parameters verified and code generated."

# --- USER MANAGEMENT ---
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str
    plant_id: Optional[str] = None

class UserUpdate(BaseModel):
    username: str
    email: str
    role: str
    plant_id: Optional[str] = None
    password: Optional[str] = None # Optional so Admins aren't forced to reset it

# --- IT ADMIN SCHEMAS ---
class ITAdminOverride(BaseModel):
    generated_material_code: Optional[str] = None
    material_description: Optional[str] = None
    long_description: Optional[str] = None
    plant_id: Optional[str] = None
    storage_location: Optional[str] = None
    material_type: Optional[str] = None
    base_unit_of_measure: Optional[str] = None
    material_group: Optional[str] = None
    purchasing_group: Optional[str] = None
    sales_org: Optional[str] = None
    dist_channel: Optional[str] = None
    control_code_gst: Optional[str] = None
    valuation_category: Optional[str] = None
    valuation_class: Optional[str] = None

class MasterDataLibraryResponse(BaseModel):
    id: int
    material_code: str
    material_description: str
    UOM: Optional[str] = None     # 🎯 Maps to our brand new column!
    created_at: datetime

    class Config:
        from_attributes = True
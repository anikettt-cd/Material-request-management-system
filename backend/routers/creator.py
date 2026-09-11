from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
import re
from rapidfuzz import process, fuzz

from backend.database import get_db
from backend import schemas
from backend import models  
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email
from backend.services.user_service import get_recipient_emails

router = APIRouter(prefix="/creator", tags=["Creator Workspace"])

# --- FETCH ALL REQUESTS FOR LOGGED-IN CREATOR ---
@router.get("/requests")
def get_my_requests(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # 1. Enforce Role-Based Access Control
    if current_user.get("role") != "Creator":
        raise HTTPException(status_code=403, detail="Access Denied.")
        
    # 2. Fetch only requests created by this specific user
    query = text("""
        SELECT * FROM material_requests 
        WHERE created_by = :user_id 
        ORDER BY created_at DESC
    """)
    results = db.execute(query, {"user_id": current_user.get("user_id")}).fetchall()
    
    # 3. Convert SQLAlchemy rows to dictionary format for JSON response
    return [dict(row._mapping) for row in results]


# --- FETCH A SINGLE REQUEST FOR EDITING ---
@router.get("/requests/{request_id}")
def get_single_request(
    request_id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    query = text("SELECT * FROM material_requests WHERE request_id = :req_id AND created_by = :user_id")
    req = db.execute(query, {"req_id": request_id, "user_id": current_user.get("user_id")}).fetchone()
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or not authorized.")
        
    return dict(req._mapping)


# --- SUBMIT NEW REQUEST ---
@router.post("/submit")
def submit_material_request(
    request: schemas.MaterialRequestCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Creator":
        raise HTTPException(status_code=403, detail="Access Denied. Only Creators can submit new materials.")

    actual_plant_id = current_user.get("plant_id")
    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    try:
        # 🎯 FIX: Converted raw MySQL INSERT into pure SQLAlchemy ORM
        new_request = models.MaterialRequest(
            material_type=request.material_type,
            plant_id=actual_plant_id,
            storage_location=request.storage_location,
            sales_org=request.sales_org,
            dist_channel=request.dist_channel,
            material_description=request.material_description,
            long_description=request.long_description,
            base_unit_of_measure=request.base_unit_of_measure,
            material_group=request.material_group,
            control_code_gst=request.control_code_gst,
            purchasing_group=request.purchasing_group,
            valuation_category=request.valuation_category,
            valuation_class=request.valuation_class,
            created_by=current_user.get("user_id"),
            status="Pending",
            current_stage="Plant_Head"
        )
        
        db.add(new_request)
        db.flush() # 🎯 Automatically assigns the new ID without LAST_INSERT_ID()
        
        new_request_id = new_request.request_id

        # 🎯 FIX: Converted WorkflowLog INSERT to pure ORM
        new_log = models.WorkflowLog(
            request_id=new_request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type="SUBMITTED",
            comments="Initial manual SAP form submission"
        )
        db.add(new_log)

        plant_head_emails = get_recipient_emails(db, role="Plant_Head", plant_id=new_request.plant_id)

        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #2E86C1;">Action Required: Pending Material Approval</h3>
            <p>A new material request is awaiting your review in the MDM Portal.</p>
            <table border="1" style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left;">Attribute</th>
                    <th style="padding: 10px; text-align: left;">Details</th>
                </tr>
                <tr><td style="padding: 8px;"><strong>Plant No</strong></td><td style="padding: 8px;">{new_request.plant_id}</td></tr>
                <tr><td style="padding: 8px;"><strong>Material Type</strong></td><td style="padding: 8px;">{new_request.material_type}</td></tr>
                <tr><td style="padding: 8px;"><strong>Storage Location</strong></td><td style="padding: 8px;">{new_request.storage_location}</td></tr>
                <tr><td style="padding: 8px;"><strong>Description</strong></td><td style="padding: 8px;">{new_request.material_description}</td></tr>
            </table>
            <p>Please log in to the <a href="http://192.168.100.57/dashboard">Viraj MDM Portal</a> to proceed.</p>

        </div>
        """

        for email in plant_head_emails:
            background_tasks.add_task(
                send_notification_email,
                to_email=email,
                subject=f"New Request #{new_request_id} for Approval",
                html_content=email_html
            )

        db.commit()
        return {
            "message": "Success! Request routed to Plant Head.", 
            "tracking_id": new_request_id,
            "status": "Pending"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


# --- UPDATE & RE-SUBMIT CORRECTION REQUESTS ---
@router.put("/re-submit/{request_id}")
def resubmit_corrected_request(
    request_id: int, 
    request: schemas.MaterialRequestCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Creator":
        raise HTTPException(status_code=403, detail="Access Denied.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    # 🎯 FIX: Fetch using ORM to allow easy updating
    req_to_update = db.query(models.MaterialRequest).filter(models.MaterialRequest.request_id == request_id).first()
    
    if not req_to_update:
        raise HTTPException(status_code=404, detail="Request record not found.")
        
    if req_to_update.current_stage != "Creator":
        raise HTTPException(status_code=400, detail="Action Denied. Request is under active review.")

    target_stage = req_to_update.return_to_stage if req_to_update.return_to_stage else "Plant_Head"

    try:
        # 🎯 FIX: Update attributes cleanly via ORM instead of raw UPDATE statement
        req_to_update.material_type = request.material_type
        req_to_update.plant_id = request.plant_id
        req_to_update.storage_location = request.storage_location
        req_to_update.sales_org = request.sales_org
        req_to_update.dist_channel = request.dist_channel
        req_to_update.material_description = request.material_description
        req_to_update.long_description = request.long_description
        req_to_update.base_unit_of_measure = request.base_unit_of_measure
        req_to_update.material_group = request.material_group
        req_to_update.control_code_gst = request.control_code_gst
        req_to_update.purchasing_group = request.purchasing_group
        req_to_update.valuation_category = request.valuation_category
        req_to_update.valuation_class = request.valuation_class
        req_to_update.status = "Pending"
        req_to_update.current_stage = target_stage
        req_to_update.return_to_stage = None
        req_to_update.latest_note = "Corrections finalized and re-submitted"

        # 🎯 FIX: Insert Log via ORM
        new_log = models.WorkflowLog(
            request_id=request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type="RE_SUBMITTED",
            comments="Data fixed."
        )
        db.add(new_log)

        target_emails = get_recipient_emails(db, role=target_stage, plant_id=request.plant_id,material_type=request.material_type)

        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #D35400;">Notice: Corrected Request #{request_id} Returned</h3>
            <p>The Creator has applied requested corrections. It has returned to your <strong>{target_stage}</strong> queue.</p>
            <p>Please log in to the <a href="http://192.168.100.57/dashboard">Viraj MDM Portal</a> to proceed.</p>

        </div>
        """

        for email in target_emails:
            background_tasks.add_task(send_notification_email, to_email=email, subject="Request Updated", html_content=email_html)

        db.commit()
        return {"message": "Success!"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
    

@router.get("/check-duplicate")
def check_duplicate_material(description: str, db: Session = Depends(get_db)):
    if not description or len(description.strip()) < 3:
        return {"is_duplicate": False, "matches": [], "message": ""}
        
    try:
        # Pull a broader set of data (adjust limits based on your DB size)
        active_sql = text("SELECT request_id, material_description, base_unit_of_measure FROM material_requests")
        lib_sql = text("SELECT material_code, material_description, UOM FROM master_data_library")
        
        active_results = db.execute(active_sql).fetchall()
        lib_results = db.execute(lib_sql).fetchall()
        all_results = active_results + lib_results
        
        # Create a dictionary mapping the descriptions to their full row data
        desc_map = {row[1]: row for row in all_results if row[1]}
        descriptions = list(desc_map.keys())
        
        # 🎯 RAPIDFUZZ: Extract the top 5 closest matches, allowing for typos
        # limit=5 returns the top 5 results. score_cutoff=70 ignores anything less than a 70% match.
        fuzzy_matches = process.extract(
            description, 
            descriptions, 
            scorer=fuzz.token_set_ratio, 
            limit=5, 
            score_cutoff=70
        )
        
        matches = []
        for match_text, score, index in fuzzy_matches:
            row = desc_map[match_text]
            matches.append({
                "code": str(row[0]),
                "desc": row[1],
                "uom": str(row[2]) if row[2] else "—",
                "match_score": round(score, 1) # e.g., 95.5% match
            })
            
        if matches:
            return {
                "is_duplicate": True, 
                "matches": matches,
                "message": f"Found {len(matches)} similar items (Typo-tolerant search)."
            }
            
        return {"is_duplicate": False, "matches": [], "message": "Description is unique."}
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        return {"is_duplicate": False, "matches": [], "message": "Description is unique."}
    
@router.get("/master-count")
def get_master_data_count(db: Session = Depends(get_db)):
    count = db.execute(text("SELECT COUNT(*) FROM master_data_library")).scalar()
    return {"count": count}
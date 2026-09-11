from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
import json # 🎯 DIFF FIX: Needed to save JSON to DB

from backend.database import get_db
from backend import schemas
from backend import models # 🎯 NEW: Imported models for ORM
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email
from backend.services.user_service import get_recipient_emails
from backend.utils.audit import generate_diff # 🎯 DIFF FIX: Import our magic diff generator

router = APIRouter(prefix="/purchase", tags=["Purchase Workspace"])

@router.get("/pending")
def get_pending_requests(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role", "").lower() != "purchase":
        raise HTTPException(status_code=403, detail="Access Denied. Purchase Team only.")
    
    user_plants_str = str(current_user.get("plant_id", ""))
    user_plants_list = [p.strip() for p in user_plants_str.split(",") if p.strip()]

    if not user_plants_list:
        raise HTTPException(status_code=400, detail="No plant locations linked to your profile.")

    # 🎯 FIX: Converted raw SQL to ORM to avoid the MS SQL tuple/IN clause bug
    results = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.current_stage == 'Purchase',
        models.MaterialRequest.plant_id.in_(user_plants_list),
        models.MaterialRequest.status.in_(['Pending', 'Active'])
    ).order_by(models.MaterialRequest.request_id.desc()).all()
    
    # 🎯 FIX: Return a list of dictionaries with only the fields the frontend expects
    return [{
        "request_id": row.request_id,
        "plant_id": row.plant_id,
        "material_type": row.material_type,
        "material_group": row.material_group,
        "base_unit_of_measure": row.base_unit_of_measure,
        "material_description": row.material_description,
        "storage_location": row.storage_location,
        "purchasing_group": row.purchasing_group
    } for row in results]


@router.post("/approve/{request_id}")
def approve_request(
    request_id: int, 
    action: schemas.PurchaseApprovalPayload, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role", "").lower() != "purchase":
        raise HTTPException(status_code=403, detail="Access Denied.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    # 🎯 FIX: Fetch using ORM
    req_to_update = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.request_id == request_id,
        models.MaterialRequest.current_stage == 'Purchase'
    ).first()
    
    if not req_to_update:
        raise HTTPException(status_code=404, detail="Request not found.")

    # 🎯 DIFF FIX: Convert ORM object to dictionary to capture the "old" state
    old_data = {c.name: getattr(req_to_update, c.name) for c in req_to_update.__table__.columns}

    try:
        # 🎯 DIFF FIX: Construct what the new data looks like based on what Purchase sent
        new_data = {
            "base_unit_of_measure": action.base_unit_of_measure or old_data["base_unit_of_measure"],
            "purchasing_group": action.purchasing_group or old_data["purchasing_group"]
        }
        
        # 🎯 DIFF FIX: Generate the GitHub-style diff!
        changes = generate_diff(old_data, new_data)

        # 🎯 SCHEMA DRIFT FIX: Update attributes cleanly via ORM
        req_to_update.current_stage = 'GST_Audit'
        req_to_update.base_unit_of_measure = new_data["base_unit_of_measure"]
        req_to_update.purchasing_group = new_data["purchasing_group"]
        req_to_update.return_to_stage = None
        req_to_update.latest_note = None

        # 🎯 DIFF FIX: Insert Log via ORM
        new_log = models.WorkflowLog(
            request_id=request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type='APPROVED_AND_EDITED',
            comments=action.comments,
            changes_diff=json.dumps(changes) if changes else None # <-- Saved to DB here!
        )
        db.add(new_log)

        steuc_val = old_data.get("control_code_gst")
        steuc_display = steuc_val if steuc_val else "Pending Allocation"

        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #2E86C1;">Action Required: Pending GST Compliance Review</h3>
            <p>The Purchase Team has approved Material Request #{request_id}. It is now routed to your desk for tax field allocation.</p>
            
            <table border="1" style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left;">SAP Field Description</th>
                    <th style="padding: 10px; text-align: left;">Value</th>
                </tr>
                <tr><td style="padding: 8px;"><strong>Material Description</strong></td><td style="padding: 8px;">{old_data['material_description']}</td></tr>
                <tr><td style="padding: 8px;"><strong>Control Code (STEUC)</strong></td><td style="padding: 8px;">{steuc_display}</td></tr>
            </table>
            
            <p>Please log in to the <a href="http://192.168.100.57/dashboard">Viraj MDM Portal</a> to proceed.</p>
        </div>
        """

        target_emails = get_recipient_emails(db, role="GST", plant_id=old_data['plant_id'])

        for email in target_emails:
            background_tasks.add_task(
                send_notification_email,
                to_email=email,
                subject=f"Action Required: Request #{request_id} routed to GST",
                html_content=email_html
            )

        db.commit()
        return {"message": "Success! Material approved and routed to GST/Audit."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
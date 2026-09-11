from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
import json # 🎯 DIFF FIX: Needed to save JSON to MySQL

from backend.database import get_db
from backend import schemas
from backend import models # 🎯 NEW: Imported models for ORM
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email
from backend.services.user_service import get_recipient_emails
from backend.utils.audit import generate_diff # 🎯 DIFF FIX: Import our magic diff generator

router = APIRouter(prefix="/gst", tags=["GST Workspace"])

@router.get("/pending")
def get_pending_requests(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    # Ensure they are the GST team (Safe dictionary access)
    if current_user.get("role", "").lower() != "gst":
        raise HTTPException(status_code=403, detail="Access Denied. GST Team only.")
    
    # 🎯 FIX: Converted raw SQL to pure ORM
    results = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.current_stage == 'GST_Audit',
        models.MaterialRequest.status.in_(['Pending', 'Active'])
    ).order_by(models.MaterialRequest.request_id.desc()).all()
    
    # Convert ORM objects to standard dictionaries for the frontend
    return [{column.name: getattr(row, column.name) for column in row.__table__.columns} for row in results]


@router.post("/approve/{request_id}")
def approve_and_edit_request(
    request_id: int, 
    action: schemas.GSTEdit, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    # Safe dictionary access
    if current_user.get("role", "").lower() != "gst":
        raise HTTPException(status_code=403, detail="Access Denied.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    # 🎯 FIX: Fetch using ORM so we have all data to diff against and update
    req_to_update = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.request_id == request_id,
        models.MaterialRequest.current_stage == 'GST_Audit'
    ).first()
    
    if not req_to_update:
        raise HTTPException(status_code=404, detail="Request not found or not pending GST verification.")

    # 🎯 DIFF FIX: Convert ORM object to dictionary to capture the "old" state
    old_data = {c.name: getattr(req_to_update, c.name) for c in req_to_update.__table__.columns}

    try:
        # 🎯 DIFF FIX: Construct what the new data looks like based on what GST sent
        new_data = {
            "control_code_gst": action.steuc or old_data["control_code_gst"]
        }
        
        # 🎯 DIFF FIX: Generate the GitHub-style diff!
        changes = generate_diff(old_data, new_data)

        # 1. 🎯 SCHEMA DRIFT FIX: Update attributes cleanly via ORM
        req_to_update.current_stage = 'Store'
        req_to_update.control_code_gst = new_data["control_code_gst"]
        req_to_update.return_to_stage = None
        req_to_update.latest_note = None

        # 2. 🎯 DIFF FIX: Insert Log via ORM
        new_log = models.WorkflowLog(
            request_id=request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type='APPROVED_AND_EDITED',
            comments=f"Assigned Control Code (STEUC): {action.steuc}. {action.comments}",
            changes_diff=json.dumps(changes) if changes else None # <-- Saved to DB here!
        )
        db.add(new_log)

        # 3. Queue up the background task to alert the Store Head desk
        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #2E86C1;">Action Required: Pending Final Store Verification</h3>
            <p>The GST Team has verified compliance metrics for material Request #{request_id} and updated the tax code entries.</p>
            
            <table border="1" style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left;">SAP Field Description</th>
                    <th style="padding: 10px; text-align: left;">Value</th>
                </tr>
                <tr><td style="padding: 8px;"><strong>Material Description</strong></td><td style="padding: 8px;">{old_data['material_description']}</td></tr>
                <tr><td style="padding: 8px;"><strong>Control Code (STEUC)</strong></td><td style="padding: 8px;">{action.steuc}</td></tr>
            </table>
            
            <p>Please log in to the <a href="http://192.168.100.57/dashboard">Viraj MDM Portal</a> to proceed.</p>
        </div>
        """

        # Store is a global role, so it will automatically ignore the plant_id and fetch all Store emails
        target_emails = get_recipient_emails(db, role="Store", plant_id=old_data['plant_id'])

        for email in target_emails:
            background_tasks.add_task(
                send_notification_email,
                to_email=email,
                subject=f"Action Required: Request #{request_id} cleared by GST Compliance",
                html_content=email_html
            )

        db.commit()
        return {"message": "Success! HSN mapped and routed to Store Master successfully."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
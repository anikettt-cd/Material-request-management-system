from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import get_db
from backend import schemas, models  # 🎯 NEW: Added models for ORM
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email
from backend.services.user_service import get_recipient_emails

router = APIRouter(prefix="/material-head", tags=["Material Head Workspace"])

def get_allowed_material_types(username: str):
    """Helper function to determine allowed SAP material types based on the user's department."""
    if not username:
        return ["ZMIS", "ZEIS"]
        
    if "Mech" in username:
        return ["ZMIS"]  # Mechanical Items & Spares
    elif "Elec" in username:
        return ["ZEIS"]  # Electrical Items & Spares
    return ["ZMIS", "ZEIS"] # Fallback for Admins

@router.get("/pending")
def get_pending_requests(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Material_Head":
        raise HTTPException(status_code=403, detail="Access Denied. Material Heads only.")
    
    username = current_user.get("username", "")
    allowed_types = get_allowed_material_types(username)

    # 🎯 FIX: Converted to pure ORM so it safely queries MySQL without syntax errors
    # Also ensures 'Pending Mat. Head' requests are visible!
    results = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.current_stage == 'Material_Head',
        models.MaterialRequest.material_type.in_(allowed_types),
        models.MaterialRequest.status.in_(['Pending', 'Active', 'Pending Mat. Head'])
    ).order_by(models.MaterialRequest.request_id.desc()).all()

    return [{column.name: getattr(row, column.name) for column in row.__table__.columns} for row in results]

@router.post("/approve/{request_id}")
def approve_request(
    request_id: int, 
    action: schemas.ActionSubmit, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Material_Head":
        raise HTTPException(status_code=403, detail="Access Denied.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")
    allowed_types = get_allowed_material_types(safe_username)

    # 🎯 Fetch using ORM so we can easily read the redirected_from flag
    req_to_update = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.request_id == request_id,
        models.MaterialRequest.current_stage == 'Material_Head'
    ).first()
    
    if not req_to_update:
        raise HTTPException(status_code=404, detail="Request not found.")

    if req_to_update.material_type not in allowed_types:
        raise HTTPException(status_code=403, detail=f"Access Denied. You cannot approve {req_to_update.material_type} materials.")

    try:
        # 1. Log the action
        new_log = models.WorkflowLog(
            request_id=request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type="APPROVED",
            comments=action.comments or "Material Type verification complete."
        )
        db.add(new_log)

        # =============================================================
        # THE PING-PONG LOGIC: Was this rerouted from Store or IT?
        # =============================================================
        if req_to_update.redirected_from in ["store_master", "it_admin"]:
            req_to_update.current_stage = "IT_Stage"
            req_to_update.status = "Pending IT"
            req_to_update.redirected_from = None  # Clear the tracking flag!
            
            db.commit()
            
            # Send Email directly to IT Admin
            target_emails = get_recipient_emails(db, role="IT_Admin", plant_id=req_to_update.plant_id)
            email_html = f"""
            <div style="font-family: Arial, sans-serif;">
                <h3 style="color: #E67E22;">Action Required: Final IT Verification (Returned)</h3>
                <p>Request #{request_id} has been technically verified by the Material Head after being reclassified.</p>
                <p>It is now ready for final SAP Code Generation.</p>
                <p>Please log in to the MDM Portal to proceed.</p>
            </div>
            """
            for email in target_emails:
                background_tasks.add_task(send_notification_email, to_email=email, subject=f"Action Required: Request #{request_id} returned to IT", html_content=email_html)

            return {"message": "Success! Reclassified material verified and returned to IT Admin.", "workflow_status": "Pending IT"}

        # =============================================================
        # STANDARD FLOW: Normal request from Plant Head, proceed to Purchase
        # =============================================================
        req_to_update.current_stage = 'Purchase'
        req_to_update.return_to_stage = None
        req_to_update.latest_note = None
        
        db.commit()

        target_emails = get_recipient_emails(db, role="Purchase", plant_id=req_to_update.plant_id)
        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #2E86C1;">Action Required: Pending Purchase Review</h3>
            <p>The Material Head ({safe_username}) has technically verified Request #{request_id}. It is now ready for your action.</p>
            <table border="1" style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left;">Attribute</th>
                    <th style="padding: 10px; text-align: left;">Details</th>
                </tr>
                <tr><td style="padding: 8px;"><strong>Plant No</strong></td><td style="padding: 8px;">{req_to_update.plant_id}</td></tr>
                <tr><td style="padding: 8px;"><strong>Material Type</strong></td><td style="padding: 8px;">{req_to_update.material_type}</td></tr>
                <tr><td style="padding: 8px;"><strong>Storage Location</strong></td><td style="padding: 8px;">{req_to_update.storage_location}</td></tr>
                <tr><td style="padding: 8px;"><strong>Description</strong></td><td style="padding: 8px;">{req_to_update.material_description}</td></tr>
                <tr><td style="padding: 8px;"><strong>Material Group</strong></td><td style="padding: 8px;">{req_to_update.material_group}</td></tr>
                <tr><td style="padding: 8px;"><strong>Base UOM</strong></td><td style="padding: 8px;">{req_to_update.base_unit_of_measure}</td></tr>
            </table>
            <p>Please log in to the MDM Portal to proceed.</p>
        </div>
        """
        for email in target_emails:
            background_tasks.add_task(send_notification_email, to_email=email, subject=f"Action Required: Request #{request_id} routed to Purchase", html_content=email_html)

        return {"message": "Success! Technical specs verified. Broadcasted to Purchase Team."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
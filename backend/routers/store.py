from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
import json # 🎯 Needed to save JSON to MySQL

from backend.database import get_db
from backend import schemas, models
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email
from backend.services.user_service import get_recipient_emails
from backend.utils.audit import generate_diff # 🎯 Import our magic diff generator

router = APIRouter(prefix="/store", tags=["Store Master Workspace"])

@router.get("/pending")
def get_pending_requests(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role", "").lower() != "store":
        raise HTTPException(status_code=403, detail="Access Denied. Store Master only.")
    
    # ORM query to fetch all pending store requests safely
    results = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.current_stage == 'Store',
        models.MaterialRequest.status.in_(['Pending', 'Active'])
    ).order_by(models.MaterialRequest.request_id.desc()).all()
    
    return [{column.name: getattr(row, column.name) for column in row.__table__.columns} for row in results]

@router.post("/approve/{request_id}")
def approve_request(
    request_id: int, 
    action: schemas.StoreEdit, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role", "").lower() != "store":
        raise HTTPException(status_code=403, detail="Access Denied.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    # 🎯 Fetch using ORM so we can update fields as Python attributes
    req_to_update = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.request_id == request_id,
        models.MaterialRequest.current_stage == 'Store'
    ).first()
    
    if not req_to_update:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    old_data = {c.name: getattr(req_to_update, c.name) for c in req_to_update.__table__.columns}

    try:
        new_data = {
            "material_group": action.material_group or old_data.get("material_group"),
            "purchasing_group": action.purchasing_group or old_data.get("purchasing_group"),
            "material_type": action.material_type or old_data.get("material_type"),
            "base_unit_of_measure": action.base_unit_of_measure or old_data.get("base_unit_of_measure"),
            "material_description": action.material_description or old_data.get("material_description"),
            "long_description": action.long_description or old_data.get("long_description")
        }
        
        # Generate the GitHub-style diff
        changes = generate_diff(old_data, new_data)

        # Apply data updates directly to the ORM object
        req_to_update.material_group = new_data["material_group"]
        req_to_update.purchasing_group = new_data["purchasing_group"]
        req_to_update.material_type = new_data["material_type"]
        req_to_update.base_unit_of_measure = new_data["base_unit_of_measure"]
        req_to_update.material_description = new_data["material_description"]
        req_to_update.long_description = new_data["long_description"]
        req_to_update.return_to_stage = None
        req_to_update.latest_note = None

        # Log the action via ORM
        new_log = models.WorkflowLog(
            request_id=request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type='APPROVED_AND_EDITED',
            comments=action.comments or "Store verification complete.",
            changes_diff=json.dumps(changes) if changes else None
        )
        db.add(new_log)

        # =============================================================
        # THE PING-PONG LOGIC: Did the Store Master reclassify to ZEIS/ZMIS?
        # =============================================================
        old_type = old_data.get("material_type")
        new_type = new_data["material_type"]
        controlled_types = ["ZEIS", "ZMIS"]

        if old_type != new_type and new_type in controlled_types:
            req_to_update.current_stage = "Material_Head"
            req_to_update.status = "Pending Mat. Head"
            req_to_update.redirected_from = "store_master" # 🎯 We plant the tracking flag here!
            
            db.commit()

            department = "Electrical" if new_type == "ZEIS" else "Mechanical"
            target_emails = get_recipient_emails(db=db, role="Material_Head", plant_id=req_to_update.plant_id, material_type=new_type)
            
            email_html = f"""
            <div style="font-family: Arial, sans-serif;">
                <h3 style="color: #E74C3C;">Action Required: Pending {department} Material Review</h3>
                <p>Request #{request_id} was reclassified to <strong>{new_type}</strong> by the Store Master and material type is changed .</p>
                <p>It has been routed back to you and requires your technical verification before proceeding to IT.</p>
                <p>Please log in to the MDM Portal to review.</p>
                <p>Please log in to the <a href="http://192.168.100.57/dashboard">Viraj MDM Portal</a> to proceed.</p>

            </div>
            """
            for email in target_emails:
                background_tasks.add_task(
                    send_notification_email, 
                    to_email=email, 
                    subject=f"Action Required: Request #{request_id} Reclassified to {new_type}", 
                    html_content=email_html
                )

            return {
                "message": f"Request verified and routed to {department} Material Head.", 
                "workflow_status": "Pending Material Head"
            }

        # =============================================================
        # STANDARD FLOW: No controlled change, proceed to IT
        # =============================================================
        req_to_update.current_stage = 'IT_Stage'
        req_to_update.status = 'Pending IT'
        
        db.commit()

        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #E67E22;">Action Required: Final IT Verification</h3>
            <p>Material Request #{request_id} is is approved by Store_master.</p>
            <p>Please log in to the MDM Portal to proceed.</p>
        </div>
        """
        target_emails = get_recipient_emails(db, role="IT_Admin", plant_id=req_to_update.plant_id)
        
        for email in target_emails:
            background_tasks.add_task(
                send_notification_email, 
                to_email=email, 
                subject=f"Action Required: Request #{request_id} ready for SAP Code", 
                html_content=email_html
            )

        return {"message": "Success! Request verified and routed to IT.", "workflow_status": "Pending IT"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
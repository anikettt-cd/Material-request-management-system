from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import get_db
from backend import schemas
from backend import models  # 🎯 NEW: Imported models for ORM
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email
from backend.services.user_service import get_recipient_emails 

router = APIRouter(prefix="/plant-head", tags=["Plant Head Workspace"])

@router.get("/pending")
def get_pending_requests(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Plant_Head":
        raise HTTPException(status_code=403, detail="Access Denied. Plant Head only.")
    
    # This query is standard ANSI SQL, so it works perfectly in MS SQL Server as-is.
    query = text("""
        SELECT * FROM material_requests 
        WHERE current_stage = 'Plant_Head' 
        AND plant_id = :plant_id
        AND status IN ('Pending', 'Active')
        ORDER BY request_id DESC
    """)
    
    results = db.execute(query, {"plant_id": current_user.get("plant_id")}).fetchall()
    
    return [dict(row._mapping) for row in results]


@router.post("/approve/{request_id}")
def approve_request(
    request_id: int, 
    action: schemas.ActionSubmit, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Plant_Head":
        raise HTTPException(status_code=403, detail="Access Denied.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    # 🎯 FIX: Changed raw SELECT to ORM so we can easily update it later
    req_to_update = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.request_id == request_id,
        models.MaterialRequest.current_stage == 'Plant_Head',
        models.MaterialRequest.plant_id == current_user.get("plant_id")
    ).first()
    
    if not req_to_update:
        raise HTTPException(status_code=404, detail="Request not found or not authorized.")

    try:
        material_type = req_to_update.material_type 
        plant_id = req_to_update.plant_id 
        
        if material_type == "ZMIS":
            department = "Mechanical"
            next_stage = "Material_Head"
            search_term = "%Mech%"       
            role_target = "Material_Head"
            
        elif material_type == "ZEIS":
            department = "Electrical"
            next_stage = "Material_Head"
            search_term = "%Elec"       
            role_target = "Material_Head"
            
        else:
            department = "Other"
            next_stage = "Purchase"      
            search_term = "%"            
            role_target = "Purchase"

        # 🎯 FIX: Use ORM to update attributes instead of raw UPDATE query
        req_to_update.current_stage = next_stage
        req_to_update.return_to_stage = None
        req_to_update.latest_note = None

        # 🎯 THE FIX: Updated the SQL to use our new Audit Trail schema!
        new_log = models.WorkflowLog(
            request_id=request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type="APPROVED",
            comments=action.comments
        )
        db.add(new_log)

        target_emails = get_recipient_emails(
            db=db, 
            role=role_target, 
            plant_id=plant_id,
            material_type=material_type
        )

        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #2E86C1;">Action Required: Pending {department} Material Review</h3>
            <p>The Plant Head has approved material Request #{request_id}. It is now awaiting your action.</p>
            
            <table border="1" style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left;">Attribute</th>
                    <th style="padding: 10px; text-align: left;">Details</th>
                </tr>
                <tr><td style="padding: 8px;"><strong>Plant No</strong></td><td style="padding: 8px;">{plant_id}</td></tr>
                <tr><td style="padding: 8px;"><strong>Material Type</strong></td><td style="padding: 8px;">{material_type}</td></tr>
                <tr><td style="padding: 8px;"><strong>Storage Location</strong></td><td style="padding: 8px;">{req_to_update.storage_location}</td></tr>
                <tr><td style="padding: 8px;"><strong>Description</strong></td><td style="padding: 8px;">{req_to_update.material_description}</td></tr>
            </table>
            <p>Please log in to the <a href="http://192.168.100.57/dashboard">Viraj MDM Portal</a> to proceed.</p>
        </div>
        """

        for email in target_emails:
            background_tasks.add_task(
                send_notification_email,
                to_email=email, 
                subject=f"Action Required: Request #{request_id} routed to {next_stage}",
                html_content=email_html
            )

        db.commit()
        return {"message": f"Success! Material approved and routed to {next_stage} ({department})."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
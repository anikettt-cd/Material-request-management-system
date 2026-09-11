import os
import io
import pandas as pd
from datetime import datetime  # <--- THIS IS THE MISSING LINE
import json # 🎯 Added for JSON diff serialization
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import schemas, models # 🎯 NEW: Imported models for ORM logic
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email
from backend.services.user_service import get_recipient_emails
from backend.schemas import ITAdminOverride 
from backend.utils.audit import generate_diff # 🎯 Import our diff generator

router = APIRouter(prefix="/it-department", tags=["IT Department Workspace"])

# 🎯 Fetch the Global Audit Trail
# 🎯 Fetch the Global Audit Trail
@router.get("/audit-logs")
def get_global_audit_trail(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied. Global Admin only.")

    try:
        # Fetch all logs, ordered by newest first
        query = text("""
            SELECT log_id, request_id, username, action_type, timestamp, comments, changes_diff 
            FROM workflow_logs 
            ORDER BY timestamp DESC
        """)
        results = db.execute(query).fetchall()
        
        # Parse the JSON string back into a dictionary for the frontend
        logs = []
        for row in results:
            log_dict = dict(row._mapping)
            
            # 🎯 THE FIX: Safely parse double-encoded JSON strings
            if isinstance(log_dict['changes_diff'], str):
                try:
                    parsed_diff = json.loads(log_dict['changes_diff'])
                    # If it's STILL a string (double-encoded), parse it one more time!
                    if isinstance(parsed_diff, str):
                        parsed_diff = json.loads(parsed_diff)
                    log_dict['changes_diff'] = parsed_diff
                except Exception:
                    # If it completely fails to parse, default to None so it doesn't break the UI
                    log_dict['changes_diff'] = None
                    
            logs.append(log_dict)
            
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@router.get("/dashboard-data")
def get_global_dashboard_data(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied. Global Admin only.")

    try:
        stats_query = text("""
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'Completed' OR status = 'Active / Live' THEN 1 ELSE 0 END) as completed_requests,
                SUM(CASE WHEN current_stage != 'Completed' AND status != 'Rejected' AND status != 'Active / Live' THEN 1 ELSE 0 END) as active_requests,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected_requests
            FROM material_requests
        """)
        stats = db.execute(stats_query).fetchone()

        queue_query = text("""
            SELECT * FROM material_requests ORDER BY request_id DESC
        """)
        requests = db.execute(queue_query).fetchall()

        default_stats = {
            "total_requests": 0, "completed_requests": 0, 
            "active_requests": 0, "rejected_requests": 0
        }

        return {
            "stats": dict(stats._mapping) if stats and stats[0] is not None else default_stats,
            "requests": [dict(row._mapping) for row in requests]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")    


# 🎯 STEP 1a: Save Edits Without Approving (NOW WITH PING-PONG INTERCEPT)
@router.put("/update/{request_id}")
def update_request_details(
    request_id: int, 
    edits: ITAdminOverride, 
    background_tasks: BackgroundTasks, # 🎯 NEW: Added to send emails when rerouting
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    # 1. Fetch old data to compare using ORM
    req_to_update = db.query(models.MaterialRequest).filter(
        models.MaterialRequest.request_id == request_id
    ).first()
    
    if not req_to_update:
        raise HTTPException(status_code=404, detail="Request not found.")
    
    old_data = {c.name: getattr(req_to_update, c.name) for c in req_to_update.__table__.columns}
    new_data = edits.dict(exclude_unset=True) # Only get fields that were sent
    
    # 2. Calculate the Diff
    changes = generate_diff(old_data, new_data)

    # 3. Apply changes directly to ORM attributes dynamically
    for key, value in new_data.items():
        setattr(req_to_update, key, value)

    # 4. Save to Audit Trail if there were changes
    if changes:
        new_log = models.WorkflowLog(
            request_id=request_id,
            action_by=current_user.get("user_id"),
            username=safe_username,
            action_type='EDITED',
            comments='IT Admin modified request parameters.',
            changes_diff=json.dumps(changes)
        )
        db.add(new_log)

    # =============================================================
    # THE PING-PONG LOGIC: Did the IT Admin reclassify to ZEIS/ZMIS?
    # =============================================================
    old_type = old_data.get("material_type")
    actual_new_type = new_data.get("material_type", old_type)
    controlled_types = ["ZEIS", "ZMIS"]

    if old_type != actual_new_type and actual_new_type in controlled_types:
        req_to_update.current_stage = "Material_Head"
        req_to_update.status = "Pending Mat. Head"
        req_to_update.redirected_from = "it_admin" # 🎯 Plant the IT Admin tracking flag!
        
        db.commit()

        # Send Email to the specific Material Head
        department = "Electrical" if actual_new_type == "ZEIS" else "Mechanical"
        target_emails = get_recipient_emails(db=db, role="Material_Head", plant_id=req_to_update.plant_id, material_type=actual_new_type)
        
        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #E74C3C;">Action Required: Pending {department} Material Review</h3>
            <p>Request #{request_id} was reclassified to <strong>{actual_new_type}</strong> by the IT Admin.</p>
            <p>It has been routed back to you and requires your technical verification before proceeding to final SAP Code Generation.</p>
            <p>Please log in to the MDM Portal to review.</p>
        </div>
        """
        for email in target_emails:
            background_tasks.add_task(
                send_notification_email, 
                to_email=email, 
                subject=f"Action Required: Request #{request_id} Reclassified to {actual_new_type}", 
                html_content=email_html
            )

        return {
            "message": f"Request verified and routed to {department} Material Head.", 
            "workflow_status": "Pending Material Head"
        }

    # =============================================================
    # STANDARD FLOW: No controlled change, save edits normally
    # =============================================================
    db.commit()
    return {"message": "Request details updated successfully."}


@router.post("/approve/{request_id}")
def approve_request(
    request_id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied.")

    query = text("UPDATE material_requests SET status = 'Ready for SAP' WHERE request_id = :req_id")
    db.execute(query, {"req_id": request_id})
    db.commit()
    return {"message": "Request approved and flagged for SAP generation."}


@router.get("/export-single/{request_id}")
def export_single_request(
    request_id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied.")

    query = text("SELECT * FROM material_requests WHERE request_id = :req_id")
    result = db.execute(query, {"req_id": request_id}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Request not found.")

    df = pd.DataFrame([dict(result._mapping)])
    
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.tz_localize(None) 

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="SAP_Export")
    output.seek(0)

    filename = f"Request_{request_id}_SAP_Data.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export-bulk-ready")
def export_bulk_ready_requests(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    # 1. Security Check
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied.")

    # 2. Query all requests currently sitting in the Ready for SAP queue
    query = text("SELECT * FROM material_requests WHERE status = 'Ready for SAP'")
    results = db.execute(query).fetchall()

    if not results:
        raise HTTPException(status_code=404, detail="No ready requests found to export.")

    # 3. Convert all rows into a single Pandas DataFrame
    df = pd.DataFrame([dict(row._mapping) for row in results])
    
    # 4. Strip timezone data from dates to prevent Excel errors (Exact same as your single export)
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.tz_localize(None) 

    # 5. Write to BytesIO in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="SAP_Bulk_Export")
    output.seek(0)

    # 6. Generate dynamic filename with today's date
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"Viraj_SAP_Bulk_Data_{date_str}.xlsx"
    
    # 7. Stream the file back to React
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# 🎯 STEP 3: Finalize, Save Code, and Push to Master Library
@router.post("/finalize/{request_id}")
def finalize_and_sync(
    request_id: int, 
    edits: ITAdminOverride, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied. IT Gateway only.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    if not edits.generated_material_code:
        raise HTTPException(status_code=400, detail="Generated SAP Material Code is required.")

    check_query = text("SELECT * FROM material_requests WHERE request_id = :req_id")
    req = db.execute(check_query, {"req_id": request_id}).fetchone()
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")

    try:
        final_sap_code = edits.generated_material_code
        final_desc = edits.material_description

        update_query = text("""
            UPDATE material_requests 
            SET current_stage = 'Completed', 
                status = 'Active / Live',
                generated_material_code = :sap_code,
                material_description = :material_description,
                long_description = :long_description,
                plant_id = :plant_id,
                storage_location = :storage_location,
                material_type = :material_type,
                base_unit_of_measure = :base_unit_of_measure,
                material_group = :material_group,
                purchasing_group = :purchasing_group,
                sales_org = :sales_org,
                dist_channel = :dist_channel,
                control_code_gst = :control_code_gst,
                valuation_category = :valuation_category,
                valuation_class = :valuation_class,
                return_to_stage = NULL,
                latest_note = NULL
            WHERE request_id = :req_id
        """)
        
        db.execute(update_query, {
            "req_id": request_id,
            "sap_code": final_sap_code,
            "material_description": final_desc,
            "long_description": edits.long_description,
            "plant_id": edits.plant_id,
            "storage_location": edits.storage_location,
            "material_type": edits.material_type,
            "base_unit_of_measure": edits.base_unit_of_measure,
            "material_group": edits.material_group,
            "purchasing_group": edits.purchasing_group,
            "sales_org": edits.sales_org,
            "dist_channel": edits.dist_channel,
            "control_code_gst": edits.control_code_gst,
            "valuation_category": edits.valuation_category,
            "valuation_class": edits.valuation_class
        })

        insert_lib_query = text("""
            INSERT INTO master_data_library (material_code, material_description, UOM) 
            VALUES (:code, :desc , :uom)
        """)
        db.execute(insert_lib_query, {
            "code": final_sap_code,
            "desc": final_desc,
            "uom": edits.base_unit_of_measure
        })

        log_query = text("""
            INSERT INTO workflow_logs (request_id, action_by, username, action_type, comments) 
            VALUES (:req_id, :user_id, :username, 'FINALIZED', :comments)
        """)
        db.execute(log_query, {
            "req_id": request_id, 
            "user_id": current_user.get("user_id"), 
            "username": safe_username,
            "comments": f"SUCCESS: SAP Code {final_sap_code} linked and pushed to Master Library."
        })

        # Email Notification
        target_emails = get_recipient_emails(db, role="Creator", plant_id=edits.plant_id or req._mapping["plant_id"])
        email_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #27AE60;">SAP Material Code Generated</h3>
            <p>Your request #{request_id} has been fully processed and is now LIVE.</p>
            <p><strong>SAP Code:</strong> {final_sap_code}</p>
        </div>
        """
        
        for email in target_emails:
            background_tasks.add_task(
                send_notification_email,
                to_email=email,
                subject=f"System Alert: Material {final_sap_code} is now LIVE",
                html_content=email_html
            )

        db.commit()
        return {"message": f"Pipeline Complete! SAP Code {final_sap_code} added to Master Data Library."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


@router.post("/override-reject/{request_id}")
def emergency_reject_request(
    request_id: int, 
    reason: str, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "IT_Admin":
        raise HTTPException(status_code=403, detail="Access Denied. IT Administrators only.")

    safe_username = current_user.get("username", f"User_{current_user.get('user_id')}")

    reject_query = text("""
        UPDATE material_requests 
        SET current_stage = 'Rejected', 
            status = 'Rejected',
            return_to_stage = NULL,
            latest_note = NULL
        WHERE request_id = :request_id
    """)
    result = db.execute(reject_query, {"request_id": request_id})

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Request not found.")

    log_query = text("""
        INSERT INTO workflow_logs (request_id, action_by, username, action_type, comments) 
        VALUES (:req_id, :user_id, :username, 'REJECTED', :comments)
    """)
    db.execute(log_query, {
        "req_id": request_id,
        "user_id": current_user.get("user_id"),
        "username": safe_username,
        "comments": f"SYSTEM OVERRIDE CANCEL: {reason}"
    })
    
    db.commit()
    return {"message": f"System Override Successful: Request {request_id} has been terminated."}
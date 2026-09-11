from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.database import get_db

# Adjust this import to match where your get_current_user function lives!
from backend.routers.auth import get_current_user 

router = APIRouter(prefix="/history", tags=["Action History"])

@router.get("/my-history")
def get_my_history(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        # 🎯 Fetch every request this specific user has touched
        # NOTE: If your workflow_logs timestamp column is named 'created_at', change 'w.action_at' to 'w.created_at' below!
       # 🎯 FIX: Changed w.created_at to w.timestamp to match your database!
        query = text("""
            SELECT DISTINCT 
                r.request_id, 
                r.material_description, 
                r.status, 
                r.current_stage, 
                w.action_type, 
                w.timestamp as action_at 
            FROM material_requests r
            JOIN workflow_logs w ON r.request_id = w.request_id
            WHERE w.action_by = :uid OR r.created_by = :uid
            ORDER BY w.timestamp DESC
        """)
        
        results = db.execute(query, {"uid": user_id}).fetchall()
        
        # Convert SQLAlchemy rows to a list of dictionaries for JSON
        return [dict(row._mapping) for row in results]
        
    except Exception as e:
        print(f"❌ Error fetching history: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch history")
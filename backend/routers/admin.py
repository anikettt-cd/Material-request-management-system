# backend/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
import bcrypt

from backend.database import get_db
from backend import schemas
from backend.routers.auth import get_current_user
from backend.email_service import send_notification_email

router = APIRouter(prefix="/admin", tags=["Admin Workspace (User Management)"])


class UserUpdate(BaseModel):
    username: str
    email: str
    role: str
    plant_id: Optional[str] = None
    password: Optional[str] = None # Optional so we don't force a password change

# Secure Password Encryption
def get_password_hash(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')



@router.post("/create-user")
def create_new_employee(
    new_user: schemas.UserCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Access Denied. Admins only.")

    # Check if username already exists
    check_query = text("SELECT * FROM users WHERE username = :username")
    existing_user = db.execute(check_query, {"username": new_user.username}).fetchone()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists!")

    try:
        # Encrypt the password and save the user
        hashed_pw = get_password_hash(new_user.password)
        
        insert_query = text("""
            INSERT INTO users (username, email, password_hash, role, plant_id) 
            VALUES (:username, :email, :password_hash, :role, :plant_id)
        """)
        
        db.execute(insert_query, {
            "username": new_user.username,
            "email": new_user.email,
            "password_hash": hashed_pw,
            "role": new_user.role,
            "plant_id": new_user.plant_id
        })
        db.commit()
        
        # Welcome Email Logic
        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2E86C1; padding: 20px; text-align: center;">
                <h2 style="color: white; margin: 0;">Welcome to Viraj MDM Portal</h2>
            </div>
            <div style="padding: 20px;">
                <p>Hello,</p>
                <p>Your enterprise portal account has been successfully created by the Administrator. Below are your official login credentials:</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #2E86C1; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Username:</strong> {new_user.username}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Email:</strong> {new_user.email}</p>
                    <p style="margin: 0;"><strong>Temporary Password:</strong> {new_user.password}</p>
                </div>
                
                <p><strong>Assigned Role:</strong> {new_user.role}</p>
                <p><strong>Assigned Plant:</strong> {new_user.plant_id or 'Global'}</p>
                
                <p>Please log in to the <a href="http://192.168.100.57/dashboard">Viraj MDM Portal</a> to proceed.</p>
            </div>
        </div>
        """

        background_tasks.add_task(
            send_notification_email,
            to_email=new_user.email,
            subject="Welcome to Viraj MDM - Your Login Credentials",
            html_content=email_html
        )
        
        return {"message": f"Success! Employee {new_user.username} has been onboarded as a {new_user.role}."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


@router.get("/users")
def get_all_users(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Access Denied.")
    
    try:
        query = text("""
            SELECT user_id, username, role, plant_id, email, 1 as is_active 
            FROM users 
            ORDER BY user_id DESC
        """)
        results = db.execute(query).fetchall()
        return [dict(row._mapping) for row in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


@router.put("/users/{target_user_id}")
def update_employee(
    target_user_id: int, 
    user_data: UserUpdate, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Access Denied. Admins only.")

    try:
        check_query = text("SELECT * FROM users WHERE user_id = :id")
        existing_user = db.execute(check_query, {"id": target_user_id}).fetchone()
        
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found.")

        update_query = """
            UPDATE users 
            SET username = :username, email = :email, role = :role, plant_id = :plant_id
        """
        params = {
            "id": target_user_id,
            "username": user_data.username,
            "email": user_data.email,
            "role": user_data.role,
            "plant_id": user_data.plant_id
        }

        if user_data.password and user_data.password.strip() != "":
            hashed_pw = get_password_hash(user_data.password)
            update_query += ", password_hash = :password_hash"
            params["password_hash"] = hashed_pw

        update_query += " WHERE user_id = :id"
        db.execute(text(update_query), params)
        db.commit()
        
        return {"message": f"Success! User {user_data.username} has been updated."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


@router.delete("/users/{target_user_id}")
def delete_employee(
    target_user_id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Access Denied. Admins only.")
    
    if current_user.get("user_id") == target_user_id:
        raise HTTPException(status_code=400, detail="Action Denied. You cannot delete your own admin account.")

    try:
        check_query = text("SELECT username FROM users WHERE user_id = :user_id")
        user_to_delete = db.execute(check_query, {"user_id": target_user_id}).fetchone()
        
        if not user_to_delete:
            raise HTTPException(status_code=404, detail="User not found.")
            
        # Reassign any audit logs to the Admin
        reassign_logs_query = text("""
            UPDATE workflow_logs 
            SET action_by = :admin_id, 
                comments = CONCAT(COALESCE(comments, ''), ' (Original acting user ', :username, ' was deleted)')
            WHERE action_by = :user_id
        """)
        db.execute(reassign_logs_query, {
            "admin_id": current_user.get("user_id"), 
            "username": user_to_delete[0],
            "user_id": target_user_id
        })

        # Reassign ownership of any Material Requests to the Admin
        reassign_requests_query = text("""
            UPDATE material_requests 
            SET created_by = :admin_id 
            WHERE created_by = :user_id
        """)
        db.execute(reassign_requests_query, {
            "admin_id": current_user.get("user_id"), 
            "user_id": target_user_id
        })
            
        # Execute the final deletion
        delete_query = text("DELETE FROM users WHERE user_id = :user_id")
        db.execute(delete_query, {"user_id": target_user_id})
        
        db.commit()
        
        return {"message": f"Success! User {user_to_delete[0]} has been permanently deleted."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
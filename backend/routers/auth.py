# backend/routers/auth.py
import os
from datetime import datetime, timedelta
# 🎯 THE UPGRADE: Added Response and Request to the imports
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
import bcrypt
import jwt

from backend.database import get_db
from backend import schemas

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# We keep this for Swagger UI documentation purposes
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# 🎯 THE UPGRADE: Teach the backend to read the cookie jar
def get_current_user(request: Request, db: Session = Depends(get_db)):
    # First, try to get the token from the HttpOnly cookie
    token = request.cookies.get("access_token")
    
    # Fallback: Check the header (useful if you are testing via Swagger UI)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid Authentication Token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or Expired Token")

    query = text("SELECT * FROM users WHERE username = :username")
    user = db.execute(query, {"username": username}).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return dict(user._mapping)


# 🎯 THE UPGRADE: Inject 'response: Response' and set the cookie
@router.post("/login")
def login(response: Response, user_credentials: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    query = text("SELECT * FROM users WHERE username = :username")
    result = db.execute(query, {"username": user_credentials.username}).fetchone()

    if not result or not verify_password(user_credentials.password, result._mapping["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Credentials")

    user_dict = dict(result._mapping) 
    access_token = create_access_token(
        data={"sub": user_dict["username"], "role": user_dict["role"], "plant_id": user_dict["plant_id"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # 🔒 Lock the token inside the browser's cookie jar
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,                 # Invisible to JavaScript (XSS Protection)
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",                # CSRF Protection
        secure=False                   # Set to True later when we enable HTTPS
    )

    return {
        "message": "Login successful", 
        "role": user_dict["role"], 
        "plant_id": user_dict["plant_id"]
    }
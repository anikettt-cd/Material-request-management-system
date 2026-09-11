# backend/seed_users.py
import bcrypt
from sqlalchemy import text
from backend.database import engine

# Unified master list matching your live database updates and router role checks
test_users = [
    # (username, email, role, plant_id)
    ("Creator_01", "creator@viraj.com", "Creator", "1000"),
    ("Plant_Head_1000", "jagdijena0017@gmail.com", "Plant_Head", "1000"), # Matched to live test email
    ("Deepak_Mech", "sainiant751@gmail.com", "Material_Head", None),       # Matched to live test email
    ("Pradeep_Elec", "aadityash1492@viraj.com", "Material_Head", None),
    ("Purchase_Team", "aniketss23hiteudent.mes.ac.in", "Purchase", None), # Matched to live test email
    ("GST_Audit", "aadityas212@gmail.com", "GST", None),                   # Matched to 'GST' role & live email
    ("Store_Master", "markk50marketing@gmail.com", "Store", None),           # Matched to live test email
    ("IT_Admin", "jagdisha3017@gmail.com", "IT_Admin", None),             # FIX: Role changed from 'Admin' to 'IT_Admin'
    ("SuperAdmin", "superadmin@viraj.com", "Admin", None),
]

def hash_password(plain_text_password: str):
    """Encrypts the password using enterprise-grade Bcrypt"""
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(plain_text_password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

def seed_database():
    print("🌱 Starting database seeding process...")
    
    standard_password = "password123"
    hashed_pw = hash_password(standard_password)

    with engine.connect() as connection:
        for username, email, role, plant_id in test_users:
            try:
                # SQL command to insert or update users safely
                query = text("""
                    INSERT INTO users (username, password_hash, role, plant_id, email) 
                    VALUES (:username, :password_hash, :role, :plant_id, :email)
                    ON DUPLICATE KEY UPDATE 
                        email = VALUES(email),
                        role = VALUES(role),
                        plant_id = VALUES(plant_id);
                """)
                
                connection.execute(query, {
                    "username": username,
                    "password_hash": hashed_pw,
                    "role": role,
                    "plant_id": plant_id,
                    "email": email
                })
                print(f"✅ Synced User: {username} [{role}]")
                
            except Exception as e:
                print(f"⚠️ Could not sync {username}. Error: {e}")
        
        connection.commit()
    
    print("🚀 Seeding and role synchronization complete!")

if __name__ == "__main__":
    seed_database()
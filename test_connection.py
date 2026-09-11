from backend.database import engine
from sqlalchemy import text

def verify_connection():
    print("Attempting to connect to MYSQL Server...")
    try:
        # We try to open a connection and run a basic "hello" query
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            print("\n✅ SUCCESS! Your application is fully connected to viraj_mdm_db!")
            
    except Exception as e:
        print("\n❌ FAILED! The connection was refused.")
        print(f"Error Details: {e}")

if __name__ == "__main__":
    verify_connection()
import sys
from backend.database import engine, Base
# Explicitly import all your models so SQLAlchemy knows they exist
from backend.models import User, MaterialRequest, WorkflowLog, MasterDataLibrary

def run_migration():
    print("=" * 60)
    print("STARTING SCHEMA MIGRATION TO MS SQL SERVER")
    print("Target Instance: MMUATSRV01\\SQLEXPRESS")
    print("Target Database: viraj_mdm_db")
    print("=" * 60)
    
    try:
        print("Translating SQLAlchemy ORM definitions to T-SQL...")
        # This command actually builds the tables
        Base.metadata.create_all(bind=engine)
        
        print("\n[SUCCESS] Migration completed!")
        print("The following tables are now active in 'viraj_mdm_db':")
        print("  - users")
        print("  - material_requests")
        print("  - workflow_logs")
        print("  - master_data_library")
        print("=" * 60)
        
    except Exception as error:
        print("\n[CRITICAL ERROR] Migration execution failed.")
        print(f"Error Details: {str(error)}")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
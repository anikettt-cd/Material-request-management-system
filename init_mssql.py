# init_mssql.py
import sys
from backend.database import engine, Base
# Crucial: Import all models explicitly so SQLAlchemy registers their metadata
from backend.models import User, MaterialRequest, WorkflowLog, MasterDataLibrary

def generate_production_schema():
    print("=" * 60)
    print("STARTING SCHEMA MIGRATION: MYSQL -> MS SQL SERVER")
    print("Target Database Engine Instance: MMUATSRV01\\SQLEXPRESS")
    print("=" * 60)
    
    try:
        # Drops tables if they exist to provide a clean state (optional)
        # Base.metadata.drop_all(bind=engine) 
        
        print("\nTranslating SQLAlchemy ORM definitions to T-SQL...")
        Base.metadata.create_all(bind=engine)
        
        print("\n[SUCCESS] Table creation finalized perfectly!")
        print("The following structures are now active in 'viraj_mdm_db':")
        print("  - users")
        print("  - material_requests")
        print("  - workflow_logs")
        print("  - master_data_library")
        print("=" * 60)
        
    except Exception as error:
        print("\n[ERROR] Migration execution halted due to a connection or syntax issue.")
        print(f"Details: {str(error)}")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    generate_production_schema()
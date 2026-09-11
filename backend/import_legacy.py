import os
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv

# 1. Load credentials securely from your .env file
load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")

# 2. Construct the Database URL
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

def run_import():
    print("Loading legacy Excel file...")
    
    try:
        # 3. Read the Excel file (Make sure 'Data E.xlsx' is inside your backend or root folder!)
        df = pd.read_excel("Data_M.xlsx", sheet_name="Sheet1") 
    except FileNotFoundError:
        print("❌ Error: 'Data_M.xlsx' not found. Please verify the filename and placement.")
        return

    # 4. Rename columns to match the database exactly
    # 🎯 UPDATED SCHEMA MATCH: Added UOM / Base Unit of Measure tracking
    df = df.rename(columns={
        "Material": "material_code",
        "Material description": "material_description",
        "UOM": "UOM",
        "Base Unit of Measure": "UOM"  # Handles both common column name variations
    })

    # Fallback: If UOM column is missing entirely from Excel, create an empty one
    if "UOM" not in df.columns:
        print("⚠️ Warning: No 'UOM' column found in Excel. Inserting blank values.")
        df["UOM"] = None

    # Keep only the three columns we care about now
    df = df[["material_code", "material_description", "UOM"]]

    # Drop rows only if they lack crucial identifier codes or descriptions
    df = df.dropna(subset=["material_code", "material_description"])

    # Clean strings to remove trailing spaces from Excel data
    df["material_code"] = df["material_code"].astype(str).str.strip()
    df["material_description"] = df["material_description"].astype(str).str.strip()
    df["UOM"] = df["UOM"].astype(str).str.strip().replace("nan", None).replace("None", None)

    print(f"Found {len(df)} records. Pushing to database...")

    # 5. Push to MySQL
    try:
        df.to_sql("master_data_library", con=engine, if_exists="append", index=False)
        print("🎉 SUCCESS! Check MySQL Workbench, all legacy data including UOM is loaded with IDs!")
    except Exception as e:
        print(f"❌ Error during import: {e}")

if __name__ == "__main__":
    run_import()
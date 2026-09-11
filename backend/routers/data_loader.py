from fastapi import APIRouter, HTTPException
import pandas as pd
import os

# Crucial: prefix is "/data", NOT "/api/data"
router = APIRouter(prefix="/data", tags=["Dropdown Data"])

# Points to C:\viraj_project\frontend\public\data
DATA_DIR = os.path.join(os.getcwd(), "frontend", "public", "data")

@router.get("/{file_name}")
def get_dropdown_data(file_name: str):
    file_path = os.path.join(DATA_DIR, f"{file_name}.xlsx")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File {file_name}.xlsx not found.")
        
    try:
        df = pd.read_excel(file_path)
        df = df.fillna("")  
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
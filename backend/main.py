# backend/main.py
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 🎯 NEW: Import your database engine and models
from backend.database import engine
from backend import models

from backend.routers import auth, creator, plant_head, material_head, purchase, gst, store, it_admin, admin 
from backend.routers import workflow
from backend.routers import data_loader
from backend.routers import history

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Viraj MDM Portal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(creator.router)
app.include_router(plant_head.router)
app.include_router(material_head.router)
app.include_router(purchase.router)
app.include_router(gst.router)
app.include_router(store.router)
app.include_router(it_admin.router)
app.include_router(admin.router)
app.include_router(workflow.router)
app.include_router(data_loader.router)
app.include_router(history.router) 


@app.get("/")
def root():
    return {"message": "Viraj MDM Engine is Online and Secure"}
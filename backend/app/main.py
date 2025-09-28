from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from fastapi import Response
from typing import Optional, List
import os
import shutil
from datetime import datetime
import uuid

from app.database import init_database
from app.models import (
    User, Entry, HairlineEntry, MoleEntry, AcneEntry, 
    Medication, MedicationCategory
)
from app.schemas import UserCreate, EntryCreate, MedicationCreate, MedicationUpdate
from app.services.pdf_service import generate_user_report
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="DermAI API",
    description="""
    # DermAI - Dermatology Tracking API

    A comprehensive dermatology tracking web application that uses AI to analyze skin conditions.

    ## Features

    * **User Management** - Create and manage user profiles
    * **Entry Tracking** - Track hairline, acne, and mole conditions with photos
    * **AI Analysis** - Automatic AI-powered analysis using GPT-4 Vision
    * **Medication Management** - Track medications by condition category
    * **PDF Reports** - Generate professional dermatologist reports
    * **Progress Tracking** - Monitor changes over time with sequence IDs

    ## Entry Types

    * **Hairline Entries** - Norwood scale scoring for hair loss tracking
    * **Acne Entries** - Severity assessment and treatment recommendations
    * **Mole Entries** - Irregularity detection and monitoring recommendations

    ## Getting Started

    1. Create a user with `POST /create-user`
    2. Add medications if applicable
    3. Create entries with photos for AI analysis
    4. Export comprehensive reports as needed
    """,
    version="1.0.0",
    contact={
        "name": "DermAI Support",
        "email": "support@dermrai.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# CORS: allow all origins, methods, and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_database()

# User Management
@app.post(
    "/create-user",
    tags=["User Management"],
    summary="Create a new user",
    description="Create a new user account. Returns a unique user_id that serves as authentication for this prototype."
)
async def create_user(user_data: UserCreate):
    user = User(name=user_data.name)
    await user.save()
    return {"user_id": user.user_id, "message": "User created successfully"}

@app.get(
    "/users/{user_id}",
    tags=["User Management"],
    summary="Get user details",
    description="Retrieve user information by user ID."
)
async def get_user(user_id: str):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Medication Management
@app.post(
    "/users/{user_id}/medications",
    tags=["Medication Management"],
    summary="Add medication",
    description="Add a new medication for a user, categorized by condition type (acne, hairline, mole)."
)
async def add_medication(user_id: str, medication: MedicationCreate):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    med = Medication(user_id=user_id, **medication.dict())
    await med.save()
    return med

@app.get(
    "/users/{user_id}/medications",
    tags=["Medication Management"],
    summary="Get user medications",
    description="Retrieve all medications for a user, optionally filtered by category."
)
async def get_medications(
    user_id: str, 
    category: Optional[MedicationCategory] = Query(None, description="Filter by medication category")
):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if category:
        medications = await Medication.find(
            Medication.user_id == user_id,
            Medication.category == category
        ).to_list()
    else:
        medications = await Medication.find(Medication.user_id == user_id).to_list()
    
    return medications

@app.put(
    "/medications/{medication_id}",
    tags=["Medication Management"],
    summary="Update medication",
    description="Update an existing medication's details."
)
async def update_medication(medication_id: str, update_data: MedicationUpdate):
    medication = await Medication.get(medication_id)
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    await medication.update({"$set": update_dict})
    return medication

@app.delete(
    "/medications/{medication_id}",
    tags=["Medication Management"],
    summary="Delete medication",
    description="Remove a medication from the user's profile."
)
async def delete_medication(medication_id: str):
    medication = await Medication.get(medication_id)
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    await medication.delete()
    return {"message": "Medication deleted successfully"}

# Entry Management
async def save_upload_file(upload_file: UploadFile, user_id: str) -> (str, str, str):
    os.makedirs("entry_images", exist_ok=True)
    original_name = upload_file.filename or "image"
    ext = os.path.splitext(original_name)[1].lower() or ".jpg"
    image_id = str(uuid.uuid4())
    file_path = os.path.join("entry_images", f"{image_id}{ext}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return image_id, ext, file_path

@app.post(
    "/users/{user_id}/hairline-entries",
    tags=["Hairline Tracking"],
    summary="Create hairline entry",
    description="Upload a hairline photo for AI analysis. Returns Norwood score, comments, and recommendations."
)
async def create_hairline_entry(
    user_id: str,
    photo: UploadFile = File(..., description="Photo of hairline for analysis"),
    sequence_id: Optional[str] = Form(None, description="Link to existing sequence for progress tracking"),
    user_notes: Optional[str] = Form(None, description="User's notes about current condition"),
    user_concerns: Optional[str] = Form(None, description="User's specific concerns")
):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    image_id, image_ext, photo_path = await save_upload_file(photo, user_id)
    
    entry = HairlineEntry(
        user_id=user_id,
        image_id=image_id,
        image_ext=image_ext,
        photo_path=photo_path,
        user_notes=user_notes,
        user_concerns=user_concerns
    )
    
    if sequence_id:
        entry.sequence_id = sequence_id
    
    await entry.save()
    
    # Get AI feedback
    try:
        await entry.get_ai_feedback()
        return {"entry": entry}
    except Exception as e:
        return {"entry": entry, "error": str(e)}

@app.post(
    "/users/{user_id}/acne-entries",
    tags=["Acne Tracking"],
    summary="Create acne entry",
    description="Upload an acne photo for AI analysis. Returns severity level, comments, and treatment recommendations."
)
async def create_acne_entry(
    user_id: str,
    photo: UploadFile = File(..., description="Photo of acne condition for analysis"),
    sequence_id: Optional[str] = Form(None, description="Link to existing sequence for progress tracking"),
    user_notes: Optional[str] = Form(None, description="User's notes about current condition"),
    user_concerns: Optional[str] = Form(None, description="User's specific concerns")
):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    image_id, image_ext, photo_path = await save_upload_file(photo, user_id)
    
    entry = AcneEntry(
        user_id=user_id,
        image_id=image_id,
        image_ext=image_ext,
        photo_path=photo_path,
        user_notes=user_notes,
        user_concerns=user_concerns
    )
    
    if sequence_id:
        entry.sequence_id = sequence_id
    
    await entry.save()
    
    # Get AI feedback
    try:
        await entry.get_ai_feedback()
        return {"entry": entry}
    except Exception as e:
        return {"entry": entry, "error": str(e)}

@app.post(
    "/users/{user_id}/mole-entries",
    tags=["Mole Tracking"],
    summary="Create mole entry",
    description="Upload a mole photo for AI analysis. Returns irregularity detection, comments, and monitoring recommendations."
)
async def create_mole_entry(
    user_id: str,
    photo: UploadFile = File(..., description="Photo of mole for irregularity analysis"),
    sequence_id: Optional[str] = Form(None, description="Link to existing sequence for progress tracking"),
    user_notes: Optional[str] = Form(None, description="User's notes about current condition"),
    user_concerns: Optional[str] = Form(None, description="User's specific concerns")
):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    image_id, image_ext, photo_path = await save_upload_file(photo, user_id)
    
    entry = MoleEntry(
        user_id=user_id,
        image_id=image_id,
        image_ext=image_ext,
        photo_path=photo_path,
        user_notes=user_notes,
        user_concerns=user_concerns
    )
    
    if sequence_id:
        entry.sequence_id = sequence_id
    
    await entry.save()
    
    # Get AI feedback
    try:
        await entry.get_ai_feedback()
        return {"entry": entry}
    except Exception as e:
        return {"entry": entry, "error": str(e)}

# Entry Retrieval
@app.get(
    "/users/{user_id}/entries",
    tags=["Entry Management"],
    summary="Get user entries",
    description="Retrieve all entries for a user with optional filtering by type and sequence ID."
)
async def get_all_entries(
    user_id: str,
    entry_type: Optional[str] = Query(None, description="Filter by entry type: hairline, acne, or mole"),
    sequence_id: Optional[str] = Query(None, description="Filter by sequence ID for progress tracking")
):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build base query conditions
    base_conditions = {"user_id": user_id}
    
    if sequence_id:
        base_conditions["sequence_id"] = sequence_id
    
    if entry_type == "hairline":
        entries = await HairlineEntry.find(base_conditions).sort(-HairlineEntry.created_at).to_list()
    elif entry_type == "acne":
        entries = await AcneEntry.find(base_conditions).sort(-AcneEntry.created_at).to_list()
    elif entry_type == "mole":
        entries = await MoleEntry.find(base_conditions).sort(-MoleEntry.created_at).to_list()
    else:
        # Get all entry types when no specific type is requested
        hairline_entries = await HairlineEntry.find({"user_id": user_id}).to_list()
        acne_entries = await AcneEntry.find({"user_id": user_id}).to_list()
        mole_entries = await MoleEntry.find({"user_id": user_id}).to_list()
        
        # Combine all entries and sort by created_at
        entries = hairline_entries + acne_entries + mole_entries
        entries.sort(key=lambda x: x.created_at, reverse=True)
        
        # Apply sequence_id filter if provided
        if sequence_id:
            entries = [e for e in entries if e.sequence_id == sequence_id]
    
    return entries

@app.get(
    "/images/{image_id}",
    tags=["Entry Management"],
    summary="Get image by ID",
    description="Serve an entry image by its UUID without exposing user-specific paths."
)
async def get_image_by_id(image_id: str):
    # Search across all entry types since Entry is the base class
    entry = None
    
    # Try to find in HairlineEntry first
    entry = await HairlineEntry.find_one(HairlineEntry.image_id == image_id)
    
    # If not found, try AcneEntry
    if not entry:
        entry = await AcneEntry.find_one(AcneEntry.image_id == image_id)
    
    # If not found, try MoleEntry
    if not entry:
        entry = await MoleEntry.find_one(MoleEntry.image_id == image_id)
    
    if not entry:
        raise HTTPException(status_code=404, detail="Image not found")

    # Prefer new consolidated path, fallback to legacy photo_path if needed
    if entry.image_ext:
        file_path = os.path.join("entry_images", f"{image_id}{entry.image_ext}")
        if os.path.exists(file_path):
            return FileResponse(file_path)

    if entry.photo_path and os.path.exists(entry.photo_path):
        return FileResponse(entry.photo_path)

    raise HTTPException(status_code=404, detail="Image file missing")

@app.get(
    "/users/{user_id}/entries/sequences",
    tags=["Entry Management"],
    summary="Get entry sequences",
    description="Get all unique sequence IDs for a user with entry counts and latest timestamps."
)
async def get_entry_sequences(user_id: str):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get unique sequence IDs for the user
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$sequence_id",
            "count": {"$sum": 1},
            "latest_entry": {"$max": "$created_at"},
            "entry_type": {"$first": "$_cls"}
        }},
        {"$sort": {"latest_entry": -1}}
    ]
    
    sequences = await Entry.aggregate(pipeline).to_list()
    return sequences

@app.get(
    "/entries/{entry_id}",
    tags=["Entry Management"],
    summary="Get single entry",
    description="Retrieve a specific entry by its ID."
)
async def get_entry(entry_id: str):
    # Search across all entry types since Entry is the base class
    entry = None
    
    # Try to find in HairlineEntry first
    try:
        entry = await HairlineEntry.get(entry_id)
    except:
        pass
    
    # If not found, try AcneEntry
    if not entry:
        try:
            entry = await AcneEntry.get(entry_id)
        except:
            pass
    
    # If not found, try MoleEntry
    if not entry:
        try:
            entry = await MoleEntry.get(entry_id)
        except:
            pass
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

# PDF Export
@app.get(
    "/users/{user_id}/export-pdf",
    tags=["Reports"],
    summary="Export PDF report",
    description="Generate and download a comprehensive dermatological assessment report for the user.",
    response_class=FileResponse
)
async def export_user_pdf(user_id: str):
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        pdf_path = await generate_user_report(user_id)
        return FileResponse(
            pdf_path, 
            media_type="application/pdf",
            filename=f"dermatology_report_{user.name.replace(' ', '_')}.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

@app.get(
    "/debug/database",
    tags=["Debug"],
    summary="View entire database",
    description="Debug route to view all data in the database as JSON. Shows all users, entries, and medications."
)
async def debug_database():
    try:
        # Get all users
        users = await User.find_all().to_list()
        
        # Get all entries (all types)
        hairline_entries = await HairlineEntry.find_all().to_list()
        acne_entries = await AcneEntry.find_all().to_list()
        mole_entries = await MoleEntry.find_all().to_list()
        
        # Get all medications
        medications = await Medication.find_all().to_list()
        
        return {
            "database_snapshot": {
                "users": users,
                "entries": {
                    "hairline": hairline_entries,
                    "acne": acne_entries,
                    "mole": mole_entries,
                    "total_count": len(hairline_entries) + len(acne_entries) + len(mole_entries)
                },
                "medications": medications,
                "summary": {
                    "total_users": len(users),
                    "total_entries": len(hairline_entries) + len(acne_entries) + len(mole_entries),
                    "total_medications": len(medications),
                    "collections": ["users", "entries", "medications"]
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve database data: {str(e)}")

@app.get(
    "/",
    tags=["General"],
    summary="API Information",
    description="Get basic API information and links to documentation."
)
async def root():
    return {
        "message": "Welcome to DermAI API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi_schema": "/openapi.json"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

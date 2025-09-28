from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models import MedicationCategory

class UserCreate(BaseModel):
    name: str

class EntryCreate(BaseModel):
    sequence_id: Optional[str] = None
    user_notes: Optional[str] = None
    user_concerns: Optional[str] = None
    created_at: Optional[datetime] = None

class MedicationCreate(BaseModel):
    category: MedicationCategory
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None

from beanie import Document, Indexed
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid

class MedicationCategory(str, Enum):
    ACNE = "acne"
    HAIRLINE = "hairline" 
    MOLE = "mole"

class User(Document):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "users"

class Medication(Document):
    user_id: Indexed(str)
    category: MedicationCategory
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "medications"
        
    def dict(self, *args, **kwargs):
        """Override dict method to include medication_id"""
        data = super().dict(*args, **kwargs)
        data['medication_id'] = str(self.id)
        return data

class Entry(Document):
    sequence_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    image_id: Optional[str] = None
    image_ext: Optional[str] = None
    photo_path: str
    ai_comments: Optional[str] = None
    recommendations: Optional[str] = None
    treatment: Optional[List[str]] = None
    user_notes: Optional[str] = None
    user_concerns: Optional[str] = None
    
    class Settings:
        name = "entries"
        is_root = True

class HairlineEntry(Entry):
    norwood_score: Optional[int] = None
    
    async def get_ai_feedback(self):
        from app.services.ai_service import get_hairline_feedback
        return await get_hairline_feedback(self)

class MoleEntry(Entry):
    irregularities_detected: Optional[bool] = None
    
    async def get_ai_feedback(self):
        from app.services.ai_service import get_mole_feedback
        return await get_mole_feedback(self)

class AcneEntry(Entry):
    severity_level: Optional[str] = None
    
    async def get_ai_feedback(self):
        from app.services.ai_service import get_acne_feedback
        return await get_acne_feedback(self)

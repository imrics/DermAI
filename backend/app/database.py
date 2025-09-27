import os
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.models import User, Entry, HairlineEntry, MoleEntry, AcneEntry, Medication

async def init_database():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    
    await init_beanie(
        database=client.dermapp_db,
        document_models=[User, Entry, HairlineEntry, MoleEntry, AcneEntry, Medication]
    )

from fastapi import APIRouter
from app.models import VersionResponse

router = APIRouter(prefix="/api/versions", tags=["versions"])

@router.get("", response_model=VersionResponse)
async def get_versions() -> VersionResponse:
    return VersionResponse(versions=["5", "8", "17", "21"], default="8")

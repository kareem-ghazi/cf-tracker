"""API v1 Master Router aggregating all endpoint routers."""
from fastapi import APIRouter
from app.api.v1.endpoints.groups import router as groups_router
from app.api.v1.endpoints.tasks import router as tasks_router
from app.api.v1.endpoints.contests import router as contests_router
from app.api.v1.endpoints.spreadsheets import router as spreadsheets_router
from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.codeforces import router as codeforces_router

api_v1_router = APIRouter()

api_v1_router.include_router(groups_router)
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(contests_router)
api_v1_router.include_router(spreadsheets_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(codeforces_router)


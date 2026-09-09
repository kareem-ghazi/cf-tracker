"""Background task status polling API endpoints."""
from typing import Any, Dict
from fastapi import APIRouter
from celery.result import AsyncResult

from app.workers.celery_app import celery_app

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/{task_id}")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """Retrieve progress and completion status of an asynchronous background job."""
    task_result = AsyncResult(task_id, app=celery_app)

    state = task_result.state
    response: Dict[str, Any] = {
        "task_id": task_id,
        "status": state,
        "progress": 0,
        "result": None,
        "error": None,
    }

    if state == "PENDING":
        response["message"] = "Task is waiting in queue..."
    elif state == "PROGRESS":
        info = task_result.info if isinstance(task_result.info, dict) else {}
        response["progress"] = info.get("progress", 50)
        response["message"] = info.get("message", "Task in progress...")
    elif state == "SUCCESS":
        response["progress"] = 100
        response["result"] = task_result.result
        response["message"] = "Task completed successfully"
    elif state == "FAILURE":
        response["progress"] = 100
        response["error"] = str(task_result.info)
        response["message"] = "Task execution failed"

    return response

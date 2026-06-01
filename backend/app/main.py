from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.cabinet import router as cabinet_router
from app.routers.health import router as health_router
from app.routers.public_subscription import router as public_subscription_router
from app.routers.telegram import router as telegram_router

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(public_subscription_router)
app.include_router(cabinet_router)
app.include_router(telegram_router)
app.include_router(admin_router)
app.include_router(auth_router)



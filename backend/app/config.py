from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "arvexo-connect-core"
    app_env: str = "development"
    public_base_url: str = "http://localhost:8000"
    database_url: str = "postgresql+asyncpg://arvexo:arvexo_password@postgres:5432/arvexo_connect"
    admin_token: str = "change_me_admin_token"
    bot_internal_token: str = "change_me_bot_token"
    upstream_ssl_verify: bool = False
    request_timeout: int = 15
    cors_origins: str = "https://connect.arvexo.ru,http://localhost:3000,http://localhost:3002"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()

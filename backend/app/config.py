from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "arvexo-connect-core"
    app_env: str = "development"
    public_base_url: str = "http://localhost:8012"
    public_sub_base_url: str = "http://localhost:8012"
    public_api_base_url: str = "http://localhost:8012"
    public_frontend_base_url: str = "http://localhost:3002"
    database_url: str = "postgresql+asyncpg://arvexo:arvexo_password@postgres:5432/arvexo_connect"
    admin_token: str = "change_me_admin_token"
    bot_internal_token: str = "change_me_bot_token"
    upstream_ssl_verify: bool = False
    request_timeout: int = 15
    cors_origins: str = "https://connect.arvexo.ru,http://localhost:3000,http://localhost:3002"
    xui_base_url: str = "https://monitor.vpn.arvexo.ru:32145/Lb9BYg8zvNRCZMPeon"
    xui_api_token: str = "change_me_xui_api_token"
    xui_sub_base_url: str = "https://monitor.vpn.arvexo.ru:2096"
    xui_sub_path: str = "/arvexo/"
    xui_ssl_verify: bool = False
    xui_request_timeout: int = 15
    xui_default_inbound_ids: str = "1,2,3,4,6"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def xui_default_inbound_id_list(self) -> list[int]:
        return [int(item.strip()) for item in self.xui_default_inbound_ids.split(",") if item.strip()]


settings = Settings()

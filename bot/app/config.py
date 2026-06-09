from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    telegram_bot_token: str = "change_me_telegram_bot_token"
    backend_api_base_url: str = "http://backend:8000"
    bot_internal_token: str = "change_me_bot_token"
    support_url: str = "https://t.me/arvexo_support"
    admin_telegram_ids: str = ""
    payment_notify_interval_seconds: int = 20

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def admin_telegram_id_list(self) -> list[int]:
        return [int(item.strip()) for item in self.admin_telegram_ids.split(",") if item.strip()]


settings = Settings()

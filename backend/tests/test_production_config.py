import pytest

from app.config import Settings


def test_production_config_rejects_default_secrets():
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            jwt_secret="change_me_jwt_secret",
            admin_token="change_me_admin_token",
            bot_internal_token="change_me_bot_token",
        )


def test_production_config_accepts_non_default_secrets():
    settings = Settings(
        app_env="production",
        jwt_secret="jwt_secret_for_test",
        admin_token="admin_secret_for_test",
        bot_internal_token="bot_secret_for_test",
    )

    assert settings.app_env == "production"

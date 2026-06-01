import secrets


def generate_public_token() -> str:
    return f"ARVX-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

# Renders as JSONB on PostgreSQL, falls back to JSON on SQLite (used in tests)
PgJSON = JSON().with_variant(JSONB(), "postgresql")

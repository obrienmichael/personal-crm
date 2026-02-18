#!/bin/bash
# Initialize the personal_crm database with schema
# Usage: export DB_LOCAL_PASSWORD=yourpassword && ./scripts/init-db.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/../schema.sql"

if [ -z "$DB_LOCAL_PASSWORD" ]; then
    echo "Error: DB_LOCAL_PASSWORD is not set."
    echo ""
    echo "Run with:"
    echo "  export DB_LOCAL_PASSWORD=yourpassword"
    echo "  ./scripts/init-db.sh"
    echo ""
    echo "If you forgot your postgres password, open pgAdmin (installed with PostgreSQL)"
    echo "or reset it via: sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'newpassword';\""
    exit 1
fi

echo "Applying schema to personal_crm database..."
PGPASSWORD=$DB_LOCAL_PASSWORD psql -h localhost -U postgres -d personal_crm -f "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "Database schema initialized successfully"
    echo ""
    echo "Verify tables with:"
    echo "  PGPASSWORD=\$DB_LOCAL_PASSWORD psql -h localhost -U postgres -d personal_crm -c \"\\dt\""
else
    echo ""
    echo "Failed to initialize database"
    echo ""
    echo "Common causes:"
    echo "  - Wrong password (DB_LOCAL_PASSWORD is incorrect)"
    echo "  - PostgreSQL not running (start it from the PostgreSQL app in your Applications folder)"
    echo "  - Database 'personal_crm' does not exist"
    exit 1
fi

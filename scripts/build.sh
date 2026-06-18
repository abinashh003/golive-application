#!/bin/bash
# Builds and starts the full stack locally with Docker Compose.
set -e

echo "Building and starting containers..."
docker compose up --build -d

echo ""
echo "Done. Services:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:5000"
echo "  Postgres:  localhost:5432"
echo ""
echo "Tail logs with: docker compose logs -f"

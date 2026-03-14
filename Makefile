.PHONY: dev api dashboard build test typecheck migrate

# Run both API and dashboard
dev:
	@make -j2 api dashboard

# API server on port 3200
api:
	bun run dev:api

# Dashboard on port 3201
dashboard:
	bun run dev:dashboard

# Build
build:
	bun run build

# Build CLI binary
build-cli:
	bun run build:cli

# Run tests
test:
	DATABASE_PATH=./data/test.db bun test

# Type check
typecheck:
	bun run typecheck

# Run database migrations
migrate:
	bun run db:migrate

# Install dependencies
install:
	bun install

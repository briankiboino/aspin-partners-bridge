.PHONY: install build test test-cov clean lint format

# Install dependencies
install:
	pnpm install

# Build the project
build:
	pnpm run build

# Run linting
lint:
	pnpm run lint

# Format code
format:
	pnpm run format

# Run unit tests
test:
	pnpm run test

# Run tests with coverage report
test-cov:
	pnpm run test:cov

# Clean up build artifacts and coverage
clean:
	rm -rf dist coverage

# Docker executions
# Build container images
docker-build:
	docker compose up -d

# Rebuild container images (one need basis like after code changes)
docker-rebuild:
	docker compose up -d --build app

# Tear down containers
docker-tear-down:
	docker compose down

# Show logs for the app container
docker-show-logs:
	docker compose logs app | tail -n 100

# Show active containers
docker-active-containers:
	docker compose ps

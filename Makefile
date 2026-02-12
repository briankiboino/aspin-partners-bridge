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

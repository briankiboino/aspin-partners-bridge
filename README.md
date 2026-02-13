# Aspin Partners Bridge

## Project Overview

The **Aspin Partners Bridge** is a robust payment processing middleware designed to facilitate financial transactions between Aspin and its partners (e.g., Insurance companies like APA, Britam).

Key features include:
- **Unified Payment Interface**: Single API for initiating payments across different partners and channels.
- **Multi-Channel Support**: Seamless integration with Mpesa and Airtel Money.
- **Asynchronous Processing**: Reliable event-driven architecture using RabbitMQ for notifications and BullMQ for delayed tasks (e.g., proactive status checks).
- **Observability**: Comprehensive monitoring via Prometheus metrics and real-time error tracking with Sentry.
- **Security**: Request validation, webhook signature verification (HMAC-SHA256), and secure secret management.

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL (via TypeORM)
- **Message Broker**: RabbitMQ (for event sourcing)
- **Job Queue**: Redis & BullMQ (for delayed status checks and retries)
- **Monitoring**: Prometheus (Metrics), Sentry (Error Tracking & Profiling)
- **Infrastructure**: Docker & Docker Compose
- **Testing**: Jest (Unit & Integration)
- **Package Manager**: pnpm

## Key Design Decisions

### 1. Clean Architecture (Uncle Bob)
The application adheres to the principles of Clean Architecture to ensure independence of frameworks, testability, and separation of concerns:
- **Domain (Entities)**: Contains the core business objects (Entities) and enterprise-wide rules. This layer has no external dependencies.
- **Application (Use Cases)**: Encapsulates application-specific business rules. It orchestrates the flow of data to and from the entities and defines interfaces for infrastructure.
- **Infrastructure (Frameworks & Drivers)**: Implements the interfaces defined by the Application layer. This includes Databases (TypeORM), External Adapters (PaymentHub, Aspin), and Queues (RabbitMQ/BullMQ).
- **Presentation (Interface Adapters)**: Handles the delivery mechanism (HTTP Controllers), converting data from the external form to the internal use case format.

### 1.1 Layer Communication & Dependency Inversion
Communication between layers is achieved through **Interfaces** defined in the inner layers (Application/Domain) and implemented by outer layers (Infrastructure). This strictly follows the **Dependency Rule**: source code dependencies can only point inwards.

- **Separation of Concerns**:
  - The `PaymentsUseCase` (Application) needs to save data but doesn't know *how*. It defines a `PaymentRepository` interface.
  - The `PaymentRepositoryImpl` (Infrastructure) implements this interface using TypeORM and Postgres.
  - This decouples the business logic from the database technology.

- **Testability**:
  - Because the Use Case depends on an interface, we can easily inject a Mock or Stub implementation during unit testing.
  - We test `PaymentsUseCase` without spinning up a real database, making tests fast and reliable.

- **Example Flow**:
  1. **Controller** (Presentation) calls `PaymentsUseCase`.
  2. **UseCase** (Application) calls `IPaymentExecutor`.
  3. **Executor** (Infrastructure) calls `PaymentHubAdapter`.
  4. All dependencies are injected via NestJS Dependency Injection container.

### 2. Strategy Pattern for Payment Execution
To handle the combinatorial complexity of Partners (APA, Britam) and Channels (Mpesa, Airtel), the system uses the Strategy Pattern.
- `IPaymentExecutor`: Defines the contract for payment operations.
- `BasePaymentExecutor`: Abstract class implementing common logic (webhooks, notifications).
- **Concrete Executors** (e.g., `ApaMpesaExecutor`, `BritamAirtelExecutor`): Handle partner-specific business rules.
- `PaymentExecutorBuilder`: Factory to instantiate the correct executor based on the request context.

### 3. Stateless Channel Gateways
Channel implementations (`BaseMpesaChannel`, `BaseAirtelChannel`) are designed to be stateless. They accept configuration (credentials, secrets) at runtime, allowing the system to support multiple partners with different credentials using the same underlying channel logic.

### 4. Robust Status Synchronization
- **Webhooks**: Handles real-time notifications from the Payment Hub.
- **Proactive Polling**: Automatically schedules a delayed job (via BullMQ) to check payment status if a final state isn't received immediately, ensuring data consistency.

### 5. Monitoring & Observability
- **Metrics (Prometheus)**: The system exposes key business and performance metrics (e.g., `payments_success_rate`, `payment_processing_duration`, `api_error_rate`) at `/metrics`.
- **Error Tracking (Sentry)**: Integrated Sentry SDK captures unhandled exceptions and performance profiles, providing deep visibility into runtime issues.
- **Instrumentation**: Custom instrumentation is applied to the payment execution flow to track latencies and success rates across different partners and channels.

## Installation

This project uses `pnpm` as the package manager.

```bash
# Install dependencies
pnpm install

# Alternatively, if you don't have pnpm
npm install
```

## Configuration

The application relies on environment variables for configuration. 

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the `.env` file** with your specific configuration details (database credentials, API keys, etc.).

### Required Environment Variables

| Variable | Description | Default (Local) |
|----------|-------------|-----------------|
| `PORT` | Application Port | 3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `DB_HOST` | Database Host | localhost |
| `DB_PORT` | Database Port | 5432 |
| `DB_USERNAME` | Database User | postgres |
| `DB_PASSWORD` | Database Password | postgres |
| `DB_NAME` | Database Name | payments_db |
| `REDIS_HOST` | Redis Host | localhost |
| `REDIS_PORT` | Redis Port | 6379 |
| `RABBITMQ_URL` | RabbitMQ Connection URL | amqp://localhost:5672 |
| `PAYMENTHUB_API_BASE_URL` | PaymentHub API Base URL | - |
| `PAYMENTHUB_API_KEY` | PaymentHub API Key | - |
| `ASPIN_API_BASE_URL` | Aspin API Base URL | - |
| `ASPIN_API_KEY` | Aspin API Key | - |
| `ASPIN_ADAPTER_SIGNATURE_SECRET` | Secret for verifying webhook signatures | - |
| `SENTRY_DSN` | Sentry DSN for error tracking | - |

## Running the Project Locally

### Prerequisites
- Node.js (v20.13.1 recommended)
- Docker & Docker Compose

### 1. Start Infrastructure Services
Run the following command to spin up PostgreSQL, Redis, and RabbitMQ:

```bash
docker-compose up -d
```

### 2. Run the Application
You can run the application in development mode:

```bash
# Development mode (watch)
pnpm run start:dev

# OR with npm
npm run start:dev
```

The server will start on `http://localhost:3000` (or the configured PORT).

## Running Tests

The project includes a comprehensive suite of unit tests.

```bash
# Run unit tests
pnpm test

# Run tests with coverage report
pnpm run test:cov

# Run specific test file
pnpm test src/path/to/test.spec.ts
```

### Test Coverage
Coverage is strictly configured to report on the `src` directory, ensuring `dist` and other artifacts are excluded.

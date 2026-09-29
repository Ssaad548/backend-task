# Multi-Tenant Lead Management SaaS - Leadflow Workspace

## Project Overview

This repository contains a full-stack lead management platform with a NestJS backend, a Vite + React frontend, PostgreSQL as the source of truth, and Redis for queueing and cache support. The current implementation establishes the project foundation and the multi-tenant database layer, which is the critical base for production-grade lead workflows.

The project is designed around a multi-tenant SaaS model where each tenant owns its own users, leads, and activity history. The schema prevents cross-tenant assignment by design and keeps tenant membership and authorization logic explicit at the database and service layers.

The current milestone includes:

- NestJS backend scaffold and modular app structure
- Prisma-based PostgreSQL schema with tenant-aware models
- Dockerized local Postgres and Redis services
- Seeded demo data for two tenants and representative leads
- Frontend shell for lead dashboard workflows
- Validation through backend tests, e2e tests, and frontend production build

## Architecture Overview

The solution is structured as a traditional SaaS architecture with separate UI, API, data, and background job layers:

- Frontend: React application for lead viewing, creation, filtering, and assignment
- Backend API: NestJS service layer exposing lead endpoints and business logic
- Database: PostgreSQL with Prisma ORM and tenant-aware primary/foreign key relationships
- Queue and cache: Redis for BullMQ jobs, background processing, and transient state
- Infrastructure: Docker Compose for local developer environments and a planned AWS deployment layered around ALB, RDS, ElastiCache, and CloudFront

This gives the platform a clean separation of concerns while keeping the trust boundary around tenant data strong.

## Architecture Diagram

```mermaid
flowchart LR
    U[User / Agent / Owner] --> F[React Frontend]
    F --> B[NestJS API]
    B --> P[(PostgreSQL / Prisma)]
    B --> R[(Redis / BullMQ)]
    R --> W[Background Workers]

    subgraph LocalDev
        F
        B
        P
        R
    end

    subgraph AWSProd
        ALB[Application Load Balancer]
        EC2[ECS / Fargate Services]
        RDS[(RDS PostgreSQL)]
        REDIS[(ElastiCache Redis)]
        CDN[CloudFront / S3 Assets]
    end

    ALB --> EC2
    EC2 --> RDS
    EC2 --> REDIS
    CDN --> F
```

## Tech Stack

- Node.js 20+
- NestJS 12
- TypeScript
- Prisma ORM
- PostgreSQL 16
- Redis 7
- React 18 + Vite
- Docker + Docker Compose
- Jest + Supertest
- BullMQ (planned next phase)
- Socket.IO with Redis adapter

## Local Setup Instructions

### Prerequisites

- Node.js 20 or newer
- npm
- Docker Desktop or Docker Engine
- Git

### 1. Clone and install dependencies

```bash
cd backend-task
cp .env.example .env

cd backend
npm install

cd ../frontend
npm install
```

### 2. Start local infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Run database migrations

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Seed demo data

```bash
cd backend
npx prisma db seed
```

### 5. Start the app

```bash
cd backend
npm run start:dev

# In a second terminal
cd frontend
npm run dev
```

The backend listens on the default NestJS port, usually http://localhost:3000 and the frontend runs on http://localhost:5173 unless you change the env values.

## Docker Commands

```bash
# Start all local services
Docker compose up -d

# Start only the DB and Redis
Docker compose up -d postgres redis

# View status
Docker compose ps

# Tail logs
Docker compose logs -f postgres
Docker compose logs -f redis

# Stop containers
Docker compose down

# Stop and remove persisted data
Docker compose down -v
```

## Environment Variables

Copy the project template before running locally:

```bash
cp .env.example .env
```

Example values:

```env
POSTGRES_USER=leads
POSTGRES_PASSWORD=leads_password
POSTGRES_DB=leads_db
POSTGRES_PORT=5432

REDIS_PORT=6379

DATABASE_URL=postgresql://leads:leads_password@localhost:5432/leads_db?schema=public
REDIS_URL=redis://localhost:6379

PORT=3000
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=1d
FRONTEND_ORIGIN=http://localhost:5173

FOLLOW_UP_DELAY_MS=120000

VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

Notes:

- The local app uses localhost for DB and Redis from the developer machine.
- Docker Compose uses the same credentials but resolves the hostnames internally as postgres and redis when running inside containers.
- Never commit a real production secret into source control.

## Database Migration Commands

```bash
cd backend
npx prisma migrate dev --name init
npx prisma migrate dev --name add_follow_up_rules
npx prisma migrate deploy
npx prisma migrate reset
```

Common workflow:

1. Update schema.prisma
2. Run `npx prisma migrate dev --name <change_name>`
3. Validate the DB
4. Commit both Prisma schema and migration files together

## Seed Commands

```bash
cd backend
npx prisma db seed
```

The current seed script creates demo data for two tenants, one owner and one agent per tenant, and several representative leads with statuses like NEW, CONTACTED, QUALIFIED, WON, LOST, and FOLLOW_UP_REQUIRED.

## Test Commands

```bash
cd backend
npm test -- --runInBand
npm run test:e2e -- --runInBand

cd ../frontend
npm run build
```

Current validation status:

- Backend unit tests: passing
- E2E tests: passing
- Frontend production build: passing

## API Documentation Instructions

Swagger is enabled in the backend and exposes the generated API contract at:

```text
http://localhost:3000/docs
```

Manual endpoint examples:

```bash
# List tenant-scoped leads
curl http://localhost:3000/leads \
  -H "Authorization: Bearer <access_token>"

# Create lead
curl -X POST http://localhost:3000/leads \
  -H "Authorization: Bearer <owner_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "source": "Website"
  }'
```

## Authentication Flow

The authentication flow is designed as a standard tenant-aware JWT flow:

1. User submits credentials to the auth endpoint.
2. Backend verifies the password using the stored hash.
3. Backend generates a JWT containing at least:
   - user id
   - tenant id
   - role
   - expiration
4. Frontend stores the JWT in local storage or a secure cookie.
5. Every protected request sends the Bearer token.
6. Authentication middleware resolves the user, tenant, and permissions from the token.
7. Downstream service calls apply tenant scoping before querying or modifying data.

This pattern avoids trusting the client to send a tenant id directly. The tenant is always derived from the authenticated principal.

## Tenant-Isolation Strategy

The tenant model is a core design pillar. The Prisma schema implements it in several ways:

- Each entity belongs to a tenant via `tenant_id`
- Every user is assigned to exactly one tenant
- Every lead belongs to the tenant that created or owns it
- Composite foreign keys enforce that a lead can only be assigned to a user in the same tenant
- Activities are bound to both the lead and the tenant
- Queries should always include a tenant filter, never a global query without scope

Example enforcement pattern:

```ts
prisma.lead.findMany({
  where: {
    tenantId: currentUser.tenantId,
  },
});
```

This materially reduces the chance of accidental cross-tenant data leakage due to application bugs.

## Authorization Strategy

The project uses role-based access control combined with tenant-level scoping:

- OWNER: can manage ownership, assignments, users, and tenant-level settings
- AGENT: can work within the tenant and manage leads assigned to them or visible to their role
- All requests are validated for both authentication and tenant access
- Service methods must verify the current user belongs to the tenant being modified

Recommended policy layer:

- `AuthGuard` verifies JWT
- `TenantGuard` verifies tenant context
- `RolesGuard` enforces role access
- `PermissionService` answers whether a user can view, edit, assign, or close a lead

## Socket.io Security Approach

Socket.IO is implemented for tenant-scoped lead updates, assignment alerts, and live dashboard activity. The security approach is:

- Use JWT authentication during the socket handshake
- Validate Origin and allowlist trusted domains only
- Bind each socket to the authenticated tenant and user id
- Use server-managed rooms: `tenant:<tenantId>:user:<userId>` and `tenant:<tenantId>:owners`
- Never broadcast cross-tenant events to all clients
- Do not expose client-driven room join events or accept a tenant ID from the client
- Rate-limit connection storms and noisy events
- Log connection events and enforce disconnect cleanup

Security note:

```ts
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  // verify JWT and attach user + tenant data
  next();
});
```

`EventsService.emitLeadEvent` emits only to the tenant owners room, the current assigned agent room, and the previous assigned agent room when a lead is reassigned. It never uses `io.emit`. The Socket.IO Redis adapter propagates those room-targeted events across API instances.

## BullMQ Job Design

BullMQ is the recommended approach for asynchronous tasks such as follow-up reminders, lead assignment automation, and status transitions.

Suggested job queues:

- `lead-follow-up`
- `lead-assignment`
- `lead-status-sync`
- `tenant-reporting`

Example job lifecycle:

1. A lead enters a stage or requires follow-up.
2. Service creates a BullMQ job with lead id, tenant id, and actor context.
3. Worker consumes the job and updates the relevant lead state or emits notifications.
4. Job retries are configured with exponential backoff for transient errors.
5. Failed jobs are logged with tenant and lead metadata for auditability.

The key design principle is that external or time-based work should be asynchronous so the API remains fast and predictable.

## Redis Usage

Redis is used for:

- BullMQ queue state and delayed jobs
- short-lived caching for lookup data
- pub/sub signaling for real-time app events
- rate limiting and transient request throttling
- job deduplication and workflow scheduling

Redis should never be considered the primary transactional data store; Postgres remains the system of record.

## AWS Deployment Design

A production deployment should be built around a stateless API tier and a managed data layer.

Recommended design:

- API and worker services deployed on ECS Fargate or EKS
- Application Load Balancer for routing and TLS termination
- RDS PostgreSQL for transactional persistence
- ElastiCache Redis for BullMQ and caching
- CloudFront + S3 for static frontend assets
- Secrets Manager for JWT secret, DB credentials, and service credentials
- Route 53 or a custom domain for public routing
- CloudWatch or equivalent monitoring and log aggregation

This deployment model keeps the application horizontally scalable while preserving clean tenant-level boundaries.

## Debugging Scenario Answer

A common debugging scenario in a multi-tenant app is: ?A lead is visible in the wrong tenant or an agent can see another tenant?s records.?

The correct debugging sequence is:

1. Check the authenticated user token and confirm the resolved `tenantId`
2. Query the database directly to inspect the lead row and confirm the `tenant_id`
3. Check the assigned user row and verify `assigned_to` points to a user in the same tenant
4. Review application logs for a missing tenant filter in a Prisma query
5. Inspect any background worker or socket update event to ensure it is scoped to the same tenant
6. Verify the data is not being created from a global cache or stale state

Example sanity checks:

```sql
SELECT id, tenant_id, assigned_to, status FROM leads WHERE id = '...';
SELECT id, tenant_id, email, role FROM users WHERE id = '...';
```

If a mismatch appears, the fix is usually to correct the tenant filter, the JWT mapping, or the composite FK relation rather than patching the database after the fact.

## Known Limitations

- Authentication, tenant-scoped lead authorization, guarded mutations, pagination, lifecycle transitions, and activity queries are implemented. More advanced policy rules can be added as the product grows.
- The role decorator and guard provide coarse checks; detailed lead ownership rules intentionally live in `LeadsService` and `ActivityService`.
- BullMQ follow-up workers are not yet wired into the application runtime.
- Tenant activity history is implemented, but tenant-specific admin screens are not yet complete.
- The seed data is intentionally demo-oriented and not production-grade.
- The frontend is a shell and should be expanded with tenant-aware UX and real-time updates.

## Trade-offs and Future Improvements

### Current trade-offs

- Database-level tenant isolation is prioritized over convenience at the expense of some initial complexity.
- Prisma schema contracts are explicit and typed, which is a strong stability choice but requires migrations and discipline.
- The app intentionally avoids overbuilding before the multi-tenant model is stable.

### Future improvements

- Add richer role policies and tenant administration workflows
- Add Swagger/OpenAPI documentation
- Add BullMQ workers for follow-ups and reminders
- Add activity timeline views
- Add support for pagination, filtering, and search at scale
- Add observability with tracing, logs, and alerting
- Add infrastructure-as-code for AWS deployment

## Current Status Summary

The project has reached a strong foundational milestone:

- app scaffold and monorepo setup are valid
- Prisma schema and migration foundation are in place
- PostgreSQL and Redis are prepared for local development
- multi-tenant constraints are present in the data model
- demo data is seeded and reproducible
- tenant-aware JWT login, `/auth/me`, request context, role decorator, and roles guard are implemented
- global request validation and Swagger generation at `/docs` are configured
- tenant-scoped lead repository and authorized lead lifecycle endpoints are implemented
- owner-only activity endpoint with pagination and tenant filtering is implemented
- JWT-authenticated Socket.IO connections, server-managed tenant rooms, and Redis adapter support are implemented
- backend and frontend validation checks are green

Phase 5 is complete. The next phase is to connect the follow-up scheduler hook to BullMQ workers.

## License

This project is for local development and internal evaluation purposes unless otherwise noted.

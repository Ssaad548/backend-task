# Multi-Tenant Lead Management SaaS - Leadflow Workspace

## Project Overview

This repository contains a full-stack, multi-tenant lead management platform with a NestJS API, React frontend, PostgreSQL system of record, Redis-backed queues, and a standalone follow-up worker.

The project is designed around a multi-tenant SaaS model where each tenant owns its own users, leads, and activity history. The schema prevents cross-tenant assignment by design and keeps tenant membership and authorization logic explicit at the database and service layers.

The current milestone includes:

- NestJS backend scaffold and modular app structure
- Prisma-based PostgreSQL schema with tenant-aware models
- Dockerized API, worker, frontend, Postgres, and Redis services
- Seeded demo data for two tenants and representative leads
- Frontend shell for lead dashboard workflows
- Validation through backend tests, e2e tests, and frontend production build

## Demo Credentials

| Tenant | Role | Email | Password |
| --- | --- | --- | --- |
| A | OWNER | `owner-a@example.com` | `Password123!` |
| A | AGENT | `agent-a@example.com` | `Password123!` |
| B | OWNER | `owner-b@example.com` | `Password123!` |
| B | AGENT | `agent-b@example.com` | `Password123!` |

## Architecture Overview

The solution is structured as a traditional SaaS architecture with separate UI, API, data, and background job layers:

- Frontend: React application for lead viewing, creation, filtering, and assignment
- Backend API: NestJS service layer exposing lead endpoints and business logic
- Database: PostgreSQL with Prisma ORM and tenant-aware primary/foreign key relationships
- Queue and cache: Redis for BullMQ jobs, background processing, and transient state
- Infrastructure: Docker Compose locally; AWS deployment guidance for ALB, ECS/Fargate, RDS, ElastiCache, and CloudFront

This gives the platform a clean separation of concerns while keeping the trust boundary around tenant data strong.

## Architecture Diagram

See [docs/architecture.md](docs/architecture.md) for the Mermaid diagrams covering local Docker Compose and the proposed AWS deployment.

## Tech Stack

- Node.js 20+
- NestJS 12
- TypeScript
- Prisma ORM
- PostgreSQL 16
- Redis 7
- React 19 + Vite
- Docker + Docker Compose
- Jest + Supertest
- BullMQ follow-up queue and standalone worker
- Socket.IO with Redis adapter

## Docker Quick Start

From the repository root:

```bash
docker compose up --build
```

Open `http://localhost:5173`. The API is available at `http://localhost:3000` and Swagger at `http://localhost:3000/docs`. The API container runs `prisma migrate deploy` and the idempotent seed before starting NestJS. The worker starts after the API health check passes.

Use `docker compose down -v` to remove the database and Redis volumes.

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

# In a third terminal
cd backend
npm run start:worker
```

The backend listens on the default NestJS port, usually http://localhost:3000 and the frontend runs on http://localhost:5173 unless you change the env values.

## Docker Commands

```bash
# Start all services and rebuild images
docker compose up --build -d

# Start only the DB and Redis
docker compose up -d postgres redis

# View status
docker compose ps

# Tail logs
docker compose logs -f api
docker compose logs -f worker

# Stop containers
docker compose down

# Stop and remove persisted data
docker compose down -v
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
npm run lint -- --quiet
npm run build

cd ../frontend
npm run build
```

Current validation status:

- Backend unit tests: 8 passed
- Backend e2e tests: 12 passed
- Backend lint and build: passed
- Frontend production build: run separately as needed

Automated test coverage includes:

- Tenant isolation for lead listing, lookup, assignment, and agent updates
- Agent visibility limited to assigned leads
- Follow-up protection for CONTACTED, LOST, and WON leads
- Redis-backed duplicate follow-up job prevention
- Socket.IO event isolation across two tenants and four authenticated clients

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

The authentication flow is a tenant-aware JWT flow:

1. User submits credentials to the auth endpoint.
2. Backend verifies the password using the stored hash.
3. Backend generates a JWT containing at least:
   - user id
   - tenant id
   - role
   - expiration
4. Frontend stores the JWT in `sessionStorage`.
5. Every protected request sends the Bearer token.
6. `JwtAuthGuard` verifies the token and resolves the user, tenant, and role.
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

- OWNER: can create, assign, update, and view tenant leads
- AGENT: can view and update leads assigned to them
- All requests are validated for both authentication and tenant access
- Service methods must verify the current user belongs to the tenant being modified

Implemented guards:

- `JwtAuthGuard` verifies JWT claims
- `RolesGuard` enforces role access
- `LeadsService` enforces lead ownership and tenant scope

## Socket.io Security Approach

Socket.IO is implemented for tenant-scoped lead updates, assignment alerts, and live dashboard activity. The security approach is:

- Use JWT authentication during the socket handshake
- CORS is currently broad for local integration; restrict it to trusted origins in production
- Bind each socket to the authenticated tenant and user id
- Use server-managed rooms: `tenant:<tenantId>:user:<userId>` and `tenant:<tenantId>:owners`
- Never broadcast cross-tenant events to all clients
- Do not expose client-driven room join events or accept a tenant ID from the client
- Log disconnects and clean up Redis clients during application shutdown

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

BullMQ is implemented for delayed follow-up reminders. Lead creation schedules a deterministic job containing `{ leadId, tenantId }` with a two-minute delay, three attempts, and exponential backoff.

The implemented queue is:

- `lead-follow-up`

Example job lifecycle:

1. An owner creates a lead and the API commits the lead and activity transaction.
2. The API schedules a BullMQ job with lead id and tenant id.
3. The standalone worker re-fetches the lead and conditionally updates it only while its status is `NEW`.
4. The worker writes a system activity row and emits `lead.follow_up_required` only when the update count is exactly one.
5. Job retries use exponential backoff for transient errors.

The key design principle is that external or time-based work should be asynchronous so the API remains fast and predictable.

## Redis Usage

Redis is used for:

- BullMQ queue state and delayed jobs
- Socket.IO adapter pub/sub signaling for real-time app events
- worker-to-API event publishing through `@socket.io/redis-emitter`
- job deduplication and workflow scheduling

Redis should never be considered the primary transactional data store; Postgres remains the system of record.

Authentication reads remain authoritative in PostgreSQL. No login rate limiter or user cache is currently enabled.

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

A common debugging scenario is: "Users from one company see another company's lead in real time, but it disappears after refresh."

### Possible Causes

- A global Socket.IO broadcast such as `io.emit`.
- Incorrect tenant room naming or a room name that omits the tenant id.
- Client-controlled room joining without server-side verification.
- A tenant id trusted from the frontend instead of the verified JWT claim.
- A shared event listener updating every browser's lead state without filtering.
- A missing Socket.IO Redis adapter when multiple API instances are running.
- Stale user or tenant data retained across reconnects or account switches.
- A race between logout, token replacement, and socket reconnection.

### Debugging Plan

1. Decode the active JWT and verify `sub`, `tenantId`, `role`, and expiry.
2. Log and compare socket id, user id, tenant id, room names, event name, and lead id.
3. Confirm the database lead and assignee have the expected `tenant_id`.
4. Inspect `EventsService` targets and verify there is no global broadcast.
5. Confirm the gateway derives rooms from authenticated socket data, not client input.
6. Compare REST results with the socket payload and inspect frontend event filtering.
7. Reproduce with two tenants, multiple browser sessions, reconnects, and multiple API instances.
8. Verify the Redis adapter is connected and integration tests cover room membership.

### Fixes

- Authenticate sockets with JWT middleware and derive tenant identity only from verified claims.
- Join only server-managed rooms such as `tenant:<tenantId>:owners` and `tenant:<tenantId>:user:<userId>`.
- Emit only to the tenant owner, current assignee, and previous assignee rooms; never use `io.emit`.
- Filter event payloads before updating agent-visible state.
- Configure the Socket.IO Redis adapter for every API instance.
- Clear socket and cached user state on logout, token expiry, and account switching.
- Add regression tests for cross-tenant events, reconnects, stale tokens, and multi-instance delivery.

### Project-Specific Observations

This implementation already authenticates the handshake, creates tenant/user rooms on the server, and emits through targeted rooms in `EventsService`. The Redis adapter is configured for horizontal delivery, and the frontend disconnects its socket during cleanup. The remaining risks are broad local CORS, limited structured socket logging, and the frontend's single lead callback, which currently relies on a subsequent lead reload rather than applying fine-grained event authorization in the client.

Example sanity checks:

```sql
SELECT id, tenant_id, assigned_to, status FROM leads WHERE id = '...';
SELECT id, tenant_id, email, role FROM users WHERE id = '...';
```

If a mismatch appears, the fix is usually to correct the tenant filter, the JWT mapping, or the composite FK relation rather than patching the database after the fact.

## Known Limitations

- Authentication, tenant-scoped lead authorization, guarded mutations, lifecycle transitions, and activity queries are implemented. More advanced policy rules can be added as the product grows.
- The role decorator and guard provide coarse checks; detailed lead ownership rules intentionally live in `LeadsService` and `ActivityService`.
- BullMQ follow-up workers are implemented through `src/worker.ts`; richer job types can be added later.
- Tenant activity history is implemented, but tenant-specific admin screens are not yet complete.
- The seed data is intentionally demo-oriented and not production-grade.
- Socket CORS and login rate limiting need production hardening.

## Trade-offs and Future Improvements

### Current trade-offs

- Database-level tenant isolation is prioritized over convenience at the expense of some initial complexity.
- Prisma schema contracts are explicit and typed, which is a strong stability choice but requires migrations and discipline.
- The app intentionally avoids overbuilding before the multi-tenant model is stable.

### Future improvements

- Add richer role policies and tenant administration workflows
- Add stricter production CORS and login rate limiting
- Add additional BullMQ job types and operational dashboards
- Add activity timeline views
- Add support for pagination, filtering, and search at scale
- Add observability with tracing, logs, and alerting
- Add infrastructure-as-code for AWS deployment

The current implementation is suitable for local evaluation. Production work should prioritize secrets management, CORS/rate-limit hardening, observability, and infrastructure automation.

## License

This project is for local development and internal evaluation purposes unless otherwise noted.

# Architecture Diagram

Leadflow is split into a React frontend, NestJS API, PostgreSQL database, Redis services, and a standalone BullMQ worker.

## Local Deployment

```mermaid
flowchart LR
    U[User / Agent / Owner] --> F[React Frontend]
    F --> B[NestJS API]
    B --> P[(PostgreSQL / Prisma)]
    B --> R[(Redis / BullMQ)]
    R --> W[Follow-up Worker]
    B --> S[Socket.IO]
    S --> R
```

## AWS Deployment

```mermaid
flowchart LR
    U[Users] --> CDN[CloudFront / S3 Frontend]
    U --> ALB[Application Load Balancer]
    ALB --> API[ECS / Fargate API]
    API --> DB[(RDS PostgreSQL)]
    API --> CACHE[(ElastiCache Redis)]
    WORKER[ECS / Fargate Worker] --> DB
    WORKER --> CACHE
```

PostgreSQL is the system of record. Redis handles BullMQ state and Socket.IO adapter coordination. Tenant and role checks are enforced by the API before database reads or mutations.

# AI Usage

## What I used AI for

- Planning the project structure and implementation phases.
- Reviewing repository structure and `.gitignore` files.
- Drafting and refining Dockerfiles, Compose health checks, and startup commands.
- Reviewing tenant isolation, authentication, Socket.IO, BullMQ, frontend behavior, and documentation.
- Drafting the debugging scenario explanation and self-review prompts.

## Suggestions accepted / rejected

- Accepted focused implementation suggestions only after checking them against the existing code.
- Accepted the multi-stage Docker and health-gated Compose design after building and running it.
- Rejected or corrected stale documentation claims about observability, guards, rate limiting, and production CORS.
- Corrected an initial Docker image issue where the generated Prisma client was overwritten in the runtime stage.

## What I verified myself

- Backend and frontend production builds.
- Docker Compose configuration, image builds, migrations, seed startup, service health, and HTTP responses.
- Idempotent seed behavior by restarting the API container.
- README requirements, the `docs/architecture.md` Mermaid diagrams, and the PDF's debugging causes and fixes.

The backend unit and e2e test counts recorded in `README.md` were not rerun during the documentation pass; they remain reported as repository validation results rather than new tests run for this change.

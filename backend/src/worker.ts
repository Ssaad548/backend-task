import { NestFactory } from '@nestjs/core';
import { FollowUpWorkerModule } from './follow-up/follow-up-worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(FollowUpWorkerModule);
}

void bootstrap().catch((error: unknown) => {
  console.error('Follow-up worker failed to start', error);
  process.exitCode = 1;
});
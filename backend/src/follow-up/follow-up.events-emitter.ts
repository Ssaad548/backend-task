import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Emitter } from '@socket.io/redis-emitter';
import { createClient, type RedisClientType } from 'redis';
import { EventsService } from '../events/events.service';

@Injectable()
export class FollowUpEventsEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = createClient({ url: redisUrl });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    const emitter = new Emitter(this.client);
    this.eventsService.setEmitter(emitter);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
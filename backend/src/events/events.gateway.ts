import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import type { Server, Socket } from 'socket.io';
import type { Role } from '@prisma/client';
import type { RequestContext } from '../auth/auth.types';
import { EventsService } from './events.service';

interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
}

type RedisClient = RedisClientType;

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private pubClient?: RedisClient;
  private subClient?: RedisClient;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
  ) {}

  afterInit(server: Server): void {
    this.server = server;
    this.eventsService.setServer(server);
    server.use((socket, next) => {
      void this.authenticate(socket, next);
    });
    void this.configureRedisAdapter(server);
  }

  handleConnection(socket: Socket): void {
    const context = socket.data.user as RequestContext;
    const userRoom = this.eventsService.userRoom(context.tenantId, context.userId);
    void socket.join(userRoom);

    if (context.role === 'OWNER') {
      void socket.join(this.eventsService.ownerRoom(context.tenantId));
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug(`Socket disconnected: ${socket.id}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.pubClient?.quit(),
      this.subClient?.quit(),
    ]);
  }

  private async authenticate(
    socket: Socket,
    next: (error?: Error) => void,
  ): Promise<void> {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length === 0) {
        throw new Error('Socket authentication token is required');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      if (!payload.sub || !payload.tenantId || !payload.role) {
        throw new Error('Invalid socket token claims');
      }

      socket.data.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
      } satisfies RequestContext;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  }

  private async configureRedisAdapter(server: Server): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      this.pubClient = pubClient;
      this.subClient = subClient;
      this.logger.log('Socket.IO Redis adapter initialized');
    } catch (error) {
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
      this.logger.error('Socket.IO Redis adapter initialization failed', error);
    }
  }
}

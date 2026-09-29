import type { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

type SocketLike = {
  handshake: { auth: { token?: unknown } };
  data: Record<string, unknown>;
};

describe('EventsGateway authentication', () => {
  const createGateway = (verifyAsync: jest.Mock) => {
    const jwtService = { verifyAsync } as unknown as JwtService;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    } as unknown as ConfigService;
    return new EventsGateway(jwtService, configService, new EventsService());
  };

  it('builds request context from the verified handshake token', async () => {
    const verifyAsync = jest.fn().mockResolvedValue({
      sub: 'user-a',
      tenantId: 'tenant-a',
      role: 'AGENT' as Role,
    });
    const gateway = createGateway(verifyAsync);
    const socket: SocketLike = {
      handshake: { auth: { token: 'signed-token' } },
      data: {},
    };
    const next = jest.fn();

    await gateway['authenticate'](socket as never, next);

    expect(verifyAsync).toHaveBeenCalledWith('signed-token', { secret: 'test-secret' });
    expect(socket.data.user).toEqual({ userId: 'user-a', tenantId: 'tenant-a', role: 'AGENT' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects missing or invalid handshake tokens', async () => {
    const verifyAsync = jest.fn().mockRejectedValue(new Error('invalid'));
    const gateway = createGateway(verifyAsync);
    const socket: SocketLike = {
      handshake: { auth: {} },
      data: {},
    };
    const next = jest.fn();

    await gateway['authenticate'](socket as never, next);

    expect(verifyAsync).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized' }));
  });
});

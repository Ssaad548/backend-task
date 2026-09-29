import type { ConfigService } from '@nestjs/config';

export function redisConnection(configService: ConfigService) {
  const redisUrl = configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
  };
}

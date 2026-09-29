import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from './auth.types';
import type { LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') ?? '1d';
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: expiresIn as StringValue,
    });

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    };
  }

  async getMe(context: RequestContext) {
    const user = await this.prisma.user.findFirst({
      where: { id: context.userId, tenantId: context.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        tenantId: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }
}
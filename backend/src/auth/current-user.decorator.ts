import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestContext } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const request = context.switchToHttp().getRequest<{ user: RequestContext }>();
    return request.user;
  },
);
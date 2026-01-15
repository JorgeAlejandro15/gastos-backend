import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUser = {
  userId: string;
  email: string;
  sessionId: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const req = ctx.switchToHttp().getRequest<{
      user?: { userId: string; email: string; sessionId: string };
    }>();
    if (!req.user) {
      // Should never happen if JwtAuthGuard is applied
      return { userId: '', email: '', sessionId: '' };
    }
    return req.user;
  },
);

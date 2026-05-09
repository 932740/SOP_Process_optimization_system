import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!user && request.headers['x-anonymous-id']) {
      request.anonymousId = request.headers['x-anonymous-id'];
    }
    return user || null;
  }
}

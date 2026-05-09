import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class AnonymousUserInterceptor implements NestInterceptor {
  constructor(private authService: AuthService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (!request.user && request.anonymousId) {
      request.user = await this.authService.findOrCreateAnonymousUser(request.anonymousId);
    }
    return next.handle();
  }
}

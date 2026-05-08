import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog } from './entities/operation-log.entity';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(OperationLog)
    private logRepo: Repository<OperationLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const action = `${request.method} ${request.route?.path || request.url}`;

    return next.handle().pipe(
      tap(() => {
        if (user && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
          const log = this.logRepo.create({
            user_id: user.id,
            action,
            target_type: context.getClass().name,
            detail: { body: request.body, params: request.params },
            ip: request.ip,
            user_agent: request.headers['user-agent'],
          });
          this.logRepo.save(log).catch(() => null);
        }
      }),
    );
  }
}

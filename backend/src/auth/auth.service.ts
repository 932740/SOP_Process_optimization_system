import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const hash = this.hashPassword(password);
    if (user.password_hash !== hash) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return { token, user };
  }

  async validateUser(userId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId, status: 1 } });
  }

  async findOrCreateAnonymousUser(anonymousId: string): Promise<User> {
    const username = `anonymous_${anonymousId}`;
    let user = await this.userRepo.findOne({ where: { username } });
    if (!user) {
      user = this.userRepo.create({
        username,
        name: '匿名用户',
        password_hash: '',
        role: UserRole.ANONYMOUS,
        status: 1,
      });
      user = await this.userRepo.save(user);
    }
    return user;
  }
}

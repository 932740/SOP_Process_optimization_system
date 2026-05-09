import { Controller, Get, Post, Put, Body, Query, UseGuards, Request, Param, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User, UserRole } from '../auth/entities/user.entity';
import { DepartmentFormat } from './entities/department-format.entity';
import { OperationLog } from '../log/entities/operation-log.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(DepartmentFormat)
    private deptFormatRepo: Repository<DepartmentFormat>,
    @InjectRepository(OperationLog)
    private logRepo: Repository<OperationLog>,
  ) {}

  @Get('users')
  @Roles(UserRole.SUPER_ADMIN)
  getUsers() {
    return this.userRepo.find({ order: { created_at: 'DESC' } });
  }

  @Post('users')
  @Roles(UserRole.SUPER_ADMIN)
  async createUser(@Body() dto: { username: string; password: string; name: string; department?: string; role?: UserRole }) {
    const existing = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existing) throw new BadRequestException('用户名已存在');

    const password_hash = crypto.createHash('sha256').update(dto.password).digest('hex');
    const user = this.userRepo.create({
      username: dto.username,
      password_hash,
      name: dto.name,
      department: dto.department || 'IT部',
      role: dto.role || UserRole.USER,
      status: 1,
    });
    return this.userRepo.save(user);
  }

  @Put('users/:id/role')
  @Roles(UserRole.SUPER_ADMIN)
  async updateUserRole(@Param('id') id: string, @Body() dto: { role: UserRole }) {
    await this.userRepo.update(+id, { role: dto.role });
    return this.userRepo.findOne({ where: { id: +id } });
  }

  @Get('department-formats')
  @UseGuards(OptionalJwtAuthGuard)
  getDepartmentFormats() {
    return this.deptFormatRepo.find();
  }

  @Put('department-formats/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateDepartmentFormat(@Param('id') id: string, @Body() dto: any) {
    await this.deptFormatRepo.update(+id, dto);
    return this.deptFormatRepo.findOne({ where: { id: +id } });
  }

  @Get('operation-logs')
  @Roles(UserRole.SUPER_ADMIN)
  getOperationLogs(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.logRepo.find({
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}

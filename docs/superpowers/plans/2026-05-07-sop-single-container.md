# SOP 系统单容器一体化改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SOP 系统从多服务 Docker Compose 架构改造为单容器一体化部署，实现零外部依赖、前台全配置、免登录使用。

**Architecture:** 后端 NestJS 改用 SQLite 数据库和本地文件存储，移除 Redis/MinIO/MySQL/Nginx 依赖；前端增加匿名会话和系统配置页面；所有服务打包到单个 Docker 镜像。

**Tech Stack:** NestJS, React, TypeORM (SQLite), Python FastAPI, Docker, Supervisord

---

## 文件结构变更

### 后端修改
- `backend/package.json` — 调整依赖
- `backend/src/app.module.ts` — TypeORM SQLite + ServeStaticModule + SetupModule
- `backend/src/auth/entities/user.entity.ts` — 扩展 UserRole 枚举
- `backend/src/common/redis.service.ts` — 重写为内存缓存/队列
- `backend/src/common/minio.service.ts` — 重写为本地文件系统
- `backend/src/common/common.module.ts` — 调整 providers
- `backend/src/common/guards/optional-jwt.guard.ts` — 支持 X-Anonymous-ID
- `backend/src/auth/auth.service.ts` — 添加匿名用户方法
- `backend/src/export/export.controller.ts` — 支持匿名用户
- `backend/src/ai-model/ai-model.controller.ts` — 开放匿名访问
- `backend/src/admin/admin.controller.ts` — 开放 GET 接口

### 后端新增
- `backend/src/setup/setup.module.ts`
- `backend/src/setup/setup.controller.ts`
- `backend/src/setup/setup.service.ts`

### 前端修改
- `frontend/src/services/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`

### 前端新增
- `frontend/src/pages/SetupWizard.tsx`

### Docker/部署
- `Dockerfile`
- `docker-compose.yml`

---

### Task 1: 调整后端依赖

**Files:**
- Modify: `backend/package.json`

**Context:** 需要添加 SQLite 和静态文件服务依赖，同时移除不再需要的 Redis、MinIO 依赖。

- [ ] **Step 1: 修改 backend/package.json**

  在 `dependencies` 中添加：
  ```json
  "sqlite3": "^5.1.6",
  "@nestjs/serve-static": "^4.0.0"
  ```

  从 `dependencies` 中移除：
  ```json
  "ioredis",
  "redis",
  "minio"
  ```

- [ ] **Step 2: 安装新依赖**

  Run:
  ```bash
  cd backend && npm install
  ```
  Expected: `sqlite3` 和 `@nestjs/serve-static` 安装成功，无报错。

- [ ] **Step 3: Commit**

  ```bash
  git add backend/package.json backend/package-lock.json
  git commit -m "deps: add sqlite3 and serve-static, remove redis/minio deps"
  ```

---

### Task 2: 配置 SQLite 数据库与 ServeStaticModule

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/auth/entities/user.entity.ts`

**Context:** 将 TypeORM 从 MySQL 切换到 SQLite，让 NestJS 直接托管前端静态文件，替代 Nginx。

- [ ] **Step 1: 修改 backend/src/app.module.ts**

  替换为以下内容：
  ```typescript
  import { Module } from '@nestjs/common';
  import { ConfigModule } from '@nestjs/config';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { ServeStaticModule } from '@nestjs/serve-static';
  import { join } from 'path';
  import { AuthModule } from './auth/auth.module';
  import { OperationLog } from './log/entities/operation-log.entity';
  import { SopModule } from './sop/sop.module';
  import { AiModelModule } from './ai-model/ai-model.module';
  import { ExportModule } from './export/export.module';
  import { AdminModule } from './admin/admin.module';
  import { LogModule } from './log/log.module';
  import { CommonModule } from './common/common.module';
  import { SetupModule } from './setup/setup.module';

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: '/app/data/sop.db',
        autoLoadEntities: true,
        synchronize: true,
      }),
      TypeOrmModule.forFeature([OperationLog]),
      ServeStaticModule.forRoot({
        rootPath: join(__dirname, '..', 'frontend', 'dist'),
        exclude: ['/api*'],
      }),
      CommonModule,
      AuthModule,
      SopModule,
      AiModelModule,
      ExportModule,
      AdminModule,
      LogModule,
      SetupModule,
    ],
  })
  export class AppModule {}
  ```

- [ ] **Step 2: 扩展 UserRole 枚举**

  修改 `backend/src/auth/entities/user.entity.ts`，将枚举扩展为：
  ```typescript
  export enum UserRole {
    SUPER_ADMIN = 'super_admin',
    USER = 'user',
    ANONYMOUS = 'anonymous',
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/app.module.ts backend/src/auth/entities/user.entity.ts
  git commit -m "feat: switch to sqlite and serve-static, add anonymous role"
  ```

---

### Task 3: 内存缓存替换 Redis

**Files:**
- Modify: `backend/src/common/redis.service.ts`

**Context:** ExportService 使用 `pushQueue` 将导出任务入队。当前没有独立的消费者调用 `popQueue`，但为了保持接口兼容性，用内存 Map 模拟队列。

- [ ] **Step 1: 重写 RedisService 为内存实现**

  替换 `backend/src/common/redis.service.ts` 为：
  ```typescript
  import { Injectable } from '@nestjs/common';

  @Injectable()
  export class RedisService {
    private cache = new Map<string, { value: any; expires: number }>();
    private queues = new Map<string, any[]>();

    private cleanup() {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (item.expires > 0 && item.expires < now) {
          this.cache.delete(key);
        }
      }
    }

    async get(key: string): Promise<any | null> {
      this.cleanup();
      const item = this.cache.get(key);
      if (!item) return null;
      if (item.expires > 0 && item.expires < Date.now()) {
        this.cache.delete(key);
        return null;
      }
      return item.value;
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
      const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
      this.cache.set(key, { value, expires });
    }

    async del(key: string): Promise<void> {
      this.cache.delete(key);
    }

    async pushQueue(queueName: string, data: any): Promise<void> {
      if (!this.queues.has(queueName)) {
        this.queues.set(queueName, []);
      }
      this.queues.get(queueName)!.push(data);
    }

    async popQueue(queueName: string): Promise<any | null> {
      const queue = this.queues.get(queueName);
      if (!queue || queue.length === 0) {
        return null;
      }
      return queue.shift();
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/src/common/redis.service.ts
  git commit -m "feat: replace redis with in-memory cache and queue"
  ```

---

### Task 4: 本地文件存储替换 MinIO

**Files:**
- Modify: `backend/src/common/minio.service.ts`

**Context:** 将文件存储从 MinIO 对象存储改为本地文件系统，文件存放在 `/app/data/uploads/`。

- [ ] **Step 1: 重写 MinioService**

  替换 `backend/src/common/minio.service.ts` 为：
  ```typescript
  import { Injectable } from '@nestjs/common';
  import * as fs from 'fs';
  import * as path from 'path';

  @Injectable()
  export class MinioService {
    private uploadDir = '/app/data/uploads';

    constructor() {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    }

    async putObject(bucket: string, objectName: string, file: Buffer | string): Promise<void> {
      const dir = path.join(this.uploadDir, bucket);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = path.join(dir, objectName);
      if (typeof file === 'string') {
        fs.writeFileSync(filePath, file, 'utf-8');
      } else {
        fs.writeFileSync(filePath, file);
      }
    }

    async getObject(bucket: string, objectName: string): Promise<Buffer> {
      const filePath = path.join(this.uploadDir, bucket, objectName);
      return fs.readFileSync(filePath);
    }

    getPublicUrl(bucket: string, objectName: string): string {
      return `/uploads/${bucket}/${objectName}`;
    }

    async getDownloadUrl(bucket: string, objectName: string): Promise<string> {
      return this.getPublicUrl(bucket, objectName);
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/src/common/minio.service.ts
  git commit -m "feat: replace minio with local filesystem storage"
  ```

---

### Task 5: 匿名会话认证

**Files:**
- Modify: `backend/src/common/guards/optional-jwt.guard.ts`
- Modify: `backend/src/auth/auth.service.ts`

**Context:** 前端未登录用户会携带 `X-Anonymous-ID` header，后端需要据此创建/查找匿名用户并注入到请求中。

- [ ] **Step 1: 修改 OptionalJwtAuthGuard**

  替换 `backend/src/common/guards/optional-jwt.guard.ts` 为：
  ```typescript
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
  ```

- [ ] **Step 2: 修改 AuthService 添加匿名用户方法**

  修改 `backend/src/auth/auth.service.ts`，在 `validateUser` 方法后添加：
  ```typescript
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
  ```

  同时确保文件顶部导入了 `UserRole`（已有）。

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/common/guards/optional-jwt.guard.ts backend/src/auth/auth.service.ts
  git commit -m "feat: support anonymous sessions via X-Anonymous-ID header"
  ```

---

### Task 6: 在 Controller 中注入匿名用户

**Files:**
- Modify: `backend/src/sop/sop.controller.ts`
- Modify: `backend/src/export/export.controller.ts`
- Modify: `backend/src/ai-model/ai-model.controller.ts`
- Modify: `backend/src/admin/admin.controller.ts`

**Context:** 需要让所有普通接口识别匿名用户，并将匿名用户注入 `req.user`，使业务逻辑能正常获取 `created_by`。

- [ ] **Step 1: 创建 AnonymousUserInterceptor**

  创建 `backend/src/common/interceptors/anonymous-user.interceptor.ts`：
  ```typescript
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
  ```

- [ ] **Step 2: 注册全局拦截器**

  修改 `backend/src/app.module.ts`，在 `@Module` 的 `providers` 数组中添加（需要先导入）：
  ```typescript
  import { APP_INTERCEPTOR } from '@nestjs/core';
  import { AnonymousUserInterceptor } from './common/interceptors/anonymous-user.interceptor';

  // 在 @Module 中添加 providers:
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AnonymousUserInterceptor,
    },
  ],
  ```

  注意：`app.module.ts` 当前没有 `providers` 数组，需要添加。

- [ ] **Step 3: 修改 ExportController 支持匿名用户**

  替换 `backend/src/export/export.controller.ts` 为：
  ```typescript
  import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
  import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';
  import { ExportService } from './export.service';

  @Controller('exports')
  @UseGuards(OptionalJwtAuthGuard)
  export class ExportController {
    constructor(private exportService: ExportService) {}

    @Post()
    create(@Body() dto: { documentId: number; formatType: string }, @Request() req) {
      return this.exportService.createTask(dto.documentId, dto.formatType, req.user);
    }

    @Get(':id/status')
    getStatus(@Param('id') id: string) {
      return this.exportService.getStatus(+id);
    }
  }
  ```

- [ ] **Step 4: 修改 AiModelController 开放匿名访问**

  替换 `backend/src/ai-model/ai-model.controller.ts` 为：
  ```typescript
  import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
  import { AiModelService } from './ai-model.service';

  @Controller('admin/ai-models')
  export class AiModelController {
    constructor(private aiModelService: AiModelService) {}

    @Get()
    findAll() {
      return this.aiModelService.findAll();
    }

    @Get('active')
    findActive() {
      return this.aiModelService.findActive();
    }

    @Post()
    create(@Body() dto: any) {
      return this.aiModelService.create(dto);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: any) {
      return this.aiModelService.update(+id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.aiModelService.remove(+id);
    }
  }
  ```

- [ ] **Step 5: 修改 AdminController 开放部门格式 GET**

  修改 `backend/src/admin/admin.controller.ts`，将 `getDepartmentFormats` 方法的装饰器改为：
  ```typescript
  @Get('department-formats')
  @UseGuards(OptionalJwtAuthGuard)
  getDepartmentFormats() {
    return this.deptFormatRepo.find();
  }
  ```

  其余方法保持 `@UseGuards(AuthGuard('jwt'), RolesGuard)` 和 `@Roles(UserRole.SUPER_ADMIN)` 不变。

  需要确保导入了 `OptionalJwtAuthGuard`。

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/common/interceptors/anonymous-user.interceptor.ts backend/src/app.module.ts backend/src/export/export.controller.ts backend/src/ai-model/ai-model.controller.ts backend/src/admin/admin.controller.ts
  git commit -m "feat: allow anonymous access to common endpoints, inject anonymous user"
  ```

---

### Task 7: 新增 SetupModule

**Files:**
- Create: `backend/src/setup/setup.module.ts`
- Create: `backend/src/setup/setup.controller.ts`
- Create: `backend/src/setup/setup.service.ts`

**Context:** 提供系统初始化状态检测和初始化配置接口。初始化完成后才能创建超级管理员和配置 AI 模型。

- [ ] **Step 1: 创建 SetupService**

  创建 `backend/src/setup/setup.service.ts`：
  ```typescript
  import { Injectable } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { User, UserRole } from '../auth/entities/user.entity';
  import { AiModel } from '../ai-model/entities/ai-model.entity';
  import { DepartmentFormat } from '../admin/entities/department-format.entity';
  import * as crypto from 'crypto';

  @Injectable()
  export class SetupService {
    constructor(
      @InjectRepository(User)
      private userRepo: Repository<User>,
      @InjectRepository(AiModel)
      private aiModelRepo: Repository<AiModel>,
      @InjectRepository(DepartmentFormat)
      private deptFormatRepo: Repository<DepartmentFormat>,
    ) {}

    async isInitialized(): Promise<boolean> {
      const admin = await this.userRepo.findOne({ where: { role: UserRole.SUPER_ADMIN } });
      return !!admin;
    }

    async initialize(data: {
      adminUsername: string;
      adminPassword: string;
      aiModels?: any[];
    }) {
      const passwordHash = crypto.createHash('sha256').update(data.adminPassword).digest('hex');
      const admin = this.userRepo.create({
        username: data.adminUsername,
        password_hash: passwordHash,
        name: '系统管理员',
        department: 'IT部',
        role: UserRole.SUPER_ADMIN,
        status: 1,
      });
      await this.userRepo.save(admin);

      if (data.aiModels && data.aiModels.length > 0) {
        for (const model of data.aiModels) {
          const aiModel = this.aiModelRepo.create(model);
          await this.aiModelRepo.save(aiModel);
        }
      }

      return { success: true };
    }
  }
  ```

- [ ] **Step 2: 创建 SetupController**

  创建 `backend/src/setup/setup.controller.ts`：
  ```typescript
  import { Controller, Get, Post, Body } from '@nestjs/common';
  import { SetupService } from './setup.service';

  @Controller('setup')
  export class SetupController {
    constructor(private setupService: SetupService) {}

    @Get('status')
    async getStatus() {
      const initialized = await this.setupService.isInitialized();
      return { initialized };
    }

    @Post('init')
    async init(@Body() body: { adminUsername: string; adminPassword: string; aiModels?: any[] }) {
      return this.setupService.initialize(body);
    }
  }
  ```

- [ ] **Step 3: 创建 SetupModule**

  创建 `backend/src/setup/setup.module.ts`：
  ```typescript
  import { Module } from '@nestjs/common';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { SetupService } from './setup.service';
  import { SetupController } from './setup.controller';
  import { User } from '../auth/entities/user.entity';
  import { AiModel } from '../ai-model/entities/ai-model.entity';
  import { DepartmentFormat } from '../admin/entities/department-format.entity';

  @Module({
    imports: [TypeOrmModule.forFeature([User, AiModel, DepartmentFormat])],
    providers: [SetupService],
    controllers: [SetupController],
  })
  export class SetupModule {}
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/setup/
  git commit -m "feat: add setup module for initialization status and config"
  ```

---

### Task 8: 前端匿名会话

**Files:**
- Modify: `frontend/src/services/api.ts`

**Context:** 前端需要自动生成并持久化匿名 ID，未登录时通过 header 传递。同时调整 401 处理逻辑，不再强制跳转登录页。

- [ ] **Step 1: 修改 api.ts**

  替换 `frontend/src/services/api.ts` 为：
  ```typescript
  import axios from 'axios'

  const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
  })

  // Initialize anonymous id
  let anonymousId = localStorage.getItem('anonymous_id')
  if (!anonymousId) {
    anonymousId = crypto.randomUUID()
    localStorage.setItem('anonymous_id', anonymousId)
  }

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else if (anonymousId) {
      config.headers['X-Anonymous-ID'] = anonymousId
    }
    return config
  })

  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        // Do not redirect to login for anonymous users
      }
      return Promise.reject(err)
    }
  )

  export default api

  export const authApi = {
    login: (data: { username: string; password: string }) => api.post('/auth/login', data),
  }

  export const documentApi = {
    list: (status?: string) => api.get('/sop-documents', { params: { status } }),
    get: (id: number) => api.get(`/sop-documents/${id}`),
    create: (data: any) => api.post('/sop-documents', data),
    update: (id: number, data: any) => api.put(`/sop-documents/${id}`, data),
    remove: (id: number) => api.delete(`/sop-documents/${id}`),
    submit: (id: number) => api.post(`/sop-documents/${id}/submit`),
  }

  export const stepApi = {
    create: (docId: number, data: any) => api.post(`/sop-documents/${docId}/steps`, data),
    update: (stepId: number, data: any) => api.put(`/sop-documents/steps/${stepId}`, data),
    remove: (stepId: number) => api.delete(`/sop-documents/steps/${stepId}`),
    aiOptimize: (stepId: number, data: any) => api.post(`/steps/${stepId}/ai-optimize`, data),
  }

  export const exportApi = {
    createTask: (data: any) => api.post('/exports', data),
    getStatus: (taskId: number) => api.get(`/exports/${taskId}/status`),
  }

  export const adminApi = {
    getUsers: () => api.get('/admin/users'),
    createUser: (data: any) => api.post('/admin/users', data),
    updateUserRole: (id: number, data: any) => api.put(`/admin/users/${id}/role`, data),
    getDepartmentFormats: () => api.get('/admin/department-formats'),
    updateDepartmentFormat: (id: number, data: any) => api.put(`/admin/department-formats/${id}`, data),
    getAiModels: () => api.get('/admin/ai-models'),
    createAiModel: (data: any) => api.post('/admin/ai-models', data),
    updateAiModel: (id: number, data: any) => api.put(`/admin/ai-models/${id}`, data),
    deleteAiModel: (id: number) => api.delete(`/admin/ai-models/${id}`),
    getLogs: (params?: any) => api.get('/admin/operation-logs', { params }),
  }

  export const setupApi = {
    getStatus: () => api.get('/setup/status'),
    initialize: (data: any) => api.post('/setup/init', data),
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/services/api.ts
  git commit -m "feat: add anonymous session support and setup api client"
  ```

---

### Task 9: 前端系统配置页面

**Files:**
- Create: `frontend/src/pages/SetupWizard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Context:** 新增 `/settings` 页面，无需登录即可配置 AI 模型、部门格式和管理员账号。

- [ ] **Step 1: 创建 SetupWizard 页面**

  创建 `frontend/src/pages/SetupWizard.tsx`：
  ```tsx
  import { useEffect, useState } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { Card, Tabs, Table, Button, Modal, Form, Input, Select, Space, message, Tag, Switch } from 'antd'
  import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
  import { adminApi, setupApi } from '../services/api'

  const { TabPane } = Tabs

  function SetupWizard() {
    const [activeTab, setActiveTab] = useState('ai-models')
    const [aiModels, setAiModels] = useState<any[]>([])
    const [deptFormats, setDeptFormats] = useState<any[]>([])
    const [initialized, setInitialized] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingModel, setEditingModel] = useState<any>(null)
    const [form] = Form.useForm()
    const navigate = useNavigate()

    useEffect(() => {
      fetchAll()
    }, [])

    const fetchAll = async () => {
      try {
        const statusRes = await setupApi.getStatus()
        setInitialized(statusRes.data.initialized)
        await fetchAiModels()
        await fetchDeptFormats()
      } catch (err) {
        message.error('加载配置失败')
      }
    }

    const fetchAiModels = async () => {
      const res = await adminApi.getAiModels()
      setAiModels(res.data)
    }

    const fetchDeptFormats = async () => {
      const res = await adminApi.getDepartmentFormats()
      setDeptFormats(res.data)
    }

    const handleSaveModel = async (values: any) => {
      try {
        if (editingModel) {
          await adminApi.updateAiModel(editingModel.id, values)
          message.success('更新成功')
        } else {
          await adminApi.createAiModel(values)
          message.success('创建成功')
        }
        setModalOpen(false)
        setEditingModel(null)
        form.resetFields()
        fetchAiModels()
      } catch (err) {
        message.error('保存失败')
      }
    }

    const handleDeleteModel = async (id: number) => {
      try {
        await adminApi.deleteAiModel(id)
        message.success('删除成功')
        fetchAiModels()
      } catch (err) {
        message.error('删除失败')
      }
    }

    const handleInitSystem = async (values: { adminUsername: string; adminPassword: string }) => {
      try {
        await setupApi.initialize({
          adminUsername: values.adminUsername,
          adminPassword: values.adminPassword,
        })
        message.success('初始化成功')
        setInitialized(true)
      } catch (err) {
        message.error('初始化失败')
      }
    }

    const handleUpdateDeptFormat = async (id: number, data: any) => {
      try {
        await adminApi.updateDepartmentFormat(id, data)
        message.success('更新成功')
        fetchDeptFormats()
      } catch (err) {
        message.error('更新失败')
      }
    }

    const aiModelColumns = [
      { title: '名称', dataIndex: 'name' },
      { title: '提供商', dataIndex: 'provider' },
      { title: '模型', dataIndex: 'model_name' },
      { title: 'API地址', dataIndex: 'api_base_url', ellipsis: true },
      {
        title: '默认',
        dataIndex: 'is_default',
        render: (v: number) => v ? <Tag color="blue">默认</Tag> : null,
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        render: (v: number) => (
          <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
        ),
      },
      {
        title: '操作',
        render: (_: any, record: any) => (
          <Space>
            <Button size="small" onClick={() => { setEditingModel(record); form.setFieldsValue(record); setModalOpen(true) }}>
              编辑
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteModel(record.id)}>
              删除
            </Button>
          </Space>
        ),
      },
    ]

    const deptColumns = [
      { title: '部门代码', dataIndex: 'department_code' },
      { title: '部门名称', dataIndex: 'department_name' },
      {
        title: '可用格式',
        dataIndex: 'available_formats',
        render: (formats: string[]) => formats?.map(f => <Tag key={f}>{f}</Tag>),
      },
      {
        title: '默认格式',
        dataIndex: 'default_format',
      },
      {
        title: '操作',
        render: (_: any, record: any) => (
          <Button size="small" onClick={() => {
            const formats = window.prompt('输入可用格式（逗号分隔）', record.available_formats?.join(','))
            if (formats !== null) {
              handleUpdateDeptFormat(record.id, { available_formats: formats.split(',').map((s: string) => s.trim()) })
            }
          }}>
            编辑
          </Button>
        ),
      },
    ]

    return (
      <div>
        {!initialized && (
          <Card title="系统初始化" style={{ marginBottom: 24 }}>
            <Form layout="vertical" onFinish={handleInitSystem}>
              <Form.Item name="adminUsername" label="管理员用户名" rules={[{ required: true }]}>
                <Input placeholder="admin" />
              </Form.Item>
              <Form.Item name="adminPassword" label="管理员密码" rules={[{ required: true }]}>
                <Input.Password placeholder="admin123" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  初始化系统
                </Button>
              </Form.Item>
            </Form>
          </Card>
        )}

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="AI模型配置" key="ai-models">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ marginBottom: 16 }}
              onClick={() => { setEditingModel(null); form.resetFields(); setModalOpen(true) }}
            >
              添加模型
            </Button>
            <Table rowKey="id" columns={aiModelColumns} dataSource={aiModels} />
          </TabPane>

          <TabPane tab="部门格式配置" key="dept-formats">
            <Table rowKey="id" columns={deptColumns} dataSource={deptFormats} />
          </TabPane>
        </Tabs>

        <Modal
          title={editingModel ? '编辑AI模型' : '添加AI模型'}
          open={modalOpen}
          onCancel={() => { setModalOpen(false); setEditingModel(null) }}
          onOk={() => form.submit()}
        >
          <Form form={form} onFinish={handleSaveModel} layout="vertical">
            <Form.Item name="name" label="显示名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
              <Select options={[
                { value: 'openai', label: 'OpenAI' },
                { value: 'zhipu', label: '智谱AI' },
                { value: 'moonshot', label: 'Moonshot' },
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'qwen', label: '通义千问' },
                { value: 'ernie', label: '文心一言' },
              ]} />
            </Form.Item>
            <Form.Item name="model_name" label="模型名称" rules={[{ required: true }]}>
              <Input placeholder="如 gpt-4, glm-4 等" />
            </Form.Item>
            <Form.Item name="api_base_url" label="API地址" rules={[{ required: true }]}>
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
            <Form.Item name="api_key" label="API Key" rules={[{ required: !editingModel }]}>
              <Input.Password placeholder={editingModel ? '留空表示不修改' : ''} />
            </Form.Item>
            <Form.Item name="is_default" valuePropName="checked">
              <Switch checkedChildren="默认" unCheckedChildren="非默认" />
            </Form.Item>
            <Form.Item name="is_active" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    )
  }

  export default SetupWizard
  ```

- [ ] **Step 2: 修改 App.tsx 添加路由和初始化检测**

  替换 `frontend/src/App.tsx` 为：
  ```tsx
  import { Routes, Route, Navigate } from 'react-router-dom'
  import { useEffect, useState } from 'react'
  import Login from './pages/Login'
  import DocumentCenter from './pages/DocumentCenter'
  import DocumentEditor from './pages/DocumentEditor'
  import DocumentViewer from './pages/DocumentViewer'
  import AdminDashboard from './pages/AdminDashboard'
  import SetupWizard from './pages/SetupWizard'
  import Layout from './components/Layout'
  import { setupApi } from './services/api'

  function App() {
    const [initialized, setInitialized] = useState<boolean | null>(null)

    useEffect(() => {
      setupApi.getStatus().then(res => {
        setInitialized(res.data.initialized)
      }).catch(() => {
        setInitialized(true)
      })
    }, [])

    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout initialized={initialized} />}>
          <Route index element={<DocumentCenter />} />
          <Route path="editor/:id?" element={<DocumentEditor />} />
          <Route path="viewer/:id" element={<DocumentViewer />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="settings" element={<SetupWizard />} />
        </Route>
      </Routes>
    )
  }

  export default App
  ```

- [ ] **Step 3: 修改 Layout.tsx 添加系统配置入口和初始化提示**

  替换 `frontend/src/components/Layout.tsx` 为：
  ```tsx
  import { Outlet, useNavigate, useLocation } from 'react-router-dom'
  import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, message, Alert } from 'antd'
  import {
    FileTextOutlined,
    SettingOutlined,
    LogoutOutlined,
    UserOutlined,
    LoginOutlined,
    ToolOutlined,
  } from '@ant/icons'
  import type { MenuProps } from 'antd'

  const { Header, Sider, Content } = AntLayout

  function Layout({ initialized }: { initialized: boolean | null }) {
    const navigate = useNavigate()
    const location = useLocation()
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const isLoggedIn = !!token
    const isAdmin = user.role === 'super_admin'

    const handleLogout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      message.success('已退出登录')
      window.location.reload()
    }

    const handleAdminClick = () => {
      if (!isLoggedIn) {
        navigate('/login', { state: { from: '/admin' } })
      } else if (!isAdmin) {
        message.error('只有超级管理员可以访问后台管理')
      } else {
        navigate('/admin')
      }
    }

    const menuItems: MenuProps['items'] = [
      {
        key: '/',
        icon: <FileTextOutlined />,
        label: '文档中心',
      },
      {
        key: '/settings',
        icon: <ToolOutlined />,
        label: '系统配置',
      },
      {
        key: '/admin',
        icon: <SettingOutlined />,
        label: '后台管理',
      },
    ]

    const handleMenuClick = ({ key }: { key: string }) => {
      if (key === '/admin') {
        handleAdminClick()
      } else {
        navigate(key)
      }
    }

    const userMenuItems: MenuProps['items'] = [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ]

    return (
      <AntLayout style={{ minHeight: '100vh' }}>
        <Sider theme="light" width={200}>
          <div style={{ padding: 16, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
            SOP系统
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname.startsWith('/editor') ? '/' : location.pathname.startsWith('/viewer') ? '/' : location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        <AntLayout>
          <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isLoggedIn ? (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar src={user.avatar} icon={<UserOutlined />} />
                  <span>{user.name || '用户'}</span>
                </div>
              </Dropdown>
            ) : (
              <Button icon={<LoginOutlined />} onClick={() => navigate('/login')}>
                管理员登录
              </Button>
            )}
          </Header>
          <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
            {initialized === false && (
              <Alert
                message="系统尚未初始化"
                description="建议先前往系统配置页面设置 AI 模型和管理员账号。"
                type="warning"
                showIcon
                style={{ marginBottom: 24 }}
                action={
                  <Button size="small" type="primary" onClick={() => navigate('/settings')}>
                    前往配置
                  </Button>
                }
              />
            )}
            <Outlet />
          </Content>
        </AntLayout>
      </AntLayout>
    )
  }

  export default Layout
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/SetupWizard.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
  git commit -m "feat: add setup wizard page, anonymous routing, and init alert"
  ```

---

### Task 10: Dockerfile 改造

**Files:**
- Modify: `Dockerfile`

**Context:** 安装中文字体解决乱码，调整构建产物复制路径，移除 Nginx 相关逻辑。

- [ ] **Step 1: 修改 Dockerfile**

  替换 `Dockerfile` 为：
  ```dockerfile
  # Stage 1: Build Frontend
  FROM node:20-alpine AS frontend-builder
  WORKDIR /app/frontend
  COPY frontend/package*.json ./
  RUN npm install
  RUN chmod +x node_modules/.bin/*
  COPY frontend/ ./
  RUN npm run build

  # Stage 2: Build Backend
  FROM node:20-alpine AS backend-builder
  WORKDIR /app/backend
  COPY backend/package*.json ./
  RUN npm install
  RUN chmod +x node_modules/.bin/*
  COPY backend/ ./
  RUN npm run build

  # Stage 3: Final Image with Supervisor
  FROM ubuntu:22.04
  ENV DEBIAN_FRONTEND=noninteractive

  RUN apt-get update && apt-get install -y --no-install-recommends \
      nodejs \
      npm \
      software-properties-common \
      curl \
      supervisor \
      gnupg \
      gpg-agent \
      dirmngr \
      fonts-noto-cjk \
      && rm -rf /var/lib/apt/lists/*

  # Install Python 3.11 via deadsnakes PPA
  RUN add-apt-repository -y ppa:deadsnakes/ppa && \
      apt-get update && apt-get install -y --no-install-recommends \
      python3.11 \
      python3.11-dev \
      python3.11-venv \
      && rm -rf /var/lib/apt/lists/*

  # Install pip for python3.11
  RUN python3.11 -m ensurepip --upgrade && python3.11 -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

  # Install Node.js 20 (Ubuntu default is older)
  RUN npm install -g n && n 20

  WORKDIR /app

  # Copy built artifacts
  COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
  COPY --from=backend-builder /app/backend/dist /app/backend/dist
  COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
  COPY --from=backend-builder /app/backend/package.json /app/backend/package.json

  COPY ai-service/ /app/ai-service
  COPY ai-service/requirements.txt /app/requirements.txt
  RUN python3.11 -m pip install --no-cache-dir -r /app/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

  COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

  # Create data and log directories
  RUN mkdir -p /app/data/uploads /app/logs

  EXPOSE 3000

  CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
  ```

  关键变更：
  - 新增 `fonts-noto-cjk` 安装
  - 前端产物复制到 `/app/frontend/dist`（供 ServeStaticModule 读取）
  - 创建 `/app/data/uploads` 目录
  - 只暴露 3000 端口

- [ ] **Step 2: Commit**

  ```bash
  git add Dockerfile
  git commit -m "build: single container with cjk fonts, sqlite, local storage"
  ```

---

### Task 11: docker-compose.yml 改造

**Files:**
- Modify: `docker-compose.yml`

**Context:** 精简为单服务，移除 MySQL/Redis/MinIO/Nginx。

- [ ] **Step 1: 修改 docker-compose.yml**

  替换 `docker-compose.yml` 为：
  ```yaml
  version: '3.8'

  services:
    sop:
      build:
        context: .
        dockerfile: Dockerfile
      container_name: sop-system
      ports:
        - "80:3000"
      volumes:
        - ./data:/app/data
        - ./logs:/app/logs
      networks:
        - sop-network

  networks:
    sop-network:
      driver: bridge
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add docker-compose.yml
  git commit -m "deploy: simplify to single service compose"
  ```

---

### Task 12: 构建与验证

**Context:** 构建镜像，启动容器，验证所有功能正常。

- [ ] **Step 1: 构建镜像**

  Run:
  ```bash
  docker compose build
  ```
  Expected: 构建成功，无报错。

- [ ] **Step 2: 启动容器**

  Run:
  ```bash
  docker compose up -d
  ```
  Expected: 容器 `sop-system` 状态为 `Up`。

- [ ] **Step 3: 验证前端可访问**

  Run:
  ```bash
  curl -s http://localhost | head -n 5
  ```
  Expected: 返回 HTML，包含 `<title>SOP流程优化系统</title>`，无乱码。

- [ ] **Step 4: 验证 API 正常**

  Run:
  ```bash
  curl -s http://localhost/api/setup/status
  ```
  Expected: 返回 `{"initialized":false}`。

- [ ] **Step 5: 验证 SQLite 数据库已创建**

  Run:
  ```bash
  ls -la ./data/sop.db
  ```
  Expected: 文件存在。

- [ ] **Step 6: 功能测试（浏览器中）**

  打开 `http://localhost`，依次验证：
  1. 页面中文正常显示，无乱码
  2. 能直接创建 SOP 文档（无需登录）
  3. 侧边栏"系统配置"可访问
  4. 在系统配置中添加 AI 模型
  5. 初始化管理员账号
  6. 管理员登录后能进入后台管理

- [ ] **Step 7: Commit（如有后续修复）**

  如果在验证过程中有修复，分别提交：
  ```bash
  git add .
  git commit -m "fix: resolve issues found during integration testing"
  ```

---

## 自审检查

### 1. Spec 覆盖检查

| 设计文档要求 | 对应任务 |
|------------|---------|
| 单容器部署 | Task 10, 11 |
| MySQL → SQLite | Task 1, 2 |
| Redis → 内存缓存 | Task 1, 3 |
| MinIO → 本地文件 | Task 1, 4 |
| 匿名会话 | Task 5, 6, 8 |
| SetupModule（初始化检测/配置） | Task 7 |
| 前端系统配置页面 | Task 9 |
| 免登录使用 | Task 6, 8, 9 |
| 字体乱码修复 | Task 10 |
| NestJS serve 静态文件 | Task 2 |

**无遗漏。**

### 2. Placeholder 检查

- 无 TBD/TODO
- 无 "add appropriate error handling" 等模糊描述
- 每个代码步骤包含完整代码
- 无 "Similar to Task N" 引用

### 3. 类型一致性检查

- `UserRole.ANONYMOUS` 在 Task 2 定义，Task 5 使用 — 一致
- `X-Anonymous-ID` header 在 Task 5（后端）和 Task 8（前端）中名称一致
- `setupApi` 在 Task 8 定义，Task 9 使用 — 一致
- `/app/data/sop.db` 路径在 Task 2（后端配置）和 Task 10（Dockerfile 创建目录）中一致

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-sop-single-container.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

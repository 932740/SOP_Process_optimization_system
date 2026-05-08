# SOP 系统单容器一体化改造设计文档

## 1. 背景与目标

### 1.1 当前痛点
- **部署复杂**：依赖 MySQL、Redis、MinIO、Nginx 等多个外部服务，需要手动编写 `.env` 文件
- **功能不可用**：部署后 API 报错/无响应，前端字体乱码（缺少系统中文支持）
- **配置分散**：AI 模型、部门格式等配置需登录后台管理页面操作，无法开箱即用

### 1.2 设计目标
1. **单容器部署**：所有服务打包到一个 Docker 镜像，一条 `docker compose up -d` 启动
2. **零外部依赖**：移除 MySQL、Redis、MinIO、Nginx 独立容器
3. **前台全配置**：所有配置（AI 模型、部门格式、管理员账号）通过前端页面完成
4. **免登录使用**：普通用户打开页面即可创建/编辑 SOP 文档，无需登录
5. **后台需登录**：仅后台管理（用户管理、操作日志）需要超级管理员 JWT 登录
6. **修复乱码**：在镜像中安装中文字体，解决前端显示和导出文件的中文渲染问题

---

## 2. 架构总览

### 2.1 部署形态

```
┌─────────────────────────────────────────┐
│         Docker 容器（单容器）              │
│  ┌─────────────┐    ┌─────────────────┐ │
│  │  NestJS     │    │  Python FastAPI │ │
│  │  (3000)     │◄──►│  (8000, 内部)   │ │
│  │  API + 前端  │    │  AI 服务        │ │
│  └─────────────┘    └─────────────────┘ │
│        ▲                                │
│        │ ServeStaticModule              │
│   ┌────┴────┐                          │
│   │ dist/   │  ← React 前端构建产物      │
│   └─────────┘                          │
│                                         │
│  持久化目录（Docker Volume）              │
│  ├── /app/data/sop.db      (SQLite)     │
│  ├── /app/data/uploads/    (文件存储)    │
│  └── /app/logs/            (日志)       │
└─────────────────────────────────────────┘
              │
              ▼
         宿主机 80 端口
```

### 2.2 外部端口

只暴露 **3000** 一个端口到宿主机（通常映射到宿主机的 80 端口）。

- 前端页面、API 请求、静态资源全部走 3000 端口
- AI 服务运行在容器内部的 8000 端口，仅 NestJS 后端内部调用，不暴露到宿主机

### 2.3 容器内部进程

由 `supervisord` 统一管理：

| 进程 | 端口 | 职责 |
|------|------|------|
| NestJS | 3000 | 业务 API + 托管前端静态文件 |
| Python AI | 8000 | FastAPI，处理 AI 优化和导出 |

---

## 3. 后端改造

### 3.1 数据库：MySQL → SQLite

**改造点：**
- `app.module.ts` 中 TypeORM 配置改为：
  ```typescript
  TypeOrmModule.forRoot({
    type: 'sqlite',
    database: '/app/data/sop.db',
    autoLoadEntities: true,
    synchronize: true,
    charset: 'utf8mb4',
  })
  ```
- `backend/package.json` 添加 `sqlite3` 驱动依赖：
  ```bash
  cd backend && npm install sqlite3
  ```
- `backend/init.sql` 废弃，由 TypeORM `synchronize: true` 自动建表
- 实体定义中的 MySQL 特有语法（如 `BIGINT AUTO_INCREMENT`）TypeORM 会自动适配到 SQLite，一般无需修改

### 3.2 缓存：Redis → 内存缓存

**改造点：**
- 移除 `redis` 容器依赖
- `backend/package.json` 移除 `ioredis`、`redis` 依赖
- `redis.service.ts` 改为基于 Node.js `Map` 的内存缓存，支持 TTL：
  ```typescript
  // 简单实现，足够支撑单机场景
  private cache = new Map<string, { value: any; expires: number }>();
  ```

### 3.3 文件存储：MinIO → 本地文件系统

**改造点：**
- 移除 `minio` 容器依赖
- `backend/package.json` 移除 `minio` 依赖
- `minio.service.ts` 重写为直接读写 `/app/data/uploads/` 目录：
  - `putObject(bucket, key, file)` → `fs.writeFileSync(`/app/data/uploads/${key}`, file)`
  - `getObject(bucket, key)` → `fs.createReadStream(...)`
  - `presignedGetObject(bucket, key)` → 返回 NestJS 静态文件路由 `/uploads/${key}`
- 新增 NestJS 静态文件路由，对外提供上传文件访问

### 3.4 认证：匿名会话

**改造点：**
- 前端 `api.ts` 中，无登录 token 时，自动携带请求头 `X-Anonymous-ID: <uuid>`
- `OptionalJwtAuthGuard` 增强：
  1. 无 JWT 且无 `X-Anonymous-ID` → 允许通过，`req.user = null`
  2. 无 JWT 但有 `X-Anonymous-ID` → 查询/创建匿名用户记录，`req.user = 匿名用户`
  3. 有 JWT → 正常 JWT 校验
- `auth/entities/user.entity.ts` 中扩展 `UserRole` 枚举，新增 `ANONYMOUS = 'anonymous'`
- 匿名用户的数据库记录：`role = UserRole.ANONYMOUS`，`name = '匿名用户'`，`username = 'anonymous_<uuid>'`
- 每个浏览器实例有独立的匿名用户 ID，文档的 `created_by` 能正确区分不同用户

### 3.5 新增 SetupModule

**职责：** 检测系统初始化状态，接收初始化配置。

**接口：**
- `GET /api/setup/status` → `{ initialized: boolean }`
  - 检查数据库中是否存在超级管理员账号
- `POST /api/setup/init` → 接收 `{ adminUsername, adminPassword, aiModels }`
  - 创建超级管理员账号
  - 保存 AI 模型配置
  - 返回成功状态

### 3.6 ServeStaticModule

NestJS 直接托管前端构建产物，替代 Nginx。

**依赖安装：**
```bash
cd backend && npm install @nestjs/serve-static
```

**配置：**

```typescript
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend', 'dist'),
      exclude: ['/api*'],
    }),
  ],
})
```

---

## 4. 前端改造

### 4.1 匿名会话管理

- `api.ts` 初始化时，检查 `localStorage` 中是否存在 `anonymous_id`
- 不存在则生成 UUID v4 并存入 `localStorage`
- 所有 API 请求拦截器在无 token 时，自动附加 `X-Anonymous-ID` header

### 4.2 系统配置页面（新增 `/settings`）

**访问权限**：无需登录即可访问。

**功能模块：**
1. **AI 模型配置**
   - 添加/编辑/删除 AI 模型
   - 字段：名称、提供商、API 地址、API Key、模型名称
   - 设置默认模型
   - 和现在后台管理的 AI 模型配置 UI 一致

2. **部门格式配置**
   - 调整各部门可用的导出格式列表
   - 设置各部门默认导出格式

3. **管理员账号设置**
   - 仅当系统尚未创建超级管理员时显示
   - 设置超级管理员用户名和密码

### 4.3 初始化引导

- `App.tsx` 挂载时调用 `GET /api/setup/status`
- 如果 `initialized: false`，在页面顶部显示提示条：
  > "系统尚未初始化，建议先配置 AI 模型和管理员账号 → 前往系统配置"
- 提示条可关闭，不阻塞正常使用

### 4.4 路由与菜单调整

- `App.tsx` 新增 `/settings` 路由
- `Layout.tsx` 侧边栏增加"系统配置"入口（所有用户可见）
- "后台管理"（`/admin`）保留，仍需要超级管理员登录
- `api.ts` 的 401 拦截器：移除强制跳转登录页的逻辑（匿名用户本来就没有 token），仅静默清除本地存储的 token

---

## 5. Dockerfile 改造

### 5.1 构建阶段

保留三阶段构建：
1. **frontend-builder**：`node:20-alpine`，构建 React 产物到 `dist/`
2. **backend-builder**：`node:20-alpine`，构建 NestJS 产物到 `dist/`
3. **final**：`ubuntu:22.04`，组装运行环境

### 5.2 最终镜像关键变更

**新增：**
```dockerfile
# 安装中文字体（解决乱码）
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
```

**移除：**
- 不再安装 Nginx
- 不再依赖外部 MySQL/Redis/MinIO（这些服务从 docker-compose 中移除）

**文件复制：**
```dockerfile
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY --from=backend-builder /app/backend/dist /app/backend/dist
COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/backend/package.json /app/backend/package.json
COPY ai-service/ /app/ai-service
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
```

### 5.3 supervisord.conf

```ini
[supervisord]
nodaemon=true
user=root

[program:nestjs]
command=node /app/backend/dist/main.js
autostart=true
autorestart=true
stdout_logfile=/app/logs/nestjs.log
stderr_logfile=/app/logs/nestjs-error.log
priority=10

[program:python]
command=python3.11 -m uvicorn ai-service.main:app --host 0.0.0.0 --port 8000 --workers 2
autostart=true
autorestart=true
stdout_logfile=/app/logs/python.log
stderr_logfile=/app/logs/python-error.log
priority=20
```

---

## 6. docker-compose.yml 改造

精简为单服务：

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

**部署命令：**
```bash
docker compose build
docker compose up -d
```

---

## 7. 数据持久化策略

| 数据类型 | 存储位置 | 说明 |
|---------|---------|------|
| 业务数据 | `/app/data/sop.db` | SQLite 单文件，通过 Docker volume 挂载到宿主机 |
| 上传文件 | `/app/data/uploads/` | 本地文件系统，替代 MinIO |
| 日志 | `/app/logs/` | 各进程标准输出日志 |

**备份方式：**
```bash
# 备份 SQLite 数据库
cp ./data/sop.db ./backup/sop_$(date +%Y%m%d).db

# 备份上传文件
tar czvf ./backup/uploads_$(date +%Y%m%d).tar.gz ./data/uploads/
```

---

## 8. 字体乱码修复

### 8.1 问题根因
Ubuntu 22.04 基础镜像默认不包含任何中文字体，导致前端页面中文显示为方块或乱码。

### 8.2 修复方案
在 Dockerfile 最终阶段安装 `fonts-noto-cjk`：

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
```

### 8.3 覆盖范围
- 前端页面中文显示
- 导出文件（Word/PDF/PPT）的中文渲染（Python 导出引擎依赖系统字体）
- Docker 日志中的中文输出

---

## 9. 交互流程

### 9.1 首次使用流程

```
用户打开 http://localhost
    │
    ▼
前端调用 GET /api/setup/status
    │
    ▼
返回 { initialized: false }
    │
    ▼
页面顶部显示提示条："系统尚未初始化，建议配置 AI 模型和管理员账号"
    │
    ▼
用户可立即创建/编辑 SOP 文档（免登录）
    │
    ▼
用户点击"前往系统配置"
    │
    ▼
在 /settings 页面配置 AI 模型、部门格式、管理员账号
    │
    ▼
提交后系统标记为 initialized，提示条消失
```

### 9.2 日常使用流程

```
用户打开 http://localhost
    │
    ▼
自动生成 anonymous_id（首次）或使用已有的
    │
    ▼
直接进入文档中心，可创建/编辑/查看 SOP（免登录）
    │
    ▼
如需 AI 优化，调用 AI 服务（依赖已配置的 AI 模型）
    │
    ▼
如需进入后台管理，点击"管理员登录"，输入账号密码
```

---

## 10. 风险与限制

| 风险点 | 说明 | 缓解措施 |
|-------|------|---------|
| SQLite 并发性能 | SQLite 在高并发写入场景下性能不如 MySQL | 单机/内网场景通常足够；如需扩展可后续迁移到外部 MySQL |
| 文件存储单点 | 本地文件系统无法分布式共享 | 单机部署无需分布；如需扩展可后续接入外部 MinIO |
| 系统配置页面暴露 | `/settings` 无需登录，任何人可修改 AI Key | 单机/内网场景可控；如需外网部署，建议加一层 Basic Auth 或 IP 白名单 |
| 匿名用户数据隔离 | 清除浏览器 localStorage 后 anonymous_id 丢失，无法关联历史文档 | 设计如此，如需持久身份可后续引导注册真实账号 |

---

## 11. 后续扩展路径

如果未来需要恢复多服务架构，改造路径清晰：
1. 将 SQLite 导出并导入到外部 MySQL
2. 将 `/app/data/uploads/` 同步到 MinIO
3. 恢复 Redis 缓存
4. 将 Nginx 前置， NestJS 不再 serve 静态文件
5. 修改 `docker-compose.yml` 添加外部服务

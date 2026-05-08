# SOP流程优化应用 — 开发设计文档

## 1. 项目概述

### 1.1 背景与目标
构建一个企业级SOP（标准作业程序）流程优化应用。用户可通过上传操作步骤图片和文字描述，利用AI对每一步进行针对性优化（文字润色、图片理解补全、规范检查点补充）。优化完成的SOP可提交归档，并导出为不同格式供各部门使用，同时支持自动同步至飞书知识库。

### 1.2 核心功能
- SOP文档全生命周期管理（新建、编辑、AI优化、提交归档、下载）
- 步骤级AI优化（支持多种优化类型，用户可逐条确认）
- 多格式导出（Markdown、Word、PDF、Excel、PPT），按部门控制可用格式
- 后台AI模型灵活配置（支持OpenAI及国内大模型）
- 基于飞书的身份认证与知识库同步
- RBAC权限控制（超级管理员 vs 普通用户）

### 1.3 约束条件
- 数据库：MySQL 8.0
- 部署：Docker容器化
- 文件存储：MinIO对象存储
- 登录：飞书应用API对接（非SSO）
- 无外部通知/审批流需求

---

## 2. 技术栈

| 层级 | 技术选型 | 选型理由 |
|------|---------|---------|
| 前端 | React 18 + Ant Design + TypeScript | 企业级后台管理成熟方案，组件丰富，TypeScript前后端统一 |
| 业务后端 | NestJS (Node.js) + TypeScript | 模块化、依赖注入、TypeScript原生支持，适合中大型项目 |
| AI & 导出服务 | Python + FastAPI | Python在AI SDK生态（OpenAI/国内模型）和文档转换库（python-docx/ReportLab/WeasyPrint）上显著优于Node.js |
| 数据库 | MySQL 8.0 | 关系型数据为主，事务支持完善 |
| 缓存/队列 | Redis 7 | Session缓存、任务队列、热点数据缓存 |
| 文件存储 | MinIO | 本地部署的对象存储，兼容S3 API，存图片和导出文件 |
| 网关 | Nginx (stable) | 静态资源托管、反向代理、负载均衡 |
| 容器化 | Docker + Docker Compose | 开发测试一键启动，运维简单 |

---

## 3. 系统架构

### 3.1 整体拓扑

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   用户浏览器  │─────▶│   Nginx (网关)    │─────▶│  React 前端静态资源│
└──────────────┘      └──────────────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  NestJS 主服务 │◀──── 业务API / 权限 / 飞书登录
                       │   (Node.js)  │◀──── 文件上传 / 下载 / 状态管理
                       └──────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │  MySQL   │   │  Redis   │   │    MinIO     │
        │ (业务库)  │   │(缓存/队列)│   │(图片/导出文件) │
        └──────────┘   └──────────┘   └──────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ Python AI服务 │◀──── AI优化 / 图片OCR / 格式导出
                       │  (FastAPI)   │◀──── Markdown/Word/PDF/Excel/PPT生成
                       └──────────────┘
```

### 3.2 核心数据流

1. **编辑流**：用户上传步骤图片 → NestJS生成预签名URL直传MinIO → 前端调Python服务进行AI优化 → 结果回显 → 用户确认保存 → NestJS写入MySQL
2. **提交流**：用户点击提交 → NestJS校验完整性 → 状态改为"已完成" → 触发版本快照 → 异步触发飞书知识库同步
3. **下载流**：用户选择格式 → NestJS校验部门权限 → 创建导出任务入Redis队列 → Python消费生成文件 → 上传MinIO → 前端获取下载链接
4. **配置流**：超管在后台增删改AI模型配置 → NestJS加密存储 → 前端AI优化面板动态读取可用模型列表

### 3.3 服务边界约定
- NestJS是唯一的业务状态Owner，Python服务无状态，仅处理计算任务
- Python服务不直接连接MySQL，所有数据由NestJS通过HTTP请求传入
- 文件存储统一走MinIO，两服务通过预签名URL读写，不直接交换文件

---

## 4. 功能模块划分

### 4.1 前端模块（React + Ant Design）

| 模块 | 职责 |
|------|------|
| 文档中心 | 总览列表（状态筛选、搜索）、新建SOP按钮、卡片/表格视图 |
| 文档编辑 | 左侧步骤列表（可拖拽排序）、右侧步骤详情（文字+图片上传）、AI优化弹窗 |
| 文档查看 | 只读预览（类Markdown渲染）、下载格式选择器（按部门权限过滤） |
| 后台管理 | AI模型配置、部门-格式权限映射、用户角色管理 |
| 操作日志 | 仅超管可见，支持按用户/时间/操作类型筛选 |
| 飞书登录 | 登录页、飞书授权回调处理、Token刷新、退出 |

### 4.2 后端模块（NestJS）

| 模块 | 职责 |
|------|------|
| Auth（认证） | 飞书应用登录回调、JWT签发与刷新、登出 |
| RBAC（权限） | 角色定义、权限守卫、接口级鉴权、菜单/按钮级权限控制 |
| SOP文档管理 | CRUD、版本快照（提交时自动备份）、状态机流转控制 |
| 步骤管理 | 步骤CRUD、图片上传（预签名URL）、步骤排序 |
| AI任务调度 | 接收AI优化请求、调用Python服务、返回结果、记录调用日志 |
| 导出管理 | 创建导出任务、推Redis队列、轮询结果、返回下载链接 |
| 模型配置 | AI模型CRUD、可用性测试（保存前验证API连通性）、默认模型设置 |
| 系统配置 | 部门管理、格式模板管理、部门-格式映射配置 |
| 操作日志 | 拦截器记录敏感操作、仅超管查询 |
| 飞书同步 | 已完成SOP异步同步至飞书知识库、目录管理 |

### 4.3 Python AI服务（FastAPI）

| 模块 | 职责 |
|------|------|
| AI优化引擎 | 多Provider适配（OpenAI、文心、通义、Kimi、DeepSeek等）、Prompt模板管理、流式/非流式调用 |
| 图片理解 | 多模态模型调用（图片OCR与描述生成）、图片与文字关联分析 |
| 文档导出引擎 | Markdown/Word/PDF/Excel/PPT生成，支持模板渲染 |
| 健康检查 | 各模型连通性探测、服务状态上报 |

---

## 5. 数据库设计

### 5.1 用户与权限

```sql
-- 用户表
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  union_id VARCHAR(64) UNIQUE COMMENT '飞书唯一ID',
  name VARCHAR(64) NOT NULL,
  avatar VARCHAR(256),
  department VARCHAR(64),
  role ENUM('super_admin', 'user') DEFAULT 'user',
  status TINYINT DEFAULT 1 COMMENT '0禁用 1启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 角色权限表（预留扩展）
CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(32) UNIQUE NOT NULL,
  permissions JSON COMMENT '权限编码列表',
  description VARCHAR(128)
);
```

### 5.2 SOP文档

```sql
-- 文档表
CREATE TABLE sop_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  doc_no VARCHAR(32) UNIQUE COMMENT '编号',
  title VARCHAR(128) NOT NULL,
  doc_type VARCHAR(32) COMMENT '文档类型',
  status ENUM('draft', 'completed') DEFAULT 'draft',
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  current_version INT DEFAULT 1,
  INDEX idx_created_by (created_by),
  INDEX idx_status (status)
);

-- 文档版本快照表（提交时自动备份）
CREATE TABLE sop_versions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  document_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  snapshot JSON NOT NULL COMMENT '完整文档JSON快照',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES sop_documents(id) ON DELETE CASCADE
);
```

### 5.3 操作步骤

```sql
-- 步骤表
CREATE TABLE sop_steps (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  document_id BIGINT NOT NULL,
  step_no INT NOT NULL COMMENT '序号',
  title VARCHAR(128),
  description TEXT COMMENT '原始文字描述',
  image_urls JSON COMMENT '图片MinIO地址列表',
  ai_optimized_desc TEXT COMMENT 'AI优化后的描述',
  optimization_type VARCHAR(32) COMMENT '本次优化类型记录',
  ai_model_id BIGINT COMMENT '使用的模型ID',
  status VARCHAR(32) DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES sop_documents(id) ON DELETE CASCADE,
  INDEX idx_document_step (document_id, step_no)
);
```

### 5.4 AI与系统配置

```sql
-- AI模型配置表
CREATE TABLE ai_models (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL COMMENT '显示名',
  provider VARCHAR(32) NOT NULL COMMENT '厂商标识',
  api_base_url VARCHAR(256) NOT NULL,
  api_key VARCHAR(512) NOT NULL COMMENT 'AES加密存储',
  model_name VARCHAR(64) NOT NULL,
  is_default TINYINT DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  capabilities JSON COMMENT '支持的功能标签',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 部门-格式映射表
CREATE TABLE department_formats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  department_code VARCHAR(32) UNIQUE NOT NULL,
  department_name VARCHAR(64) NOT NULL,
  available_formats JSON NOT NULL COMMENT '如["pdf","docx"]',
  default_format VARCHAR(16) NOT NULL DEFAULT 'pdf',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 导出模板表
CREATE TABLE export_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  format_type VARCHAR(16) NOT NULL,
  template_name VARCHAR(64) NOT NULL,
  template_content TEXT COMMENT '模板定义或文件路径',
  department_scope JSON COMMENT '适用部门列表',
  is_default TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.5 日志

```sql
-- 操作日志表
CREATE TABLE operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  action VARCHAR(32) NOT NULL COMMENT '操作类型',
  target_type VARCHAR(32) COMMENT '对象类型',
  target_id BIGINT COMMENT '对象ID',
  detail JSON COMMENT '详情',
  ip VARCHAR(64),
  user_agent VARCHAR(256),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_time (user_id, created_at),
  INDEX idx_action (action)
);

-- AI调用日志表
CREATE TABLE ai_call_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  step_id BIGINT NOT NULL,
  model_id BIGINT NOT NULL,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  latency_ms INT COMMENT '响应耗时',
  status VARCHAR(16) DEFAULT 'success',
  error_msg TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
);
```

### 5.6 关键设计决策

1. **图片存储**：步骤图片以JSON数组形式存储MinIO URL，支持多图和排序
2. **AI密钥加密**：`ai_models.api_key`使用AES-256加密，密钥通过环境变量`AES_KEY`注入
3. **版本快照**：每次提交时自动将完整文档数据以JSON形式备份至`sop_versions`，便于历史追溯
4. **日志预留扩展**：若操作日志写入量过大，后续可拆分至独立实例或对接ElasticSearch

---

## 6. 核心业务状态流与AI优化流程

### 6.1 SOP文档状态机

```
┌──────────┐    保存/更新     ┌──────────┐    提交      ┌──────────┐
│  新建文档  │───────────────▶│  草稿态   │───────────▶│ 已完成态  │
│ (无记录)  │                │ (可编辑)  │   校验通过   │ (只读+下载)│
└──────────┘                └──────────┘              └──────────┘
                                  │                        │
                                  │  删除                   │  查看
                                  ▼                        ▼
                             ┌──────────┐              ┌──────────┐
                             │  已删除   │              │  版本快照  │
                             └──────────┘              └──────────┘
```

**状态规则**：
- **草稿态**：可增删改步骤、可AI优化、可保存、可提交、可删除
- **已完成态**：所有字段锁定，不可编辑，不可AI优化，不可删除。仅可查看、下载、同步飞书
- **提交校验**：所有步骤必须有描述；至少存在一个步骤；文档名称和类型必填

### 6.2 单步骤AI优化交互流程

```
用户点击"AI优化"按钮
        │
        ▼
┌───────────────┐
│ 1. 弹出优化配置面板 │
│    - 选择AI模型（下拉，来自后台配置） │
│    - 选择优化类型：                    │
│      · 文字润色（修正语法、标准化术语）   │
│      · 图片理解补全（根据步骤图片生成/补充描述）│
│      · 规范检查点补充（根据行业模板补全安全/质检项）│
└───────────────┘
        │
        ▼
┌───────────────┐
│ 2. 组装Prompt + 上下文 │
│    - 注入文档类型、行业背景             │
│    - 注入当前步骤文字 + 图片URL         │
│    - 注入选择的优化类型指令              │
└───────────────┘
        │
        ▼
┌───────────────┐
│ 3. 调用Python AI服务 │
│    - 图片理解：先调多模态模型分析图片      │
│    - 文本优化：调文本模型整合输出          │
│    - 返回优化后的文字 + 修改建议标记       │
└───────────────┘
        │
        ▼
┌───────────────┐
│ 4. 用户确认界面 │
│    - 左右对比：原文 vs AI优化结果        │
│    - 用户可手动编辑AI结果               │
│    - 点击"采用"替换 / 点击"放弃"取消     │
└───────────────┘
        │
        ▼
┌───────────────┐
│ 5. 保存到步骤表 │
│    - 原描述保留在description            │
│    - AI结果存入ai_optimized_desc        │
│    - 记录使用的模型和优化类型             │
└───────────────┘
```

**关键约束**：
- AI优化是**步骤级别**的，非整篇文档批量处理，用户可逐条精细化控制
- 采用AI结果后仍可手动编辑`ai_optimized_desc`，直到满意再提交
- 提交时优先取`ai_optimized_desc`作为最终内容；若某步骤未AI优化，则取原`description`

### 6.3 提交与归档流程

用户点击"提交" → 完整性校验 → 状态改为"已完成" → 生成版本快照 → 触发导出文件预热（可选） → 异步触发飞书知识库同步

---

## 7. 导出与下载流程设计

### 7.1 导出模板体系

| 层级 | 说明 | 管理权限 |
|------|------|---------|
| 系统默认模板 | 每种格式内置一套默认排版 | 不可删除，超管可见 |
| 部门自定义模板 | 可为特定部门上传自定义模板 | 超管增删改 |

**支持格式**：
- **Markdown**：Jinja2模板，轻量，IT部门可直接阅读源码
- **Word(docx)**：基于`python-docx`按段落/表格渲染，支持上传`.docx`作为样式母版
- **PDF**：Word生成后转PDF，或HTML→WeasyPrint直出
- **Excel**：步骤清单表格化，适合运营/财务核查
- **PPT**：一页一步骤，适合培训演示

### 7.2 格式与部门权限控制

**默认配置**：
- IT部：默认Markdown，可用格式包括Markdown、Word、PDF
- 其余部门（财务、运营、人事、设计、管理）：默认PDF，超管可在后台调整各部的可用格式列表

用户在查看/下载页面的格式下拉框，仅显示其所属部门被授权的格式。

### 7.3 异步导出任务流程

```
用户选择格式 → 点击下载
        │
        ▼
   NestJS校验权限（部门+格式）
        │
        ▼
   创建export_tasks记录（status=pending）
        │
        ▼
   推送任务到Redis队列（document_id, format, user_id）
        │
        ▼
   ┌─────────────────────┐
   │ Python导出服务消费任务 │
   │ 1. 从NestJS API拉取完整文档数据 │
   │ 2. 加载对应格式模板              │
   │ 3. 渲染生成文件                  │
   │ 4. 上传文件到MinIO               │
   │ 5. 回调NestJS更新任务状态为done   │
   └─────────────────────┘
        │
        ▼
   前端轮询获取下载预签名URL
        │
        ▼
   浏览器触发下载
```

**性能考量**：
- 短文档（<20步）导出通常3秒内完成，前端轮询即可
- 长文档展示进度条，同一文档+版本+格式的结果缓存24小时
- 导出记录保留在`export_tasks`表，用户可在个人中心查看"最近下载"

---

## 8. 权限设计（RBAC）

### 8.1 角色定义

| 角色 | 权限范围 |
|------|---------|
| 超级管理员 | 全部权限：SOP文档的增删改查、AI模型配置、部门/格式映射配置、用户管理、查看操作日志、删除已完成文档 |
| 普通用户 | 新建/编辑/保存/提交自己的SOP文档、对步骤进行AI优化、下载已授权格式的文件、查看已完成文档。无法进入后台管理，无法查看操作日志 |

### 8.2 权限控制粒度

**前端**：根据角色动态渲染菜单和按钮
- 普通用户看不到"后台管理"入口
- 已完成文档的"编辑/AI优化/删除"按钮不渲染
- 超管才渲染"操作日志"菜单

**后端**：每个API附加`@Roles`或`@Permissions`装饰器
- `PUT /sop-documents/:id` → 仅草稿态且属主可操作
- `POST /admin/ai-models` → 仅super_admin
- `GET /admin/operation-logs` → 仅super_admin
- `DELETE /sop-documents/:id` → 仅super_admin可删除已完成文档

### 8.3 数据隔离规则

- 普通用户只能看到**自己创建**的文档列表
- 超级管理员可以看到**全部文档**列表，并能代为操作
- 飞书登录首次进入系统时，如用户不存在，**默认创建为普通用户**。超管需在后台手动提升角色或预导入超管名单

---

## 9. 飞书对接设计

### 9.1 飞书应用登录（API对接）

```
用户点击"飞书登录"
        │
        ▼
前端跳转飞书授权页
(GET https://open.feishu.cn/open-apis/authen/v1/index)
        │
        ▼
用户授权后跳转回调地址
携带 ?code=xxx
        │
        ▼
后端 /auth/feishu/callback
1. 用app_id + app_secret 调飞书接口换取 user_access_token
2. 用token调 /open-apis/contact/v3/users/me 获取用户信息
3. 根据 union_id 查找本地 users 表
   ├─ 存在 → 更新姓名/头像/部门，签发JWT
   └─ 不存在 → 创建普通用户，签发JWT
        │
        ▼
返回JWT给前端，登录成功
```

### 9.2 飞书知识库同步（已完成SOP）

```
SOP提交完成 → 状态变"已完成"
        │
        ▼
NestJS投递异步任务到Redis
        │
        ▼
后台Worker消费任务：
1. 将SOP内容渲染为富文本/HTML格式
2. 调飞书API创建文档并写入内容
   POST /open-apis/docx/v1/documents
   POST /open-apis/docx/v1/documents/{id}/blocks
3. （可选）移动至指定知识库目录
4. 回写 sync_record 到MySQL（记录飞书文档链接）
```

### 9.3 飞书配置项（后台超管配置）

| 配置项 | 说明 |
|--------|------|
| feishu_app_id | 飞书应用ID |
| feishu_app_secret | 飞书应用密钥 |
| feishu_redirect_uri | 登录回调地址 |
| knowledge_base_folder_token | 同步目标知识库文件夹Token |

---

## 10. 部署与运维架构

### 10.1 Docker Compose 编排

```yaml
version: '3.8'
services:
  nginx:
    image: nginx:stable
    ports: ["80:80"]
    volumes: [./nginx.conf:/etc/nginx/nginx.conf]
    depends_on: [sop-app]

  sop-app:
    build: .
    # 容器内Supervisor同时管理 NestJS + Python
    ports: ["3000:3000", "8000:8000"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://user:pass@mysql:3306/sop_db
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio:9000
      - AI_SERVICE_URL=http://localhost:8000
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - AES_KEY=${AES_KEY}
    volumes:
      - app-logs:/app/logs
    depends_on:
      mysql: { condition: service_healthy }
      redis: { condition: service_started }
      minio: { condition: service_started }

  mysql:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=sop_db
    volumes:
      - mysql-data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes: [redis-data:/data]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
    volumes: [minio-data:/data]
    ports: ["9000:9000", "9001:9001"]

volumes:
  mysql-data:
  redis-data:
  minio-data:
  app-logs:
```

### 10.2 单镜像多进程实现

通过Supervisor在一个容器内管理两个服务：

```ini
; supervisord.conf
[program:nestjs]
command=node /app/web/server/main.js
autorestart=true
stdout_logfile=/app/logs/nestjs.log

[program:python]
command=/opt/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
autorestart=true
stdout_logfile=/app/logs/python.log
```

### 10.3 持久化与备份

| 存储 | 位置 | 备份策略 |
|------|------|---------|
| MySQL数据 | Docker Volume `mysql-data` | 每日全量mysqldump |
| MinIO文件 | Docker Volume `minio-data` | 与MySQL备份同步 |
| 应用日志 | Docker Volume `app-logs` | 7天滚动清理 |

### 10.4 初始化流程

首次启动时执行：
1. 创建数据库表结构（TypeORM migrations或init.sql）
2. 插入默认系统数据：超管账号（需手动配置飞书union_id）、默认AI模型占位、部门-格式默认映射
3. 创建MinIO bucket并设置公开读策略

---

## 11. 核心API概览

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 认证 | GET | `/auth/feishu/callback` | 飞书登录回调 |
| 文档 | GET | `/sop-documents` | 文档列表（支持状态筛选） |
| 文档 | POST | `/sop-documents` | 新建文档 |
| 文档 | GET | `/sop-documents/:id` | 文档详情 |
| 文档 | PUT | `/sop-documents/:id` | 更新文档基础信息 |
| 文档 | POST | `/sop-documents/:id/submit` | 提交完成 |
| 步骤 | POST | `/sop-documents/:id/steps` | 新增步骤 |
| 步骤 | PUT | `/steps/:id` | 更新步骤 |
| 步骤 | POST | `/steps/:id/ai-optimize` | AI优化步骤 |
| 导出 | POST | `/exports` | 创建导出任务 |
| 导出 | GET | `/exports/:id/status` | 查询导出进度 |
| 后台 | CRUD | `/admin/ai-models` | AI模型配置 |
| 后台 | GET/PUT | `/admin/department-formats` | 部门格式映射 |
| 后台 | GET | `/admin/operation-logs` | 操作日志（超管） |
| 系统 | GET | `/health` | 健康检查 |

---

## 12. 风险与后续扩展建议

| 风险点 | 缓解措施 |
|--------|---------|
| AI服务响应慢/失败 | 设置30秒超时、失败降级返回原文、记录日志供排查 |
| AI密钥泄露 | AES加密存储、不在日志中打印密钥、环境变量注入 |
| 导出任务堆积 | Redis队列限流、Python服务可水平扩容、大文件分片生成 |
| 飞书API限流 | 异步任务重试机制（指数退避）、失败任务进入死信队列 |

**后续可扩展**：
- 操作日志对接ElasticSearch实现全文检索
- AI优化支持流式输出（SSE）提升体验
- 文档协作编辑（WebSocket实时同步）
- SOP审批工作流（如需）

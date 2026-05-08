# SOP流程优化系统

基于AI的SOP（标准作业程序）文档创建、优化与管理系统。支持步骤级AI优化、多格式导出与免登录使用。

## 功能特性

- **SOP文档管理**：新建、编辑、提交归档、版本快照
- **步骤级AI优化**：文字润色、图片理解补全、规范检查点补充
- **多格式导出**：Markdown、Word、PDF、Excel、PPT，按部门权限控制
- **免登录使用**：打开页面即可创建/编辑SOP文档，无需任何登录操作
- **前台系统配置**：AI模型配置、部门格式映射、管理员账号，全部通过前端页面完成
- **后台管理**：用户角色管理、操作日志（需超级管理员登录）
- **权限控制**：超级管理员与普通用户双角色体系，后台管理受JWT保护

## 技术架构

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Ant Design + TypeScript |
| 业务后端 | NestJS (Node.js) + TypeScript + SQLite |
| AI服务 | Python + FastAPI |
| 数据库 | SQLite（单文件，零配置） |
| 文件存储 | 本地文件系统 |
| 部署 | Docker + Docker Compose（单容器） |

## 快速开始

```bash
# 1. 克隆项目
git clone <repo-url>
cd sop-system

# 2. 构建并启动（一条命令）
docker compose build
docker compose up -d

# 3. 访问系统
# 打开 http://localhost
# 首次使用：页面可直接操作，建议进入"系统配置"设置AI模型和管理员账号
```

详细部署文档请参见 [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)。

## 使用说明

### 首次使用
1. 打开 `http://localhost`，即可直接创建/编辑 SOP 文档
2. 点击侧边栏"系统配置"，添加 AI 模型（用于AI优化功能）
3. 在"系统配置"中初始化超级管理员账号（用于访问后台管理）
4. 配置完成后，可使用"管理员登录"进入后台管理页面

### 日常操作
- **文档中心**：查看、创建、编辑、删除 SOP 文档
- **系统配置**：配置AI模型、部门导出格式（无需登录）
- **后台管理**：用户管理、操作日志（需超级管理员登录）

## 项目结构

```
.
├── docker-compose.yml          # Docker编排（单服务）
├── Dockerfile                  # 单容器镜像构建
├── supervisord.conf            # 进程管理配置
├── backend/                    # NestJS后端
│   ├── src/
│   │   ├── auth/               # 认证模块（支持匿名会话）
│   │   ├── sop/                # SOP文档与步骤管理
│   │   ├── ai-model/           # AI模型配置
│   │   ├── export/             # 导出任务管理
│   │   ├── admin/              # 后台管理
│   │   ├── setup/              # 系统初始化
│   │   ├── common/             # 公共模块（内存缓存、本地存储）
│   │   └── log/                # 操作日志
│   └── package.json
├── frontend/                   # React前端
│   └── src/
│       ├── pages/              # 页面组件
│       │   ├── SetupWizard.tsx # 系统配置页面
│       │   └── ...
│       ├── components/         # 公共组件
│       └── services/           # API服务
├── ai-service/                 # Python AI服务
│   ├── app/
│   │   ├── routers/            # API路由
│   │   └── core/exporters/     # 导出引擎
│   └── main.py
└── deploy/
    └── DEPLOYMENT.md           # 部署文档
```

## 数据持久化

系统数据通过 Docker Volume 挂载到宿主机：

| 路径 | 内容 |
|------|------|
| `./data/sop.db` | SQLite 数据库文件 |
| `./data/uploads/` | 上传的文件/图片 |
| `./logs/` | 运行日志 |

**备份：**
```bash
# 备份数据库
cp ./data/sop.db ./backup/sop_$(date +%Y%m%d).db

# 备份上传文件
tar czvf ./backup/uploads_$(date +%Y%m%d).tar.gz ./data/uploads/
```

## 许可证

MIT

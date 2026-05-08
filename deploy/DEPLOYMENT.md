# SOP流程优化系统 — 部署文档

## 1. 环境要求

### 1.1 硬件要求

| 组件 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2核 | 4核及以上 |
| 内存 | 4GB | 8GB及以上 |
| 磁盘 | 50GB SSD | 100GB SSD |
| 网络 | 公网IP或内网可达 | 稳定带宽 |

### 1.2 软件环境

- **操作系统**: Ubuntu 20.04 LTS / 22.04 LTS / CentOS 7+ / Debian 11+ / Windows (WSL2)
- **Docker**: 24.0.0+
- **Docker Compose**: v2.20.0+

### 1.3 检查Docker安装

```bash
docker --version
docker compose version
```

如未安装，参考 [Docker官方文档](https://docs.docker.com/engine/install/) 进行安装。

---

## 2. 项目部署

### 2.1 获取代码

```bash
# 创建应用目录
mkdir -p /opt/sop-system
cd /opt/sop-system

# 克隆代码（或上传代码包）
git clone <your-repo-url> .
# 或者通过scp上传代码压缩包后解压
```

### 2.2 目录结构说明

```
/opt/sop-system/
├── docker-compose.yml      # Docker编排文件
├── Dockerfile              # 应用镜像构建文件
├── supervisord.conf        # Supervisor进程管理配置
├── backend/                # NestJS后端源码
├── frontend/               # React前端源码
└── ai-service/             # Python AI服务
```

### 2.3 构建并启动服务

```bash
cd /opt/sop-system

# 构建Docker镜像（首次构建可能需要5-10分钟）
docker compose build

# 后台启动服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 2.4 验证服务启动

```bash
# 查看容器状态
docker compose ps

# 预期输出示例：
# NAME                IMAGE               STATUS              PORTS
# sop-system          sop-system-sop      Up 2 minutes        0.0.0.0:80->3000/tcp
```

**访问测试：**
- 前端页面：`http://your-server-ip`
- 后端API：`http://your-server-ip/api/health`
- AI服务：`http://your-server-ip/ai/`（内部代理，无需直接访问）

---

## 3. 初始化配置

### 3.1 首次使用

系统启动后即可直接使用，无需任何配置：

1. 打开 `http://your-server-ip`
2. 页面顶部可能显示提示："系统尚未初始化"，点击"前往配置"
3. 在"系统配置"页面中：
   - **添加AI模型**：填写名称、提供商、API地址、API Key、模型名称
   - **初始化管理员账号**：设置超级管理员用户名和密码

### 3.2 配置AI模型

在"系统配置" -> "AI模型配置"中：

| 字段 | 说明 | 示例 |
|------|------|------|
| 名称 | 显示名称 | "Kimi" |
| 提供商 | 模型厂商 | moonshot / openai / deepseek |
| 模型名称 | 实际调用的模型ID | moonshot-v1-8k / gpt-4 |
| API地址 | Base URL | https://api.moonshot.cn/v1 |
| API Key | 从厂商平台获取的密钥 | sk-... |

### 3.3 配置部门导出格式

在"系统配置" -> "部门格式配置"中：
- 系统已预置财务、运营、人事、设计、管理、IT六个部门
- 可按需调整各部门的可用格式列表

### 3.4 后台管理登录

使用初始化时设置的管理员账号登录：
- 点击右上角"管理员登录"
- 进入"后台管理"可查看用户管理、操作日志

---

## 4. 数据持久化

系统数据存储在宿主机目录，通过 Docker Volume 挂载：

```yaml
volumes:
  - ./data:/app/data    # SQLite数据库 + 上传文件
  - ./logs:/app/logs    # 运行日志
```

| 数据类型 | 宿主机路径 | 说明 |
|---------|-----------|------|
| 业务数据 | `./data/sop.db` | SQLite单文件数据库 |
| 上传文件 | `./data/uploads/` | 图片、导出文件等 |
| 日志 | `./logs/` | NestJS和Python服务日志 |

---

## 5. 日常运维

### 5.1 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看最近100行日志
docker compose logs --tail=100

# 查看实时日志
docker compose logs -f --tail=20
```

### 5.2 重启服务

```bash
# 重启所有服务
docker compose restart

# 停止并重新启动
docker compose down
docker compose up -d
```

### 5.3 更新部署

```bash
cd /opt/sop-system

# 拉取最新代码
git pull origin main

# 重新构建并启动
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 5.4 数据备份

**SQLite数据库备份：**

```bash
# 创建备份目录
mkdir -p /opt/sop-backup

# 执行备份（建议加入crontab定时任务）
cp /opt/sop-system/data/sop.db /opt/sop-backup/sop_$(date +%Y%m%d_%H%M%S).db

# 备份上传文件
tar czvf /opt/sop-backup/uploads_$(date +%Y%m%d_%H%M%S).tar.gz /opt/sop-system/data/uploads/
```

**设置每日自动备份（crontab）：**

```bash
sudo crontab -e

# 添加以下行（每天凌晨2点备份）
0 2 * * * cp /opt/sop-system/data/sop.db /opt/sop-backup/sop_$(date +\%Y\%m\%d).db 2>> /opt/sop-backup/backup.log
0 2 * * * find /opt/sop-backup -name "sop_*.db" -mtime +7 -delete
```

### 5.5 数据恢复

```bash
# 停止应用
docker compose down

# 恢复SQLite数据库
cp /opt/sop-backup/sop_20240101_020000.db /opt/sop-system/data/sop.db

# 启动所有服务
docker compose up -d
```

---

## 6. 常见问题排查

### 6.1 端口占用

```bash
# 检查端口占用
sudo netstat -tlnp | grep -E '80|3000'

# 如需修改端口，编辑 docker-compose.yml：
ports:
  - "8080:3000"    # 将80改为8080
```

### 6.2 中文乱码

系统镜像已内置 `fonts-noto-cjk` 中文字体。如仍出现乱码：

```bash
# 检查字体是否安装
docker compose exec sop fc-list :lang=zh

# 如未安装，重新构建镜像
docker compose build --no-cache
docker compose up -d
```

### 6.3 数据库问题

```bash
# 检查SQLite数据库文件是否存在
ls -la ./data/sop.db

# 查看数据库大小
du -sh ./data/sop.db
```

### 6.4 登录失败

1. 确认已在"系统配置"中初始化管理员账号
2. 检查用户名和密码是否正确
3. 查看后端日志：`docker compose logs --tail=50`

### 6.5 AI优化无响应

```bash
# 检查Python AI服务状态
docker compose logs --tail=50 | grep python

# 测试AI服务连通性
curl http://localhost/api/setup/status

# 检查模型配置中的API地址和密钥是否正确
```

### 6.6 导出文件失败

```bash
# 检查上传目录权限
ls -la ./data/uploads/

# 检查导出任务状态
# 在浏览器中打开系统，进入"系统配置"查看AI模型是否正常配置
```

---

## 7. 安全配置建议

### 7.1 配置HTTPS（生产环境必需）

如果需要在生产环境使用，建议在前置Nginx或负载均衡器上配置HTTPS。系统本身只暴露3000端口。

```bash
# 使用Nginx反向代理（在Docker外部或另一个容器中）
# nginx.conf 示例：
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 7.2 防火墙配置

```bash
# Ubuntu/Debian (UFW)
sudo ufw default deny incoming
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 7.3 定期更新镜像

```bash
# 更新基础镜像
docker compose pull
docker compose up -d
```

---

## 8. 卸载清理

如需完全卸载系统：

```bash
cd /opt/sop-system

# 停止并删除容器
docker compose down

# 如需删除数据（谨慎操作）
rm -rf ./data ./logs

# 删除项目目录
sudo rm -rf /opt/sop-system

# 如需删除Docker镜像
docker rmi sop-system-sop
```

**注意：** 删除 `./data` 目录将永久删除SQLite数据库和上传文件。如需保留数据，请先执行备份。

---

## 9. 联系与支持

部署过程中如遇问题，请检查以下日志定位原因：

```bash
# 一键收集所有日志
docker compose logs > /tmp/sop-system-logs.txt 2>&1
```

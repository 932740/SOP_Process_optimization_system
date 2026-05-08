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
    libsqlite3-dev \
    python3 \
    make \
    g++ \
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
COPY --from=backend-builder /app/backend/package*.json /app/backend/
RUN cd /app/backend && npm install

COPY ai-service/ /app/ai-service
COPY ai-service/requirements.txt /app/requirements.txt
RUN python3.11 -m pip install --no-cache-dir -r /app/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create data and log directories
RUN mkdir -p /app/data/uploads /app/logs

EXPOSE 3000

CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

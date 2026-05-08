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

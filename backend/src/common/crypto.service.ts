import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class CryptoService {
  private key: string;

  constructor(private configService: ConfigService) {
    this.key = this.configService.get('AES_KEY') || 'default_key_32_bytes_for_dev_only!';
  }

  encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.key).toString();
  }

  decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

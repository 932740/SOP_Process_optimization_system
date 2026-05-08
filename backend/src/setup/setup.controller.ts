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

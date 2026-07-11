// src/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok';
  timestamp: string;
  environment: string;
  uptime: number;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Health check endpoint',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-07-11T12:00:00.000Z',
        environment: 'production',
        uptime: 123.45,
      },
    },
  })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    };
  }
}

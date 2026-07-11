// src/modules/audits/audit.module.ts

import {
  Global,
  Module,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
    ]),
  ],
  controllers: [
    AuditController,
  ],
  providers: [
    AuditService,
    {
      provide:
        APP_INTERCEPTOR,
      useClass:
        AuditInterceptor,
    },
  ],
  exports: [
    AuditService,
  ],
})
export class AuditModule {}
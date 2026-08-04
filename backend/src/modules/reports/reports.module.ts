// src/modules/reports/reports.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Container } from '../containers/entities/container.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Container])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

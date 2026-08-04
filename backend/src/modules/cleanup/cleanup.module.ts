// src/modules/cleanup/cleanup.module.ts

import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { ContainersModule } from '../containers/containers.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [ContainersModule, ItemsModule],
  providers: [CleanupService],
})
export class CleanupModule {}

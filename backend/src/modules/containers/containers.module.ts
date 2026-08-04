// src/modules/containers/containers.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';
import { Container } from './entities/container.entity';
import { Item } from '../items/entities/item.entity';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([Container, Item]), FilesModule],
  controllers: [ContainersController],
  providers: [ContainersService],
  exports: [ContainersService],
})
export class ContainersModule {}

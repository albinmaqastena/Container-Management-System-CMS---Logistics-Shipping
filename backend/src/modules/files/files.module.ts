// src/modules/files/files.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import fileConfig from '../../config/file.config';

@Module({
  imports: [ConfigModule.forFeature(fileConfig)],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

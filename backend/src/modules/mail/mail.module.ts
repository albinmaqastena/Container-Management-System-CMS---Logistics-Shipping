// src/modules/mail/mail.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MailService } from './mail.service';
import mailConfig from '../../config/mail.config';
import appConfig from '../../config/app.config';

@Module({
  imports: [ConfigModule.forFeature(mailConfig), ConfigModule.forFeature(appConfig)],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

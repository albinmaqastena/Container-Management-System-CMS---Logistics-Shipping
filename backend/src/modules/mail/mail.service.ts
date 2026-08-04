// src/modules/mail/mail.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly frontendUrl: URL;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.getOrThrow<string>('mail.from');
    this.frontendUrl = new URL(this.configService.getOrThrow<string>('app.frontendUrl'));

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('mail.host'),
      port: this.configService.get<number>('mail.port', 587),
      secure: this.configService.get<boolean>('mail.secure', false),
      auth: {
        user: this.configService.getOrThrow<string>('mail.user'),
        pass: this.configService.getOrThrow<string>('mail.password'),
      },
      connectionTimeout: this.configService.get<number>('mail.connectionTimeout', 10_000),
      greetingTimeout: this.configService.get<number>('mail.greetingTimeout', 10_000),
      socketTimeout: this.configService.get<number>('mail.socketTimeout', 20_000),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP transporter verified');
    } catch (error: unknown) {
      this.logger.error(
        'SMTP verification failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = new URL('/reset-password', this.frontendUrl);
    resetUrl.searchParams.set('token', token);

    const mailOptions: SendMailOptions = {
      from: this.fromAddress,
      to: email,
      subject: 'Reset your password',
      text: [
        'A password reset was requested for your account.',
        `Reset your password using this link: ${resetUrl.toString()}`,
        'This link expires in one hour.',
        'If you did not request this reset, you can ignore this email.',
      ].join('\n\n'),
      html: `
        <p>A password reset was requested for your account.</p>
        <p><a href="${resetUrl.toString()}">Reset your password</a></p>
        <p>This link expires in one hour.</p>
        <p>If you did not request this reset, you can ignore this email.</p>
      `,
    };

    const maskedEmail = this.maskEmail(email);

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${maskedEmail}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send password reset email to ${maskedEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private maskEmail(email: string): string {
    const firstAtIndex = email.indexOf('@');
    const lastAtIndex = email.lastIndexOf('@');

    if (firstAtIndex <= 0 || firstAtIndex !== lastAtIndex || lastAtIndex === email.length - 1) {
      return '[invalid-email]';
    }

    const localPart = email.slice(0, lastAtIndex);
    const domain = email.slice(lastAtIndex + 1);

    const maskedLocal =
      localPart.length <= 2 ? `${localPart[0] ?? '*'}***` : `${localPart.slice(0, 2)}***`;

    return `${maskedLocal}@${domain}`;
  }
}

// src/modules/mail/mail.service.spec.ts
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';

import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;
  let configService: jest.Mocked<ConfigService>;
  let mockTransporter: {
    verify: jest.Mock;
    sendMail: jest.Mock;
  };
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const mockConfig = {
    'mail.from': 'noreply@example.com',
    'app.frontendUrl': 'https://app.example.com',
    'mail.host': 'smtp.example.com',
    'mail.port': 587,
    'mail.secure': false,
    'mail.user': 'user',
    'mail.password': 'pass',
    'mail.connectionTimeout': 10000,
    'mail.greetingTimeout': 10000,
    'mail.socketTimeout': 20000,
  };

  beforeEach(async () => {
    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key in mockConfig) {
          const value = mockConfig[key as keyof typeof mockConfig];
          return value ?? defaultValue;
        }
        return defaultValue;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key in mockConfig) {
          const value = mockConfig[key as keyof typeof mockConfig];
          if (value === undefined) {
            throw new Error(`Missing config: ${key}`);
          }
          return value;
        }
        throw new Error(`Missing config: ${key}`);
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);

    // Spy on logger methods and suppress output
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create transporter with config values', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user',
          pass: 'pass',
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
    });

    it('should use default timeout values when not provided', () => {
      const configServiceWithoutTimeouts = {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'mail.port') return 587;
          if (key === 'mail.secure') return false;
          return defaultValue;
        }),
        getOrThrow: jest.fn((key: string) => {
          const requiredConfig: Record<string, string> = {
            'mail.from': 'noreply@example.com',
            'app.frontendUrl': 'https://app.example.com',
            'mail.host': 'smtp.example.com',
            'mail.user': 'user',
            'mail.password': 'pass',
          };
          const value = requiredConfig[key];
          if (value === undefined) {
            throw new Error(`Missing config: ${key}`);
          }
          return value;
        }),
      } as unknown as ConfigService;

      (nodemailer.createTransport as jest.Mock).mockClear();

      // Instantiate the service directly to test constructor behavior
      new MailService(configServiceWithoutTimeouts);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        }),
      );
    });

    it('should throw when frontend URL is invalid', () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app.frontendUrl') {
          return 'invalid-url';
        }
        const value = mockConfig[key as keyof typeof mockConfig];
        if (value === undefined) {
          throw new Error(`Missing config: ${key}`);
        }
        return value;
      });

      expect(() => new MailService(configService)).toThrow('Invalid URL');
    });

    it('should throw when required SMTP configuration is missing', () => {
      const createTransportMock = nodemailer.createTransport as jest.Mock;
      createTransportMock.mockClear();

      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'mail.host') {
          throw new Error('Missing config: mail.host');
        }
        return mockConfig[key as keyof typeof mockConfig];
      });

      expect(() => new MailService(configService)).toThrow('Missing config: mail.host');
      expect(createTransportMock).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should verify transporter and log success', async () => {
      await service.onModuleInit();

      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
      expect(loggerLogSpy).toHaveBeenCalledWith('SMTP transporter verified');
    });

    it('should log error and throw when verification fails', async () => {
      const verifyError = new Error('SMTP connection refused');
      mockTransporter.verify.mockRejectedValueOnce(verifyError);

      await expect(service.onModuleInit()).rejects.toBe(verifyError);

      expect(loggerErrorSpy).toHaveBeenCalledWith('SMTP verification failed', verifyError.stack);
    });
  });

  describe('sendPasswordResetEmail', () => {
    const email = 'test@example.com';
    const token = 'abc123token';

    it('should send email with correct options and log masked email', async () => {
      await service.sendPasswordResetEmail(email, token);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const callArgs = mockTransporter.sendMail.mock.calls[0]?.[0] as
        nodemailer.SendMailOptions | undefined;

      if (!callArgs) {
        throw new Error('Expected sendMail to be called with mail options');
      }

      expect(callArgs.from).toBe('noreply@example.com');
      expect(callArgs.to).toBe(email);
      expect(callArgs.subject).toBe('Reset your password');

      if (typeof callArgs.text !== 'string') {
        throw new Error('Expected text body to be a string');
      }

      if (typeof callArgs.html !== 'string') {
        throw new Error('Expected HTML body to be a string');
      }

      const text = callArgs.text;
      const html = callArgs.html;

      expect(text).toContain('Reset your password using this link');
      expect(text).toContain('https://app.example.com/reset-password?token=abc123token');
      expect(html).toContain('<a href="https://app.example.com/reset-password?token=abc123token">');
      expect(html).toContain('This link expires in one hour');

      expect(loggerLogSpy).toHaveBeenCalledWith('Password reset email sent to te***@example.com');
    });

    it('should safely encode the reset token in the URL', async () => {
      const specialToken = 'abc+123&next=/admin';

      await service.sendPasswordResetEmail(email, specialToken);

      const mailOptions = mockTransporter.sendMail.mock.calls[0]?.[0] as
        nodemailer.SendMailOptions | undefined;

      if (!mailOptions) {
        throw new Error('Expected sendMail to be called with mail options');
      }

      const resetUrl = new URL('/reset-password', 'https://app.example.com');
      resetUrl.searchParams.set('token', specialToken);

      if (typeof mailOptions.text !== 'string') {
        throw new Error('Expected text body to be a string');
      }

      if (typeof mailOptions.html !== 'string') {
        throw new Error('Expected HTML body to be a string');
      }

      const text = mailOptions.text;
      const html = mailOptions.html;

      expect(text).toContain(resetUrl.toString());
      expect(html).toContain(resetUrl.toString());
    });

    it('should not expose the token or full email in logs', async () => {
      const sensitiveToken = 'sensitive-reset-token';

      await service.sendPasswordResetEmail(email, sensitiveToken);

      const serializedLogs = JSON.stringify(loggerLogSpy.mock.calls);

      expect(serializedLogs).not.toContain(sensitiveToken);
      expect(serializedLogs).not.toContain(email);
      expect(serializedLogs).toContain('te***@example.com');
    });

    it('should log error and rethrow when sendMail fails', async () => {
      const sendError = new Error('SMTP send failed');
      mockTransporter.sendMail.mockRejectedValueOnce(sendError);

      await expect(service.sendPasswordResetEmail(email, token)).rejects.toBe(sendError);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to send password reset email to te***@example.com',
        sendError.stack,
      );
    });
  });

  describe('maskEmail', () => {
    const getServiceWithMask = (): {
      maskEmail(email: string): string;
    } =>
      service as unknown as {
        maskEmail(email: string): string;
      };

    it('should mask a normal email', () => {
      expect(getServiceWithMask().maskEmail('test@example.com')).toBe('te***@example.com');
    });

    it('should mask a short local part (2 chars)', () => {
      expect(getServiceWithMask().maskEmail('ab@example.com')).toBe('a***@example.com');
    });

    it('should mask a very short local part (1 char)', () => {
      expect(getServiceWithMask().maskEmail('a@example.com')).toBe('a***@example.com');
    });

    it('should return invalid-email for email without @', () => {
      expect(getServiceWithMask().maskEmail('invalid')).toBe('[invalid-email]');
    });

    it('should return invalid-email for email starting with @', () => {
      expect(getServiceWithMask().maskEmail('@example.com')).toBe('[invalid-email]');
    });

    it('should return invalid-email for email ending with @', () => {
      expect(getServiceWithMask().maskEmail('test@')).toBe('[invalid-email]');
    });

    it('should reject an email with multiple @ symbols', () => {
      expect(getServiceWithMask().maskEmail('test@sub@example.com')).toBe('[invalid-email]');
    });
  });
});

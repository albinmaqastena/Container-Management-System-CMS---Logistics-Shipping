// src/main.ts

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import * as dotenv from 'dotenv';
import type { Response } from 'express';
import * as fs from 'fs';
import helmet from 'helmet';
import { join } from 'path';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

dotenv.config();

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const configService = new ConfigService();
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const port = configService.get<number>('PORT', 3000);
  const frontendUrls = configService
    .get<string>('FRONTEND_URLS', 'http://localhost:3001')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  bootstrapLogger.log('Starting Container Management System');
  bootstrapLogger.log(`NODE_ENV: ${nodeEnv}`);
  bootstrapLogger.log(`Port: ${port}`);
  bootstrapLogger.log(`Database: ${configService.get<string>('DB_DATABASE', 'unknown')}`);

  const app = await createApplication(configService, isProduction);

  app.set('trust proxy', true);

  const uploadsPath = join(process.cwd(), 'uploads');

  if (fs.existsSync(uploadsPath)) {
    app.useStaticAssets(uploadsPath, {
      prefix: '/uploads/',
      setHeaders: (response: Response) => {
        response.setHeader('Cache-Control', 'public, max-age=31536000');
      },
    });
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      frameguard: {
        action: 'deny',
      },
      noSniff: true,
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    }),
  );

  app.use(compression());

  app.enableCors({
    origin: isProduction ? frontendUrls : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  if (!isProduction) {
    configureSwagger(app, port);
  }

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  bootstrapLogger.log(`Application is running on http://localhost:${port}`);
  bootstrapLogger.log(`Environment: ${nodeEnv}`);
}

async function createApplication(
  configService: ConfigService,
  isProduction: boolean,
): Promise<NestExpressApplication> {
  if (!isProduction) {
    return NestFactory.create<NestExpressApplication>(AppModule);
  }

  const sslKeyPath = configService.get<string>('SSL_KEY_PATH', './certs/key.pem');
  const sslCertPath = configService.get<string>('SSL_CERT_PATH', './certs/cert.pem');

  if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
    bootstrapLogger.warn('SSL certificates not found. Falling back to HTTP.');

    return NestFactory.create<NestExpressApplication>(AppModule);
  }

  const httpsOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };

  bootstrapLogger.log('HTTPS enabled');

  return NestFactory.create<NestExpressApplication>(AppModule, { httpsOptions });
}

function configureSwagger(app: NestExpressApplication, port: number): void {
  const config = new DocumentBuilder()
    .setTitle('Container Management System API')
    .setDescription('API for authentication, containers, items, files and audit logs.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Login, register, refresh and logout')
    .addTag('Containers', 'Container management operations')
    .addTag('Items', 'Item management operations')
    .addTag('Files', 'File upload operations')
    .addTag('Audit Logs', 'Audit log operations')
    .addTag('Health', 'Health check endpoint')
    .addServer(`http://localhost:${port}`, 'Development Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      operationsSorter: 'alpha',
      tagsSorter: 'alpha',
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
    },
  });

  bootstrapLogger.log(`Swagger UI: http://localhost:${port}/api-docs`);
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : 'Unknown bootstrap error';

  bootstrapLogger.error(message);
  process.exitCode = 1;
});

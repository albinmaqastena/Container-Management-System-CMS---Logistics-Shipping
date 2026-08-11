// src/main.ts

import {
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import compression from 'compression';
import * as dotenv from 'dotenv';
import helmet from 'helmet';

import { AppModule } from './app.module';

import {
  HttpExceptionFilter,
} from './common/filters/http-exception.filter';

dotenv.config();

const bootstrapLogger =
  new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const configService =
    new ConfigService();

  const nodeEnv =
    configService.get<string>(
      'NODE_ENV',
      'development',
    );

  const isProduction =
    nodeEnv === 'production';

  // Railway injects PORT automatically.
  const port =
    configService.get<number>(
      'PORT',
      3000,
    );

  // ================================================================
  // FRONTEND ORIGINS
  // ================================================================

  const frontendUrls =
    configService
      .get<string>(
        'FRONTEND_URLS',
        'http://localhost:3001',
      )
      .split(',')
      .map((url) =>
        url
          .trim()
          .replace(/\/$/, ''),
      )
      .filter(Boolean);

  // ================================================================
  // BOOTSTRAP LOGGING
  // ================================================================

  bootstrapLogger.log(
    'Starting Container Management System',
  );

  bootstrapLogger.log(
    `NODE_ENV: ${nodeEnv}`,
  );

  bootstrapLogger.log(
    `Port: ${port}`,
  );

  bootstrapLogger.log(
    `Database: ${configService.get<string>(
      'DB_DATABASE',
      'unknown',
    )}`,
  );

  bootstrapLogger.log(
    `Allowed frontend origins: ${
      frontendUrls.join(', ') ||
      'none'
    }`,
  );

  // ================================================================
  // CREATE APPLICATION
  //
  // Railway terminates HTTPS before forwarding requests
  // to the NestJS application.
  // ================================================================

  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    );

  // Railway runs behind a reverse proxy.
  app.set(
    'trust proxy',
    true,
  );

  // ================================================================
  // SECURITY HEADERS
  // ================================================================

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [
            "'self'",
          ],

          styleSrc: [
            "'self'",
            "'unsafe-inline'",
          ],

          imgSrc: [
            "'self'",
            'data:',
            'https:',
          ],

          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
          ],

          connectSrc: [
            "'self'",
            'https:',
          ],
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
        policy:
          'strict-origin-when-cross-origin',
      },
    }),
  );

  // ================================================================
  // COMPRESSION
  // ================================================================

  app.use(
    compression(),
  );

  // ================================================================
  // CORS
  // ================================================================

  app.enableCors({
    origin: (
      origin,
      callback,
    ) => {
      /*
       * Requests pa Origin mund të jenë:
       * - Railway health checks
       * - curl
       * - server-to-server requests
       * - tools lokale
       */
      if (!origin) {
        callback(
          null,
          true,
        );

        return;
      }

      const normalizedOrigin =
        origin
          .trim()
          .replace(/\/$/, '');

      /*
       * Në development lejojmë origin-et.
       */
      if (!isProduction) {
        callback(
          null,
          true,
        );

        return;
      }

      /*
       * Në production lejohen vetëm
       * origin-et e FRONTEND_URLS.
       */
      if (
        frontendUrls.includes(
          normalizedOrigin,
        )
      ) {
        callback(
          null,
          true,
        );

        return;
      }

      bootstrapLogger.warn(
        `Blocked CORS origin: ${normalizedOrigin}`,
      );

      callback(
        new Error(
          `Origin ${normalizedOrigin} is not allowed by CORS`,
        ),
        false,
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],

    exposedHeaders: [
      'Content-Range',
      'X-Content-Range',
      'Content-Disposition',
    ],

    maxAge: 86400,

    optionsSuccessStatus: 204,
  });

  // ================================================================
  // GLOBAL VALIDATION
  // ================================================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      transform: true,

      forbidNonWhitelisted:
        true,

      transformOptions: {
        enableImplicitConversion:
          true,
      },
    }),
  );

  // ================================================================
  // GLOBAL ERROR FILTER
  // ================================================================

  app.useGlobalFilters(
    new HttpExceptionFilter(),
  );

  // ================================================================
  // API VERSIONING
  //
  // Endpoints:
  // /v1/auth/login
  // /v1/containers
  // /v1/items
  // ...
  // ================================================================

  app.enableVersioning({
    type:
      VersioningType.URI,

    defaultVersion:
      '1',
  });

  // ================================================================
  // SWAGGER
  //
  // Development:
  // enabled automatically.
  //
  // Production:
  // enable with:
  // SWAGGER_ENABLED=true
  // ================================================================

  const swaggerEnabled =
    !isProduction ||
    configService.get<string>(
      'SWAGGER_ENABLED',
      'false',
    ) === 'true';

  if (swaggerEnabled) {
    configureSwagger(
      app,
      port,
      isProduction,
    );
  }

  // ================================================================
  // SHUTDOWN
  // ================================================================

  app.enableShutdownHooks();

  // ================================================================
  // START SERVER
  //
  // Railway needs the application to listen on all interfaces.
  // ================================================================

  await app.listen(
    port,
    '0.0.0.0',
  );

  bootstrapLogger.log(
    `Application started on port ${port}`,
  );

  bootstrapLogger.log(
    `Environment: ${nodeEnv}`,
  );

  if (swaggerEnabled) {
    bootstrapLogger.log(
      'Swagger is enabled',
    );
  }
}

// ==================================================================
// SWAGGER
// ==================================================================

function configureSwagger(
  app: NestExpressApplication,
  port: number,
  isProduction: boolean,
): void {
  const builder =
    new DocumentBuilder()
      .setTitle(
        'Container Management System API',
      )
      .setDescription(
        'API for authentication, containers, items, files, reports and audit logs.',
      )
      .setVersion(
        '1.0',
      )
      .addBearerAuth(
        {
          type: 'http',

          scheme: 'bearer',

          bearerFormat:
            'JWT',

          name:
            'Authorization',

          description:
            'Enter your JWT access token',

          in:
            'header',
        },

        'JWT-auth',
      )
      .addTag(
        'Authentication',
        'Login, register, refresh and logout',
      )
      .addTag(
        'Containers',
        'Container management operations',
      )
      .addTag(
        'Items',
        'Item management operations',
      )
      .addTag(
        'Files',
        'File upload operations',
      )
      .addTag(
        'Reports',
        'PDF and Excel report operations',
      )
      .addTag(
        'Audit Logs',
        'Audit log operations',
      )
      .addTag(
        'Health',
        'Health check endpoint',
      );

  if (!isProduction) {
    builder.addServer(
      `http://localhost:${port}`,
      'Development Server',
    );
  }

  const config =
    builder.build();

  const document =
    SwaggerModule.createDocument(
      app,
      config,
    );

  SwaggerModule.setup(
    'api-docs',
    app,
    document,
    {
      swaggerOptions: {
        persistAuthorization:
          true,

        displayRequestDuration:
          true,

        filter:
          true,

        tryItOutEnabled:
          true,

        operationsSorter:
          'alpha',

        tagsSorter:
          'alpha',

        defaultModelsExpandDepth:
          3,

        defaultModelExpandDepth:
          3,
      },
    },
  );

  if (!isProduction) {
    bootstrapLogger.log(
      `Swagger UI: http://localhost:${port}/api-docs`,
    );
  } else {
    bootstrapLogger.log(
      'Swagger UI available at /api-docs',
    );
  }
}

// ==================================================================
// START
// ==================================================================

void bootstrap().catch(
  (
    error: unknown,
  ) => {
    const message =
      error instanceof Error
        ? error.stack ||
          error.message
        : 'Unknown bootstrap error';

    bootstrapLogger.error(
      message,
    );

    process.exitCode = 1;
  },
);
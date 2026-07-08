// src/main.ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';

dotenv.config();

async function bootstrap() {
  const configService = new ConfigService();
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const port = configService.get<number>('PORT', 3000);
  const frontendUrls = configService
    .get<string>('FRONTEND_URLS', 'http://localhost:3001')
    .split(',')
    .map((url) => url.trim());

  console.log('========================================');
  console.log('🚀 Starting Container Management System');
  console.log(`🔧 NODE_ENV: ${nodeEnv}`);
  console.log(`🌐 Port: ${port}`);
  console.log(`📊 Database: ${configService.get('DB_DATABASE')}`);
  console.log('========================================');

  // ============================================
  // 1. HTTPS CONFIGURATION (Production)
  // ============================================
  let app: NestExpressApplication;

  if (isProduction) {
    // ✅ HTTPS në production
    const sslKeyPath = configService.get<string>('SSL_KEY_PATH', './certs/key.pem');
    const sslCertPath = configService.get<string>('SSL_CERT_PATH', './certs/cert.pem');

    // Kontrollo nëse certifikatat ekzistojnë
    if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
      console.warn('⚠️  SSL certificates not found. Falling back to HTTP.');
      app = await NestFactory.create<NestExpressApplication>(AppModule);
    } else {
      const httpsOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      };
      app = await NestFactory.create<NestExpressApplication>(AppModule, { httpsOptions });
      console.log('🔒 HTTPS enabled');
    }
  } else {
    // HTTP në development
    app = await NestFactory.create<NestExpressApplication>(AppModule);
  }

   // ============================================
  // 2. TRUST PROXY (për IP të saktë)
  // ============================================
  app.set('trust proxy', true); // ✅ Shto këtë!

  // ============================================
  // 2. STATIC FILES (Uploads)
  // ============================================
  const uploadsPath = join(__dirname, '..', 'uploads');
  if (fs.existsSync(uploadsPath)) {
    app.useStaticAssets(uploadsPath, {
      prefix: '/uploads/',
      setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      },
    });
  }

  // ============================================
  // 3. SIGURIA - HELMET
  // ============================================
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
      hsts: {
        maxAge: 31536000, // 1 vit
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      noSniff: true,
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    }),
  );

  // ============================================
  // 4. KOMPRESIONI PËR PERFORMANCË
  // ============================================
  app.use(compression());

  // ============================================
  // 5. CORS - I KUFIZUAR
  // ============================================
  app.enableCors({
    origin: isProduction ? frontendUrls : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 orë
  });

  // ============================================
  // 6. VALIDIMI GLOBAL
  // ============================================
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

  // ============================================
  // 7. EXCEPTION FILTER - ERROR HANDLING (PA STACK TRACE)
  // ============================================
  app.useGlobalFilters(new HttpExceptionFilter());

  // ============================================
  // 8. LOGGER INTERCEPTOR
  // ============================================
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ============================================
  // 9. VERSIONIMI I API-së
  // ============================================
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ============================================
  // 10. PREFIXI GLOBAL (Opsional)
  // ============================================
  // app.setGlobalPrefix('api');

  // ============================================
  // 11. SWAGGER - VETËM NË DEVELOPMENT
  // ============================================
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Container Management System API')
      .setDescription(`
## Container Management System API

### 🔐 Authentication
- **Login**: POST /auth/login
- **Register**: POST /auth/register (Admin only)
- **Refresh Token**: POST /auth/refresh
- **Logout**: POST /auth/logout
- **Sessions**: GET /auth/sessions

### 📦 Containers
- **Create**: POST /containers
- **Get All**: GET /containers
- **Get Active**: GET /containers/active
- **Get Archived**: GET /containers/archived
- **Search**: GET /containers/search
- **Get By ID**: GET /containers/:id
- **Update**: PUT /containers/:id
- **Update Status**: PUT /containers/:id/status
- **Delete**: DELETE /containers/:id

### 📦 Items
- **Create**: POST /items
- **Get All**: GET /items
- **Search**: GET /items/search
- **Get By ID**: GET /items/:id
- **Update**: PUT /items/:id
- **Delete**: DELETE /items/:id

### 👤 User Roles
- **Super Admin**: Full access (can manage everything)
- **Admin**: Create/Manage containers and items, manage users
- **User**: View only

### 🔒 Security Features
- JWT Authentication with Refresh Tokens
- Role-Based Access Control (RBAC)
- Rate Limiting (5 attempts/min for login)
- Account Locking (5 failed attempts = 15 min lock)
- Password hashing with Argon2
- Helmet security headers
- CORS restricted to allowed domains
- Input validation with DTOs
- SQL Injection prevention (parameterized queries)
- File upload security (MIME, size, extension validation)
- HTTPS (Production)
`)
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
      .addTag('Authentication', 'Login, Register, Refresh, Logout')
      .addTag('Containers', 'Container management operations')
      .addTag('Items', 'Item management operations')
      .addTag('Files', 'File upload operations')
      .addTag('Health', 'Health check endpoint')
      .addServer(`http://localhost:${port}`, 'Development Server')
      .addServer(`https://your-production-domain.com`, 'Production Server')
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
    console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
  }

  // ============================================
  // 12. START SERVER
  // ============================================
  await app.listen(port, '0.0.0.0');

  console.log(`✅ Application is running on: ${isProduction ? 'https' : 'http'}://localhost:${port}`);
  console.log(`🔧 Environment: ${nodeEnv}`);
  console.log('========================================');

  // ============================================
  // 13. GRACEFUL SHUTDOWN
  // ============================================
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      await app.close();
      console.log('✅ Application closed gracefully');
      process.exit(0);
    });
  });
}

bootstrap();
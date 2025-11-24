import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);

  // Register Fastify plugins
  await app.register(fastifyCookie as any);
  const corsOriginsConfig =
    configService.get<string>('FRONTEND_URLS') ||
    configService.get<string>('FRONTEND_URL') ||
    'http://localhost:5173';

  const allowedOrigins = corsOriginsConfig
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(fastifyCors as any, {
    origin: (origin: string, cb: (err: Error | null, allow: boolean) => void) => {
      if (!origin) {
        return cb(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });
  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false, // Adjust for production
  });
  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  const port = configService.get('PORT') || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Application running on: http://localhost:${port}/api`);
}

bootstrap();

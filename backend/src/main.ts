process.env.TZ = 'Asia/Makassar'; // Force timezone to WITA (UTC+8)

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS - allow all origins for LAN access
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = configService.get<number>('BACKEND_PORT', 3001);
  const server = await app.listen(port);
  
  // Disable timeouts for large file uploads
  server.setTimeout(0);
  if (server.keepAliveTimeout) {
    server.keepAliveTimeout = 0;
  }

  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`📡 WebSocket ready on ws://localhost:${port}`);
}
bootstrap();

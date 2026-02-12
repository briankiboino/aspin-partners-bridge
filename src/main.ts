import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  const configService = app.get(ConfigService);
  const allowedOrigins = configService.get('ALLOWED_ORIGINS').split(',');

  app.enableCors({
    origin: (origin, callback) => {
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Keepalive'],
    methods: ['POST', 'PUT', 'PATCH', 'DELETE', 'GET', 'OPTIONS'],
  });

  await app.listen(parseInt(configService.get('PORT')), '0.0.0.0');
  console.log(`Dr Frankenstein: It's Alive! It's Alive!`);
}
bootstrap();

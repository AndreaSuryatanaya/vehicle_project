import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vehicle Marketplace API')
    .setDescription('API documentation for categories, listings, search, and filters.')
    .setVersion('1.0.0')
    .addTag('Categories')
    .addTag('Listings')
    .addTag('Search')
    .addTag('Filters')
    .build();
  SwaggerModule.setup(
    'api',
    app,
    () => SwaggerModule.createDocument(app, swaggerConfig),
    { jsonDocumentUrl: 'api-json', customSiteTitle: 'Vehicle Marketplace API' },
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

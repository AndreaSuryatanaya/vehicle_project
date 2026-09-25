import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DatabaseService } from './database/database.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  try {
    await app.get(DatabaseService).checkConnection();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[Database] Connection failed; application will not start. ${reason}`);
    try {
      await app.close();
    } catch (closeError) {
      const closeReason = closeError instanceof Error ? closeError.message : String(closeError);
      console.error(`[Startup] Error while closing application: ${closeReason}`);
    }
    process.exitCode = 1;
    return;
  }

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

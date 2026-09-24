import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CategoriesModule } from './module/categories/categories.module.js';
import { ListingsModule } from './module/listings/listings.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [DatabaseModule, CategoriesModule, ListingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

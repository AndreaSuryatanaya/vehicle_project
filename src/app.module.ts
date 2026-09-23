import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CategoriesModule } from './module/categories/categories.module.js';
import { ListingsModule } from './module/listings/listings.module.js';

@Module({
  imports: [CategoriesModule, ListingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

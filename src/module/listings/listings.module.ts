import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller.js';
import { FiltersController } from './filters.controller.js';
import { ListingsService } from './listings.service.js';
import { ListingsRepository } from './repositories/listings.repository.js';

@Module({
  controllers: [ListingsController, FiltersController],
  providers: [ListingsService, ListingsRepository],
})
export class ListingsModule {}

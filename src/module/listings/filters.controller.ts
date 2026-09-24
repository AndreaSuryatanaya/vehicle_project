import { Controller, Get, Param } from '@nestjs/common';
import { ListingsService } from './listings.service.js';
import { CategoryFilterParamDto } from './dto/listings.dto.js';

@Controller('filters')
export class FiltersController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  findAll() {
    return this.listingsService.findAllFilterOptions();
  }

  @Get(':categoryId')
  findByCategory(@Param() params: CategoryFilterParamDto) {
    return this.listingsService.findCategoryFilters(params.categoryId);
  }
}

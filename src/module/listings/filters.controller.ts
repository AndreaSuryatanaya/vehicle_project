import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ListingsService } from './listings.service.js';
import { CategoryFilterParamDto } from './dto/listings.dto.js';
import {
  ApiCommonErrors,
  ApiEnvelopeResponse,
} from '../../common/swagger/api-response.decorators.js';

@Controller('filters')
@ApiTags('Filters')
export class FiltersController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available filter options with facet counts' })
  @ApiEnvelopeResponse(200, { type: 'array', items: { type: 'object', additionalProperties: true } })
  findAll() {
    return this.listingsService.findAllFilterOptions();
  }

  @Get(':categoryId')
  @ApiOperation({ summary: 'Get filterable attributes for a category' })
  @ApiParam({ name: 'categoryId', description: 'Category ID', example: 2 })
  @ApiEnvelopeResponse(200, { type: 'array', items: { type: 'object', additionalProperties: true } })
  @ApiCommonErrors({ badRequest: 'The category ID is invalid' })
  findByCategory(@Param() params: CategoryFilterParamDto) {
    return this.listingsService.findCategoryFilters(params.categoryId);
  }
}

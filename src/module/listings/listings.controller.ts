import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ListingsService } from './listings.service.js';
import {
  CreateListingDto,
  ListingSuggestionQueryDto,
  ListingBrowseQueryDto,
  ListingIdParamDto,
  UpdateListingDto,
} from './dto/listings.dto.js';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  create(@Body() input: CreateListingDto) {
    return this.listingsService.create(input);
  }

  @Get()
  findMany(@Query() query: ListingBrowseQueryDto) {
    return this.listingsService.findMany(query);
  }

  @Get('search/suggest')
  findSuggestions(@Query() query: ListingSuggestionQueryDto) {
    return this.listingsService.findSuggestions(query.q);
  }

  @Get('search')
  search(@Query() query: ListingBrowseQueryDto) {
    return this.listingsService.search(query);
  }

  @Get(':id')
  findOne(@Param() params: ListingIdParamDto) {
    return this.listingsService.findOne(params.id);
  }

  @Patch(':id')
  update(@Param() params: ListingIdParamDto, @Body() input: UpdateListingDto) {
    return this.listingsService.update(params.id, input);
  }

  @Delete(':id')
  remove(@Param() params: ListingIdParamDto) {
    return this.listingsService.remove(params.id);
  }
}

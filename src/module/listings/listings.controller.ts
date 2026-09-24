import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ListingsService } from './listings.service.js';
import {
  CreateListingDto,
  ListingSuggestionQueryDto,
  ListingBrowseQueryDto,
  ListingIdParamDto,
  UpdateListingDto,
} from './dto/listings.dto.js';
import {
  ApiCommonErrors,
  ApiEnvelopeResponse,
  ApiMutationEnvelopeResponse,
  ApiPaginatedEnvelopeResponse,
} from '../../common/swagger/api-response.decorators.js';

@Controller('listings')
@ApiTags('Listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a vehicle listing' })
  @ApiBody({ type: CreateListingDto })
  @ApiMutationEnvelopeResponse(201, true, 'Listing created')
  @ApiCommonErrors({ badRequest: 'The listing payload is invalid or references invalid database records' })
  create(@Body() input: CreateListingDto) {
    return this.listingsService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'Browse listings with filters, sorting, and cursor pagination' })
  @ApiPaginatedEnvelopeResponse('Listings with cursor pagination metadata')
  @ApiCommonErrors({ badRequest: 'One or more filters, sort options, or cursor values are invalid' })
  findMany(@Query() query: ListingBrowseQueryDto) {
    return this.listingsService.findMany(query);
  }

  @Get('search/suggest')
  @ApiTags('Search')
  @ApiOperation({ summary: 'Get autocomplete suggestions for makes, models, and cities' })
  @ApiEnvelopeResponse(200, { type: 'array', items: { type: 'object', additionalProperties: true } })
  @ApiCommonErrors({ badRequest: 'The q query parameter is required and must be valid' })
  findSuggestions(@Query() query: ListingSuggestionQueryDto) {
    return this.listingsService.findSuggestions(query.q);
  }

  @Get('search')
  @ApiTags('Search')
  @ApiOperation({ summary: 'Full-text search listings with combined filters and facets' })
  @ApiPaginatedEnvelopeResponse('Search results, facets, and cursor pagination metadata', true)
  @ApiCommonErrors({ badRequest: 'One or more search filters or cursor values are invalid' })
  search(@Query() query: ListingBrowseQueryDto) {
    return this.listingsService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a listing by ID' })
  @ApiParam({ name: 'id', description: 'Listing ID', example: 10 })
  @ApiEnvelopeResponse(200)
  @ApiCommonErrors({ badRequest: 'The listing ID is invalid', notFound: 'The listing was not found' })
  findOne(@Param() params: ListingIdParamDto) {
    return this.listingsService.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a listing' })
  @ApiParam({ name: 'id', description: 'Listing ID', example: 10 })
  @ApiBody({ type: UpdateListingDto })
  @ApiMutationEnvelopeResponse(200, false, 'Listing updated')
  @ApiCommonErrors({ badRequest: 'The listing ID or payload is invalid', notFound: 'The listing was not found' })
  update(@Param() params: ListingIdParamDto, @Body() input: UpdateListingDto) {
    return this.listingsService.update(params.id, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a listing' })
  @ApiParam({ name: 'id', description: 'Listing ID', example: 10 })
  @ApiMutationEnvelopeResponse(200, false, 'Listing soft-deleted')
  @ApiCommonErrors({ badRequest: 'The listing ID is invalid', notFound: 'The listing was not found' })
  remove(@Param() params: ListingIdParamDto) {
    return this.listingsService.remove(params.id);
  }
}

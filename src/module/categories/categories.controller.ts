import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service.js';
import {
  CategoryIdParamDto,
  CategoryListingsQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto.js';
import {
  ApiCommonErrors,
  ApiEnvelopeResponse,
  ApiMutationEnvelopeResponse,
  ApiPaginatedEnvelopeResponse,
} from '../../common/swagger/api-response.decorators.js';

@Controller('categories')
@ApiTags('Categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the active category tree' })
  @ApiEnvelopeResponse(200, { type: 'array', items: { type: 'object', additionalProperties: true } })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category and its active descendants' })
  @ApiParam({ name: 'id', description: 'Category ID', example: 2 })
  @ApiEnvelopeResponse(200)
  @ApiCommonErrors({ badRequest: 'The category ID is invalid', notFound: 'The category was not found' })
  findOne(@Param() params: CategoryIdParamDto) {
    return this.categoriesService.findOne(params.id);
  }

  @Get(':id/listings')
  @ApiOperation({ summary: 'Browse listings in a category and its subcategories' })
  @ApiParam({ name: 'id', description: 'Category ID', example: 2 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, maximum: 100 })
  @ApiPaginatedEnvelopeResponse('Listings with pagination metadata')
  @ApiCommonErrors({
    badRequest: 'The category ID or pagination parameters are invalid',
    notFound: 'The category is missing or inactive',
  })
  findListings(
    @Param() params: CategoryIdParamDto,
    @Query() query: CategoryListingsQueryDto,
  ) {
    return this.categoriesService.findListings(params.id, query.page, query.limit);
  }

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiMutationEnvelopeResponse(201, true, 'Category created')
  @ApiCommonErrors({ badRequest: 'The category payload is invalid', conflict: 'The category slug already exists or its parent is invalid' })
  create(@Body() input: CreateCategoryDto) {
    return this.categoriesService.create(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category ID', example: 2 })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiMutationEnvelopeResponse(200, false, 'Category updated')
  @ApiCommonErrors({ badRequest: 'The category ID or payload is invalid', notFound: 'The category was not found', conflict: 'The category slug already exists' })
  update(
    @Param() params: CategoryIdParamDto,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(params.id, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'Category ID', example: 2 })
  @ApiMutationEnvelopeResponse(200, false, 'Category deleted')
  @ApiCommonErrors({ badRequest: 'The category ID is invalid', notFound: 'The category was not found', conflict: 'The category is referenced by a child category or listing' })
  remove(@Param() params: CategoryIdParamDto) {
    return this.categoriesService.remove(params.id);
  }
}

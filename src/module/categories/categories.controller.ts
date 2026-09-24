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
import { CategoriesService } from './categories.service.js';
import {
  CategoryIdParamDto,
  CategoryListingsQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto.js';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param() params: CategoryIdParamDto) {
    return this.categoriesService.findOne(params.id);
  }

  @Get(':id/listings')
  findListings(
    @Param() params: CategoryIdParamDto,
    @Query() query: CategoryListingsQueryDto,
  ) {
    return this.categoriesService.findListings(params.id, query.page, query.limit);
  }

  @Post()
  create(@Body() input: CreateCategoryDto) {
    return this.categoriesService.create(input);
  }

  @Patch(':id')
  update(
    @Param() params: CategoryIdParamDto,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(params.id, input);
  }

  @Delete(':id')
  remove(@Param() params: CategoryIdParamDto) {
    return this.categoriesService.remove(params.id);
  }
}

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
  CategoriesService,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './categories.service.js';

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
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Get(':id/listings')
  findListings(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.categoriesService.findListings(id, page, limit);
  }

  @Post()
  create(@Body() input: CreateCategoryInput) {
    return this.categoriesService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateCategoryInput,
  ) {
    return this.categoriesService.update(id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}

import { Transform } from 'class-transformer';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../interface/categories.interface.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

@ValidatorConstraint({ name: 'validCategoryPage', async: false })
class ValidCategoryPageConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const page = Number(value);
    const query = args.object as CategoryListingsQueryDto;
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    return (
      Number.isSafeInteger(page) &&
      page > 0 &&
      Number.isSafeInteger((page - 1) * limit)
    );
  }

  defaultMessage(): string {
    return 'page must be a positive integer within the supported range';
  }
}

@ValidatorConstraint({ name: 'validCategoryListingsLimit', async: false })
class ValidCategoryListingsLimitConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const limit = Number(value);
    return Number.isInteger(limit) && limit >= 1 && limit <= 100;
  }

  defaultMessage(): string {
    return 'limit must be an integer between 1 and 100';
  }
}

@ValidatorConstraint({ name: 'categoryPatchNotEmpty', async: false })
class CategoryPatchNotEmptyConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return Object.entries(args.object as Record<string, unknown>).some(
      ([key, value]) => key !== '_patchPayload' && value !== undefined,
    );
  }

  defaultMessage(): string {
    return 'At least one category field is required';
  }
}

@ValidatorConstraint({ name: 'categoryNameCanGenerateSlug', async: false })
class CategoryNameCanGenerateSlugConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    return (
      value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '').length > 0
    );
  }

  defaultMessage(): string {
    return 'name must contain at least one letter or number';
  }
}

export class CategoryIdParamDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  id!: string;
}

export class CategoryListingsQueryDto {
  @IsOptional()
  @Matches(/^[1-9]\d*$/)
  @Validate(ValidCategoryPageConstraint)
  page?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/)
  @Validate(ValidCategoryListingsLimitConstraint)
  limit?: string;
}

export class CreateCategoryDto implements CreateCategoryInput {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Validate(CategoryNameCanGenerateSlugConstraint)
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Optional. Parent category ID. Omit or set null to create a root category.',
    example: '1',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;
}

export class UpdateCategoryDto implements UpdateCategoryInput {
  @ApiHideProperty()
  @Validate(CategoryPatchNotEmptyConstraint)
  private readonly _patchPayload = '';

  @ApiPropertyOptional({
    description:
      'Optional. Rename the category; the existing slug stays unchanged.',
    example: 'SUV',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Optional. Set a custom URL slug. Must be unique.',
    example: 'suv',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Optional. Set a parent category ID, or null to move this category to the root.',
    example: '1',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  @ApiPropertyOptional({
    description: 'Optional. Enable or disable the category.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

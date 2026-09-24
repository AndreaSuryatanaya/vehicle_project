import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
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
    return Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger((page - 1) * limit);
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
    return Object.entries(args.object as Record<string, unknown>)
      .some(([key, value]) => key !== '_patchPayload' && value !== undefined);
  }

  defaultMessage(): string {
    return 'At least one category field is required';
  }
}

@ValidatorConstraint({ name: 'categoryCanGenerateSlug', async: false })
class CategoryCanGenerateSlugConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    const input = args.object as CreateCategoryInput;
    const slug = input.slug ?? value;
    return slug
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '').length > 0;
  }

  defaultMessage(): string {
    return 'name or slug must contain at least one letter or number';
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
  @Validate(CategoryCanGenerateSlugConstraint)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  sortOrder?: number;
}

export class UpdateCategoryDto implements UpdateCategoryInput {
  @Validate(CategoryPatchNotEmptyConstraint)
  private readonly _patchPayload = '';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import type {
  CreateListingRecord,
  ListingAttributeInput,
  ListingBrowseQuery,
  ListingImageInput,
  UpdateListingRecord,
} from '../interface/listings.interface.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const ID_PATTERN = /^[1-9]\d*$/;

@ValidatorConstraint({ name: 'validListingLimit', async: false })
class ValidListingLimitConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const limit = Number(value);
    return Number.isInteger(limit) && limit >= 1 && limit <= 100;
  }

  defaultMessage(): string {
    return 'limit must be an integer between 1 and 100';
  }
}

@ValidatorConstraint({ name: 'validPriceFilter', async: false })
class ValidPriceFilterConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const amount = Number(value);
    if (typeof value !== 'string' || !Number.isFinite(amount) || amount < 0) return false;
    const query = args.object as ListingBrowseQuery;
    const other = args.property === 'minPrice' ? query.maxPrice : query.minPrice;
    if (other === undefined) return true;
    return args.property === 'minPrice' ? amount <= Number(other) : Number(other) <= amount;
  }

  defaultMessage(args: ValidationArguments): string {
    return args.property === 'minPrice'
      ? 'minPrice must be less than or equal to maxPrice'
      : 'maxPrice must be greater than or equal to minPrice';
  }
}

@ValidatorConstraint({ name: 'validYearFilter', async: false })
class ValidYearFilterConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const year = Number(value);
    if (typeof value !== 'string' || !Number.isSafeInteger(year) || year < 1886 || year > 2200) return false;
    const query = args.object as ListingBrowseQuery;
    const other = args.property === 'minYear' ? query.maxYear : query.minYear;
    if (other === undefined) return true;
    return args.property === 'minYear' ? year <= Number(other) : Number(other) <= year;
  }

  defaultMessage(args: ValidationArguments): string {
    return args.property === 'minYear'
      ? 'minYear must be less than or equal to maxYear'
      : 'maxYear must be greater than or equal to minYear';
  }
}

@ValidatorConstraint({ name: 'validListingCursor', async: false })
class ValidListingCursorConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    try {
      const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (typeof parsed !== 'object' || parsed === null) return false;
      const cursor = parsed as Record<string, unknown>;
      const idIsValid = typeof cursor.id === 'string' && ID_PATTERN.test(cursor.id);
      const dateIsValid = typeof cursor.createdAt === 'string' && !Number.isNaN(Date.parse(cursor.createdAt));
      const directionIsValid = cursor.direction === undefined || cursor.direction === 'next' || cursor.direction === 'previous';
      if (!idIsValid || !dateIsValid || !directionIsValid) return false;

      if ('rank' in cursor) {
        const page = cursor.page === undefined ? 2 : cursor.page;
        return typeof cursor.rank === 'number' && Number.isFinite(cursor.rank) &&
          (typeof page === 'number' && Number.isSafeInteger(page) && page >= 1);
      }

      if (typeof cursor.value !== 'string') return false;
      const offset = cursor.offset;
      if (offset !== undefined && (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0)) return false;
      const query = args.object as ListingBrowseQuery;
      return query.sort?.startsWith('price_')
        ? Number.isFinite(Number(cursor.value))
        : !Number.isNaN(Date.parse(cursor.value));
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'cursor is invalid';
  }
}

@ValidatorConstraint({ name: 'listingPatchNotEmpty', async: false })
class ListingPatchNotEmptyConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return Object.entries(args.object as Record<string, unknown>)
      .some(([key, value]) => key !== '_patchPayload' && value !== undefined);
  }

  defaultMessage(): string {
    return 'At least one listing field is required';
  }
}

export class ListingIdParamDto {
  @IsString()
  @Matches(ID_PATTERN)
  id!: string;
}

export class CategoryFilterParamDto {
  @IsString()
  @Matches(ID_PATTERN)
  categoryId!: string;
}

export class ListingBrowseQueryDto implements ListingBrowseQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Matches(ID_PATTERN)
  categoryId?: string;

  @IsOptional()
  @Matches(ID_PATTERN)
  makeId?: string;

  @IsOptional()
  @Matches(/^\d+(?:\.\d+)?$/)
  @Validate(ValidPriceFilterConstraint)
  minPrice?: string;

  @IsOptional()
  @Matches(/^\d+(?:\.\d+)?$/)
  @Validate(ValidPriceFilterConstraint)
  maxPrice?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  @Validate(ValidYearFilterConstraint)
  minYear?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  @Validate(ValidYearFilterConstraint)
  maxYear?: string;

  @IsOptional()
  @IsIn(['petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'cng', 'lpg'])
  fuelType?: string;

  @IsOptional()
  @IsIn(['available', 'pending', 'sold', 'removed'])
  status?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'price_asc', 'price_desc'])
  sort?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  @Validate(ValidListingLimitConstraint)
  limit?: string;

  @IsOptional()
  @IsString()
  @Validate(ValidListingCursorConstraint)
  cursor?: string;
}

export class ListingSuggestionQueryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q!: string;
}

export class ListingImageDto implements ListingImageInput {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  url!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

@ValidatorConstraint({ name: 'exactlyOneAttributeValue', async: false })
class ExactlyOneAttributeValueConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const attribute = args.object as ListingAttributeInput;
    return [attribute.valueText, attribute.valueNumber, attribute.valueBoolean]
      .filter((value) => value !== undefined && value !== null).length === 1;
  }

  defaultMessage(): string {
    return 'Each attribute must provide exactly one of valueText, valueNumber, or valueBoolean';
  }
}

export class ListingAttributeDto implements ListingAttributeInput {
  @IsString()
  @Matches(ID_PATTERN)
  @Validate(ExactlyOneAttributeValueConstraint)
  attributeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  valueText?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  valueNumber?: number | null;

  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean | null;

}

export class CreateListingDto implements CreateListingRecord {
  @IsString()
  @Matches(ID_PATTERN)
  categoryId!: string;

  @IsString()
  @Matches(ID_PATTERN)
  modelId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1886)
  @Max(2200)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  mileage!: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsIn(['new', 'used'])
  condition!: string;

  @IsIn(['automatic', 'manual', 'cvt', 'semi_automatic', 'single_speed'])
  transmission!: string;

  @IsIn(['petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'cng', 'lpg'])
  fuelType!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  color!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  region!: string;

  @IsOptional()
  @IsIn(['available', 'pending', 'sold'])
  status?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListingImageDto)
  images?: ListingImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListingAttributeDto)
  attributes?: ListingAttributeDto[];
}

export class UpdateListingDto implements UpdateListingRecord {
  @Validate(ListingPatchNotEmptyConstraint)
  private readonly _patchPayload = '';

  @IsOptional()
  @IsString()
  @Matches(ID_PATTERN)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(ID_PATTERN)
  modelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1886)
  @Max(2200)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  mileage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsIn(['new', 'used'])
  condition?: string;

  @IsOptional()
  @IsIn(['automatic', 'manual', 'cvt', 'semi_automatic', 'single_speed'])
  transmission?: string;

  @IsOptional()
  @IsIn(['petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'cng', 'lpg'])
  fuelType?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  color?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsIn(['available', 'pending', 'sold', 'removed'])
  status?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

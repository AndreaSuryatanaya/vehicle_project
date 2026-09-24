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

export class ListingIdParamDto {
  @IsString()
  @Matches(ID_PATTERN)
  id!: string;
}

export class ListingBrowseQueryDto implements ListingBrowseQuery {
  @IsOptional()
  @Matches(ID_PATTERN)
  categoryId?: string;

  @IsOptional()
  @Matches(ID_PATTERN)
  makeId?: string;

  @IsOptional()
  @Matches(/^\d+(?:\.\d+)?$/)
  minPrice?: string;

  @IsOptional()
  @Matches(/^\d+(?:\.\d+)?$/)
  maxPrice?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  minYear?: string;

  @IsOptional()
  @Matches(/^\d+$/)
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
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
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

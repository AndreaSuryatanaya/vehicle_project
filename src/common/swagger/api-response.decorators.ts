import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiResponse,
  type SchemaObject,
} from '@nestjs/swagger';

const paginationSchema: SchemaObject = {
  type: 'object',
  properties: {
    total: { type: 'integer', example: 42 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 10 },
    totalPages: { type: 'integer', example: 5 },
    nextCursor: { type: 'string', nullable: true },
    previousCursor: { type: 'string', nullable: true },
  },
};

export function ApiEnvelopeResponse(
  status: number,
  data: SchemaObject = { type: 'object', additionalProperties: true },
  description = 'Successful response',
): MethodDecorator {
  return ApiResponse({
    status,
    description,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Success' },
        statusCode: { type: 'integer', example: status },
        isSuccess: { type: 'boolean', example: true },
        data,
      },
    },
  });
}

export function ApiPaginatedEnvelopeResponse(
  description = 'Successful paginated response',
  includeFacets = false,
): MethodDecorator {
  const properties: Record<string, SchemaObject> = {
    message: { type: 'string', example: 'Success' },
    statusCode: { type: 'integer', example: 200 },
    isSuccess: { type: 'boolean', example: true },
    data: { type: 'array', items: { type: 'object', additionalProperties: true } },
    pagination: paginationSchema,
  };
  if (includeFacets) {
    properties.facets = {
      type: 'object',
      properties: {
        make: { type: 'array', items: { type: 'object', additionalProperties: true } },
        fuelType: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    };
  }
  return ApiResponse({
    status: 200,
    description,
    schema: { type: 'object', properties },
  });
}

export function ApiMutationEnvelopeResponse(
  status: number,
  includeData: boolean,
  description: string,
): MethodDecorator {
  return ApiResponse({
    status,
    description,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Success' },
        statusCode: { type: 'integer', example: status },
        isSuccess: { type: 'boolean', example: true },
        ...(includeData ? { data: { type: 'object', additionalProperties: true } } : {}),
      },
    },
  });
}

export function ApiCommonErrors(options: {
  badRequest?: string;
  notFound?: string;
  conflict?: string;
} = {}): MethodDecorator {
  const decorators: MethodDecorator[] = [];
  if (options.badRequest) decorators.push(ApiBadRequestResponse({ description: options.badRequest }));
  if (options.notFound) decorators.push(ApiNotFoundResponse({ description: options.notFound }));
  if (options.conflict) decorators.push(ApiConflictResponse({ description: options.conflict }));
  return applyDecorators(...decorators);
}

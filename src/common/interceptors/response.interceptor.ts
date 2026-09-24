import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';

interface PaginatedPayload {
  data: unknown[];
  pagination: unknown;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((payload: unknown) => {
        const method = request.method.toUpperCase();
        const message = this.getMessage(payload, method);

        const statusCode = response.statusCode;
        const isSuccess = statusCode >= 200 && statusCode < 300;
        const body = this.getData(payload);

        if (method === 'POST') {
          return { message, statusCode, isSuccess, data: body };
        }

        if (method === 'PATCH' || method === 'PUT') {
          return { message, statusCode, isSuccess };
        }

        if (this.isPaginated(payload)) {
          return {
            message,
            statusCode,
            isSuccess,
            data: payload.data,
            pagination: payload.pagination,
          };
        }

        if (method === 'DELETE') return { message, statusCode, isSuccess };

        return { message, statusCode, isSuccess, data: body };
      }),
    );
  }

  private getMessage(payload: unknown, method: string): string {
    if (this.isRecord(payload) && typeof payload.message === 'string') {
      return payload.message;
    }

    if (method === 'POST') return 'Created successfully';
    if (method === 'PATCH' || method === 'PUT') return 'Updated successfully';
    if (method === 'DELETE') return 'Deleted successfully';
    return 'Success';
  }

  private getData(payload: unknown): unknown {
    if (this.isRecord(payload) && 'data' in payload && 'pagination' in payload) {
      return payload.data;
    }
    return payload;
  }

  private isPaginated(payload: unknown): payload is PaginatedPayload {
    return (
      this.isRecord(payload) &&
      Array.isArray(payload.data) &&
      'pagination' in payload
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

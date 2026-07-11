// src/modules/audits/audit.interceptor.spec.ts

import {
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  lastValueFrom,
  of,
  throwError,
} from 'rxjs';

import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import {
  AuditAction,
  AuditStatus,
} from './entities/audit-log.entity';
import {
  AUDIT_ACTION_KEY,
  SKIP_AUDIT_KEY,
} from './decorators/audit.decorator';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: jest.Mocked<AuditService>;
  let reflector: jest.Mocked<Reflector>;
  let configService: jest.Mocked<ConfigService>;

  const createExecutionContext = (
    overrides: Partial<{
      method: string;
      url: string;
      originalUrl: string;
      body: Record<string, unknown>;
      user: {
        id: string;
      };
      params: Record<string, string>;
      headers: Record<string, string>;
      ip: string;
      statusCode: number;
    }> = {},
  ): ExecutionContext => {
    const request = {
      method:
        overrides.method ??
        'POST',
      url:
        overrides.url ??
        '/v1/items',
      originalUrl:
        overrides.originalUrl ??
        overrides.url ??
        '/v1/items',
      body:
        overrides.body ??
        {},
      user:
        overrides.user ?? {
          id:
            '550e8400-e29b-41d4-a716-446655440000',
        },
      params:
        overrides.params ??
        {},
      headers:
        overrides.headers ?? {
          'user-agent':
            'jest-agent',
        },
      ip:
        overrides.ip ??
        '127.0.0.1',
      socket: {
        remoteAddress:
          '127.0.0.1',
      },
    };

    const response = {
      statusCode:
        overrides.statusCode ??
        200,
    };

    return {
      switchToHttp: () => ({
        getRequest: () =>
          request,
        getResponse: () =>
          response,
      }),
      getHandler: () =>
        function handler() {
          return undefined;
        },
      getClass: () =>
        class TestController {},
    } as unknown as ExecutionContext;
  };

  const createCallHandler = (
    value: unknown,
  ): CallHandler => ({
    handle: () => of(value),
  });

  beforeEach(() => {
    auditService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    reflector = {
      getAllAndOverride:
        jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    configService.get.mockReturnValue(
      'development',
    );

    auditService.log.mockResolvedValue(
      {} as never,
    );

    interceptor =
      new AuditInterceptor(
        auditService,
        reflector,
        configService,
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should bypass audit when SkipAudit metadata is enabled', async () => {
    reflector.getAllAndOverride
      .mockImplementation(
        (
          metadataKey: unknown,
        ) =>
          metadataKey ===
          SKIP_AUDIT_KEY
            ? true
            : undefined,
      );

    const context =
      createExecutionContext();

    const result =
      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            id: 'item-1',
          }),
        ),
      );

    expect(result).toEqual({
      id: 'item-1',
    });

    expect(
      auditService.log,
    ).not.toHaveBeenCalled();
  });

  it('should bypass audit in test environment', async () => {
    configService.get
      .mockReturnValue('test');

    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    const context =
      createExecutionContext();

    await lastValueFrom(
      interceptor.intercept(
        context,
        createCallHandler({
          id: 'item-1',
        }),
      ),
    );

    expect(
      auditService.log,
    ).not.toHaveBeenCalled();
  });

  it('should bypass unknown and read-only routes', async () => {
    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    const context =
      createExecutionContext({
        method: 'GET',
        url: '/v1/health',
      });

    const result =
      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            status: 'ok',
          }),
        ),
      );

    expect(result).toEqual({
      status: 'ok',
    });

    expect(
      auditService.log,
    ).not.toHaveBeenCalled();
  });

  it('should use explicit Audit metadata when provided', async () => {
    reflector.getAllAndOverride
      .mockImplementation(
        (
          metadataKey: unknown,
        ) => {
          if (
            metadataKey ===
            SKIP_AUDIT_KEY
          ) {
            return false;
          }

          if (
            metadataKey ===
            AUDIT_ACTION_KEY
          ) {
            return AuditAction.USER_ROLE_CHANGE;
          }

          return undefined;
        },
      );

    const context =
      createExecutionContext({
        method: 'PATCH',
        url:
          '/v1/auth/users/user-id/role',
        params: {
          id: 'user-id',
        },
      });

    await lastValueFrom(
      interceptor.intercept(
        context,
        createCallHandler({
          id: 'user-id',
        }),
      ),
    );

    await Promise.resolve();

    expect(
      auditService.log,
    ).toHaveBeenCalledWith(
      AuditAction.USER_ROLE_CHANGE,
      expect.any(String),
      'user-id',
      'User',
      undefined,
      expect.objectContaining({
        method: 'PATCH',
        url:
          '/v1/auth/users/user-id/role',
        statusCode: 200,
        duration:
          expect.any(Number),
      }),
      AuditStatus.SUCCESS,
    );
  });

  it('should detect an item create action and log success', async () => {
    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    const context =
      createExecutionContext({
        method: 'POST',
        url: '/v1/items',
        body: {
          name: 'Laptop',
        },
        statusCode: 201,
      });

    await lastValueFrom(
      interceptor.intercept(
        context,
        createCallHandler({
          id:
            '550e8400-e29b-41d4-a716-446655440001',
        }),
      ),
    );

    await Promise.resolve();

    expect(
      auditService.log,
    ).toHaveBeenCalledWith(
      AuditAction.ITEM_CREATE,
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      'Item',
      {
        name: 'Laptop',
      },
      expect.objectContaining({
        ip: '127.0.0.1',
        userAgent:
          'jest-agent',
        method: 'POST',
        url: '/v1/items',
        statusCode: 201,
        duration:
          expect.any(Number),
      }),
      AuditStatus.SUCCESS,
    );
  });

  it('should use request params as target ID when response has no ID', async () => {
    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    const context =
      createExecutionContext({
        method: 'DELETE',
        url:
          '/v1/items/550e8400-e29b-41d4-a716-446655440002',
        params: {
          id:
            '550e8400-e29b-41d4-a716-446655440002',
        },
        statusCode: 204,
      });

    await lastValueFrom(
      interceptor.intercept(
        context,
        createCallHandler(
          undefined,
        ),
      ),
    );

    await Promise.resolve();

    expect(
      auditService.log,
    ).toHaveBeenCalledWith(
      AuditAction.ITEM_DELETE,
      expect.any(String),
      '550e8400-e29b-41d4-a716-446655440002',
      'Item',
      undefined,
      expect.objectContaining({
        statusCode: 204,
      }),
      AuditStatus.SUCCESS,
    );
  });

  it('should sanitize sensitive fields recursively', async () => {
    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    const context =
      createExecutionContext({
        method: 'POST',
        url: '/v1/auth/login',
        body: {
          email:
            'admin@example.com',
          password:
            'secret-password',
          nested: {
            accessToken:
              'secret-token',
            safe:
              'visible',
          },
          sessions: [
            {
              refreshToken:
                'refresh-secret',
              device:
                'browser',
            },
          ],
        },
      });

    await lastValueFrom(
      interceptor.intercept(
        context,
        createCallHandler({
          accessToken:
            'response-token',
        }),
      ),
    );

    await Promise.resolve();

    expect(
      auditService.log,
    ).toHaveBeenCalledWith(
      AuditAction.LOGIN,
      expect.any(String),
      undefined,
      'Auth',
      {
        email:
          'admin@example.com',
        nested: {
          safe:
            'visible',
        },
        sessions: [
          {
            device:
              'browser',
          },
        ],
      },
      expect.any(Object),
      AuditStatus.SUCCESS,
    );
  });

  it('should log failed requests and rethrow the original error', async () => {
    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    const context =
      createExecutionContext({
        method: 'PUT',
        url:
          '/v1/containers/550e8400-e29b-41d4-a716-446655440003',
        params: {
          id:
            '550e8400-e29b-41d4-a716-446655440003',
        },
        body: {
          name:
            'Updated Container',
        },
      });

    const error =
      Object.assign(
        new Error(
          'Container not found',
        ),
        {
          status: 404,
        },
      );

    const next: CallHandler = {
      handle: () =>
        throwError(
          () => error,
        ),
    };

    await expect(
      lastValueFrom(
        interceptor.intercept(
          context,
          next,
        ),
      ),
    ).rejects.toBe(error);

    await Promise.resolve();

    expect(
      auditService.log,
    ).toHaveBeenCalledWith(
      AuditAction.CONTAINER_UPDATE,
      expect.any(String),
      '550e8400-e29b-41d4-a716-446655440003',
      'Container',
      {
        name:
          'Updated Container',
      },
      expect.objectContaining({
        statusCode: 404,
        duration:
          expect.any(Number),
      }),
      AuditStatus.FAILED,
      'Container not found',
    );
  });

  it('should not fail the request when audit logging fails', async () => {
    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    auditService.log
      .mockRejectedValue(
        new Error(
          'Database unavailable',
        ),
      );

    const context =
      createExecutionContext({
        method: 'POST',
        url:
          '/v1/containers',
      });

    const result =
      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            id: 'container-1',
          }),
        ),
      );

    await Promise.resolve();

    expect(result).toEqual({
      id: 'container-1',
    });

    expect(
      auditService.log,
    ).toHaveBeenCalled();
  });

  it.each([
    [
      'POST',
      '/v1/files/upload',
      AuditAction.FILE_UPLOAD,
    ],
    [
      'DELETE',
      '/v1/files/items/photo.jpg',
      AuditAction.FILE_DELETE,
    ],
    [
      'PUT',
      '/v1/items/item-id/restore',
      AuditAction.ITEM_RESTORE,
    ],
    [
      'DELETE',
      '/v1/containers/container-id/permanent',
      AuditAction.CONTAINER_PERMANENT_DELETE,
    ],
  ])(
    'should detect %s %s as %s',
    async (
      method,
      url,
      expectedAction,
    ) => {
      reflector.getAllAndOverride
        .mockReturnValue(
          undefined,
        );

      const context =
        createExecutionContext({
          method,
          url,
          params: {
            id: 'target-id',
          },
        });

      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            id:
              'target-id',
          }),
        ),
      );

      await Promise.resolve();

      expect(
        auditService.log,
      ).toHaveBeenCalledWith(
        expectedAction,
        expect.any(String),
        'target-id',
        expect.any(String),
        undefined,
        expect.any(Object),
        AuditStatus.SUCCESS,
      );
    },
  );
});
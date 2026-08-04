// src/modules/audits/audit.interceptor.spec.ts

import { CallHandler, ExecutionContext, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';

import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { AuditAction, AuditStatus } from './entities/audit-log.entity';
import { AUDIT_ACTION_KEY, SKIP_AUDIT_KEY } from './decorators/audit.decorator';

const flushPromises = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

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
      body: unknown;
      user?: {
        id?: string;
      };
      params: Record<string, string | undefined>;
      headers?: Record<string, string | string[] | undefined>;
      ip: string | undefined;
      statusCode: number;
    }> = {},
  ): ExecutionContext => {
    const request = {
      method: overrides.method ?? 'POST',
      url: overrides.url ?? '/v1/items',
      originalUrl: overrides.originalUrl ?? overrides.url ?? '/v1/items',
      body: overrides.body,
      user: Object.prototype.hasOwnProperty.call(overrides, 'user')
        ? overrides.user
        : {
            id: '550e8400-e29b-41d4-a716-446655440000',
          },
      params: overrides.params ?? {},
      headers: Object.prototype.hasOwnProperty.call(overrides, 'headers')
        ? overrides.headers
        : {
            'user-agent': 'jest-agent',
          },
      ip: Object.prototype.hasOwnProperty.call(overrides, 'ip') ? overrides.ip : '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };

    const response = {
      statusCode: overrides.statusCode ?? 200,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () =>
        function handler() {
          return undefined;
        },
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  };

  const createCallHandler = (value: unknown): CallHandler => ({
    handle: () => of(value),
  });

  beforeEach(() => {
    auditService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    configService.get.mockReturnValue('development');

    auditService.log.mockResolvedValue({} as never);

    interceptor = new AuditInterceptor(auditService, reflector, configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('bypass behavior', () => {
    it('should bypass audit when SkipAudit metadata is enabled', async () => {
      reflector.getAllAndOverride.mockImplementation((metadataKey: unknown) =>
        metadataKey === SKIP_AUDIT_KEY ? true : undefined,
      );

      const context = createExecutionContext();

      const result = await lastValueFrom(
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

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should bypass audit in test environment', async () => {
      configService.get.mockReturnValue('test');

      interceptor = new AuditInterceptor(auditService, reflector, configService);

      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext();

      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            id: 'item-1',
          }),
        ),
      );

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should bypass unknown and read-only routes', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'GET',
        url: '/v1/health',
      });

      const result = await lastValueFrom(
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

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('successful requests', () => {
    it('should use explicit Audit metadata when provided', async () => {
      reflector.getAllAndOverride.mockImplementation((metadataKey: unknown) => {
        if (metadataKey === SKIP_AUDIT_KEY) {
          return false;
        }

        if (metadataKey === AUDIT_ACTION_KEY) {
          return AuditAction.USER_ROLE_CHANGE;
        }

        return undefined;
      });

      const context = createExecutionContext({
        method: 'PATCH',
        url: '/v1/auth/users/user-id/role',
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

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.USER_ROLE_CHANGE,
        expect.any(String),
        'user-id',
        'User',
        undefined,
        expect.objectContaining({
          method: 'PATCH',
          url: '/v1/auth/users/user-id/role',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should detect an item create action and log success', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
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
            id: '550e8400-e29b-41d4-a716-446655440001',
          }),
        ),
      );

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
        'Item',
        {
          request: {
            name: 'Laptop',
          },
        },
        expect.objectContaining({
          ip: '127.0.0.1',
          userAgent: 'jest-agent',
          method: 'POST',
          url: '/v1/items',
          statusCode: 201,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should use request params as target ID when response has no ID', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'DELETE',
        url: '/v1/items/550e8400-e29b-41d4-a716-446655440002',
        params: {
          id: '550e8400-e29b-41d4-a716-446655440002',
        },
        statusCode: 204,
      });

      await lastValueFrom(interceptor.intercept(context, createCallHandler(undefined)));

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
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

    it('should pass raw request body to AuditService for sanitization', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/auth/login',
        body: {
          email: 'admin@example.com',
          password: 'secret-password',
          nested: {
            accessToken: 'secret-token',
            safe: 'visible',
          },
          sessions: [
            {
              refreshToken: 'refresh-secret',
              device: 'browser',
            },
          ],
        },
      });

      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            accessToken: 'response-token',
          }),
        ),
      );

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.LOGIN,
        expect.any(String),
        undefined,
        'Auth',
        {
          request: {
            email: 'admin@example.com',
            password: 'secret-password',
            nested: {
              accessToken: 'secret-token',
              safe: 'visible',
            },
            sessions: [
              {
                refreshToken: 'refresh-secret',
                device: 'browser',
              },
            ],
          },
        },
        expect.objectContaining({
          method: 'POST',
          url: '/v1/auth/login',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should extract target ID from response data.id', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/items',
      });

      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            data: {
              id: 'nested-item-id',
            },
          }),
        ),
      );

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        expect.any(String),
        'nested-item-id',
        'Item',
        undefined,
        expect.objectContaining({
          method: 'POST',
          url: '/v1/items',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should extract target ID from response user.id', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/auth/register',
      });

      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            user: {
              id: 'created-user-id',
            },
          }),
        ),
      );

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.REGISTER,
        expect.any(String),
        'created-user-id',
        'Auth',
        undefined,
        expect.objectContaining({
          method: 'POST',
          url: '/v1/auth/register',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should use params.userId when params.id is unavailable', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'PATCH',
        url: '/v1/auth/users/user-id',
        params: {
          userId: 'user-id',
        },
      });

      await lastValueFrom(interceptor.intercept(context, createCallHandler({})));

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.USER_UPDATE,
        expect.any(String),
        'user-id',
        'User',
        undefined,
        expect.objectContaining({
          method: 'PATCH',
          url: '/v1/auth/users/user-id',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should write only one audit log when the observable emits multiple values', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/items',
      });

      const next: CallHandler = {
        handle: () => of({ id: 'item-1' }, { id: 'item-2' }, { id: 'item-3' }),
      };

      const result = await lastValueFrom(interceptor.intercept(context, next));

      await flushPromises();

      expect(result).toEqual({ id: 'item-3' });
      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        expect.any(String),
        'item-1',
        'Item',
        undefined,
        expect.objectContaining({
          method: 'POST',
          url: '/v1/items',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });
  });

  describe('failed requests', () => {
    it('should log failed requests and rethrow the original error', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'PUT',
        url: '/v1/containers/550e8400-e29b-41d4-a716-446655440003',
        params: {
          id: '550e8400-e29b-41d4-a716-446655440003',
        },
        body: {
          name: 'Updated Container',
        },
      });

      const error = Object.assign(new Error('Container not found'), {
        status: 404,
      });

      const next: CallHandler = {
        handle: () => throwError(() => error),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBe(error);

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.CONTAINER_UPDATE,
        expect.any(String),
        '550e8400-e29b-41d4-a716-446655440003',
        'Container',
        {
          request: {
            name: 'Updated Container',
          },
        },
        expect.objectContaining({
          statusCode: 404,
          duration: expect.any(Number),
        }),
        AuditStatus.FAILED,
        'Container not found',
      );
    });

    it('should use status code from HttpException', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'DELETE',
        url: '/v1/items/item-id',
        params: {
          id: 'item-id',
        },
      });

      const error = new NotFoundException('Item not found');

      const next: CallHandler = {
        handle: () => throwError(() => error),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBe(error);

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_DELETE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          statusCode: 404,
        }),
        AuditStatus.FAILED,
        'Item not found',
      );
    });

    it('should use error.statusCode when status is unavailable', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'DELETE',
        url: '/v1/items/item-id',
        params: {
          id: 'item-id',
        },
      });

      const error = Object.assign(new Error('Request failed'), {
        statusCode: 422,
      });

      const next: CallHandler = {
        handle: () => throwError(() => error),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBe(error);

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_DELETE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          statusCode: 422,
        }),
        AuditStatus.FAILED,
        'Request failed',
      );
    });

    it('should use 500 for invalid error status', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'DELETE',
        url: '/v1/items/item-id',
        params: {
          id: 'item-id',
        },
      });

      const error = Object.assign(new Error('Invalid status'), {
        status: 999,
      });

      const next: CallHandler = {
        handle: () => throwError(() => error),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBe(error);

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_DELETE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          statusCode: 500,
        }),
        AuditStatus.FAILED,
        'Invalid status',
      );
    });

    it('should log unknown error message for non-Error values', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'DELETE',
        url: '/v1/items/item-id',
        params: {
          id: 'item-id',
        },
      });

      const error = {
        status: 400,
        reason: 'Invalid request',
      };

      const next: CallHandler = {
        handle: () => throwError(() => error),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBe(error);

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_DELETE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          statusCode: 400,
        }),
        AuditStatus.FAILED,
        'Unknown error',
      );
    });

    it('should use status 500 for primitive thrown values', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'DELETE',
        url: '/v1/items/item-id',
      });

      const next: CallHandler = {
        handle: () => throwError(() => 'failure'),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBe('failure');

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_DELETE,
        expect.any(String),
        undefined,
        'Item',
        undefined,
        expect.objectContaining({
          statusCode: 500,
        }),
        AuditStatus.FAILED,
        'Unknown error',
      );
    });
  });

  describe('route detection', () => {
    it.each([
      ['POST', '/v1/files/upload', AuditAction.FILE_UPLOAD, 'File'],
      ['DELETE', '/v1/files/items/photo.jpg', AuditAction.FILE_DELETE, 'File'],
      ['PUT', '/v1/items/item-id/restore', AuditAction.ITEM_RESTORE, 'Item'],
      ['DELETE', '/v1/items/item-id/permanent', AuditAction.ITEM_PERMANENT_DELETE, 'Item'],
      [
        'DELETE',
        '/v1/containers/container-id/permanent',
        AuditAction.CONTAINER_PERMANENT_DELETE,
        'Container',
      ],
      [
        'PATCH',
        '/v1/containers/container-id/status',
        AuditAction.CONTAINER_STATUS_CHANGE,
        'Container',
      ],
      ['PATCH', '/v1/containers/container-id/restore', AuditAction.CONTAINER_RESTORE, 'Container'],
      ['POST', '/v1/auth/logout-all', AuditAction.LOGOUT_ALL, 'Auth'],
      ['POST', '/v1/auth/forgot-password', AuditAction.PASSWORD_RESET_REQUEST, 'Auth'],
      ['DELETE', '/v1/auth/sessions/session-id', AuditAction.SESSION_REVOKE, 'Session'],
    ])('should detect %s %s as %s', async (method, url, expectedAction, expectedTargetType) => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
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
            id: 'target-id',
          }),
        ),
      );

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expectedAction,
        expect.any(String),
        'target-id',
        expectedTargetType,
        undefined,
        expect.objectContaining({
          method,
          url,
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });
  });

  describe('request normalization', () => {
    it('should use socket remoteAddress when request ip is unavailable', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/items',
        ip: undefined,
      });

      await lastValueFrom(interceptor.intercept(context, createCallHandler({ id: 'item-id' })));

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          ip: '127.0.0.1',
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should allow audit logging without an authenticated user', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/auth/login',
        user: undefined,
      });

      await lastValueFrom(
        interceptor.intercept(context, createCallHandler({ accessToken: 'token' })),
      );

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.LOGIN,
        undefined,
        undefined,
        'Auth',
        undefined,
        expect.objectContaining({
          method: 'POST',
          url: '/v1/auth/login',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should handle missing user-agent header', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/items',
        headers: undefined,
      });

      await lastValueFrom(interceptor.intercept(context, createCallHandler({ id: 'item-id' })));

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          userAgent: undefined,
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should normalize array user-agent headers', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/items',
        headers: {
          'user-agent': ['proxy-agent', 'browser-agent'],
        },
      });

      await lastValueFrom(interceptor.intercept(context, createCallHandler({ id: 'item-id' })));

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          userAgent: 'proxy-agent, browser-agent',
        }),
        AuditStatus.SUCCESS,
      );
    });

    it.each([
      ['/api/v1/items?include=owner', AuditAction.ITEM_CREATE],
      ['/v2/items/', AuditAction.ITEM_CREATE],
      ['//api//v1//items', AuditAction.ITEM_CREATE],
    ])('should normalize POST %s and detect %s', async (url, expectedAction) => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url,
        originalUrl: url,
      });

      await lastValueFrom(interceptor.intercept(context, createCallHandler({ id: 'item-id' })));

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expectedAction,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          method: 'POST',
          url,
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should omit changes when request body is an array', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/items',
        body: [
          {
            name: 'Item 1',
          },
        ],
      });

      await lastValueFrom(
        interceptor.intercept(
          context,
          createCallHandler({
            id: 'item-id',
          }),
        ),
      );

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          method: 'POST',
          url: '/v1/items',
          statusCode: 200,
          duration: expect.any(Number),
        }),
        AuditStatus.SUCCESS,
      );
    });

    it('should calculate audit duration', async () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1125);

      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/items',
      });

      await lastValueFrom(interceptor.intercept(context, createCallHandler({ id: 'item-id' })));

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        AuditAction.ITEM_CREATE,
        expect.any(String),
        'item-id',
        'Item',
        undefined,
        expect.objectContaining({
          duration: 125,
        }),
        AuditStatus.SUCCESS,
      );
    });
  });

  describe('audit service failures', () => {
    it('should not fail the request and log a warning when audit logging fails on success', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      auditService.log.mockRejectedValue(new Error('Database unavailable'));

      const context = createExecutionContext({
        method: 'POST',
        url: '/v1/containers',
      });

      const result = await lastValueFrom(
        interceptor.intercept(context, createCallHandler({ id: 'container-1' })),
      );

      await flushPromises();

      expect(result).toEqual({ id: 'container-1' });
      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('Unable to save audit log: Database unavailable');
    });

    it('should preserve the original request error when failed audit logging also fails', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const requestError = Object.assign(new Error('Item not found'), {
        status: 404,
      });

      auditService.log.mockRejectedValue(new Error('Audit database unavailable'));

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const context = createExecutionContext({
        method: 'DELETE',
        url: '/v1/items/item-id',
        params: {
          id: 'item-id',
        },
      });

      const next: CallHandler = {
        handle: () => throwError(() => requestError),
      };

      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBe(requestError);

      await flushPromises();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('Unable to save audit log: Audit database unavailable');
    });
  });
});

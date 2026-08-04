// src/modules/cleanup/cleanup.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, QueryRunner } from 'typeorm';

import { ContainersService } from '../containers/containers.service';
import { ItemsService } from '../items/items.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  /**
   * Advisory lock key used to prevent concurrent cleanup runs across multiple replicas.
   * Must be the same for all application instances.
   * String is intentionally used to avoid JavaScript bigint serialization issues with PostgreSQL.
   */
  private static readonly CLEANUP_LOCK_KEY = '734928174003';

  /**
   * Prevents overlapping cleanup runs within the same application instance.
   */
  private cleanupRunning = false;

  constructor(
    private readonly containersService: ContainersService,
    private readonly itemsService: ItemsService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    timeZone: 'Europe/Belgrade',
  })
  async cleanupSoftDeletedData(): Promise<void> {
    if (this.cleanupRunning) {
      this.logger.warn('Soft-delete cleanup is already running in this application instance');
      return;
    }

    this.cleanupRunning = true;

    let queryRunner: QueryRunner | null = null;
    let lockAcquired = false;
    const startedAt = Date.now();

    try {
      // Validate configuration before acquiring any locks or connections
      const containerRetentionDays = this.getRetentionDays(
        'CONTAINER_SOFT_DELETE_RETENTION_DAYS',
        30,
      );

      const itemRetentionDays = this.getRetentionDays('ITEM_SOFT_DELETE_RETENTION_DAYS', 30);

      this.logger.log(
        `Starting soft-delete cleanup: containers=${containerRetentionDays} days, items=${itemRetentionDays} days`,
      );

      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      lockAcquired = await this.tryAcquireCleanupLock(queryRunner);

      if (!lockAcquired) {
        this.logger.log(
          'Soft-delete cleanup skipped because another replica is already running it',
        );
        return;
      }

      let hasFailure = false;

      /*
       * Containers are processed first.
       * Permanent deletion of a container also deletes its items.
       */
      try {
        const deletedContainers =
          await this.containersService.cleanupExpiredContainers(containerRetentionDays);

        this.logger.log(`Permanently deleted ${deletedContainers} expired containers`);
      } catch (error: unknown) {
        hasFailure = true;
        this.logger.error(
          `Container cleanup failed: ${this.getErrorMessage(error)}`,
          this.getErrorStack(error),
        );
      }

      /*
       * Item cleanup continues even if container cleanup failed.
       * This only cleans up items that were individually soft-deleted.
       */
      try {
        const deletedItems = await this.itemsService.cleanupExpiredItems(itemRetentionDays);

        this.logger.log(`Permanently deleted ${deletedItems} expired individual items`);
      } catch (error: unknown) {
        hasFailure = true;
        this.logger.error(
          `Item cleanup failed: ${this.getErrorMessage(error)}`,
          this.getErrorStack(error),
        );
      }

      const durationMs = Date.now() - startedAt;

      if (hasFailure) {
        this.logger.warn(`Soft-delete cleanup completed with failures in ${durationMs}ms`);
      } else {
        this.logger.log(`Soft-delete cleanup completed successfully in ${durationMs}ms`);
      }
    } catch (error: unknown) {
      const durationMs = Date.now() - startedAt;
      this.logger.error(
        `Scheduled soft-delete cleanup failed after ${durationMs}ms: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
    } finally {
      try {
        if (queryRunner && lockAcquired) {
          await this.releaseCleanupLock(queryRunner);
        }
      } finally {
        try {
          if (queryRunner && !queryRunner.isReleased) {
            await queryRunner.release();
          }
        } catch (error: unknown) {
          this.logger.error(
            `Failed to release cleanup database connection: ${this.getErrorMessage(error)}`,
            this.getErrorStack(error),
          );
        } finally {
          this.cleanupRunning = false;
        }
      }
    }
  }

  private getRetentionDays(key: string, defaultValue: number): number {
    const configuredValue = this.configService.get<string | number>(key, defaultValue);

    const retentionDays = Number(configuredValue);

    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      throw new Error(
        `Invalid application configuration: ${key} must be an integer between 1 and 3650`,
      );
    }

    return retentionDays;
  }

  private async tryAcquireCleanupLock(queryRunner: QueryRunner): Promise<boolean> {
    const result = (await queryRunner.query(
      `
        SELECT pg_try_advisory_lock(
          $1::bigint
        ) AS "acquired"
      `,
      [CleanupService.CLEANUP_LOCK_KEY],
    )) as Array<{
      acquired: boolean;
    }>;

    return result[0]?.acquired === true;
  }

  private async releaseCleanupLock(queryRunner: QueryRunner): Promise<void> {
    try {
      const result = (await queryRunner.query(
        `
          SELECT pg_advisory_unlock(
            $1::bigint
          ) AS "released"
        `,
        [CleanupService.CLEANUP_LOCK_KEY],
      )) as Array<{
        released: boolean;
      }>;

      if (result[0]?.released !== true) {
        this.logger.warn('Soft-delete cleanup advisory lock was not held during explicit release');
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to explicitly release cleanup advisory lock: ${this.getErrorMessage(error)}. Releasing the database connection will release the session lock.`,
        this.getErrorStack(error),
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private getErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}

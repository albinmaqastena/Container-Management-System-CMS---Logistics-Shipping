import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class UpdatingVolumeDecimals1786564184864
  implements MigrationInterface
{
  name = 'UpdatingVolumeDecimals1786564184864';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // Containers
    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "totalVolume"
      TYPE NUMERIC(20,10)
      USING "totalVolume"::NUMERIC(20,10)
    `);

    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "usedVolume"
      TYPE NUMERIC(20,10)
      USING "usedVolume"::NUMERIC(20,10)
    `);

    // Items
    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "volume"
      TYPE NUMERIC(20,10)
      USING "volume"::NUMERIC(20,10)
    `);

    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "totalVolume"
      TYPE NUMERIC(24,10)
      USING "totalVolume"::NUMERIC(24,10)
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "totalVolume"
      TYPE NUMERIC(14,2)
      USING ROUND("totalVolume", 2)::NUMERIC(14,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "volume"
      TYPE NUMERIC(12,2)
      USING ROUND("volume", 2)::NUMERIC(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "usedVolume"
      TYPE NUMERIC(12,2)
      USING ROUND("usedVolume", 2)::NUMERIC(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "totalVolume"
      TYPE NUMERIC(12,2)
      USING ROUND("totalVolume", 2)::NUMERIC(12,2)
    `);
  }
}
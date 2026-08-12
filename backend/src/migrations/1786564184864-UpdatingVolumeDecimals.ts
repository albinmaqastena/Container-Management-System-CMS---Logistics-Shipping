import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class UpdatingVolumeDecimals1786564184864
  implements MigrationInterface
{
  name =
    'UpdatingVolumeDecimals1786564184864';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // ============================================================
    // 1. DROP VIEWS THAT DEPEND ON VOLUME COLUMNS
    // ============================================================

    await queryRunner.query(`
      DROP VIEW IF EXISTS "item_details"
    `);

    await queryRunner.query(`
      DROP VIEW IF EXISTS "container_statistics"
    `);

    // ============================================================
    // 2. UPDATE CONTAINERS PRECISION
    // ============================================================

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

    // ============================================================
    // 3. UPDATE ITEMS PRECISION
    // ============================================================

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

    // ============================================================
    // 4. RECREATE CONTAINER STATISTICS VIEW
    // ============================================================

    await queryRunner.query(`
      CREATE VIEW "container_statistics" AS
      SELECT
        c.id AS container_id,
        c.name AS container_name,
        c."containerCode" AS container_code,
        c.status,

        COUNT(i.id) AS total_items,

        c."totalVolume" AS total_volume,
        c."usedVolume" AS used_volume,

        c."totalVolume" - c."usedVolume"
          AS available_volume,

        ROUND(
          (
            c."usedVolume"
            / NULLIF(c."totalVolume", 0)
            * 100
          ),
          2
        ) AS usage_percentage,

        u.username AS created_by,

        c."createdAt" AS created_at,
        c."updatedAt" AS updated_at

      FROM "containers" c

      LEFT JOIN "items" i
        ON c.id = i."containerId"

      LEFT JOIN "users" u
        ON c."createdById" = u.id

      GROUP BY
        c.id,
        c.name,
        c."containerCode",
        c.status,
        c."totalVolume",
        c."usedVolume",
        u.username,
        c."createdAt",
        c."updatedAt"
    `);

    // ============================================================
    // 5. RECREATE ITEM DETAILS VIEW
    // ============================================================

    await queryRunner.query(`
      CREATE VIEW "item_details" AS
      SELECT
        i.id AS item_id,

        i."uniqueNumber"
          AS unique_number,

        i.name AS item_name,

        i.photo,

        i."packageQuantity"
          AS package_quantity,

        i."productsPerPackage"
          AS products_per_package,

        i."packagePrice"
          AS package_price,

        i.volume
          AS volume_per_package,

        i."totalVolume"
          AS total_volume,

        c.id
          AS container_id,

        c.name
          AS container_name,

        c."containerCode"
          AS container_code,

        c.status
          AS container_status,

        u.username
          AS created_by,

        i."createdAt"
          AS created_at,

        i."updatedAt"
          AS updated_at

      FROM "items" i

      JOIN "containers" c
        ON i."containerId" = c.id

      JOIN "users" u
        ON c."createdById" = u.id
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // ============================================================
    // 1. DROP DEPENDENT VIEWS
    // ============================================================

    await queryRunner.query(`
      DROP VIEW IF EXISTS "item_details"
    `);

    await queryRunner.query(`
      DROP VIEW IF EXISTS "container_statistics"
    `);

    // ============================================================
    // 2. RESTORE ITEMS PRECISION
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "totalVolume"
      TYPE NUMERIC(14,2)
      USING ROUND(
        "totalVolume",
        2
      )::NUMERIC(14,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "volume"
      TYPE NUMERIC(12,2)
      USING ROUND(
        "volume",
        2
      )::NUMERIC(12,2)
    `);

    // ============================================================
    // 3. RESTORE CONTAINERS PRECISION
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "usedVolume"
      TYPE NUMERIC(12,2)
      USING ROUND(
        "usedVolume",
        2
      )::NUMERIC(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "totalVolume"
      TYPE NUMERIC(12,2)
      USING ROUND(
        "totalVolume",
        2
      )::NUMERIC(12,2)
    `);

    // ============================================================
    // 4. RECREATE ORIGINAL CONTAINER STATISTICS VIEW
    // ============================================================

    await queryRunner.query(`
      CREATE VIEW "container_statistics" AS
      SELECT
        c.id AS container_id,
        c.name AS container_name,
        c."containerCode" AS container_code,
        c.status,

        COUNT(i.id) AS total_items,

        c."totalVolume"
          AS total_volume,

        c."usedVolume"
          AS used_volume,

        c."totalVolume" - c."usedVolume"
          AS available_volume,

        ROUND(
          (
            c."usedVolume"
            / NULLIF(
              c."totalVolume",
              0
            )
            * 100
          ),
          2
        ) AS usage_percentage,

        u.username AS created_by,

        c."createdAt"
          AS created_at,

        c."updatedAt"
          AS updated_at

      FROM "containers" c

      LEFT JOIN "items" i
        ON c.id = i."containerId"

      LEFT JOIN "users" u
        ON c."createdById" = u.id

      GROUP BY
        c.id,
        c.name,
        c."containerCode",
        c.status,
        c."totalVolume",
        c."usedVolume",
        u.username,
        c."createdAt",
        c."updatedAt"
    `);

    // ============================================================
    // 5. RECREATE ORIGINAL ITEM DETAILS VIEW
    // ============================================================

    await queryRunner.query(`
      CREATE VIEW "item_details" AS
      SELECT
        i.id AS item_id,

        i."uniqueNumber"
          AS unique_number,

        i.name AS item_name,

        i.photo,

        i."packageQuantity"
          AS package_quantity,

        i."productsPerPackage"
          AS products_per_package,

        i."packagePrice"
          AS package_price,

        i.volume
          AS volume_per_package,

        i."totalVolume"
          AS total_volume,

        c.id
          AS container_id,

        c.name
          AS container_name,

        c."containerCode"
          AS container_code,

        c.status
          AS container_status,

        u.username
          AS created_by,

        i."createdAt"
          AS created_at,

        i."updatedAt"
          AS updated_at

      FROM "items" i

      JOIN "containers" c
        ON i."containerId" = c.id

      JOIN "users" u
        ON c."createdById" = u.id
    `);
  }
}
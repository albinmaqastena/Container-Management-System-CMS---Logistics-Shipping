// src/migrations/1785000000000-InitialProductionSchema.ts
import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class InitialProductionSchema1786408503161
  implements MigrationInterface
{
  name = 'InitialProductionSchema1786408503161';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // ============================================================
    // 1. EXTENSIONS
    // ============================================================

    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
    `);

    // ============================================================
    // 2. USERS
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),

        "username" VARCHAR(50) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "password" VARCHAR(255) NOT NULL,

        "role" VARCHAR(50) NOT NULL DEFAULT 'user',
        "isActive" BOOLEAN NOT NULL DEFAULT true,

        "lastLogin" TIMESTAMP WITH TIME ZONE NULL,
        "lastLoginIp" VARCHAR(45) NULL,
        "lastLoginUserAgent" VARCHAR(500) NULL,

        "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
        "locked_until" TIMESTAMP WITH TIME ZONE NULL,

        "reset_password_token" VARCHAR(255) NULL,
        "reset_password_expires" TIMESTAMP WITH TIME ZONE NULL,

        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP WITH TIME ZONE NULL,

        CONSTRAINT "PK_users"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_users_username"
          UNIQUE ("username"),

        CONSTRAINT "UQ_users_email"
          UNIQUE ("email"),

        CONSTRAINT "CHK_users_role"
          CHECK (
            "role" IN (
              'super_admin',
              'admin',
              'user'
            )
          )
      )
    `);

    // ============================================================
    // 3. REFRESH TOKENS
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),

        "token" VARCHAR(64) NOT NULL,

        "user_id" UUID NOT NULL,

        "session_id" UUID NOT NULL DEFAULT uuid_generate_v4(),

        "ip" VARCHAR(45) NULL,
        "user_agent" VARCHAR(500) NULL,

        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,

        "is_active" BOOLEAN NOT NULL DEFAULT true,

        "revoked_at" TIMESTAMP WITH TIME ZONE NULL,
        "revoked_reason" VARCHAR(100) NULL,

        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "PK_refresh_tokens"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_refresh_tokens_token"
          UNIQUE ("token"),

        CONSTRAINT "FK_refresh_tokens_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    // ============================================================
    // 4. CONTAINERS
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "containers" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),

        "name" VARCHAR(100) NOT NULL,

        "containerCode" VARCHAR(50) NOT NULL,

        "totalVolume" NUMERIC(12,2) NOT NULL,

        "usedVolume" NUMERIC(12,2) NOT NULL DEFAULT 0,

        "status" VARCHAR(50) NOT NULL DEFAULT 'active',

        "description" VARCHAR(500) NOT NULL DEFAULT '',

        "createdById" UUID NOT NULL,

        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        "deletedAt" TIMESTAMP WITH TIME ZONE NULL,

        CONSTRAINT "PK_containers"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_containers_containerCode"
          UNIQUE ("containerCode"),

        CONSTRAINT "CHK_containers_status"
          CHECK (
            "status" IN (
              'active',
              'shipped',
              'archived'
            )
          ),

        CONSTRAINT "CHK_containers_totalVolume"
          CHECK ("totalVolume" >= 0),

        CONSTRAINT "CHK_containers_usedVolume"
          CHECK ("usedVolume" >= 0),

        CONSTRAINT "CHK_containers_used_volume"
          CHECK ("usedVolume" <= "totalVolume"),

        CONSTRAINT "FK_containers_createdBy"
          FOREIGN KEY ("createdById")
          REFERENCES "users"("id")
          ON DELETE RESTRICT
      )
    `);

    // ============================================================
    // 5. ITEMS
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),

        "uniqueNumber" VARCHAR(50) NOT NULL,

        "name" VARCHAR(200) NOT NULL,

        "photo" VARCHAR(500) NULL,

        "packageQuantity" INTEGER NOT NULL,

        "productsPerPackage" INTEGER NOT NULL,

        "packagePrice" NUMERIC(12,2) NOT NULL,

        "volume" NUMERIC(12,2) NOT NULL,

        "totalVolume" NUMERIC(14,2) NOT NULL,

        "containerId" UUID NOT NULL,

        "deletedByContainer" BOOLEAN NOT NULL DEFAULT false,

        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        "deletedAt" TIMESTAMP WITH TIME ZONE NULL,

        CONSTRAINT "PK_items"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_items_uniqueNumber"
          UNIQUE ("uniqueNumber"),

        CONSTRAINT "CHK_items_packageQuantity"
          CHECK ("packageQuantity" > 0),

        CONSTRAINT "CHK_items_productsPerPackage"
          CHECK ("productsPerPackage" > 0),

        CONSTRAINT "CHK_items_packagePrice"
          CHECK ("packagePrice" >= 0),

        CONSTRAINT "CHK_items_volume"
          CHECK ("volume" >= 0),

        CONSTRAINT "CHK_items_totalVolume"
          CHECK ("totalVolume" >= 0),

        CONSTRAINT "FK_items_container"
          FOREIGN KEY ("containerId")
          REFERENCES "containers"("id")
          ON DELETE CASCADE
      )
    `);

    // ============================================================
    // 6. AUDIT LOGS
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),

        "action" VARCHAR(50) NOT NULL,

        "status" VARCHAR(20) NOT NULL DEFAULT 'success',

        "userId" UUID NULL,

        "targetId" UUID NULL,

        "targetType" VARCHAR(100) NULL,

        "changes" JSONB NULL,

        "metadata" JSONB NULL,

        "errorMessage" TEXT NULL,

        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "PK_audit_logs"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_audit_logs_user"
          FOREIGN KEY ("userId")
          REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    // ============================================================
    // 7. USERS INDEXES
    // ============================================================

    await queryRunner.query(`
      CREATE INDEX "idx_users_role"
      ON "users" ("role")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_users_isActive"
      ON "users" ("isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_users_deletedAt"
      ON "users" ("deletedAt")
    `);

    // email dhe username nuk kanë nevojë për index tjetër,
    // sepse UNIQUE constraints krijojnë index vetë.

    // ============================================================
    // 8. REFRESH TOKEN INDEXES
    // ============================================================

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_user_active"
      ON "refresh_tokens" (
        "user_id",
        "is_active"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_session_id"
      ON "refresh_tokens" (
        "session_id"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_user_session_active"
      ON "refresh_tokens" (
        "user_id",
        "session_id",
        "is_active"
      )
    `);

    // ============================================================
    // 9. CONTAINER INDEXES
    // ============================================================

    await queryRunner.query(`
      CREATE INDEX "idx_containers_status"
      ON "containers" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_containers_createdById"
      ON "containers" ("createdById")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_containers_createdAt"
      ON "containers" ("createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_containers_deletedAt"
      ON "containers" ("deletedAt")
    `);

    // containerCode është UNIQUE,
    // prandaj PostgreSQL krijon index automatikisht.

    // ============================================================
    // 10. ITEM INDEXES
    // ============================================================

    await queryRunner.query(`
      CREATE INDEX "idx_items_name"
      ON "items" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_items_containerId"
      ON "items" ("containerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_items_createdAt"
      ON "items" ("createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_items_deletedAt"
      ON "items" ("deletedAt")
    `);

    // uniqueNumber është UNIQUE,
    // kështu që index i veçantë nuk nevojitet.

    // ============================================================
    // 11. AUDIT LOG INDEXES
    // ============================================================

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_user_created"
      ON "audit_logs" (
        "userId",
        "createdAt"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_action_created"
      ON "audit_logs" (
        "action",
        "createdAt"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_status_created"
      ON "audit_logs" (
        "status",
        "createdAt"
      )
    `);

    // ============================================================
    // 12. UPDATED AT FUNCTION
    //
    // Ky është i vetmi legacy trigger/function që migration-i
    // AlignDatabaseWithEntities NUK e heq.
    // ============================================================

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updatedAt" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_users_updated_at
      BEFORE UPDATE ON "users"
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_containers_updated_at
      BEFORE UPDATE ON "containers"
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_items_updated_at
      BEFORE UPDATE ON "items"
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `);

    // ============================================================
    // 13. VIEWS
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
        c."totalVolume" - c."usedVolume" AS available_volume,
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

    await queryRunner.query(`
      CREATE VIEW "item_details" AS
      SELECT
        i.id AS item_id,
        i."uniqueNumber" AS unique_number,
        i.name AS item_name,
        i.photo,
        i."packageQuantity" AS package_quantity,
        i."productsPerPackage" AS products_per_package,
        i."packagePrice" AS package_price,
        i.volume AS volume_per_package,
        i."totalVolume" AS total_volume,
        c.id AS container_id,
        c.name AS container_name,
        c."containerCode" AS container_code,
        c.status AS container_status,
        u.username AS created_by,
        i."createdAt" AS created_at,
        i."updatedAt" AS updated_at
      FROM "items" i
      JOIN "containers" c
        ON i."containerId" = c.id
      JOIN "users" u
        ON c."createdById" = u.id
    `);

    await queryRunner.query(`
      CREATE VIEW "user_activity" AS
      SELECT
        u.id AS user_id,
        u.username,
        u.email,
        u.role,
        u."isActive" AS is_active,
        u."lastLogin" AS last_login,
        u."lastLoginIp" AS last_login_ip,
        COUNT(DISTINCT c.id) AS containers_created,
        COUNT(DISTINCT i.id) AS items_added,
        u."createdAt" AS created_at
      FROM "users" u
      LEFT JOIN "containers" c
        ON u.id = c."createdById"
      LEFT JOIN "items" i
        ON u.id = (
          SELECT "createdById"
          FROM "containers"
          WHERE id = i."containerId"
        )
      GROUP BY
        u.id,
        u.username,
        u.email,
        u.role,
        u."isActive",
        u."lastLogin",
        u."lastLoginIp",
        u."createdAt"
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // ============================================================
    // VIEWS
    // ============================================================

    await queryRunner.query(`
      DROP VIEW IF EXISTS "user_activity"
    `);

    await queryRunner.query(`
      DROP VIEW IF EXISTS "item_details"
    `);

    await queryRunner.query(`
      DROP VIEW IF EXISTS "container_statistics"
    `);

    // ============================================================
    // TRIGGERS
    // ============================================================

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS
      trigger_items_updated_at
      ON "items"
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS
      trigger_containers_updated_at
      ON "containers"
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS
      trigger_users_updated_at
      ON "users"
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS
      update_updated_at_column()
    `);

    // ============================================================
    // TABLES
    // Reverse dependency order
    // ============================================================

    await queryRunner.query(`
      DROP TABLE IF EXISTS "audit_logs"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "items"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "containers"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "refresh_tokens"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "users"
    `);
  }
}

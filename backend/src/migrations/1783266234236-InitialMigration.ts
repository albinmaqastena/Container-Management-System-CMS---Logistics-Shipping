// src/migrations/(timestamp)-InitialMigration.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1783266234236 implements MigrationInterface {
  name = 'InitialMigration1783266234236';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // 1. ENABLE EXTENSIONS
    // ============================================
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ============================================
    // 2. CREATE USERS TABLE
    // ============================================
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "username" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "role" VARCHAR(50) NOT NULL DEFAULT 'user',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "lastLogin" TIMESTAMP,
        "lastLoginIp" VARCHAR(45),
        "lastLoginUserAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "CHK_users_role" CHECK (role IN ('super_admin', 'admin', 'user'))
      )
    `);

    // ============================================
    // 3. CREATE CONTAINERS TABLE
    // ============================================
    await queryRunner.query(`
      CREATE TABLE "containers" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "name" VARCHAR(255) NOT NULL,
        "containerCode" VARCHAR(255) NOT NULL,
        "totalVolume" DECIMAL(10,2) NOT NULL,
        "usedVolume" DECIMAL(10,2) NOT NULL DEFAULT 0,
        "status" VARCHAR(50) NOT NULL DEFAULT 'active',
        "description" TEXT,
        "createdById" UUID NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_containers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_containers_containerCode" UNIQUE ("containerCode"),
        CONSTRAINT "CHK_containers_status" CHECK (status IN ('active', 'shipped', 'archived')),
        CONSTRAINT "CHK_containers_totalVolume" CHECK ("totalVolume" >= 0),
        CONSTRAINT "CHK_containers_usedVolume" CHECK ("usedVolume" >= 0),
        CONSTRAINT "CHK_containers_used_volume" CHECK ("usedVolume" <= "totalVolume"),
        CONSTRAINT "FK_containers_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // ============================================
    // 4. CREATE ITEMS TABLE
    // ============================================
    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "uniqueNumber" VARCHAR(255) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "photo" VARCHAR(500),
        "packageQuantity" INTEGER NOT NULL,
        "productsPerPackage" INTEGER NOT NULL,
        "packagePrice" DECIMAL(10,2) NOT NULL,
        "volume" DECIMAL(10,2) NOT NULL,
        "totalVolume" DECIMAL(10,2) NOT NULL,
        "containerId" UUID NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_items_uniqueNumber" UNIQUE ("uniqueNumber"),
        CONSTRAINT "CHK_items_packageQuantity" CHECK ("packageQuantity" > 0),
        CONSTRAINT "CHK_items_productsPerPackage" CHECK ("productsPerPackage" > 0),
        CONSTRAINT "CHK_items_packagePrice" CHECK ("packagePrice" >= 0),
        CONSTRAINT "CHK_items_volume" CHECK ("volume" >= 0),
        CONSTRAINT "CHK_items_totalVolume" CHECK ("totalVolume" >= 0),
        CONSTRAINT "FK_items_container" FOREIGN KEY ("containerId") REFERENCES "containers"("id") ON DELETE CASCADE
      )
    `);

    // ============================================
    // 5. CREATE INDEXES
    // ============================================
    // Users indexes
    await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users"("email")`);
    await queryRunner.query(`CREATE INDEX "idx_users_username" ON "users"("username")`);
    await queryRunner.query(`CREATE INDEX "idx_users_role" ON "users"("role")`);
    await queryRunner.query(`CREATE INDEX "idx_users_isActive" ON "users"("isActive")`);

    // Containers indexes
    await queryRunner.query(
      `CREATE INDEX "idx_containers_containerCode" ON "containers"("containerCode")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_containers_status" ON "containers"("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_containers_createdById" ON "containers"("createdById")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_containers_createdAt" ON "containers"("createdAt" DESC)`,
    );

    // Items indexes
    await queryRunner.query(`CREATE INDEX "idx_items_uniqueNumber" ON "items"("uniqueNumber")`);
    await queryRunner.query(`CREATE INDEX "idx_items_name" ON "items"("name")`);
    await queryRunner.query(`CREATE INDEX "idx_items_containerId" ON "items"("containerId")`);
    await queryRunner.query(`CREATE INDEX "idx_items_createdAt" ON "items"("createdAt" DESC)`);

    // ============================================
    // 6. CREATE FUNCTIONS & TRIGGERS
    // ============================================

    // 6.1 Update updated_at
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

    // 6.2 Calculate item total volume
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION calculate_item_total_volume()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW."totalVolume" = NEW."packageQuantity" * NEW."volume";
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_items_calculate_total_volume
      BEFORE INSERT OR UPDATE OF "packageQuantity", "volume" ON "items"
      FOR EACH ROW
      EXECUTE FUNCTION calculate_item_total_volume()
    `);

    // 6.3 Generate container code
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_container_code()
      RETURNS TRIGGER AS $$
      DECLARE
          timestamp_part TEXT;
          name_part TEXT;
      BEGIN
          timestamp_part := EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000;
          name_part := UPPER(SUBSTRING(NEW."name" FROM 1 FOR 3));
          NEW."containerCode" := timestamp_part || '-' || name_part;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_containers_generate_code
      BEFORE INSERT ON "containers"
      FOR EACH ROW
      EXECUTE FUNCTION generate_container_code()
    `);

    // 6.4 Update container used volume
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_container_used_volume()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE "containers" 
              SET "usedVolume" = (
                  SELECT COALESCE(SUM("totalVolume"), 0) 
                  FROM "items" 
                  WHERE "containerId" = NEW."containerId"
              )
              WHERE "id" = NEW."containerId";
              RETURN NEW;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE "containers" 
              SET "usedVolume" = (
                  SELECT COALESCE(SUM("totalVolume"), 0) 
                  FROM "items" 
                  WHERE "containerId" = OLD."containerId"
              )
              WHERE "id" = OLD."containerId";
              RETURN OLD;
          ELSIF TG_OP = 'UPDATE' THEN
              UPDATE "containers" 
              SET "usedVolume" = (
                  SELECT COALESCE(SUM("totalVolume"), 0) 
                  FROM "items" 
                  WHERE "containerId" = NEW."containerId"
              )
              WHERE "id" = NEW."containerId";
              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_items_update_container_volume_insert
      AFTER INSERT ON "items"
      FOR EACH ROW
      EXECUTE FUNCTION update_container_used_volume()
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_items_update_container_volume_delete
      AFTER DELETE ON "items"
      FOR EACH ROW
      EXECUTE FUNCTION update_container_used_volume()
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_items_update_container_volume_update
      AFTER UPDATE OF "totalVolume" ON "items"
      FOR EACH ROW
      EXECUTE FUNCTION update_container_used_volume()
    `);

    // 6.5 Check container capacity before insert
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_container_capacity()
      RETURNS TRIGGER AS $$
      DECLARE
          available_vol DECIMAL(10, 2);
      BEGIN
          SELECT "totalVolume" - "usedVolume" INTO available_vol
          FROM "containers"
          WHERE "id" = NEW."containerId";
          
          IF NEW."totalVolume" > available_vol THEN
              RAISE EXCEPTION 'Not enough volume in container. Available: %, Required: %', 
                  available_vol, NEW."totalVolume";
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_items_check_capacity
      BEFORE INSERT ON "items"
      FOR EACH ROW
      EXECUTE FUNCTION check_container_capacity()
    `);

    // ============================================
    // 7. CREATE VIEWS
    // ============================================

    // 7.1 Container statistics view
    await queryRunner.query(`
      CREATE OR REPLACE VIEW container_statistics AS
      SELECT 
          c.id AS container_id,
          c.name AS container_name,
          c."containerCode" AS container_code,
          c.status,
          COUNT(i.id) AS total_items,
          c."totalVolume" AS total_volume,
          c."usedVolume" AS used_volume,
          c."totalVolume" - c."usedVolume" AS available_volume,
          ROUND((c."usedVolume" / NULLIF(c."totalVolume", 0) * 100), 2) AS usage_percentage,
          u.username AS created_by,
          c."createdAt" AS created_at,
          c."updatedAt" AS updated_at
      FROM containers c
      LEFT JOIN items i ON c.id = i."containerId"
      LEFT JOIN users u ON c."createdById" = u.id
      GROUP BY c.id, c.name, c."containerCode", c.status, c."totalVolume", c."usedVolume", u.username, c."createdAt", c."updatedAt"
    `);

    // 7.2 Item details view
    await queryRunner.query(`
      CREATE OR REPLACE VIEW item_details AS
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
      FROM items i
      JOIN containers c ON i."containerId" = c.id
      JOIN users u ON c."createdById" = u.id
    `);

    // 7.3 User activity view
    await queryRunner.query(`
      CREATE OR REPLACE VIEW user_activity AS
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
      FROM users u
      LEFT JOIN containers c ON u.id = c."createdById"
      LEFT JOIN items i ON u.id = (SELECT "createdById" FROM containers WHERE id = i."containerId")
      GROUP BY u.id, u.username, u.email, u.role, u."isActive", u."lastLogin", u."lastLoginIp", u."createdAt"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // DROP IN REVERSE ORDER
    // ============================================

    // Drop views
    await queryRunner.query(`DROP VIEW IF EXISTS user_activity`);
    await queryRunner.query(`DROP VIEW IF EXISTS item_details`);
    await queryRunner.query(`DROP VIEW IF EXISTS container_statistics`);

    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_items_check_capacity ON "items"`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_items_update_container_volume_update ON "items"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_items_update_container_volume_delete ON "items"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_items_update_container_volume_insert ON "items"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_containers_generate_code ON "containers"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_items_calculate_total_volume ON "items"`,
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_users_updated_at ON "users"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_containers_updated_at ON "containers"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_items_updated_at ON "items"`);

    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_container_capacity()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_container_used_volume()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_container_code()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS calculate_item_total_volume()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column()`);

    // Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "containers" DROP CONSTRAINT IF EXISTS "FK_containers_createdBy"`,
    );
    await queryRunner.query(`ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "FK_items_container"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_containerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_uniqueNumber"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_containers_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_containers_containerCode"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_containers_createdById"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_containers_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_username"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_isActive"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP TABLE "containers"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}

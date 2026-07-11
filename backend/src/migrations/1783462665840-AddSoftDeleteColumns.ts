// src/migrations/xxxxxxxxxxxxxx-AddSoftDeleteColumns.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteColumns1783462665840 implements MigrationInterface {
  name = 'AddSoftDeleteColumns1783462665840';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // 1. Shto kolonën deleted_at në tabelën users
    // ============================================
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "deletedAt" TIMESTAMP NULL
    `);

    // ============================================
    // 2. Shto kolonën deleted_at në tabelën containers
    // ============================================
    await queryRunner.query(`
      ALTER TABLE "containers"
      ADD COLUMN "deletedAt" TIMESTAMP NULL
    `);

    // ============================================
    // 3. Shto kolonën deleted_at në tabelën items
    // ============================================
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD COLUMN "deletedAt" TIMESTAMP NULL
    `);

    // ============================================
    // 4. Krijo indekse për performancë (opsionale)
    // ============================================
    await queryRunner.query(`
      CREATE INDEX "idx_users_deletedAt" ON "users" ("deletedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_containers_deletedAt" ON "containers" ("deletedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_items_deletedAt" ON "items" ("deletedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // KTHE NDRYSHIMET (Nëse nevojitet)
    // ============================================

    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_items_deletedAt"`);
    await queryRunner.query(`DROP INDEX "idx_containers_deletedAt"`);
    await queryRunner.query(`DROP INDEX "idx_users_deletedAt"`);

    // Drop columns
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "containers" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
  }
}

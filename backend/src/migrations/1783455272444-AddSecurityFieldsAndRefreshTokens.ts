// src/migrations/20260707123458-AddSecurityFieldsAndRefreshTokens.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSecurityFieldsAndRefreshTokens1783455272444
  implements MigrationInterface
{
  name = 'AddSecurityFieldsAndRefreshTokens1783455272444';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // 1. SHTO FUSHAT E REJA NË TABELËN USERS
    // ============================================
    
    // ✅ failed_login_attempts
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "failed_login_attempts" 
      INTEGER NOT NULL DEFAULT 0
    `);

    // ✅ locked_until
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "locked_until" 
      TIMESTAMP
    `);

    // ✅ reset_password_token
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "reset_password_token" 
      VARCHAR(255)
    `);

    // ✅ reset_password_expires
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "reset_password_expires" 
      TIMESTAMP
    `);

    console.log('✅ Users table updated with security fields');

    // ============================================
    // 2. KRIJO TABELËN REFRESH_TOKENS
    // ============================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "token" VARCHAR(255) NOT NULL UNIQUE,
        "user_id" UUID NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "revoked_at" TIMESTAMP,
        "revoked_reason" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" 
          FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") 
          ON DELETE CASCADE
      )
    `);

    // ✅ Krijo indeks për performancë
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_token" 
      ON "refresh_tokens"("token")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user_id" 
      ON "refresh_tokens"("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires_at" 
      ON "refresh_tokens"("expires_at")
    `);

    console.log('✅ Refresh tokens table created');

    // ============================================
    // 3. PËRDITËSO ADMIN-IN ME ARGON2 (Nëse përdoret)
    // ============================================
    // Nëse kalojmë nga bcrypt në Argon2, duhet të përditësojmë password-in e admin-it
    // Kjo bëhet më vonë përmes një migrimi të veçantë ose manualisht
    
    // ============================================
    // 4. VERIFIKO NDRYSHIMET
    // ============================================
    const usersColumns = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('📊 Users columns:', usersColumns.map(c => c.column_name));

    const tables = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'containers', 'items', 'refresh_tokens')
    `);
    console.log('📊 Tables:', tables.map(t => t.table_name));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // 1. FSHI TABELËN REFRESH_TOKENS
    // ============================================
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);

    // ============================================
    // 2. FSHI FUSHAT E REJA NGA USERS
    // ============================================
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "failed_login_attempts"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "locked_until"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "reset_password_token"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "reset_password_expires"
    `);

    console.log('✅ Security fields removed');
  }
}

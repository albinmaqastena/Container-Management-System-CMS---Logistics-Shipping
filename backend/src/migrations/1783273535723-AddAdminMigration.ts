// src/migrations/20260105123456-AddAdminUser.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminMigration1783273535723 implements MigrationInterface {
  name = 'AddAdminMigration1783273535723';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if an admin already exists (optional, prevents duplicate entries)
    const adminExists = await queryRunner.query(
      `SELECT id FROM "users" WHERE email = 'admin@example.com' LIMIT 1`,
    );

    if (adminExists.length === 0) {
      // Insert the admin user
      // The password hash is for "admin123" (bcrypt, salt rounds 10)
      await queryRunner.query(
        `INSERT INTO "users" (
          "id",
          "username",
          "email",
          "password",
          "role",
          "isActive",
          "createdAt",
          "updatedAt"
        ) VALUES (
          uuid_generate_v4(),
          'admin',
          'admin@example.com',
          '$2b$10$dep9eh23XTvooA0AQ7CVRuJ5kGXukX3jbjK4jURQcZFe6kw5c7Q7i',
          'admin',
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )`,
      );
    } else {
      console.log('Admin user already exists, skipping insertion.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the admin user by email (or username) if needed
    await queryRunner.query(`DELETE FROM "users" WHERE email = 'admin@example.com'`);
  }
}

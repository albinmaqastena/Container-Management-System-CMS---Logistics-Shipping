// src/migrations/20260707123456-UpdateAdminPassword.ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class UpdateAdminPassword20260707123456 implements MigrationInterface {
  name = 'UpdateAdminPassword20260707123456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Gjenero hash-in e saktë për 'admin123'
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Përditëso password-in e admin-it
    await queryRunner.query(
      `UPDATE "users" SET "password" = '${hashedPassword}' WHERE "email" = 'admin@example.com'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Kthe password-in e vjetër (opsionale)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await queryRunner.query(
      `UPDATE "users" SET "password" = '${hashedPassword}' WHERE "email" = 'admin@example.com'`
    );
  }
}
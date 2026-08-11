// src/migrations/1785000000001-CreateInitialAdmins.ts

import { MigrationInterface, QueryRunner } from 'typeorm';
import * as argon2 from 'argon2';

export class CreateInitialAdmins1786409463217
  implements MigrationInterface
{
  name = 'CreateInitialAdmins1786409463217';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const password = 'Password123@';

    // Same configuration as src/scripts/generate-hash.ts
    const superAdminHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 3,
      parallelism: 1,
      hashLength: 32,
    });

    // Generate a separate hash for the admin.
    // Same password, different random salt => different hash.
    const adminHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 3,
      parallelism: 1,
      hashLength: 32,
    });

    // ============================================================
    // SUPER ADMIN
    // ============================================================

    await queryRunner.query(
      `
      INSERT INTO "users" (
        "username",
        "email",
        "password",
        "role",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        'super_admin',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("email")
      DO UPDATE SET
        "username" = EXCLUDED."username",
        "password" = EXCLUDED."password",
        "role" = EXCLUDED."role",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      [
        'superadmin',
        'amaqastena783@gmail.com',
        superAdminHash,
      ],
    );

    // ============================================================
    // ADMIN
    // ============================================================

    await queryRunner.query(
      `
      INSERT INTO "users" (
        "username",
        "email",
        "password",
        "role",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        'admin',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("email")
      DO UPDATE SET
        "username" = EXCLUDED."username",
        "password" = EXCLUDED."password",
        "role" = EXCLUDED."role",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      [
        'admin',
        'jonimix2023@gmail.com',
        adminHash,
      ],
    );

    console.log('Initial administrator accounts created.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "users"
      WHERE "email" IN ($1, $2)
      `,
      [
        'amaqastena783@gmail.com',
        'jonimix2023@gmail.com',
      ],
    );
  }
}

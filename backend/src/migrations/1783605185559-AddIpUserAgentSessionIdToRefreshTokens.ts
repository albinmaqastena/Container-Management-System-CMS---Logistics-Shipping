// src/migrations/AddCascadeDeleteToItems.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIpUserAgentSessionIdToRefreshTokens1783605185559 implements MigrationInterface {
    public name = 'AddIpUserAgentSessionIdToRefreshTokens1783605185559';
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hiq constraint-in ekzistues
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "FK_items_container"`,
    );

    // Shto constraint-in e ri me CASCADE
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_container" 
       FOREIGN KEY ("containerId") REFERENCES "containers"("id") 
       ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_container"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_container" 
       FOREIGN KEY ("containerId") REFERENCES "containers"("id")`,
    );
  }
}
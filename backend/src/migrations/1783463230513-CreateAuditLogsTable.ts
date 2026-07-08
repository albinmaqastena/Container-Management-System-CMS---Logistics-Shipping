// src/migrations/xxxxxxxxxxxxxx-CreateAuditLogsTable.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1783463230513 implements MigrationInterface {
  name = 'CreateAuditLogsTable1783463230513';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "action" VARCHAR(50) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'success',
        "userId" UUID,
        "targetId" VARCHAR(255),
        "targetType" VARCHAR(50),
        "changes" JSONB,
        "metadata" JSONB,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_audit_logs_userId_createdAt" ON "audit_logs" ("userId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_action_createdAt" ON "audit_logs" ("action", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_audit_logs_action_createdAt"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_userId_createdAt"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}

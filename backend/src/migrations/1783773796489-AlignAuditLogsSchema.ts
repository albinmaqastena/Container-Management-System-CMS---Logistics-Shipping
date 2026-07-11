import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AlignAuditLogsSchema1783773796489
  implements MigrationInterface
{
  name =
    'AlignAuditLogsSchema1783773796489';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "createdAt"
      TYPE TIMESTAMP WITH TIME ZONE
      USING "createdAt" AT TIME ZONE 'UTC'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_audit_logs_status_created"
      ON "audit_logs"
      ("status", "createdAt")
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_audit_logs_status_created"
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "createdAt"
      TYPE TIMESTAMP
      USING "createdAt" AT TIME ZONE 'UTC'
    `);
  }
}
// src/migrations/{timestamp}-AlignDatabaseWithEntities.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

interface CapturedView {
  schemaName: string;
  viewName: string;
  definition: string;
  owner: string | null;
  grants: Array<{
    grantee: string;
    privilegeType: string;
  }>;
}

interface DiscoveredView {
  schemaName: string;
  viewName: string;
}

export class AlignDatabaseWithEntities1784672496847 implements MigrationInterface {
  name = 'AlignDatabaseWithEntities1784672496847';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const sourceTimeZone = 'Europe/Warsaw';

    // =============================================================
    // 0. Ensure uuid-ossp extension exists (fail fast if missing)
    // =============================================================
    const uuidExtension = await queryRunner.query(`
      SELECT 1
      FROM pg_extension
      WHERE extname = 'uuid-ossp'
    `);
    if (uuidExtension.length === 0) {
      throw new Error(
        'PostgreSQL extension "uuid-ossp" is required but not installed. Please install it before running this migration.',
      );
    }

    // =============================================================
    // 1. Helper functions
    // =============================================================

    const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        `,
        [tableName, columnName],
      );
      return result.length > 0;
    };

    const getColumnType = async (tableName: string, columnName: string): Promise<string | null> => {
      const result = await queryRunner.query(
        `
          SELECT data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        `,
        [tableName, columnName],
      );
      return result.length ? result[0].data_type : null;
    };

    const getColumnMaxLength = async (
      tableName: string,
      columnName: string,
    ): Promise<number | null> => {
      const result = await queryRunner.query(
        `
          SELECT character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        `,
        [tableName, columnName],
      );
      if (!result.length || result[0].character_maximum_length === null) {
        return null;
      }
      return Number(result[0].character_maximum_length);
    };

    const convertRequiredToTimestamptz = async (
      tableName: string,
      columnName: string,
    ): Promise<void> => {
      const type = await getColumnType(tableName, columnName);
      if (!type) {
        throw new Error(`Required column ${tableName}.${columnName} does not exist.`);
      }
      const normalizedType = type.trim().toLowerCase();
      if (normalizedType === 'timestamp with time zone') {
        return;
      }
      if (normalizedType === 'timestamp without time zone') {
        await queryRunner.query(`
          ALTER TABLE "${tableName}"
          ALTER COLUMN "${columnName}" TYPE TIMESTAMP WITH TIME ZONE
          USING "${columnName}" AT TIME ZONE '${sourceTimeZone}'
        `);
        return;
      }
      throw new Error(
        `Cannot convert ${tableName}.${columnName} (type: ${type}) to TIMESTAMP WITH TIME ZONE.`,
      );
    };

    const ensureDeletedAt = async (tableName: string): Promise<void> => {
      const exists = await columnExists(tableName, 'deletedAt');
      if (!exists) {
        await queryRunner.query(`
          ALTER TABLE "${tableName}"
          ADD COLUMN "deletedAt" TIMESTAMP WITH TIME ZONE NULL
        `);
      }
    };

    const ensureRequiredColumnLength = async (
      tableName: string,
      columnName: string,
      maxLength: number,
    ): Promise<void> => {
      const exists = await columnExists(tableName, columnName);
      if (!exists) {
        throw new Error(`Required column ${tableName}.${columnName} does not exist.`);
      }

      const currentType = await getColumnType(tableName, columnName);
      const currentMaxLength = await getColumnMaxLength(tableName, columnName);

      const supportedTypes = ['character varying', 'character', 'text'];
      if (!currentType || !supportedTypes.includes(currentType)) {
        throw new Error(
          `Cannot convert ${tableName}.${columnName} from ${currentType ?? 'missing'} to VARCHAR(${maxLength}). Only character/text columns are supported.`,
        );
      }

      if (currentType === 'character varying' && currentMaxLength === maxLength) {
        return;
      }

      const longValues = await queryRunner.query(
        `
          SELECT "id"
          FROM "${tableName}"
          WHERE LENGTH("${columnName}") > $1
          LIMIT 10
        `,
        [maxLength],
      );
      if (longValues.length > 0) {
        throw new Error(
          `Cannot shrink ${tableName}.${columnName} to VARCHAR(${maxLength}): oversized values exist.`,
        );
      }

      await queryRunner.query(`
        ALTER TABLE "${tableName}"
        ALTER COLUMN "${columnName}" TYPE VARCHAR(${maxLength})
      `);
    };

    const ensureColumnType = async (
      tableName: string,
      columnName: string,
      targetType: string,
      usingExpression?: string,
    ): Promise<void> => {
      const exists = await columnExists(tableName, columnName);
      if (!exists) {
        await queryRunner.query(`
          ALTER TABLE "${tableName}"
          ADD COLUMN "${columnName}" ${targetType} NULL
        `);
        return;
      }
      const currentType = await getColumnType(tableName, columnName);
      const normalizedTarget = targetType.trim().toLowerCase();
      const normalizedCurrent = currentType?.trim().toLowerCase();

      if (normalizedCurrent === normalizedTarget) {
        return;
      }

      if (normalizedTarget === 'uuid') {
        if (normalizedCurrent !== 'character varying' && normalizedCurrent !== 'text') {
          throw new Error(
            `Cannot convert ${tableName}.${columnName} from ${currentType} to UUID. Only VARCHAR or TEXT columns can be converted.`,
          );
        }
        const invalidValues = await queryRunner.query(
          `
            SELECT "id", "${columnName}"
            FROM "${tableName}"
            WHERE "${columnName}" IS NOT NULL
              AND "${columnName}" <> ''
              AND "${columnName}" !~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            LIMIT 10
          `,
        );
        if (invalidValues.length > 0) {
          throw new Error(
            `Cannot convert ${tableName}.${columnName} to UUID: invalid values exist.`,
          );
        }
      }

      await queryRunner.query(`
        ALTER TABLE "${tableName}"
        ALTER COLUMN "${columnName}" TYPE ${targetType}
        ${usingExpression ? `USING ${usingExpression}` : ''}
      `);
    };

    // =============================================================
    // 2. Find all views that depend on the tables we're modifying
    // =============================================================

    const dependentViewRows = (await queryRunner.query(`
      SELECT DISTINCT
        view_namespace.nspname AS "schemaName",
        view_class.relname AS "viewName"
      FROM pg_depend dependency
      INNER JOIN pg_rewrite rewrite
        ON rewrite.oid = dependency.objid
      INNER JOIN pg_class view_class
        ON view_class.oid = rewrite.ev_class
      INNER JOIN pg_namespace view_namespace
        ON view_namespace.oid = view_class.relnamespace
      INNER JOIN pg_class referenced_class
        ON referenced_class.oid = dependency.refobjid
      INNER JOIN pg_namespace referenced_namespace
        ON referenced_namespace.oid = referenced_class.relnamespace
      WHERE view_class.relkind = 'v'
        AND view_namespace.nspname = 'public'
        AND referenced_namespace.nspname = 'public'
        AND referenced_class.relname IN (
          'users',
          'refresh_tokens',
          'containers',
          'items',
          'audit_logs'
        )
        AND view_class.oid <> referenced_class.oid
      ORDER BY view_namespace.nspname, view_class.relname
    `)) as DiscoveredView[];

    // Build a set of all discovered views (schema.view)
    const managedViewKeys = new Set(
      dependentViewRows.map((view: DiscoveredView) => `${view.schemaName}.${view.viewName}`),
    );

    // =============================================================
    // 3. Determine view dependencies for topological ordering
    // =============================================================

    const viewNameValues = dependentViewRows.map((view: DiscoveredView) => view.viewName);

    let viewDependencies: Array<{
      dependentSchema: string;
      dependentView: string;
      referencedSchema: string;
      referencedView: string;
    }> = [];

    if (viewNameValues.length > 0) {
      const dependentPlaceholders = viewNameValues.map((_, index) => `$${index + 1}`).join(', ');

      const referencedPlaceholders = viewNameValues
        .map((_, index) => `$${viewNameValues.length + index + 1}`)
        .join(', ');

      viewDependencies = (await queryRunner.query(
        `
          SELECT DISTINCT
            dependent_namespace.nspname AS "dependentSchema",
            dependent_view.relname AS "dependentView",
            referenced_namespace.nspname AS "referencedSchema",
            referenced_view.relname AS "referencedView"
          FROM pg_depend dependency
          INNER JOIN pg_rewrite rewrite
            ON rewrite.oid = dependency.objid
          INNER JOIN pg_class dependent_view
            ON dependent_view.oid = rewrite.ev_class
          INNER JOIN pg_namespace dependent_namespace
            ON dependent_namespace.oid = dependent_view.relnamespace
          INNER JOIN pg_class referenced_view
            ON referenced_view.oid = dependency.refobjid
          INNER JOIN pg_namespace referenced_namespace
            ON referenced_namespace.oid = referenced_view.relnamespace
          WHERE dependent_view.relkind = 'v'
            AND referenced_view.relkind = 'v'
            AND dependent_namespace.nspname = 'public'
            AND referenced_namespace.nspname = 'public'
            AND dependent_view.oid <> referenced_view.oid
            AND dependent_view.relname IN (${dependentPlaceholders})
            AND referenced_view.relname IN (${referencedPlaceholders})
          ORDER BY dependent_view.relname, referenced_view.relname
        `,
        [...viewNameValues, ...viewNameValues],
      )) as Array<{
        dependentSchema: string;
        dependentView: string;
        referencedSchema: string;
        referencedView: string;
      }>;
    }

    // Build adjacency list and indegree for topological sort
    const graph: Map<string, string[]> = new Map();
    const indegree: Map<string, number> = new Map();

    // Initialize graph with all views
    for (const view of dependentViewRows) {
      const key = `${view.schemaName}.${view.viewName}`;
      graph.set(key, []);
      indegree.set(key, 0);
    }

    // Add edges
    for (const dep of viewDependencies) {
      const fromKey = `${dep.referencedSchema}.${dep.referencedView}`;
      const toKey = `${dep.dependentSchema}.${dep.dependentView}`;

      // Only track dependencies within our managed set
      if (managedViewKeys.has(fromKey) && managedViewKeys.has(toKey)) {
        graph.get(fromKey)?.push(toKey);
        const currentDegree = indegree.get(toKey);
        if (currentDegree === undefined) {
          throw new Error(`Missing indegree entry for view: ${toKey}`);
        }
        indegree.set(toKey, currentDegree + 1);
      }
    }

    // Topological sort (Kahn's algorithm)
    const sortedViews: string[] = [];
    const queue: string[] = [];

    // Find all nodes with indegree 0
    for (const [key, degree] of indegree) {
      if (degree === 0) {
        queue.push(key);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      sortedViews.push(current);
      for (const neighbor of graph.get(current) || []) {
        const currentDegree = indegree.get(neighbor);
        if (currentDegree === undefined) {
          throw new Error(`Missing indegree entry for view: ${neighbor}`);
        }
        const newDegree = currentDegree - 1;
        indegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycles
    if (sortedViews.length !== managedViewKeys.size) {
      const remaining = Array.from(managedViewKeys).filter((k) => !sortedViews.includes(k));
      throw new Error(`View dependency cycle detected: ${remaining.join(', ')}`);
    }

    // Now sortedViews contains views in dependency order (dependencies first)
    // For dropping, we need reverse order (dependents first)
    const dropOrder = [...sortedViews].reverse();
    const createOrder = sortedViews;

    // =============================================================
    // 4. Capture and drop views in the correct order
    // =============================================================

    const capturedViews: CapturedView[] = [];

    // We'll process views in the order they appear in dropOrder (dependents first)
    for (const fullViewName of dropOrder) {
      const [schemaName, viewName] = fullViewName.split('.', 2);

      const existingView = await queryRunner.query(
        `
          SELECT
            n.nspname AS "schemaName",
            c.relname AS "viewName",
            pg_get_viewdef(c.oid, true) AS "definition",
            pg_get_userbyid(c.relowner) AS "owner"
          FROM pg_class c
          INNER JOIN pg_namespace n
            ON n.oid = c.relnamespace
          WHERE n.nspname = $1
            AND c.relname = $2
            AND c.relkind = 'v'
          LIMIT 1
        `,
        [schemaName, viewName],
      );

      if (existingView.length === 0) {
        throw new Error(`Discovered view ${fullViewName} no longer exists`);
      }

      const row = existingView[0];

      if (typeof row.definition !== 'string' || !row.definition.trim()) {
        throw new Error(`Unable to capture ${viewName} view definition`);
      }

      // Check for dependent views that are not in our managed set
      const dependentViews = await queryRunner.query(
        `
          SELECT DISTINCT
            dependent_namespace.nspname AS "schemaName",
            dependent_view.relname AS "viewName"
          FROM pg_depend dependency
          INNER JOIN pg_rewrite rewrite
            ON dependency.objid = rewrite.oid
          INNER JOIN pg_class dependent_view
            ON rewrite.ev_class = dependent_view.oid
          INNER JOIN pg_namespace dependent_namespace
            ON dependent_view.relnamespace = dependent_namespace.oid
          WHERE dependency.refobjid = (
            SELECT c.oid
            FROM pg_class c
            INNER JOIN pg_namespace n
              ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND c.relname = $2
              AND c.relkind = 'v'
          )
            AND NOT (
              dependent_namespace.nspname = $1
              AND dependent_view.relname = $2
            )
        `,
        [schemaName, viewName],
      );

      const unmanagedDependentViews = dependentViews.filter(
        (dependent: { schemaName: string; viewName: string }) =>
          !managedViewKeys.has(`${dependent.schemaName}.${dependent.viewName}`),
      );

      if (unmanagedDependentViews.length > 0) {
        const names = unmanagedDependentViews
          .map(
            (dependent: { schemaName: string; viewName: string }) =>
              `${dependent.schemaName}.${dependent.viewName}`,
          )
          .join(', ');
        throw new Error(`Cannot temporarily drop ${viewName}; dependent views exist: ${names}`);
      }

      const grants = await queryRunner.query(
        `
          SELECT
            grantee,
            privilege_type AS "privilegeType"
          FROM information_schema.role_table_grants
          WHERE table_schema = $1
            AND table_name = $2
        `,
        [schemaName, viewName],
      );

      capturedViews.push({
        schemaName: row.schemaName,
        viewName: row.viewName,
        definition: row.definition,
        owner: typeof row.owner === 'string' && row.owner.trim() ? row.owner : null,
        grants,
      });

      // Drop the view after capturing
      const escapedSchema = schemaName.replace(/"/g, '""');
      const escapedView = viewName.replace(/"/g, '""');
      await queryRunner.query(`
        DROP VIEW "${escapedSchema}"."${escapedView}"
      `);
    }

    // =============================================================
    // 5. Drop legacy triggers and functions (idempotent)
    // =============================================================

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trigger_containers_generate_code" ON "containers"
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS generate_container_code()
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trigger_items_calculate_total_volume" ON "items"
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS calculate_item_total_volume()
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trigger_items_update_container_volume_insert" ON "items"
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trigger_items_update_container_volume_delete" ON "items"
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trigger_items_update_container_volume_update" ON "items"
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS update_container_used_volume()
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trigger_items_check_capacity" ON "items"
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS check_container_capacity()
    `);

    // =============================================================
    // 6. Users table
    // =============================================================

    await ensureDeletedAt('users');

    await ensureRequiredColumnLength('users', 'username', 50);
    await ensureRequiredColumnLength('users', 'lastLoginUserAgent', 500);

    const userTimestampCols = [
      'lastLogin',
      'locked_until',
      'reset_password_expires',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ];
    for (const col of userTimestampCols) {
      await convertRequiredToTimestamptz('users', col);
    }

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_email"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_username"
    `);

    // =============================================================
    // 7. RefreshTokens table
    // =============================================================

    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "ip" VARCHAR(45)
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR(500)
    `);
    await ensureColumnType(
      'refresh_tokens',
      'session_id',
      'uuid',
      'NULLIF("session_id", \'\')::uuid',
    );

    await ensureRequiredColumnLength('refresh_tokens', 'ip', 45);

    await queryRunner.query(`
      UPDATE "refresh_tokens"
      SET "session_id" = uuid_generate_v4()
      WHERE "session_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ALTER COLUMN "session_id" SET NOT NULL
    `);

    await ensureRequiredColumnLength('refresh_tokens', 'token', 64);
    await ensureRequiredColumnLength('refresh_tokens', 'revoked_reason', 100);
    await ensureRequiredColumnLength('refresh_tokens', 'user_agent', 500);

    const rtTimestampCols = ['expires_at', 'created_at', 'updated_at', 'revoked_at'];
    for (const col of rtTimestampCols) {
      await convertRequiredToTimestamptz('refresh_tokens', col);
    }

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_refresh_tokens_token"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_refresh_tokens_user_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_refresh_tokens_user_active"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_refresh_tokens_session_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_refresh_tokens_user_session_active"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_active"
      ON "refresh_tokens" ("user_id", "is_active")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_session_id"
      ON "refresh_tokens" ("session_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_session_active"
      ON "refresh_tokens" ("user_id", "session_id", "is_active")
    `);

    // =============================================================
    // 8. Containers table
    // =============================================================

    const oversizedContainerVolumes = await queryRunner.query(`
      SELECT "id"
      FROM "containers"
      WHERE ABS("totalVolume") > 9999999999.99
         OR ABS("usedVolume") > 9999999999.99
      LIMIT 10
    `);
    if (oversizedContainerVolumes.length > 0) {
      throw new Error(
        'Cannot convert container volume columns to NUMERIC(12,2): oversized values exist.',
      );
    }

    await ensureDeletedAt('containers');

    await ensureRequiredColumnLength('containers', 'containerCode', 50);
    await ensureRequiredColumnLength('containers', 'name', 100);
    await ensureRequiredColumnLength('containers', 'description', 500);

    await queryRunner.query(`
      UPDATE "containers"
      SET "description" = ''
      WHERE "description" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "description" SET DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "description" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "totalVolume" TYPE NUMERIC(12,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "containers"
      ALTER COLUMN "usedVolume" TYPE NUMERIC(12,2)
    `);

    const containerUserForeignKeys = await queryRunner.query(`
      SELECT
        constraint_record.conname AS "constraintName"
      FROM pg_constraint constraint_record
      INNER JOIN pg_class source_table
        ON source_table.oid = constraint_record.conrelid
      INNER JOIN pg_namespace source_namespace
        ON source_namespace.oid = source_table.relnamespace
      INNER JOIN pg_class target_table
        ON target_table.oid = constraint_record.confrelid
      INNER JOIN pg_namespace target_namespace
        ON target_namespace.oid = target_table.relnamespace
      WHERE source_namespace.nspname = 'public'
        AND source_table.relname = 'containers'
        AND target_namespace.nspname = 'public'
        AND target_table.relname = 'users'
        AND constraint_record.contype = 'f'
        AND pg_get_constraintdef(constraint_record.oid) LIKE '%("createdById")%'
    `);

    for (const foreignKey of containerUserForeignKeys) {
      const constraintName = String(foreignKey.constraintName).replace(/"/g, '""');
      await queryRunner.query(`
        ALTER TABLE "containers"
        DROP CONSTRAINT IF EXISTS "${constraintName}"
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "containers"
      ADD CONSTRAINT "FK_containers_createdBy"
      FOREIGN KEY ("createdById")
      REFERENCES "users"("id")
      ON DELETE RESTRICT
    `);

    const containerTimestampCols = ['createdAt', 'updatedAt', 'deletedAt'];
    for (const col of containerTimestampCols) {
      await convertRequiredToTimestamptz('containers', col);
    }

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_containers_containerCode"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_containers_createdById"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_containers_createdById"
      ON "containers" ("createdById")
    `);

    // =============================================================
    // 9. Items table
    // =============================================================

    const oversizedItemValues = await queryRunner.query(`
      SELECT "id"
      FROM "items"
      WHERE ABS("packagePrice") > 9999999999.99
         OR ABS("volume") > 9999999999.99
         OR ABS("totalVolume") > 999999999999.99
      LIMIT 10
    `);
    if (oversizedItemValues.length > 0) {
      throw new Error('Cannot convert item numeric columns: oversized values exist.');
    }

    await queryRunner.query(`
      ALTER TABLE "items"
      ADD COLUMN IF NOT EXISTS "deletedByContainer" BOOLEAN NOT NULL DEFAULT false
    `);

    await ensureDeletedAt('items');

    await ensureRequiredColumnLength('items', 'uniqueNumber', 50);
    await ensureRequiredColumnLength('items', 'name', 200);

    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "packagePrice" TYPE NUMERIC(12,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "volume" TYPE NUMERIC(12,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "totalVolume" TYPE NUMERIC(14,2)
    `);

    const itemTimestampCols = ['createdAt', 'updatedAt', 'deletedAt'];
    for (const col of itemTimestampCols) {
      await convertRequiredToTimestamptz('items', col);
    }

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_items_uniqueNumber"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_items_containerId"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_items_containerId"
      ON "items" ("containerId")
    `);

    // =============================================================
    // 10. AuditLogs table
    // =============================================================

    await ensureColumnType('audit_logs', 'targetId', 'uuid', 'NULLIF("targetId", \'\')::uuid');

    await ensureRequiredColumnLength('audit_logs', 'targetType', 100);

    await convertRequiredToTimestamptz('audit_logs', 'createdAt');

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_audit_logs_userId_createdAt"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_audit_logs_action_createdAt"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_audit_logs_status_created"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_created"
      ON "audit_logs" ("userId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action_created"
      ON "audit_logs" ("action", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_status_created"
      ON "audit_logs" ("status", "createdAt")
    `);

    // =============================================================
    // 11. Restore captured views in the correct order
    // =============================================================

    const allowedPrivileges = [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
    ];

    // Restore in createOrder (dependencies first)
    for (const fullViewName of createOrder) {
      const [schemaName, viewName] = fullViewName.split('.', 2);
      const view = capturedViews.find(
        (v) => v.schemaName === schemaName && v.viewName === viewName,
      );
      if (!view) {
        throw new Error(`Captured definition not found for view ${fullViewName}`);
      }

      const escapedSchema = view.schemaName.replace(/"/g, '""');
      const escapedView = view.viewName.replace(/"/g, '""');

      await queryRunner.query(`
        CREATE VIEW "${escapedSchema}"."${escapedView}" AS
        ${view.definition}
      `);

      for (const grant of view.grants) {
        const privilege = String(grant.privilegeType).toUpperCase();
        if (!allowedPrivileges.includes(privilege)) {
          throw new Error(`Unsupported view privilege on ${view.viewName}: ${privilege}`);
        }

        const grantee =
          grant.grantee === 'PUBLIC' ? 'PUBLIC' : `"${String(grant.grantee).replace(/"/g, '""')}"`;

        await queryRunner.query(`
          GRANT ${privilege}
          ON "${escapedSchema}"."${escapedView}"
          TO ${grantee}
        `);
      }

      if (view.owner) {
        const escapedOwner = view.owner.replace(/"/g, '""');
        await queryRunner.query(`
          ALTER VIEW "${escapedSchema}"."${escapedView}"
          OWNER TO "${escapedOwner}"
        `);
      }
    }
  }

  // =============================================================
  // DOWN: Irreversible – restore from backup
  // =============================================================

  down(): Promise<void> {
    return Promise.reject(new Error('This migration cannot be reverted safely'));
  }
}

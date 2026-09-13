import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconstrução física de `inventory_items` — auditoria 2026-07-19.
 * Reconstrução pura de ordem (sem remoção de colunas — todas aceitas por
 * `CreateInventoryItemDto` e persistidas diretamente por
 * `InventoryService.create()` via spread do DTO). A ordem já batia
 * integralmente com o DTO; único ponto corrigido é o bloco de auditoria,
 * que estava `created_by, updated_by, created_at, updated_at, deleted_at`
 * e passa para o padrão canônico `created_at, updated_at, created_by,
 * updated_by, deleted_at`.
 */
export class RebuildInventoryItemsInCanonicalFormOrder20260719000017 implements MigrationInterface {
  name = 'RebuildInventoryItemsInCanonicalFormOrder20260719000017';

  private readonly newColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    nome                varchar(255) NOT NULL,
    categoria           varchar(100),
    quantidade          integer NOT NULL DEFAULT 0,
    valor_unitario      numeric,
    localizacao         varchar(255),
    status              varchar(50) NOT NULL DEFAULT 'disponivel',
    responsavel         varchar(255),
    setor               varchar(100),
    data_entrada        date,
    local_compra        varchar(255),
    numero_nota_fiscal  varchar(100),
    observacoes         text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_by          varchar(255),
    updated_by          varchar(255),
    deleted_at          timestamptz
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'nome', 'categoria', 'quantidade', 'valor_unitario', 'localizacao',
    'status', 'responsavel', 'setor', 'data_entrada', 'local_compra', 'numero_nota_fiscal',
    'observacoes', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM inventory_items`);

    await queryRunner.query(`CREATE TABLE inventory_items_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO inventory_items_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM inventory_items`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM inventory_items_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildInventoryItemsInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE inventory_items_new ADD CONSTRAINT inventory_items_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_new ON inventory_items_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_cat_new ON inventory_items_new (tenant_id, categoria)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_status_new ON inventory_items_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_deleted_new ON inventory_items_new (tenant_id, deleted_at)`);

    await queryRunner.query(`ALTER TABLE inventory_items RENAME TO inventory_items_old`);
    await queryRunner.query(`ALTER TABLE inventory_items_old RENAME CONSTRAINT inventory_items_pkey TO inventory_items_old_pkey`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant RENAME TO idx_inventory_items_tenant_old`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_cat RENAME TO idx_inventory_items_tenant_cat_old`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_status RENAME TO idx_inventory_items_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_deleted RENAME TO idx_inventory_items_tenant_deleted_old`);

    await queryRunner.query(`ALTER TABLE inventory_items_new RENAME TO inventory_items`);
    await queryRunner.query(`ALTER INDEX inventory_items_new_pkey RENAME TO inventory_items_pkey`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_new RENAME TO idx_inventory_items_tenant`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_cat_new RENAME TO idx_inventory_items_tenant_cat`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_status_new RENAME TO idx_inventory_items_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_deleted_new RENAME TO idx_inventory_items_tenant_deleted`);

    await queryRunner.query(`ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON inventory_items
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE inventory_items OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON inventory_items TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE inventory_items_old`);
    await queryRunner.query(`ANALYZE inventory_items`);
  }

  private readonly originalColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    nome                varchar(255) NOT NULL,
    categoria           varchar(100),
    quantidade          integer NOT NULL DEFAULT 0,
    valor_unitario      numeric,
    localizacao         varchar(255),
    status              varchar(50) NOT NULL DEFAULT 'disponivel',
    responsavel         varchar(255),
    setor               varchar(100),
    data_entrada        date,
    local_compra        varchar(255),
    numero_nota_fiscal  varchar(100),
    observacoes         text,
    created_by          varchar(255),
    updated_by          varchar(255),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM inventory_items`);

    await queryRunner.query(`CREATE TABLE inventory_items_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO inventory_items_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM inventory_items`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM inventory_items_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildInventoryItemsInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE inventory_items_restore ADD CONSTRAINT inventory_items_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_restore ON inventory_items_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_cat_restore ON inventory_items_restore (tenant_id, categoria)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_status_restore ON inventory_items_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_inventory_items_tenant_deleted_restore ON inventory_items_restore (tenant_id, deleted_at)`);

    await queryRunner.query(`ALTER TABLE inventory_items RENAME TO inventory_items_canonical`);
    await queryRunner.query(`ALTER TABLE inventory_items_canonical RENAME CONSTRAINT inventory_items_pkey TO inventory_items_canonical_pkey`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant RENAME TO idx_inventory_items_tenant_canonical`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_cat RENAME TO idx_inventory_items_tenant_cat_canonical`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_status RENAME TO idx_inventory_items_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_deleted RENAME TO idx_inventory_items_tenant_deleted_canonical`);

    await queryRunner.query(`ALTER TABLE inventory_items_restore RENAME TO inventory_items`);
    await queryRunner.query(`ALTER INDEX inventory_items_restore_pkey RENAME TO inventory_items_pkey`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_restore RENAME TO idx_inventory_items_tenant`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_cat_restore RENAME TO idx_inventory_items_tenant_cat`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_status_restore RENAME TO idx_inventory_items_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_inventory_items_tenant_deleted_restore RENAME TO idx_inventory_items_tenant_deleted`);

    await queryRunner.query(`ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON inventory_items
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE inventory_items OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON inventory_items TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE inventory_items_canonical`);
    await queryRunner.query(`ANALYZE inventory_items`);
  }
}

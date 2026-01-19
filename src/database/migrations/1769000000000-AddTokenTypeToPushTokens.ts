import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenTypeToPushTokens1769000000000 implements MigrationInterface {
  name = 'AddTokenTypeToPushTokens1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "push_tokens"
      ADD COLUMN "tokenType" character varying(10) NOT NULL DEFAULT 'expo'
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_push_tokens_tokenType" ON "push_tokens" ("tokenType")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_push_tokens_tokenType"`);
    await queryRunner.query(
      `ALTER TABLE "push_tokens" DROP COLUMN "tokenType"`,
    );
  }
}

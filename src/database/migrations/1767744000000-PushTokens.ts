import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushTokens1767744000000 implements MigrationInterface {
  name = 'PushTokens1767744000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying(255) NOT NULL,
        "deviceType" character varying(20) NOT NULL,
        "deviceName" character varying(255),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_push_tokens_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_push_tokens_token" ON "push_tokens" ("token")
    `);

    await queryRunner.query(`
      ALTER TABLE "push_tokens"
      ADD CONSTRAINT "FK_push_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_tokens" DROP CONSTRAINT "FK_push_tokens_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_push_tokens_token"`);
    await queryRunner.query(`DROP TABLE "push_tokens"`);
  }
}

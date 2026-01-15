import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1766388515397 implements MigrationInterface {
  name = 'Initial1766388515397';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(320) NOT NULL,
                "displayName" character varying(120) NOT NULL,
                "password" character varying(255) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")
        `);
    await queryRunner.query(`
            CREATE TABLE "households" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(120) NOT NULL,
                "currency" character varying(3) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_2b1aef2640717132e9231aac756" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "shopping_items" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(180) NOT NULL,
                "amount" numeric(12, 2) NOT NULL,
                "price" numeric(12, 2) NOT NULL DEFAULT '0',
                "category" character varying(80),
                "purchased" boolean NOT NULL DEFAULT false,
                "purchasedAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "listId" uuid NOT NULL,
                "purchasedById" uuid,
                CONSTRAINT "PK_36f295ec7314c9001968ca2c6f9" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_ec671a537d6b12a7d902118ebb" ON "shopping_items" ("purchased")
        `);
    await queryRunner.query(`
            CREATE TABLE "shopping_lists" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(140) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "householdId" uuid NOT NULL,
                "createdById" uuid NOT NULL,
                "ownerId" uuid,
                CONSTRAINT "PK_9289ace7dd5e768d65290f3f9de" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_24692430f8dc8ab77a415f4cda" ON "shopping_lists" ("ownerId")
        `);
    await queryRunner.query(`
            CREATE TABLE "incomes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "amount" numeric(12, 2) NOT NULL,
                "currency" character varying(3) NOT NULL,
                "description" character varying(120) NOT NULL,
                "category" character varying(80),
                "source" character varying(20) NOT NULL,
                "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "ownerId" uuid NOT NULL,
                CONSTRAINT "PK_d737b3d0314c1f0da5461a55e5e" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_d7ae735474a11c5c9362d81b32" ON "incomes" ("ownerId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_83edc108645704298736a1f763" ON "incomes" ("source")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_81e3bf71daaf628ca8a26d0d4a" ON "incomes" ("occurredAt")
        `);
    await queryRunner.query(`
            CREATE TABLE "household_members" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "householdId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                CONSTRAINT "uq_household_member_household_user" UNIQUE ("householdId", "userId"),
                CONSTRAINT "PK_198055660706bdbea68909fdb01" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "expenses" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "amount" numeric(12, 2) NOT NULL,
                "currency" character varying(3) NOT NULL,
                "description" character varying(120) NOT NULL,
                "category" character varying(80),
                "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "sourceType" character varying(30) NOT NULL,
                "sourceId" uuid,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "householdId" uuid NOT NULL,
                "payerId" uuid NOT NULL,
                CONSTRAINT "uq_expenses_source" UNIQUE ("sourceType", "sourceId"),
                CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_9e0477395e7daef4c43ccfd7c9" ON "expenses" ("sourceType")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_57ce0aca6905f3a52aca30160a" ON "expenses" ("sourceId")
        `);
    await queryRunner.query(`
            CREATE TABLE "auth_sessions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "refreshToken" character varying(64) NOT NULL,
                "previousRefreshToken" character varying(64),
                "refreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "rotatedAt" TIMESTAMP WITH TIME ZONE,
                "revokedAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_925b24d7fc2f9324ce972aee02" ON "auth_sessions" ("userId")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_0936b5f825f421bd6a1331cb38" ON "auth_sessions" ("refreshToken")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_d75b66a55e6a07c17a99204dc1" ON "auth_sessions" ("previousRefreshToken")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_360328fb619b74ce69b5ccf3db" ON "auth_sessions" ("revokedAt")
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_items"
            ADD CONSTRAINT "FK_c986d00fff7152bc866f60bcf44" FOREIGN KEY ("listId") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_items"
            ADD CONSTRAINT "FK_a530353b33de6d18ec910cb6cea" FOREIGN KEY ("purchasedById") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_lists"
            ADD CONSTRAINT "FK_9924e299aa59e137cf43e7a4d56" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_lists"
            ADD CONSTRAINT "FK_ebab2aa00815c9adc11be054c43" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_lists"
            ADD CONSTRAINT "FK_24692430f8dc8ab77a415f4cdab" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "incomes"
            ADD CONSTRAINT "FK_d7ae735474a11c5c9362d81b32c" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "household_members"
            ADD CONSTRAINT "FK_640db19175e32080e5c6b94b6b5" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "household_members"
            ADD CONSTRAINT "FK_020bc38c41448c356b962401833" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "expenses"
            ADD CONSTRAINT "FK_671a7f16e95bf55e78655f3a62d" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "expenses"
            ADD CONSTRAINT "FK_8047d91a5ecf109de168ef35135" FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "expenses" DROP CONSTRAINT "FK_8047d91a5ecf109de168ef35135"
        `);
    await queryRunner.query(`
            ALTER TABLE "expenses" DROP CONSTRAINT "FK_671a7f16e95bf55e78655f3a62d"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_members" DROP CONSTRAINT "FK_020bc38c41448c356b962401833"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_members" DROP CONSTRAINT "FK_640db19175e32080e5c6b94b6b5"
        `);
    await queryRunner.query(`
            ALTER TABLE "incomes" DROP CONSTRAINT "FK_d7ae735474a11c5c9362d81b32c"
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_lists" DROP CONSTRAINT "FK_24692430f8dc8ab77a415f4cdab"
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_lists" DROP CONSTRAINT "FK_ebab2aa00815c9adc11be054c43"
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_lists" DROP CONSTRAINT "FK_9924e299aa59e137cf43e7a4d56"
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_items" DROP CONSTRAINT "FK_a530353b33de6d18ec910cb6cea"
        `);
    await queryRunner.query(`
            ALTER TABLE "shopping_items" DROP CONSTRAINT "FK_c986d00fff7152bc866f60bcf44"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_360328fb619b74ce69b5ccf3db"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_d75b66a55e6a07c17a99204dc1"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_0936b5f825f421bd6a1331cb38"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_925b24d7fc2f9324ce972aee02"
        `);
    await queryRunner.query(`
            DROP TABLE "auth_sessions"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_57ce0aca6905f3a52aca30160a"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_9e0477395e7daef4c43ccfd7c9"
        `);
    await queryRunner.query(`
            DROP TABLE "expenses"
        `);
    await queryRunner.query(`
            DROP TABLE "household_members"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_81e3bf71daaf628ca8a26d0d4a"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_83edc108645704298736a1f763"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_d7ae735474a11c5c9362d81b32"
        `);
    await queryRunner.query(`
            DROP TABLE "incomes"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_24692430f8dc8ab77a415f4cda"
        `);
    await queryRunner.query(`
            DROP TABLE "shopping_lists"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_ec671a537d6b12a7d902118ebb"
        `);
    await queryRunner.query(`
            DROP TABLE "shopping_items"
        `);
    await queryRunner.query(`
            DROP TABLE "households"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
  }
}

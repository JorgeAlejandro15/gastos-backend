import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseholdInvitationsAndPrimaryHousehold1766389200000 implements MigrationInterface {
  name = 'HouseholdInvitationsAndPrimaryHousehold1766389200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users.primaryHouseholdId
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "primaryHouseholdId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_primary_household_id" ON "users" ("primaryHouseholdId")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_primary_household" FOREIGN KEY ("primaryHouseholdId")
      REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // household_invitations
    await queryRunner.query(`
      CREATE TABLE "household_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "householdId" uuid NOT NULL,
        "email" character varying(320) NOT NULL,
        "tokenHash" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "invitedById" uuid,
        "acceptedById" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "acceptedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_household_invitations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_household_invitations_email" ON "household_invitations" ("email")
    `);

    // Prevent multiple active invites per household+email
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_household_invitation_household_email_pending"
      ON "household_invitations" ("householdId", "email")
      WHERE status = 'pending'
    `);

    await queryRunner.query(`
      ALTER TABLE "household_invitations"
      ADD CONSTRAINT "FK_household_invitations_household" FOREIGN KEY ("householdId")
      REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "household_invitations"
      ADD CONSTRAINT "FK_household_invitations_invitedBy" FOREIGN KEY ("invitedById")
      REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "household_invitations"
      ADD CONSTRAINT "FK_household_invitations_acceptedBy" FOREIGN KEY ("acceptedById")
      REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_household_invitations_acceptedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_household_invitations_invitedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_household_invitations_household"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."uq_household_invitation_household_email_pending"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_household_invitations_email"`,
    );
    await queryRunner.query(`DROP TABLE "household_invitations"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_primary_household"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_users_primary_household_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "primaryHouseholdId"`,
    );
  }
}

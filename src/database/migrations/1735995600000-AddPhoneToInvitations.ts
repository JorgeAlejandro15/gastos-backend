import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneToInvitations1735995600000 implements MigrationInterface {
  name = 'AddPhoneToInvitations1735995600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add phone_lookup_hash column (nullable to allow existing invitations)
    await queryRunner.query(
      `ALTER TABLE "household_invitations" ADD "phoneLookupHash" varchar(64)`,
    );

    // Add invited_identifier column (stores original email or phone)
    await queryRunner.query(
      `ALTER TABLE "household_invitations" ADD "invitedIdentifier" varchar(320)`,
    );

    // Migrate existing data: copy email to invitedIdentifier
    await queryRunner.query(
      `UPDATE "household_invitations" SET "invitedIdentifier" = "email" WHERE "invitedIdentifier" IS NULL`,
    );

    // Make email nullable since invitations can now be by phone
    await queryRunner.query(
      `ALTER TABLE "household_invitations" ALTER COLUMN "email" DROP NOT NULL`,
    );

    // Create partial unique index for phone invitations
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_household_invitation_household_phone_pending" ON "household_invitations"("householdId", "phoneLookupHash") WHERE "status" = 'pending' AND "phoneLookupHash" IS NOT NULL`,
    );

    // Create index on phoneLookupHash for lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_household_invitations_phone_lookup_hash" ON "household_invitations"("phoneLookupHash") WHERE "phoneLookupHash" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "public"."IDX_household_invitations_phone_lookup_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_household_invitation_household_phone_pending"`,
    );

    // Restore email NOT NULL constraint (will fail if any phone-only invitations exist)
    await queryRunner.query(
      `ALTER TABLE "household_invitations" ALTER COLUMN "email" SET NOT NULL`,
    );

    // Drop new columns
    await queryRunner.query(
      `ALTER TABLE "household_invitations" DROP COLUMN "invitedIdentifier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "household_invitations" DROP COLUMN "phoneLookupHash"`,
    );
  }
}

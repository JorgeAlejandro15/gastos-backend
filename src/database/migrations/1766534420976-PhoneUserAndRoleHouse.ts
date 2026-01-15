import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhoneUserAndRoleHouse1766534420976 implements MigrationInterface {
  name = 'PhoneUserAndRoleHouse1766534420976';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_users_primary_household"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_household_invitations_household"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_household_invitations_invitedBy"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_household_invitations_acceptedBy"
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "phoneEncrypted" character varying(512)
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "phoneLookupHash" character varying(64)
        `);
    await queryRunner.query(`
            ALTER TABLE "household_members"
            ADD "role" character varying(20) NOT NULL DEFAULT 'member'
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ALTER COLUMN "email" DROP NOT NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_users_phone_lookup_hash" ON "users" ("phoneLookupHash")
            WHERE "phoneLookupHash" IS NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_f27491b96ea046a05acef836d57" FOREIGN KEY ("primaryHouseholdId") REFERENCES "households"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations"
            ADD CONSTRAINT "FK_622793fa8e4dec712e01dac475c" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations"
            ADD CONSTRAINT "FK_3d12f141a59c8006f6df322a2a0" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations"
            ADD CONSTRAINT "FK_fc1ddf446230f1a4ea17423ee6a" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_fc1ddf446230f1a4ea17423ee6a"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_3d12f141a59c8006f6df322a2a0"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations" DROP CONSTRAINT "FK_622793fa8e4dec712e01dac475c"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_f27491b96ea046a05acef836d57"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_users_phone_lookup_hash"
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ALTER COLUMN "email"
            SET NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "household_members" DROP COLUMN "role"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "phoneLookupHash"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "phoneEncrypted"
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations"
            ADD CONSTRAINT "FK_household_invitations_acceptedBy" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations"
            ADD CONSTRAINT "FK_household_invitations_invitedBy" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "household_invitations"
            ADD CONSTRAINT "FK_household_invitations_household" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_primary_household" FOREIGN KEY ("primaryHouseholdId") REFERENCES "households"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
  }
}

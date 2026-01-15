import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SetHouseholdMemberRoleDto {
  @ApiProperty({
    example: 'member',
    description: "Nuevo rol del miembro ('owner' | 'member')",
    enum: ['owner', 'member'],
  })
  @IsIn(['owner', 'member'])
  role!: 'owner' | 'member';
}

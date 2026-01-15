import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { InviteHouseholdDto } from './dto/invite-household.dto';
import { RegisterHouseholdMemberDto } from './dto/register-household-member.dto';
import { RenameHouseholdDto } from './dto/rename-household.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { SetHouseholdMemberRoleDto } from './dto/set-member-role.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { HouseholdsService } from './households.service';

@ApiTags('households')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Post('me')
  @ApiOperation({ summary: 'Crear mi hogar (bajo demanda)' })
  createMyHousehold(
    @CurrentUser() user: CurrentUser,
    @Body() dto: CreateHouseholdDto,
  ) {
    return this.households.createHouseholdForUserOnRequest(user.userId, dto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Renombrar mi hogar' })
  renameMyHousehold(
    @CurrentUser() user: CurrentUser,
    @Body() dto: RenameHouseholdDto,
  ) {
    return this.households.renameMyHousehold(user.userId, dto.name);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Invitar a un usuario por email a mi hogar' })
  inviteByEmail(
    @CurrentUser() user: CurrentUser,
    @Body() dto: InviteHouseholdDto,
  ) {
    // Support both email and phone through unified invite method
    if (dto.email) {
      return this.households.inviteByEmail(user.userId, dto.email);
    } else if (dto.phone) {
      return this.households.invite(user.userId, { phone: dto.phone });
    } else {
      throw new Error('El correo electrónico o el teléfono son obligatorios');
    }
  }

  @Post('search-user')
  @ApiOperation({
    summary: 'Buscar usuario por email o teléfono antes de invitar',
  })
  searchUser(@CurrentUser() user: CurrentUser, @Body() dto: SearchUserDto) {
    return this.households.searchUserForInvite(user.userId, dto.identifier);
  }

  @Post('invitations/accept')
  @ApiOperation({ summary: 'Aceptar invitación a un hogar (por token)' })
  acceptInvitation(
    @CurrentUser() user: CurrentUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.households.acceptInvitationForUserByToken(
      dto.token,
      user.userId,
    );
  }

  @Post('me/members/register')
  @ApiOperation({
    summary:
      'Registrar un usuario desde mi hogar (solo owner) y añadirlo como miembro',
  })
  registerMemberFromMyHousehold(
    @CurrentUser() user: CurrentUser,
    @Body() dto: RegisterHouseholdMemberDto,
  ) {
    return this.households.registerMemberFromMyHousehold(user.userId, dto);
  }

  @Get('me/members')
  @ApiOperation({ summary: 'Listar miembros de mi hogar' })
  listMyMembers(@CurrentUser() user: CurrentUser) {
    return this.households.listMyMembers(user.userId);
  }

  @Get(':householdId/members')
  @ApiOperation({ summary: 'Listar miembros de un hogar (si soy miembro)' })
  listMembers(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
  ) {
    return this.households.listMembersForUser(householdId, user.userId);
  }

  @Post(':householdId/invitations')
  @ApiOperation({ summary: 'Invitar a un usuario a un hogar (solo owner)' })
  inviteToHousehold(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
    @Body() dto: InviteHouseholdDto,
  ) {
    return this.households.inviteToHouseholdForOwner(
      user.userId,
      householdId,
      dto,
    );
  }

  @Get(':householdId/invitations')
  @ApiOperation({ summary: 'Listar invitaciones de un hogar (solo owner)' })
  listHouseholdInvitations(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
  ) {
    return this.households.listInvitationsForOwner(user.userId, householdId);
  }

  @Delete(':householdId/invitations/:invitationId')
  @ApiOperation({ summary: 'Revocar invitación pendiente (solo owner)' })
  revokeInvitation(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
    @Param('invitationId', new ParseUUIDPipe({ version: '4' }))
    invitationId: string,
  ) {
    return this.households.revokeInvitationForOwner(
      user.userId,
      householdId,
      invitationId,
    );
  }

  @Patch(':householdId/members/:memberUserId/role')
  @ApiOperation({ summary: 'Cambiar rol de un miembro (solo owner)' })
  setMemberRole(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
    @Param('memberUserId', new ParseUUIDPipe({ version: '4' }))
    memberUserId: string,
    @Body() dto: SetHouseholdMemberRoleDto,
  ) {
    return this.households.setMemberRoleForOwner(
      user.userId,
      householdId,
      memberUserId,
      dto.role,
    );
  }

  @Delete(':householdId/members/:memberUserId')
  @ApiOperation({ summary: 'Expulsar miembro del hogar (solo owner)' })
  removeMember(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
    @Param('memberUserId', new ParseUUIDPipe({ version: '4' }))
    memberUserId: string,
  ) {
    return this.households.removeMemberForOwner(
      user.userId,
      householdId,
      memberUserId,
    );
  }

  @Get('me/all')
  @ApiOperation({ summary: 'Listar todos mis hogares' })
  listMyHouseholds(@CurrentUser() user: CurrentUser) {
    return this.households.listMyHouseholds(user.userId);
  }

  @Post('me/switch')
  @ApiOperation({ summary: 'Cambiar mi hogar primario' })
  switchPrimaryHousehold(
    @CurrentUser() user: CurrentUser,
    @Body() dto: { householdId: string },
  ) {
    return this.households.switchPrimaryHousehold(user.userId, dto.householdId);
  }

  @Patch(':householdId')
  @ApiOperation({ summary: 'Editar un hogar (solo owner)' })
  updateHousehold(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
    @Body() dto: UpdateHouseholdDto,
  ) {
    return this.households.updateHouseholdForOwner(
      user.userId,
      householdId,
      dto,
    );
  }

  @Delete(':householdId')
  @ApiOperation({ summary: 'Eliminar un hogar (solo owner)' })
  deleteHousehold(
    @CurrentUser() user: CurrentUser,
    @Param('householdId', new ParseUUIDPipe({ version: '4' }))
    householdId: string,
  ) {
    return this.households.deleteHouseholdForOwner(user.userId, householdId);
  }
}

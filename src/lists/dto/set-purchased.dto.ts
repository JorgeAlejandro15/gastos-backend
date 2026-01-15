import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetPurchasedDto {
  @ApiProperty({
    example: true,
    description: 'Marca el item como comprado (true) o no comprado (false).',
  })
  @IsBoolean()
  purchased!: boolean;
}

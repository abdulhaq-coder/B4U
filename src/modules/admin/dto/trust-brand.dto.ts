import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TrustBrandDto {
  @ApiProperty({ example: true, description: 'True auto-approves all future branches' })
  @IsBoolean()
  isTrusted!: boolean;

  @ApiPropertyOptional({ example: 30, description: 'Custom maximum branches limit for large chains' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  branchLimit?: number;
}


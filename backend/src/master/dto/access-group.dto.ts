import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class UpdateAccessGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

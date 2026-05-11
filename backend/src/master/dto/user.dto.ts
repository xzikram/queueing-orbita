import { IsString, IsEmail, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsEnum(['ADMIN', 'ADMISSION', 'CASHIER', 'ASSESSMENT', 'BDR', 'DOCTOR', 'CDC', 'PHARMACY', 'OPTIC', 'MANAGEMENT', 'QUEUE_OFFICER'])
  role: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'ADMISSION', 'CASHIER', 'ASSESSMENT', 'BDR', 'DOCTOR', 'CDC', 'PHARMACY', 'OPTIC', 'MANAGEMENT', 'QUEUE_OFFICER'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

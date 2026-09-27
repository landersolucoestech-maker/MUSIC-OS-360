import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsHexColor,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CompanyAddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(9) zipCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) complement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) country?: string;
}

export class CompanyColorsDto {
  @ApiPropertyOptional() @IsOptional() @IsHexColor() primary?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() secondary?: string;
}

export class CompanyBankingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) agency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) account?: string;
}

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ description: 'Legal company name' })
  @IsOptional() @IsString() @MaxLength(255)
  legalName?: string;

  @ApiPropertyOptional({ description: 'Nome fantasia' })
  @IsOptional() @IsString() @MaxLength(255)
  tradeName?: string;

  @ApiPropertyOptional({ description: 'CNPJ (encrypted at rest)' })
  @IsOptional() @IsString() @MaxLength(18)
  cnpj?: string;

  @ApiPropertyOptional({ description: 'State registration number' })
  @IsOptional() @IsString() @MaxLength(20)
  stateRegistration?: string;

  @ApiPropertyOptional({ description: 'Name of the person responsible for the company' })
  @IsOptional() @IsString() @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CompanyAddressDto)
  address?: CompanyAddressDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  whatsapp?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048)
  website?: string;

  @ApiPropertyOptional({ description: 'Custom domain (without protocol, e.g. app.minhaempresa.com)' })
  @IsOptional() @IsString() @MaxLength(255)
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048)
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CompanyColorsDto)
  colors?: CompanyColorsDto;

  @ApiPropertyOptional()
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CompanyBankingDto)
  banking?: CompanyBankingDto;

  @ApiPropertyOptional({ description: 'IANA timezone, ex.: America/Sao_Paulo' })
  @IsOptional() @IsString() @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'ISO 4217 code, e.g. BRL' })
  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'IETF code, e.g. pt-BR' })
  @IsOptional() @IsString() @MaxLength(10)
  language?: string;
}

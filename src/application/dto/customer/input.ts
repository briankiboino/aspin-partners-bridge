import {
  IsString,
  IsNotEmpty,
  IsEmail,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export interface AddressPayload {
  line1: string;
  city: string;
  country: string;
}

export class AddressDto {
  @IsString()
  @IsNotEmpty()
  line1: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  constructor(partial: Partial<AddressDto>) {
    Object.assign(this, partial);
  }
}

export interface UpsertCustomerPayload {
  first_name: string;
  last_name: string;
  national_id: string;
  date_of_birth: string;
  email: string;
  phone_number: string;
  address: AddressPayload;
}

export class UpsertCustomerDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  national_id: string;

  @IsDateString()
  @IsNotEmpty()
  date_of_birth: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsNotEmpty()
  address: AddressDto;

  constructor(partial: Partial<UpsertCustomerDto>) {
    Object.assign(this, partial);
  }
}

export interface InitiateKycPayload {
  reason: string;
}

export class InitiateKycDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  constructor(partial: Partial<InitiateKycDto>) {
    Object.assign(this, partial);
  }
}

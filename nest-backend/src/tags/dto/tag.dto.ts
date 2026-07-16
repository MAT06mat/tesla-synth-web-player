import { IsHexColor, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SyncTagDto {
    @IsOptional()
    @IsNumber()
    id?: number;

    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsHexColor()
    color!: string;
}
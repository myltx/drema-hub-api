import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryFileDto {
  @ApiProperty({ description: '文件名称', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: '用户ID', required: false })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiProperty({ description: '页码 (默认: 1)', required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '每页数量 (默认: 10)',
    required: false,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class QueryFileDetailDto {
  @ApiProperty({ description: '文件ID', required: true })
  @IsString()
  id: string;

  @ApiProperty({ description: '文件类型', required: true })
  @IsString()
  type: string;
}

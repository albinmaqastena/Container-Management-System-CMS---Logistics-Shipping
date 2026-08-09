// src/modules/items/items.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto } from './dto/item-query.dto';
import { SearchItemQueryDto } from './dto/search-item-query.dto';
import { Item } from './entities/item.entity';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';

import { UserRole } from '../auth/entities/user.entity';
import { StrictBooleanPipe } from '../../common/pipes/strict-boolean.pipe';

const queryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@ApiTags('Items')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({
  description: 'Authentication is required',
})
@ApiForbiddenResponse({
  description: 'Insufficient permissions',
})
@Controller('items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new item in a container' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Item created successfully',
    type: Item,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid data or not enough available volume',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Container not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'An item with the same unique number already exists',
  })
  async create(@Body() createItemDto: CreateItemDto): Promise<Item> {
    return this.itemsService.create(createItemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all items with pagination and sorting' })
  @ApiQuery({
    name: 'containerId',
    type: String,
    required: false,
    description: 'Filter items by container ID',
  })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({
    name: 'sort',
    type: String,
    required: false,
    example: 'createdAt:DESC',
  })
  @ApiQuery({
    name: 'includeDeleted',
    type: Boolean,
    required: false,
    example: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Items retrieved successfully',
    type: PaginatedResponseDto,
  })
  async findAll(
    @Query(queryValidationPipe) query: ItemQueryDto,
  ): Promise<PaginatedResponseDto<Item>> {
    return this.itemsService.findAll(query, query.containerId, query.includeDeleted === 'true');
  }

  

  @Get('deleted')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all soft-deleted items' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({
    name: 'sort',
    type: String,
    required: false,
    example: 'deletedAt:DESC',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deleted items retrieved successfully',
    type: PaginatedResponseDto,
  })
  async findDeleted(
    @Query(queryValidationPipe) query: PaginationDto,
  ): Promise<PaginatedResponseDto<Item>> {
    return this.itemsService.findDeleted(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search items with pagination and sorting' })
  @ApiQuery({
    name: 'query',
    type: String,
    required: true,
    example: 'Laptop',
  })
  @ApiQuery({
    name: 'containerId',
    type: String,
    required: false,
    description: 'Filter search results by container ID',
  })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({
    name: 'sort',
    type: String,
    required: false,
    example: 'createdAt:DESC',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully',
    type: PaginatedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Search query is missing or invalid',
  })
  async searchItems(
    @Query(queryValidationPipe) query: SearchItemQueryDto,
  ): Promise<PaginatedResponseDto<Item>> {
    return this.itemsService.searchItems(query.query, query, query.containerId);
  }

  @Get('count-active')
    @ApiOperation({
    summary: 'Get total number of active items',
    })
    @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active items count retrieved successfully',
    })
    async countActiveItems(): Promise<{
    total: number;
    }> {
    const total =
        await this.itemsService.countActiveItems();

    return {
        total,
    };
    }

  @Get(':id')
  @ApiOperation({ summary: 'Get an item by ID' })
  @ApiParam({
    name: 'id',
    description: 'Item UUID',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'includeDeleted',
    type: Boolean,
    required: false,
    example: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item retrieved successfully',
    type: Item,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid UUID or boolean format',
  })
  async findOne(
    @Param('id', UUIDValidationPipe) id: string,
    @Query('includeDeleted', StrictBooleanPipe)
    includeDeleted?: string | boolean,
  ): Promise<Item> {
    return this.itemsService.findOne(id, includeDeleted === true);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an item' })
  @ApiParam({
    name: 'id',
    description: 'Item UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item updated successfully',
    type: Item,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid data, UUID or insufficient container volume',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item or container not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'An item with the same unique number already exists',
  })
  async update(
    @Param('id', UUIDValidationPipe) id: string,
    @Body() updateItemDto: UpdateItemDto,
  ): Promise<Item> {
    return this.itemsService.update(id, updateItemDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an item' })
  @ApiParam({
    name: 'id',
    description: 'Item UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Item soft-deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid UUID format',
  })
  async remove(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    await this.itemsService.softDelete(id);
  }

  @Put(':id/restore')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore a soft-deleted item' })
  @ApiParam({
    name: 'id',
    description: 'Item UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item restored successfully',
    type: Item,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid UUID, item is not deleted or container has insufficient volume',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item or container not found',
  })
  async restore(@Param('id', UUIDValidationPipe) id: string): Promise<Item> {
    return this.itemsService.restore(id);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete an item' })
  @ApiParam({
    name: 'id',
    description: 'Item UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Item permanently deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid UUID or item must be soft-deleted first',
  })
  async permanentDelete(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    await this.itemsService.permanentDelete(id);
  }
}
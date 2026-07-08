// src/modules/items/items.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from './entities/item.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@ApiTags('Items')
@Controller('items')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new item in a container' })
  @ApiResponse({ status: 201, description: 'Item created', type: Item })
  @ApiResponse({ status: 400, description: 'Not enough volume' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async create(@Body() createItemDto: CreateItemDto): Promise<Item> {
    return this.itemsService.create(createItemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all items with pagination and sorting' })
  @ApiQuery({ name: 'containerId', required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiQuery({ name: 'includeDeleted', type: Boolean, required: false, example: false })
  @ApiResponse({ status: 200, description: 'Items retrieved', type: PaginatedResponseDto })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('containerId') containerId?: string,
    @Query('includeDeleted') includeDeleted?: boolean,
  ): Promise<PaginatedResponseDto<Item>> {
    return this.itemsService.findAll(paginationDto, containerId, includeDeleted);
  }

  @Get('deleted')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all soft-deleted items' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'deletedAt:DESC' })
  @ApiResponse({ status: 200, description: 'Deleted items retrieved', type: PaginatedResponseDto })
  async findDeleted(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Item>> {
    return this.itemsService.findDeleted(paginationDto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search items with pagination and sorting' })
  @ApiQuery({ name: 'query', type: String, required: true })
  @ApiQuery({ name: 'containerId', required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiResponse({ status: 200, description: 'Search results', type: PaginatedResponseDto })
  @ApiResponse({ status: 400, description: 'Query parameter is required' })
  async searchItems(
    @Query('query') query: string,
    @Query('containerId') containerId?: string,
    @Query() paginationDto?: PaginationDto,
  ): Promise<PaginatedResponseDto<Item>> {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Query parameter is required');
    }
    const pagination = paginationDto || new PaginationDto();
    return this.itemsService.searchItems(query.trim(), pagination, containerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an item by ID' })
  @ApiQuery({ name: 'includeDeleted', type: Boolean, required: false, example: false })
  @ApiResponse({ status: 200, description: 'Item retrieved', type: Item })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async findOne(
    @Param('id', UUIDValidationPipe) id: string,
    @Query('includeDeleted') includeDeleted?: boolean,
  ): Promise<Item> {
    return this.itemsService.findOne(id, includeDeleted);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an item' })
  @ApiResponse({ status: 200, description: 'Item updated', type: Item })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async update(
    @Param('id', UUIDValidationPipe) id: string,
    @Body() updateItemDto: UpdateItemDto,
  ): Promise<Item> {
    return this.itemsService.update(id, updateItemDto);
  }

  // ✅ Soft Delete - Mark as deleted
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an item' })
  @ApiResponse({ status: 204, description: 'Item soft deleted' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async remove(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    return this.itemsService.softDelete(id);
  }

  // ✅ Restore - Recover soft deleted item
  @Put(':id/restore')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore a soft-deleted item' })
  @ApiResponse({ status: 200, description: 'Item restored', type: Item })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 400, description: 'Item is not deleted' })
  async restore(@Param('id', UUIDValidationPipe) id: string): Promise<Item> {
    return this.itemsService.restore(id);
  }

  // ✅ Permanent Delete - Hard delete
  @Delete(':id/permanent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete an item (hard delete)' })
  @ApiResponse({ status: 204, description: 'Item permanently deleted' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async permanentDelete(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    return this.itemsService.permanentDelete(id);
  }
}
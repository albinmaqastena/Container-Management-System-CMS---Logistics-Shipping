// src/modules/containers/containers.controller.ts
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
  Request,
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
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { Container, ContainerStatus } from './entities/container.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';

@ApiTags('Containers')
@Controller('containers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new container' })
  @ApiResponse({ status: 201, description: 'Container created', type: Container })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createContainerDto: CreateContainerDto, @Request() req): Promise<Container> {
    return this.containersService.create(createContainerDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all containers with pagination and sorting' })
  @ApiQuery({ name: 'status', enum: ContainerStatus, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiQuery({ name: 'includeDeleted', type: Boolean, required: false, example: false })
  @ApiResponse({ status: 200, description: 'Containers retrieved', type: PaginatedResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: ContainerStatus,
    @Query('includeDeleted') includeDeleted?: boolean,
  ): Promise<PaginatedResponseDto<Container>> {
    if (status && !Object.values(ContainerStatus).includes(status)) {
      throw new BadRequestException(
        `Invalid status value: ${status}. Allowed values: ${Object.values(ContainerStatus).join(', ')}`,
      );
    }
    return this.containersService.findAll(paginationDto, status, includeDeleted);
  }

  @Get('deleted')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all soft-deleted containers' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'deletedAt:DESC' })
  @ApiResponse({ status: 200, description: 'Deleted containers retrieved', type: PaginatedResponseDto })
  async findDeleted(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findDeleted(paginationDto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active containers with pagination and sorting' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiResponse({ status: 200, description: 'Active containers retrieved', type: PaginatedResponseDto })
  async getActiveContainers(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findActiveContainers(paginationDto);
  }

  @Get('archived')
  @ApiOperation({ summary: 'Get archived containers with pagination and sorting' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiResponse({ status: 200, description: 'Archived containers retrieved', type: PaginatedResponseDto })
  async getArchivedContainers(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findArchivedContainers(paginationDto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search containers with pagination and sorting' })
  @ApiQuery({ name: 'query', type: String, required: true, description: 'Search term for container name or code' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiResponse({ status: 200, description: 'Search results', type: PaginatedResponseDto })
  @ApiResponse({ status: 400, description: 'Query parameter is required' })
  async searchContainers(
    @Query('query') query: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Query parameter is required');
    }
    return this.containersService.searchContainers(query.trim(), paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a container by ID' })
  @ApiQuery({ name: 'includeDeleted', type: Boolean, required: false, example: false })
  @ApiResponse({ status: 200, description: 'Container retrieved', type: Container })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async findOne(
    @Param('id', UUIDValidationPipe) id: string,
    @Query('includeDeleted') includeDeleted?: boolean,
  ): Promise<Container> {
    return this.containersService.findOne(id, includeDeleted);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a container' })
  @ApiResponse({ status: 200, description: 'Container updated', type: Container })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async update(
    @Param('id', UUIDValidationPipe) id: string,
    @Body() updateContainerDto: UpdateContainerDto,
  ): Promise<Container> {
    return this.containersService.update(id, updateContainerDto);
  }

  @Put(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update container status' })
  @ApiQuery({ name: 'status', enum: ContainerStatus, required: true })
  @ApiResponse({ status: 200, description: 'Status updated', type: Container })
  @ApiResponse({ status: 400, description: 'Invalid UUID format or status value' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async updateStatus(
    @Param('id', UUIDValidationPipe) id: string,
    @Query('status') status: ContainerStatus,
  ): Promise<Container> {
    if (!status || !Object.values(ContainerStatus).includes(status)) {
      throw new BadRequestException(
        `Invalid status value: ${status}. Allowed values: ${Object.values(ContainerStatus).join(', ')}`,
      );
    }
    return this.containersService.updateStatus(id, status);
  }

  // ✅ Soft Delete - Mark as deleted
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a container' })
  @ApiResponse({ status: 204, description: 'Container soft deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete container with items or invalid UUID' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async remove(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    return this.containersService.softDelete(id);
  }

  // ✅ Restore - Recover soft deleted container
  @Put(':id/restore')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore a soft-deleted container' })
  @ApiResponse({ status: 200, description: 'Container restored', type: Container })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 400, description: 'Container is not deleted' })
  async restore(@Param('id', UUIDValidationPipe) id: string): Promise<Container> {
    return this.containersService.restore(id);
  }

  // ✅ Permanent Delete - Hard delete
  @Delete(':id/permanent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a container (hard delete)' })
  @ApiResponse({ status: 204, description: 'Container permanently deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete container with items or invalid UUID' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async permanentDelete(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    return this.containersService.permanentDelete(id);
  }
}
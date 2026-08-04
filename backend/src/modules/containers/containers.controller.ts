// src/modules/containers/containers.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';

import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { ContainerQueryDto } from './dto/container-query.dto';
import { SearchContainerQueryDto } from './dto/search-container-query.dto';
import { Container, ContainerStatus } from './entities/container.entity';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { User, UserRole } from '../auth/entities/user.entity';

interface AuthenticatedRequest extends ExpressRequest {
  user: User;
}

const QUERY_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@ApiTags('Containers')
@ApiExtraModels(Container, PaginatedResponseDto)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({
  description: 'Authentication is required',
})
@ApiForbiddenResponse({
  description: 'Insufficient permissions',
})
@Controller('containers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new container' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Container created successfully',
    type: Container,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid container data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Container name or code already exists',
  })
  async create(
    @Body() createContainerDto: CreateContainerDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Container> {
    return this.containersService.create(createContainerDto, req.user);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all containers with pagination and sorting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Containers retrieved successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: getSchemaPath(Container),
              },
            },
          },
        },
      ],
    },
  })
  async findAll(
    @Query(QUERY_VALIDATION_PIPE)
    query: ContainerQueryDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findAll(query, query.status, query.includeDeleted ?? false);
  }

  @Get('deleted')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all soft-deleted containers',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deleted containers retrieved successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: getSchemaPath(Container),
              },
            },
          },
        },
      ],
    },
  })
  async findDeleted(
    @Query(QUERY_VALIDATION_PIPE)
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findDeleted(query);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active containers with pagination and sorting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active containers retrieved successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: getSchemaPath(Container),
              },
            },
          },
        },
      ],
    },
  })
  async getActiveContainers(
    @Query(QUERY_VALIDATION_PIPE)
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findActiveContainers(query);
  }

  @Get('archived')
  @ApiOperation({
    summary: 'Get archived containers with pagination and sorting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Archived containers retrieved successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: getSchemaPath(Container),
              },
            },
          },
        },
      ],
    },
  })
  async getArchivedContainers(
    @Query(QUERY_VALIDATION_PIPE)
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findArchivedContainers(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search containers with pagination and sorting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: getSchemaPath(Container),
              },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Search query is missing or invalid',
  })
  async searchContainers(
    @Query(QUERY_VALIDATION_PIPE)
    query: SearchContainerQueryDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.searchContainers(query.query, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a container by ID' })
  @ApiQuery({
    name: 'includeDeleted',
    type: Boolean,
    required: false,
    example: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Container retrieved successfully',
    type: Container,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid container UUID or includeDeleted value',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Container not found',
  })
  async findOne(
    @Param('id', UUIDValidationPipe) id: string,
    @Query('includeDeleted', new ParseBoolPipe({ optional: true }))
    includeDeleted?: boolean,
  ): Promise<Container> {
    return this.containersService.findOne(id, includeDeleted ?? false);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a container' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Container updated successfully',
    type: Container,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid container data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Container name or code already exists',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Container not found',
  })
  async update(
    @Param('id', UUIDValidationPipe) id: string,
    @Body() updateContainerDto: UpdateContainerDto,
  ): Promise<Container> {
    return this.containersService.update(id, updateContainerDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update container status' })
  @ApiQuery({
    name: 'status',
    enum: ContainerStatus,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Container status updated successfully',
    type: Container,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid container UUID or status value',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Container not found',
  })
  async updateStatus(
    @Param('id', UUIDValidationPipe) id: string,
    @Query(
      'status',
      new ParseEnumPipe(ContainerStatus, {
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    status: ContainerStatus,
  ): Promise<Container> {
    return this.containersService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a container' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Container soft-deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid container UUID',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Container not found',
  })
  async remove(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    await this.containersService.softDelete(id);
  }

  @Put(':id/restore')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Restore a soft-deleted container',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Container restored successfully',
    type: Container,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Container is not deleted, has active items, or restored items exceed capacity',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Container not found or could not be restored',
  })
  async restore(@Param('id', UUIDValidationPipe) id: string): Promise<Container> {
    return this.containersService.restore(id);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete a container',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Container permanently deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Container must be soft-deleted before permanent deletion',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Container not found',
  })
  async permanentDelete(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    await this.containersService.permanentDelete(id);
  }
}

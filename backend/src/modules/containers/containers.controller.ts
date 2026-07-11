// src/modules/containers/containers.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

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
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('Containers')
@ApiExtraModels(Container, PaginatedResponseDto)
@ApiBearerAuth()
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
    description: 'Invalid data or duplicate container name',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async create(
    @Body() createContainerDto: CreateContainerDto,
    @Request() req: { user: any },
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
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: ContainerQueryDto,
  ): Promise<PaginatedResponseDto<Container>> {
    const paginationDto = this.createPaginationDto(query);

    return this.containersService.findAll(
      paginationDto,
      query.status,
      query.includeDeleted === 'true',
    );
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
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findDeleted(this.createPaginationDto(query));
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
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findActiveContainers(this.createPaginationDto(query));
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
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.findArchivedContainers(this.createPaginationDto(query));
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
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: SearchContainerQueryDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.containersService.searchContainers(query.query, this.createPaginationDto(query));
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

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a container' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Container updated successfully',
    type: Container,
  })
  async update(
    @Param('id', UUIDValidationPipe) id: string,
    @Body() updateContainerDto: UpdateContainerDto,
  ): Promise<Container> {
    return this.containersService.update(id, updateContainerDto);
  }

  @Put(':id/status')
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
  async updateStatus(
    @Param('id', UUIDValidationPipe) id: string,
    @Query('status') status: ContainerStatus,
  ): Promise<Container> {
    if (!status || !Object.values(ContainerStatus).includes(status)) {
      throw new BadRequestException(
        `Invalid status value: ${status}. Allowed values: ${Object.values(ContainerStatus).join(
          ', ',
        )}`,
      );
    }

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
  async permanentDelete(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    await this.containersService.permanentDelete(id);
  }

  private createPaginationDto(query: PaginationDto): PaginationDto {
    const limit = Number(query.limit);
    const offset = Number(query.offset);

    const paginationDto = new PaginationDto();
    paginationDto.limit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    paginationDto.offset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    paginationDto.sort = query.sort || undefined;

    return paginationDto;
  }
}

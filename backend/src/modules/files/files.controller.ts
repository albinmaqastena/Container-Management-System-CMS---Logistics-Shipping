// src/modules/files/files.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';

import { FilesService } from './files.service';
import { FileUploadDto } from './dto/file-upload.dto';
import { FileValidationInterceptor } from '../../common/interceptors/file-validation.interceptor';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import type { MulterFile } from '../../common/types/multer-file.type';

interface UploadedFileResponse {
  message: string;
  filename: string;
  path: string;
  url: string;
}

interface UploadedFilesResponse {
  message: string;
  files: Array<{
    filename: string;
    path: string;
    url: string;
  }>;
}

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
  ) {}

  @Post('upload')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @UseInterceptors(
    FileInterceptor('file'),
    FileValidationInterceptor,
  )
  @ApiOperation({
    summary: 'Upload a single file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          example: 'items/photos',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or missing file',
  })
  async uploadFile(
    @UploadedFile()
    file: MulterFile | undefined,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: true,
      }),
    )
    body: FileUploadDto = {},
  ): Promise<UploadedFileResponse> {
    if (!file) {
      throw new BadRequestException(
        'No file provided',
      );
    }

    const result =
      await this.filesService.saveFile(
        file,
        body.folder,
      );

    return {
      message: 'File uploaded successfully',
      ...result,
    };
  }

  @Post('upload/multiple')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @UseInterceptors(
    FilesInterceptor('files', 10),
    FileValidationInterceptor,
  )
  @ApiOperation({
    summary: 'Upload multiple files',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          maxItems: 10,
        },
        folder: {
          type: 'string',
          example: 'items/photos',
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Files uploaded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or missing files',
  })
  async uploadMultipleFiles(
    @UploadedFiles()
    files: MulterFile[] | undefined,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: true,
      }),
    )
    body: FileUploadDto = {},
  ): Promise<UploadedFilesResponse> {
    if (!files?.length) {
      throw new BadRequestException(
        'No files provided',
      );
    }

    const results = await Promise.all(
      files.map((file) =>
        this.filesService.saveFile(
          file,
          body.folder,
        ),
      ),
    );

    return {
      message: `${results.length} files uploaded successfully`,
      files: results,
    };
  }

  @Delete('*path')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a file',
  })
  @ApiParam({
    name: 'path',
    example: 'items/photos/example.jpg',
    description:
      'Relative path returned by the upload endpoint',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file path',
  })
  async deleteFile(
    @Param('path')
    filePath: string | string[],
  ): Promise<{ message: string }> {
    const normalizedPath = Array.isArray(
      filePath,
    )
      ? filePath.join('/')
      : filePath;

    await this.filesService.deleteFile(
      normalizedPath,
    );

    return {
      message: 'File deleted successfully',
    };
  }
}
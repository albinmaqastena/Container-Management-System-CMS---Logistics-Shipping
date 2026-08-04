// src/modules/files/files.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
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
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { FilesService, SavedFileResult } from './files.service';
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
  files: SavedFileResult[];
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 10;

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
      },
    }),
    FileValidationInterceptor,
  )
  @ApiOperation({
    summary: 'Upload a single image',
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
    description: 'Invalid or missing image',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'The uploaded image could not be processed safely',
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
      throw new BadRequestException('File is required');
    }

    const result = await this.filesService.saveFile(file, body.folder ?? '');

    return {
      message: 'File uploaded successfully',
      ...result,
    };
  }

  @Post('upload/multiple')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_UPLOAD, {
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: MAX_FILES_PER_UPLOAD,
      },
    }),
    FileValidationInterceptor,
  )
  @ApiOperation({
    summary: 'Upload multiple images',
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
          minItems: 1,
          maxItems: MAX_FILES_PER_UPLOAD,
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
    description: 'Invalid or missing images',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'One or more images could not be processed safely',
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
      throw new BadRequestException('At least one file is required');
    }

    const folder = body.folder ?? '';
    const savedFiles: SavedFileResult[] = [];

    try {
      /*
       * Upload sequentially so that successfully saved
       * files are known and can be removed if a later
       * upload fails.
       */
      for (const file of files) {
        const savedFile = await this.filesService.saveFile(file, folder);

        savedFiles.push(savedFile);
      }

      return {
        message: `${savedFiles.length} files uploaded successfully`,
        files: savedFiles,
      };
    } catch (error) {
      const cleanupResults = await Promise.allSettled(
        savedFiles.map((savedFile) => this.filesService.deleteFile(savedFile.path)),
      );

      cleanupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          return;
        }

        const savedFile = savedFiles[index];

        this.logger.error(
          `Failed to clean up partially uploaded file ${savedFile?.path ?? 'unknown'}: ${
            result.reason instanceof Error ? result.reason.message : 'Unknown cleanup error'
          }`,
          result.reason instanceof Error ? result.reason.stack : undefined,
        );
      });

      /*
       * Preserve the original upload error even when
       * one or more cleanup attempts fail.
       */
      throw error;
    }
  }

  @Delete('*path')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an uploaded image',
  })
  @ApiParam({
    name: 'path',
    example: 'items/photos/example.jpg',
    description: 'Relative path returned by the upload endpoint',
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
    const normalizedPath = Array.isArray(filePath) ? filePath.join('/') : filePath;

    await this.filesService.deleteFile(normalizedPath);

    return {
      message: 'File deleted successfully',
    };
  }
}

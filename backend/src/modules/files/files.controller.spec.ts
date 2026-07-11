// src/modules/files/files.controller.spec.ts

import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileUploadDto } from './dto/file-upload.dto';
import type { MulterFile } from '../../common/types/multer-file.type';

jest.mock(
  '../../common/interceptors/file-validation.interceptor',
  () => ({
    FileValidationInterceptor: jest
      .fn()
      .mockImplementation(() => ({
        intercept: (
          _context: unknown,
          next: { handle: () => unknown },
        ) => next.handle(),
      })),
  }),
);

describe('FilesController', () => {
  let controller: FilesController;
  let service: jest.Mocked<FilesService>;

  const mockFile: MulterFile = {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockSavedFile = {
    filename: 'test-1234567890-abc123.jpg',
    path: 'folder/test-1234567890-abc123.jpg',
    url: '/uploads/folder/test-1234567890-abc123.jpg',
  };

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [FilesController],
        providers: [
          {
            provide: FilesService,
            useValue: {
              saveFile: jest.fn(),
              deleteFile: jest.fn(),
            },
          },
        ],
      }).compile();

    controller =
      module.get<FilesController>(
        FilesController,
      );

    service =
      module.get(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a single file successfully', async () => {
      service.saveFile.mockResolvedValue(
        mockSavedFile,
      );

      const body: FileUploadDto = {
        folder: 'folder',
      };

      const result =
        await controller.uploadFile(
          mockFile,
          body,
        );

      expect(result).toEqual({
        message:
          'File uploaded successfully',
        ...mockSavedFile,
      });

      expect(
        service.saveFile,
      ).toHaveBeenCalledWith(
        mockFile,
        'folder',
      );
    });

    it('should throw BadRequestException if no file is provided', async () => {
      const body: FileUploadDto = {
        folder: 'folder',
      };

      await expect(
        controller.uploadFile(
          undefined,
          body,
        ),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        service.saveFile,
      ).not.toHaveBeenCalled();
    });

    it('should call saveFile with undefined folder when not provided', async () => {
      service.saveFile.mockResolvedValue({
        ...mockSavedFile,
        path:
          'test-1234567890-abc123.jpg',
        url:
          '/uploads/test-1234567890-abc123.jpg',
      });

      const body: FileUploadDto = {
      };

      await controller.uploadFile(
        mockFile,
        body,
      );

      expect(
        service.saveFile,
      ).toHaveBeenCalledWith(
        mockFile,
        undefined,
      );
    });
  });

  describe('uploadMultipleFiles', () => {
    it('should upload multiple files successfully', async () => {
      const files: MulterFile[] = [
        mockFile,
        {
          ...mockFile,
          originalname: 'test2.jpg',
        },
      ];

      service.saveFile.mockResolvedValue(
        mockSavedFile,
      );

      const body: FileUploadDto = {
        folder: 'folder',
      };

      const result =
        await controller.uploadMultipleFiles(
          files,
          body,
        );

      expect(result).toEqual({
        message:
          '2 files uploaded successfully',
        files: [
          mockSavedFile,
          mockSavedFile,
        ],
      });

      expect(
        service.saveFile,
      ).toHaveBeenCalledTimes(2);

      expect(
        service.saveFile,
      ).toHaveBeenNthCalledWith(
        1,
        files[0],
        'folder',
      );

      expect(
        service.saveFile,
      ).toHaveBeenNthCalledWith(
        2,
        files[1],
        'folder',
      );
    });

    it('should throw BadRequestException if files are undefined', async () => {
      const body: FileUploadDto = {
        folder: 'folder',
      };

      await expect(
        controller.uploadMultipleFiles(
          undefined,
          body,
        ),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        service.saveFile,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if files array is empty', async () => {
      const body: FileUploadDto = {
      };

      await expect(
        controller.uploadMultipleFiles(
          [],
          body,
        ),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        service.saveFile,
      ).not.toHaveBeenCalled();
    });

    it('should call saveFile with undefined folder when not provided', async () => {
      const files = [mockFile];

      service.saveFile.mockResolvedValue({
        ...mockSavedFile,
        path:
          'test-1234567890-abc123.jpg',
        url:
          '/uploads/test-1234567890-abc123.jpg',
      });

      const body: FileUploadDto = {
      };

      await controller.uploadMultipleFiles(
        files,
        body,
      );

      expect(
        service.saveFile,
      ).toHaveBeenCalledWith(
        mockFile,
        undefined,
      );
    });

    it('should propagate an error when one file fails to save', async () => {
      const files = [
        mockFile,
        {
          ...mockFile,
          originalname: 'test2.jpg',
        },
      ];

      service.saveFile
        .mockResolvedValueOnce(
          mockSavedFile,
        )
        .mockRejectedValueOnce(
          new BadRequestException(
            'Unable to save file',
          ),
        );

      const body: FileUploadDto = {
        folder: 'folder',
      };

      await expect(
        controller.uploadMultipleFiles(
          files,
          body,
        ),
      ).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      service.deleteFile.mockResolvedValue(
        undefined,
      );

      const result =
        await controller.deleteFile(
          'folder/test.jpg',
        );

      expect(result).toEqual({
        message:
          'File deleted successfully',
      });

      expect(
        service.deleteFile,
      ).toHaveBeenCalledWith(
        'folder/test.jpg',
      );
    });

    it('should propagate NotFoundException from service', async () => {
      service.deleteFile.mockRejectedValue(
        new NotFoundException(
          'File not found',
        ),
      );

      await expect(
        controller.deleteFile(
          'nonexistent.jpg',
        ),
      ).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate BadRequestException for invalid paths', async () => {
      service.deleteFile.mockRejectedValue(
        new BadRequestException(
          'Invalid file path',
        ),
      );

      await expect(
        controller.deleteFile(
          '../secret.txt',
        ),
      ).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
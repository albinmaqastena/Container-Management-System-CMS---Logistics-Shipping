// src/modules/files/files.controller.spec.ts

import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileUploadDto } from './dto/file-upload.dto';
import type { MulterFile } from '../../common/types/multer-file.type';

jest.mock('../../common/interceptors/file-validation.interceptor', () => ({
  FileValidationInterceptor: jest.fn().mockImplementation(() => ({
    intercept: (_context: unknown, next: { handle: () => unknown }) => next.handle(),
  })),
}));

describe('FilesController', () => {
  let controller: FilesController;
  let service: jest.Mocked<FilesService>;
  let loggerErrorSpy: jest.SpyInstance;

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

  const firstSavedFile = {
    filename: 'first-1234567890-abc123.jpg',
    path: 'folder/first-1234567890-abc123.jpg',
    url: '/uploads/folder/first-1234567890-abc123.jpg',
  };

  const secondSavedFile = {
    filename: 'second-1234567890-def456.jpg',
    path: 'folder/second-1234567890-def456.jpg',
    url: '/uploads/folder/second-1234567890-def456.jpg',
  };

  beforeEach(async () => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
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

    controller = module.get<FilesController>(FilesController);
    service = module.get(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a single file successfully', async () => {
      service.saveFile.mockResolvedValue(mockSavedFile);

      const body: FileUploadDto = {
        folder: 'folder',
      };

      const result = await controller.uploadFile(mockFile, body);

      expect(result).toEqual({
        message: 'File uploaded successfully',
        ...mockSavedFile,
      });

      expect(service.saveFile).toHaveBeenCalledWith(mockFile, 'folder');
    });

    it('should throw if no file is provided', async () => {
      const body: FileUploadDto = {
        folder: 'folder',
      };

      await expect(controller.uploadFile(undefined, body)).rejects.toThrow('File is required');

      expect(service.saveFile).not.toHaveBeenCalled();
    });

    it('should use an empty folder when none is provided', async () => {
      service.saveFile.mockResolvedValue({
        ...mockSavedFile,
        path: mockSavedFile.filename,
        url: `/uploads/${mockSavedFile.filename}`,
      });

      const body: FileUploadDto = {};

      await controller.uploadFile(mockFile, body);

      expect(service.saveFile).toHaveBeenCalledWith(mockFile, '');
    });

    it('should propagate InternalServerErrorException', async () => {
      const error = new InternalServerErrorException('Unable to safely process uploaded image');

      service.saveFile.mockRejectedValue(error);

      const body: FileUploadDto = {};

      await expect(controller.uploadFile(mockFile, body)).rejects.toBe(error);
    });
  });

  describe('uploadMultipleFiles', () => {
    it('should upload multiple files successfully and preserve order', async () => {
      const files: MulterFile[] = [
        mockFile,
        {
          ...mockFile,
          originalname: 'test2.jpg',
        },
      ];

      service.saveFile.mockResolvedValueOnce(firstSavedFile).mockResolvedValueOnce(secondSavedFile);

      const body: FileUploadDto = {
        folder: 'folder',
      };

      const result = await controller.uploadMultipleFiles(files, body);

      expect(result).toEqual({
        message: '2 files uploaded successfully',
        files: [firstSavedFile, secondSavedFile],
      });

      expect(service.saveFile).toHaveBeenCalledTimes(2);
      expect(service.saveFile).toHaveBeenNthCalledWith(1, files[0], 'folder');
      expect(service.saveFile).toHaveBeenNthCalledWith(2, files[1], 'folder');

      expect(service.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw if files are undefined', async () => {
      const body: FileUploadDto = {
        folder: 'folder',
      };

      await expect(controller.uploadMultipleFiles(undefined, body)).rejects.toThrow(
        'At least one file is required',
      );

      expect(service.saveFile).not.toHaveBeenCalled();
    });

    it('should throw if files array is empty', async () => {
      const body: FileUploadDto = {};

      await expect(controller.uploadMultipleFiles([], body)).rejects.toThrow(
        'At least one file is required',
      );

      expect(service.saveFile).not.toHaveBeenCalled();
    });

    it('should use an empty folder when none is provided', async () => {
      const files = [mockFile];

      service.saveFile.mockResolvedValue({
        ...mockSavedFile,
        path: mockSavedFile.filename,
        url: `/uploads/${mockSavedFile.filename}`,
      });

      const body: FileUploadDto = {};

      await controller.uploadMultipleFiles(files, body);

      expect(service.saveFile).toHaveBeenCalledWith(mockFile, '');
    });

    it('should clean up previously uploaded files when a later upload fails', async () => {
      const files: MulterFile[] = [
        mockFile,
        {
          ...mockFile,
          originalname: 'test2.jpg',
        },
        {
          ...mockFile,
          originalname: 'test3.jpg',
        },
      ];

      const uploadError = new BadRequestException('Unable to save file');

      service.saveFile
        .mockResolvedValueOnce(firstSavedFile)
        .mockResolvedValueOnce(secondSavedFile)
        .mockRejectedValueOnce(uploadError);

      service.deleteFile.mockResolvedValue(undefined);

      await expect(
        controller.uploadMultipleFiles(files, {
          folder: 'folder',
        }),
      ).rejects.toBe(uploadError);

      expect(service.saveFile).toHaveBeenCalledTimes(3);
      expect(service.deleteFile).toHaveBeenCalledTimes(2);

      // Check order of cleanup calls
      expect(service.deleteFile).toHaveBeenNthCalledWith(1, firstSavedFile.path);
      expect(service.deleteFile).toHaveBeenNthCalledWith(2, secondSavedFile.path);
    });

    it('should not run cleanup when the first upload fails', async () => {
      const uploadError = new BadRequestException('Unable to save file');

      service.saveFile.mockRejectedValueOnce(uploadError);

      await expect(
        controller.uploadMultipleFiles([mockFile], {
          folder: 'folder',
        }),
      ).rejects.toBe(uploadError);

      expect(service.deleteFile).not.toHaveBeenCalled();
    });

    it('should preserve the original upload error when cleanup fails', async () => {
      const files: MulterFile[] = [
        mockFile,
        {
          ...mockFile,
          originalname: 'test2.jpg',
        },
      ];

      const uploadError = new BadRequestException('Unable to save file');

      service.saveFile.mockResolvedValueOnce(firstSavedFile).mockRejectedValueOnce(uploadError);

      service.deleteFile.mockRejectedValueOnce(new BadRequestException('Unable to delete file'));

      await expect(
        controller.uploadMultipleFiles(files, {
          folder: 'folder',
        }),
      ).rejects.toBe(uploadError);

      expect(service.deleteFile).toHaveBeenCalledWith(firstSavedFile.path);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(firstSavedFile.path),
        expect.anything(),
      );
    });

    it('should clean up earlier files and propagate InternalServerErrorException', async () => {
      const files: MulterFile[] = [
        mockFile,
        {
          ...mockFile,
          originalname: 'test2.jpg',
        },
      ];

      const uploadError = new InternalServerErrorException(
        'Unable to safely process uploaded image',
      );

      service.saveFile.mockResolvedValueOnce(firstSavedFile).mockRejectedValueOnce(uploadError);

      service.deleteFile.mockResolvedValue(undefined);

      await expect(
        controller.uploadMultipleFiles(files, {
          folder: 'folder',
        }),
      ).rejects.toBe(uploadError);

      expect(service.deleteFile).toHaveBeenCalledTimes(1);
      expect(service.deleteFile).toHaveBeenCalledWith(firstSavedFile.path);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      service.deleteFile.mockResolvedValue(undefined);

      const result = await controller.deleteFile('folder/test.jpg');

      expect(result).toEqual({
        message: 'File deleted successfully',
      });

      expect(service.deleteFile).toHaveBeenCalledWith('folder/test.jpg');
    });

    it('should join wildcard path segments before deleting', async () => {
      service.deleteFile.mockResolvedValue(undefined);

      const result = await controller.deleteFile(['items', 'photos', 'test.jpg']);

      expect(service.deleteFile).toHaveBeenCalledWith('items/photos/test.jpg');

      expect(result).toEqual({
        message: 'File deleted successfully',
      });
    });

    it('should propagate NotFoundException from service', async () => {
      service.deleteFile.mockRejectedValue(new NotFoundException('File not found'));

      await expect(controller.deleteFile('nonexistent.jpg')).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException for invalid paths', async () => {
      service.deleteFile.mockRejectedValue(new BadRequestException('Invalid file path'));

      await expect(controller.deleteFile('../secret.txt')).rejects.toThrow(BadRequestException);
    });
  });
});

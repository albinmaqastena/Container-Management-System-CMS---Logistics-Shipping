// src/modules/files/files.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { BadRequestException } from '@nestjs/common';
import type { MulterFile } from '../../common/types/multer-file.type';
import { NotFoundException } from '@nestjs/common';

// Mock FileValidationInterceptor - skip it for controller tests
jest.mock('../../common/interceptors/file-validation.interceptor', () => ({
  FileValidationInterceptor: jest.fn().mockImplementation(() => ({
    intercept: (context, next) => next.handle(),
  })),
}));

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
    path: 'test-1234567890-abc123.jpg',
    url: '/uploads/test-1234567890-abc123.jpg',
  };

  beforeEach(async () => {
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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              upload: { destination: './uploads', urlPrefix: '/uploads' },
              imageOptimization: { enabled: true, maxWidth: 800, maxHeight: 600, quality: 80 },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    service = module.get(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a single file successfully', async () => {
      service.saveFile.mockResolvedValue(mockSavedFile);

      const result = await controller.uploadFile(mockFile, 'folder');

      expect(result).toEqual({
        message: 'File uploaded successfully',
        ...mockSavedFile,
      });
      expect(service.saveFile).toHaveBeenCalledWith(mockFile, 'folder');
    });

    it('should throw BadRequestException if no file provided', async () => {
      await expect(controller.uploadFile(undefined as any, 'folder')).rejects.toThrow(BadRequestException);
      expect(service.saveFile).not.toHaveBeenCalled();
    });

    it('should call saveFile with undefined folder if not provided', async () => {
      service.saveFile.mockResolvedValue(mockSavedFile);

      await controller.uploadFile(mockFile);

      expect(service.saveFile).toHaveBeenCalledWith(mockFile, undefined);
    });
  });

  describe('uploadMultipleFiles', () => {
    it('should upload multiple files successfully', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.jpg' }];
      service.saveFile.mockResolvedValue(mockSavedFile);

      const result = await controller.uploadMultipleFiles(files, 'folder');

      expect(result.message).toBe('2 files uploaded successfully');
      expect(result.files).toHaveLength(2);
      expect(service.saveFile).toHaveBeenCalledTimes(2);
      expect(service.saveFile).toHaveBeenCalledWith(files[0], 'folder');
      expect(service.saveFile).toHaveBeenCalledWith(files[1], 'folder');
    });

    it('should throw BadRequestException if no files provided', async () => {
      await expect(controller.uploadMultipleFiles(undefined as any, 'folder')).rejects.toThrow(BadRequestException);
      expect(service.saveFile).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if files array is empty', async () => {
      await expect(controller.uploadMultipleFiles([], 'folder')).rejects.toThrow(BadRequestException);
      expect(service.saveFile).not.toHaveBeenCalled();
    });

    it('should call saveFile with undefined folder if not provided', async () => {
      const files = [mockFile];
      service.saveFile.mockResolvedValue(mockSavedFile);

      await controller.uploadMultipleFiles(files);

      expect(service.saveFile).toHaveBeenCalledWith(files[0], undefined);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      service.deleteFile.mockResolvedValue(undefined);

      const result = await controller.deleteFile('test.jpg');

      expect(result).toEqual({ message: 'File deleted successfully' });
      expect(service.deleteFile).toHaveBeenCalledWith('test.jpg');
    });

    it('should propagate NotFoundException from service', async () => {
      service.deleteFile.mockRejectedValue(new NotFoundException('File not found'));

      await expect(controller.deleteFile('nonexistent.jpg')).rejects.toThrow(NotFoundException);
    });
  });
});
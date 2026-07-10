// src/modules/files/files.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { FilesService } from './files.service';
import { NotFoundException } from '@nestjs/common';
import type { MulterFile } from '../../common/types/multer-file.type';

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
  },
}));

// Mock sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080 }),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue(undefined),
  }));
});

describe('FilesService', () => {
  let service: FilesService;
  let configService: ConfigService;
  let loggerSpy: jest.SpyInstance;

  const mockConfig = {
    file: {
      upload: {
        destination: './uploads',
        urlPrefix: '/uploads',
      },
      imageOptimization: {
        enabled: true,
        maxWidth: 800,
        maxHeight: 600,
        quality: 80,
      },
    },
  };

  const mockFile: MulterFile = {
    fieldname: 'file',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'file') return mockConfig.file;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    configService = module.get<ConfigService>(ConfigService);
    loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create upload directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync');

      new FilesService(configService);

      expect(mkdirSyncSpy).toHaveBeenCalledWith('./uploads', { recursive: true });
    });

    it('should not create upload directory if it exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync');

      new FilesService(configService);

      expect(mkdirSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('saveFile', () => {
    it('should save a file successfully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.saveFile(mockFile);

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('url');
      expect(result.url).toContain('/uploads/');
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should create subfolder if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync');
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.saveFile(mockFile, 'subfolder');

      expect(mkdirSyncSpy).toHaveBeenCalledWith(expect.stringContaining('subfolder'), { recursive: true });
    });

    it('should generate a safe filename', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.saveFile(mockFile);

      expect(result.filename).toMatch(/test-image-\d+-[a-f0-9]{16}\.jpg/);
    });

    it('should optimize image if mimetype is image', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      const optimizeSpy = jest.spyOn(service as any, 'optimizeImage');

      await service.saveFile(mockFile);

      expect(optimizeSpy).toHaveBeenCalled();
    });

    it('should not optimize image if mimetype is not image', async () => {
      const nonImageFile = { ...mockFile, mimetype: 'application/pdf' };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      const optimizeSpy = jest.spyOn(service as any, 'optimizeImage');

      await service.saveFile(nonImageFile);

      expect(optimizeSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.unlink as jest.Mock).mockResolvedValue(undefined);

      await service.deleteFile('test.jpg');

      expect(fs.promises.unlink).toHaveBeenCalledWith(path.join('./uploads', 'test.jpg'));
    });

    it('should not throw if file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.deleteFile('nonexistent.jpg');

      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if unlink fails', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.unlink as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(service.deleteFile('test.jpg')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateSafeFilename', () => {
    it('should generate a safe filename with timestamp and random bytes', () => {
      const result = (service as any).generateSafeFilename('test-file.jpg');
      expect(result).toMatch(/test-file-\d+-[a-f0-9]{16}\.jpg/);
    });

    it('should remove special characters from filename', () => {
      const result = (service as any).generateSafeFilename('test!@#$%file.jpg');
      expect(result).toMatch(/testfile-\d+-[a-f0-9]{16}\.jpg/);
    });

    it('should truncate long filenames to 50 characters', () => {
      const longName = 'a'.repeat(100) + '.jpg';
      const result = (service as any).generateSafeFilename(longName);
      expect(result).toMatch(/^a{50}-\d+-[a-f0-9]{16}\.jpg$/);
    });
  });

  describe('optimizeImage', () => {
    it('should optimize image when enabled', async () => {
      const sharpMock = sharp as jest.MockedFunction<typeof sharp>;
      const toFileMock = jest.fn().mockResolvedValue(undefined);
      const resizeMock = jest.fn().mockReturnThis();
      const jpegMock = jest.fn().mockReturnThis();

      sharpMock.mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080 }),
        resize: resizeMock,
        jpeg: jpegMock,
        toFile: toFileMock,
      } as any));

      (fs.promises.rename as jest.Mock).mockResolvedValue(undefined);

      await (service as any).optimizeImage('test.jpg');

      expect(sharpMock).toHaveBeenCalledWith('test.jpg');
      // Original 1920x1080, max 800x600 => ratio = 800/1920 = 0.4166667 => height = 450
      expect(resizeMock).toHaveBeenCalledWith(800, 450, { fit: 'inside' });
      expect(jpegMock).toHaveBeenCalledWith({ quality: 80 });
      expect(toFileMock).toHaveBeenCalledWith('test.jpg.temp');
      expect(fs.promises.rename).toHaveBeenCalledWith('test.jpg.temp', 'test.jpg');
    });

    it('should not optimize if not enabled', async () => {
      const configWithoutOptimization = {
        file: {
          upload: {
            destination: './uploads',
            urlPrefix: '/uploads',
          },
          imageOptimization: {
            enabled: false,
          },
        },
      };
      jest.spyOn(configService, 'get').mockReturnValue(configWithoutOptimization.file);

      const serviceWithNoOpt = new FilesService(configService);
      const sharpMock = sharp as jest.MockedFunction<typeof sharp>;
      sharpMock.mockClear();

      await (serviceWithNoOpt as any).optimizeImage('test.jpg');

      expect(sharpMock).not.toHaveBeenCalled();
    });

    it('should resize image if dimensions exceed max', async () => {
      const sharpMock = sharp as jest.MockedFunction<typeof sharp>;
      const resizeMock = jest.fn().mockReturnThis();
      const jpegMock = jest.fn().mockReturnThis();
      const toFileMock = jest.fn().mockResolvedValue(undefined);

      sharpMock.mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080 }),
        resize: resizeMock,
        jpeg: jpegMock,
        toFile: toFileMock,
      } as any));

      (fs.promises.rename as jest.Mock).mockResolvedValue(undefined);

      await (service as any).optimizeImage('test.jpg');

      // Same as above: 800x450
      expect(resizeMock).toHaveBeenCalledWith(800, 450, { fit: 'inside' });
      expect(jpegMock).toHaveBeenCalledWith({ quality: 80 });
      expect(toFileMock).toHaveBeenCalledWith('test.jpg.temp');
    });

    it('should not resize if dimensions are within limits', async () => {
      const sharpMock = sharp as jest.MockedFunction<typeof sharp>;
      const resizeMock = jest.fn().mockReturnThis();

      sharpMock.mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 400, height: 300 }),
        resize: resizeMock,
        jpeg: jest.fn().mockReturnThis(),
        toFile: jest.fn().mockResolvedValue(undefined),
      } as any));

      (fs.promises.rename as jest.Mock).mockResolvedValue(undefined);

      await (service as any).optimizeImage('test.jpg');

      // Since maxWidth=800, maxHeight=600, image is smaller, so resize is called with original dimensions (fit: 'inside')
      expect(resizeMock).toHaveBeenCalledWith(400, 300, { fit: 'inside' });
    });

    it('should handle errors gracefully', async () => {
      const sharpMock = sharp as jest.MockedFunction<typeof sharp>;
      sharpMock.mockImplementation(() => {
        throw new Error('Sharp error');
      });

      await (service as any).optimizeImage('test.jpg');

      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
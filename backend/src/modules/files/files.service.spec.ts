// src/modules/files/files.service.spec.ts

import {
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

import { FilesService } from './files.service';
import type { MulterFile } from '../../common/types/multer-file.type';

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    rmdir: jest.fn(),
  },
}));

jest.mock('sharp', () =>
  jest.fn(),
);

describe('FilesService', () => {
  let service: FilesService;
  let configService: ConfigService;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const uploadDirectory =
    path.resolve('./uploads');

  const mockConfig = {
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
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          FilesService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockImplementation(
                  (key: string) =>
                    key === 'file'
                      ? mockConfig
                      : undefined,
                ),
            },
          },
        ],
      }).compile();

    service =
      module.get<FilesService>(
        FilesService,
      );

    configService =
      module.get<ConfigService>(
        ConfigService,
      );

    warnSpy = jest
      .spyOn(
        Logger.prototype,
        'warn',
      )
      .mockImplementation();

    errorSpy = jest
      .spyOn(
        Logger.prototype,
        'error',
      )
      .mockImplementation();

    (
      fs.promises.mkdir as jest.Mock
    ).mockResolvedValue(undefined);

    (
      fs.promises.writeFile as jest.Mock
    ).mockResolvedValue(undefined);

    (
      fs.promises.unlink as jest.Mock
    ).mockResolvedValue(undefined);

    (
      fs.promises.rename as jest.Mock
    ).mockResolvedValue(undefined);

    (
      fs.promises.readdir as jest.Mock
    ).mockResolvedValue(['file.jpg']);

    (
      fs.promises.rmdir as jest.Mock
    ).mockResolvedValue(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create the upload directory recursively', () => {
      expect(
        fs.mkdirSync,
      ).toHaveBeenCalledWith(
        uploadDirectory,
        {
          recursive: true,
        },
      );
    });
  });

  describe('saveFile', () => {
    it('should save a file successfully', async () => {
      const optimizeSpy = jest
        .spyOn(
          service as any,
          'optimizeImage',
        )
        .mockResolvedValue(undefined);

      const result =
        await service.saveFile(
          mockFile,
        );

      expect(result.filename).toMatch(
        /^test-image-\d+-[a-f0-9]{16}\.jpg$/,
      );

      expect(result.path).toBe(
        result.filename,
      );

      expect(result.url).toBe(
        `/uploads/${result.filename}`,
      );

      expect(
        fs.promises.mkdir,
      ).toHaveBeenCalledWith(
        uploadDirectory,
        {
          recursive: true,
        },
      );

      expect(
        fs.promises.writeFile,
      ).toHaveBeenCalledWith(
        path.join(
          uploadDirectory,
          result.filename,
        ),
        mockFile.buffer,
        {
          flag: 'wx',
        },
      );

      expect(
        optimizeSpy,
      ).toHaveBeenCalledWith(
        path.join(
          uploadDirectory,
          result.filename,
        ),
        'image/jpeg',
      );
    });

    it('should save a file inside a nested folder', async () => {
      jest
        .spyOn(
          service as any,
          'optimizeImage',
        )
        .mockResolvedValue(undefined);

      const result =
        await service.saveFile(
          mockFile,
          'items/photos',
        );

      expect(result.path).toBe(
        `items/photos/${result.filename}`,
      );

      expect(result.url).toBe(
        `/uploads/items/photos/${result.filename}`,
      );

      expect(
        fs.promises.mkdir,
      ).toHaveBeenCalledWith(
        path.join(
          uploadDirectory,
          'items',
          'photos',
        ),
        {
          recursive: true,
        },
      );
    });

    it('should reject a missing original filename', async () => {
      await expect(
        service.saveFile({
          ...mockFile,
          originalname: '',
        }),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        fs.promises.writeFile,
      ).not.toHaveBeenCalled();
    });

    it('should reject an empty file buffer', async () => {
      const emptyFile = {
        ...mockFile,
        buffer: Buffer.alloc(0),
      };

      await expect(
        service.saveFile(emptyFile),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        fs.promises.writeFile,
      ).not.toHaveBeenCalled();
    });

    it('should reject path traversal in subfolder', async () => {
      await expect(
        service.saveFile(
          mockFile,
          '../outside',
        ),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        fs.promises.writeFile,
      ).not.toHaveBeenCalled();
    });

    it('should normalize backslashes in subfolder paths', async () => {
      jest
        .spyOn(
          service as any,
          'optimizeImage',
        )
        .mockResolvedValue(undefined);

      const result =
        await service.saveFile(
          mockFile,
          'items\\photos',
        );

      expect(result.path).toBe(
        `items/photos/${result.filename}`,
      );
    });

    it('should not optimize a non-image file', async () => {
      const optimizeSpy = jest.spyOn(
        service as any,
        'optimizeImage',
      );

      const pdfFile = {
        ...mockFile,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      };

      await service.saveFile(pdfFile);

      expect(
        optimizeSpy,
      ).not.toHaveBeenCalled();
    });

    it('should remove partially written file and throw if saving fails', async () => {
      (
        fs.promises.writeFile as jest.Mock
      ).mockRejectedValue(
        new Error('Disk full'),
      );

      await expect(
        service.saveFile(mockFile),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        fs.promises.unlink,
      ).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      (
        fs.promises.stat as jest.Mock
      ).mockResolvedValue({
        isFile: () => true,
      });

      await service.deleteFile(
        'items/test.jpg',
      );

      const fullPath = path.join(
        uploadDirectory,
        'items',
        'test.jpg',
      );

      expect(
        fs.promises.stat,
      ).toHaveBeenCalledWith(
        fullPath,
      );

      expect(
        fs.promises.unlink,
      ).toHaveBeenCalledWith(
        fullPath,
      );
    });

    it('should throw NotFoundException if the file does not exist', async () => {
      const error = Object.assign(
        new Error('Not found'),
        {
          code: 'ENOENT',
        },
      );

      (
        fs.promises.stat as jest.Mock
      ).mockRejectedValue(error);

      await expect(
        service.deleteFile(
          'missing.jpg',
        ),
      ).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when path points to a directory', async () => {
      (
        fs.promises.stat as jest.Mock
      ).mockResolvedValue({
        isFile: () => false,
      });

      await expect(
        service.deleteFile(
          'folder',
        ),
      ).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject path traversal', async () => {
      await expect(
        service.deleteFile(
          '../secret.txt',
        ),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        fs.promises.stat,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for unexpected filesystem errors', async () => {
      (
        fs.promises.stat as jest.Mock
      ).mockRejectedValue(
        new Error('Permission denied'),
      );

      await expect(
        service.deleteFile(
          'test.jpg',
        ),
      ).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should remove empty parent folders after deleting a file', async () => {
      (
        fs.promises.stat as jest.Mock
      ).mockResolvedValue({
        isFile: () => true,
      });

      (
        fs.promises.readdir as jest.Mock
      )
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          'another-folder',
        ]);

      await service.deleteFile(
        'items/photos/test.jpg',
      );

      expect(
        fs.promises.rmdir,
      ).toHaveBeenCalledWith(
        path.join(
          uploadDirectory,
          'items',
          'photos',
        ),
      );
    });

    it('should not fail deletion when empty-folder cleanup fails', async () => {
      (
        fs.promises.stat as jest.Mock
      ).mockResolvedValue({
        isFile: () => true,
      });

      (
        fs.promises.readdir as jest.Mock
      ).mockRejectedValue(
        new Error('Cleanup failed'),
      );

      await expect(
        service.deleteFile(
          'items/test.jpg',
        ),
      ).resolves.toBeUndefined();

      expect(
        warnSpy,
      ).toHaveBeenCalled();
    });
  });

  describe('generateSafeFilename', () => {
    it('should generate a safe filename', () => {
      const result = (
        service as any
      ).generateSafeFilename(
        'test-file.jpg',
      );

      expect(result).toMatch(
        /^test-file-\d+-[a-f0-9]{16}\.jpg$/,
      );
    });

    it('should replace unsafe characters with hyphens', () => {
      const result = (
        service as any
      ).generateSafeFilename(
        'test !@ file.jpg',
      );

      expect(result).toMatch(
        /^test-file-\d+-[a-f0-9]{16}\.jpg$/,
      );
    });

    it('should truncate base filename to 50 characters', () => {
      const result = (
        service as any
      ).generateSafeFilename(
        `${'a'.repeat(100)}.jpg`,
      );

      expect(result).toMatch(
        /^a{50}-\d+-[a-f0-9]{16}\.jpg$/,
      );
    });

    it('should use a fallback name when filename has no safe characters', () => {
      const result = (
        service as any
      ).generateSafeFilename(
        '!!!.jpg',
      );

      expect(result).toMatch(
        /^file-\d+-[a-f0-9]{16}\.jpg$/,
      );
    });
  });

  describe('optimizeImage', () => {
    const createSharpPipeline = (
      metadata: {
        width?: number;
        height?: number;
      },
    ) => {
      const pipeline = {
        metadata: jest
          .fn()
          .mockResolvedValue(metadata),
        resize: jest.fn(),
        jpeg: jest.fn(),
        png: jest.fn(),
        webp: jest.fn(),
        toFile: jest
          .fn()
          .mockResolvedValue(undefined),
      };

      pipeline.resize.mockReturnValue(
        pipeline,
      );
      pipeline.jpeg.mockReturnValue(
        pipeline,
      );
      pipeline.png.mockReturnValue(
        pipeline,
      );
      pipeline.webp.mockReturnValue(
        pipeline,
      );

      (
        sharp as unknown as jest.Mock
      ).mockReturnValue(pipeline);

      return pipeline;
    };

    it('should resize and optimize a JPEG image', async () => {
      const pipeline =
        createSharpPipeline({
          width: 1920,
          height: 1080,
        });

      await (
        service as any
      ).optimizeImage(
        'test.jpg',
        'image/jpeg',
      );

      expect(sharp).toHaveBeenCalledWith(
        'test.jpg',
        {
          failOn: 'none',
        },
      );

      expect(
        pipeline.resize,
      ).toHaveBeenCalledWith({
        width: 800,
        height: 600,
        fit: 'inside',
        withoutEnlargement: true,
      });

      expect(
        pipeline.jpeg,
      ).toHaveBeenCalledWith({
        quality: 80,
      });

      expect(
        pipeline.toFile,
      ).toHaveBeenCalledWith(
        'test.jpg.tmp',
      );

      expect(
        fs.promises.unlink,
      ).toHaveBeenCalledWith(
        'test.jpg',
      );

      expect(
        fs.promises.rename,
      ).toHaveBeenCalledWith(
        'test.jpg.tmp',
        'test.jpg',
      );
    });

    it('should optimize PNG without changing its format', async () => {
      const pipeline =
        createSharpPipeline({
          width: 400,
          height: 300,
        });

      await (
        service as any
      ).optimizeImage(
        'test.png',
        'image/png',
      );

      expect(
        pipeline.resize,
      ).not.toHaveBeenCalled();

      expect(
        pipeline.png,
      ).toHaveBeenCalledWith({
        quality: 80,
        compressionLevel: 9,
      });
    });

    it('should optimize WebP without changing its format', async () => {
      const pipeline =
        createSharpPipeline({
          width: 400,
          height: 300,
        });

      await (
        service as any
      ).optimizeImage(
        'test.webp',
        'image/webp',
      );

      expect(
        pipeline.webp,
      ).toHaveBeenCalledWith({
        quality: 80,
      });
    });

    it('should skip unsupported image formats', async () => {
      const pipeline =
        createSharpPipeline({
          width: 400,
          height: 300,
        });

      await (
        service as any
      ).optimizeImage(
        'test.gif',
        'image/gif',
      );

      expect(
        pipeline.jpeg,
      ).not.toHaveBeenCalled();

      expect(
        pipeline.png,
      ).not.toHaveBeenCalled();

      expect(
        pipeline.webp,
      ).not.toHaveBeenCalled();

      expect(
        fs.promises.rename,
      ).not.toHaveBeenCalled();
    });

    it('should skip optimization when disabled', async () => {
      jest
        .spyOn(
          configService,
          'get',
        )
        .mockReturnValue({
          ...mockConfig,
          imageOptimization: {
            ...mockConfig.imageOptimization,
            enabled: false,
          },
        });

      (
        sharp as unknown as jest.Mock
      ).mockClear();

      await (
        service as any
      ).optimizeImage(
        'test.jpg',
        'image/jpeg',
      );

      expect(
        sharp,
      ).not.toHaveBeenCalled();
    });

    it('should handle Sharp errors gracefully and clean temporary file', async () => {
      (
        sharp as unknown as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Sharp error');
      });

      await expect(
        (
          service as any
        ).optimizeImage(
          'test.jpg',
          'image/jpeg',
        ),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();

      expect(
        fs.promises.unlink,
      ).toHaveBeenCalledWith(
        'test.jpg.tmp',
      );
    });
  });
});
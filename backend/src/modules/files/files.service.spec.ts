// src/modules/files/files.service.spec.ts

import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import sharp, { type Metadata } from 'sharp';

import { FilesService } from './files.service';
import type { MulterFile } from '../../common/types/multer-file.type';

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    rmdir: jest.fn(),
  },
}));

jest.mock('sharp', () => jest.fn());

describe('FilesService', () => {
  let service: FilesService;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const uploadDirectory = path.resolve('./uploads');

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
    size: 4,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const createMetadata = (overrides: Partial<Metadata> = {}): Metadata => ({
    format: 'jpeg',
    width: 1200,
    height: 900,
    autoOrient: {
      width: 1200,
      height: 900,
    },
    space: 'srgb',
    channels: 3,
    depth: 'uchar',
    density: 72,
    chromaSubsampling: '4:2:0',
    isProgressive: false,
    isPalette: false,
    hasProfile: false,
    hasAlpha: false,
    ...overrides,
  });

  const createSharpPipeline = (metadata: Metadata = createMetadata()) => {
    const pipeline = {
      metadata: jest.fn().mockResolvedValue(metadata),
      resize: jest.fn(),
      jpeg: jest.fn(),
      png: jest.fn(),
      webp: jest.fn(),
      toFile: jest.fn().mockResolvedValue(undefined),
    };

    pipeline.resize.mockReturnValue(pipeline);
    pipeline.jpeg.mockReturnValue(pipeline);
    pipeline.png.mockReturnValue(pipeline);
    pipeline.webp.mockReturnValue(pipeline);

    (sharp as unknown as jest.Mock).mockReturnValue(pipeline);

    return pipeline;
  };

  const createService = async (config: typeof mockConfig = mockConfig): Promise<FilesService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'file' ? config : undefined)),
          },
        },
      ],
    }).compile();

    return module.get<FilesService>(FilesService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.unlink as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.rename as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.stat as jest.Mock).mockResolvedValue({
      isFile: () => true,
    });
    (fs.promises.readdir as jest.Mock).mockResolvedValue(['file.jpg']);
    (fs.promises.rmdir as jest.Mock).mockResolvedValue(undefined);

    createSharpPipeline();

    service = await createService();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('creates the upload directory recursively', () => {
      expect(fs.mkdirSync).toHaveBeenCalledWith(uploadDirectory, {
        recursive: true,
      });
    });

    it('rethrows upload directory initialization errors and logs them', async () => {
      (fs.mkdirSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      await expect(createService()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unable to initialize upload directory'),
        expect.any(String),
      );
    });

    it('uses safe defaults for invalid optimization configuration', async () => {
      const invalidConfig = {
        ...mockConfig,
        imageOptimization: {
          enabled: true,
          maxWidth: -1,
          maxHeight: 0,
          quality: Number.NaN,
        },
      };

      const configuredService = await createService(invalidConfig);

      const pipeline = createSharpPipeline(
        createMetadata({
          format: 'jpeg',
          width: 2500,
          height: 1500,
        }),
      );

      await (configuredService as any).optimizeImage(
        'test.jpg',
        createMetadata({
          format: 'jpeg',
          width: 2500,
          height: 1500,
        }),
      );

      expect(pipeline.resize).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        fit: 'inside',
        withoutEnlargement: true,
      });

      expect(pipeline.jpeg).toHaveBeenCalledWith({
        quality: 80,
      });
    });
  });

  describe('saveFile', () => {
    it('saves and validates an image successfully', async () => {
      const metadata = createMetadata({
        format: 'jpeg',
        width: 1200,
        height: 900,
      });

      const metadataSpy = jest
        .spyOn(service as any, 'getValidatedImageMetadata')
        .mockResolvedValue(metadata);

      const optimizeSpy = jest.spyOn(service as any, 'optimizeImage').mockResolvedValue(undefined);

      const result = await service.saveFile(mockFile);

      expect(result.filename).toMatch(/^test-image-\d+-[a-f0-9]{16}\.jpg$/);
      expect(result.path).toBe(result.filename);
      expect(result.url).toBe(`/uploads/${result.filename}`);

      expect(fs.promises.mkdir).toHaveBeenCalledWith(uploadDirectory, {
        recursive: true,
      });

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(uploadDirectory, result.filename),
        mockFile.buffer,
        {
          flag: 'wx',
        },
      );

      expect(metadataSpy).toHaveBeenCalledWith(path.join(uploadDirectory, result.filename));

      expect(optimizeSpy).toHaveBeenCalledWith(
        path.join(uploadDirectory, result.filename),
        metadata,
      );
    });

    it('saves an image inside a nested folder', async () => {
      jest.spyOn(service as any, 'getValidatedImageMetadata').mockResolvedValue(
        createMetadata({
          format: 'jpeg',
          width: 400,
          height: 300,
        }),
      );

      jest.spyOn(service as any, 'optimizeImage').mockResolvedValue(undefined);

      const result = await service.saveFile(mockFile, 'items/photos');

      expect(result.path).toBe(`items/photos/${result.filename}`);
      expect(result.url).toBe(`/uploads/items/photos/${result.filename}`);

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.join(uploadDirectory, 'items', 'photos'),
        {
          recursive: true,
        },
      );
    });

    it('normalizes backslashes in folder paths', async () => {
      jest.spyOn(service as any, 'getValidatedImageMetadata').mockResolvedValue(
        createMetadata({
          format: 'jpeg',
        }),
      );

      jest.spyOn(service as any, 'optimizeImage').mockResolvedValue(undefined);

      const result = await service.saveFile(mockFile, 'items\\photos');

      expect(result.path).toBe(`items/photos/${result.filename}`);
    });

    it('renames the file when its real format differs from its extension', async () => {
      jest.spyOn(service as any, 'getValidatedImageMetadata').mockResolvedValue(
        createMetadata({
          format: 'png',
          width: 400,
          height: 300,
          channels: 4,
          hasAlpha: true,
        }),
      );

      jest.spyOn(service as any, 'optimizeImage').mockResolvedValue(undefined);

      const result = await service.saveFile(mockFile);

      expect(result.filename).toMatch(/^test-image-\d+-[a-f0-9]{16}\.png$/);
      expect(result.path).toBe(result.filename);
      expect(result.url).toBe(`/uploads/${result.filename}`);

      expect(fs.promises.rename).toHaveBeenCalledWith(
        expect.stringMatching(/\.jpg$/),
        expect.stringMatching(/\.png$/),
      );
    });

    it('cleans the renamed file when a later operation fails', async () => {
      // Mock metadata to return PNG format, causing rename from .jpg to .png
      jest.spyOn(service as any, 'getValidatedImageMetadata').mockResolvedValue(
        createMetadata({
          format: 'png',
          width: 400,
          height: 300,
          channels: 4,
          hasAlpha: true,
        }),
      );

      // Mock optimizeImage to fail with a BadRequestException
      jest
        .spyOn(service as any, 'optimizeImage')
        .mockRejectedValue(new BadRequestException('Optimization failed'));

      await expect(service.saveFile(mockFile)).rejects.toThrow('Optimization failed');

      // Verify that the renamed file (with .png extension) is cleaned up
      expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringMatching(/\.png$/));
    });

    it('rejects a missing original filename', async () => {
      await expect(
        service.saveFile({
          ...mockFile,
          originalname: '',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('rejects an empty file buffer', async () => {
      await expect(
        service.saveFile({
          ...mockFile,
          buffer: Buffer.alloc(0),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('rejects path traversal in the subfolder', async () => {
      await expect(service.saveFile(mockFile, '../outside')).rejects.toThrow(BadRequestException);

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('preserves image validation BadRequestException', async () => {
      jest
        .spyOn(service as any, 'getValidatedImageMetadata')
        .mockRejectedValue(new BadRequestException('Invalid image file'));

      await expect(service.saveFile(mockFile)).rejects.toThrow('Invalid image file');

      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('removes a partially written file when saving fails', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));

      await expect(service.saveFile(mockFile)).rejects.toThrow('Unable to save file');

      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('returns 500 when a critical file replacement error reaches saveFile', async () => {
      // Trigger the real critical path:
      // optimization creates a temp file, replacement fails,
      // backup restoration fails, and the original no longer exists.
      createSharpPipeline(
        createMetadata({
          format: 'jpeg',
          width: 1200,
          height: 900,
        }),
      );

      (fs.promises.rename as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Replace failed'))
        .mockRejectedValueOnce(new Error('Restore failed'));

      (fs.promises.access as jest.Mock).mockRejectedValueOnce(new Error('Original missing'));

      await expect(service.saveFile(mockFile)).rejects.toThrow(InternalServerErrorException);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Critical file replacement failure'),
        expect.anything(),
      );
    });
  });

  describe('getValidatedImageMetadata', () => {
    it('accepts a supported JPEG image', async () => {
      const metadata = createMetadata({
        format: 'jpeg',
        width: 100,
        height: 100,
      });

      createSharpPipeline(metadata);

      await expect((service as any).getValidatedImageMetadata('test.jpg')).resolves.toEqual(
        expect.objectContaining({
          format: 'jpeg',
        }),
      );

      expect(sharp).toHaveBeenCalledWith('test.jpg', {
        failOn: 'error',
      });
    });

    it('rejects unsupported image formats', async () => {
      createSharpPipeline(
        createMetadata({
          format: 'gif',
        }),
      );

      await expect((service as any).getValidatedImageMetadata('test.gif')).rejects.toThrow(
        'Unsupported image format',
      );
    });

    it('rejects invalid image content', async () => {
      (sharp as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid image');
      });

      await expect((service as any).getValidatedImageMetadata('test.jpg')).rejects.toThrow(
        'Invalid image file',
      );
    });
  });

  describe('deleteFile', () => {
    it('deletes an existing file', async () => {
      await service.deleteFile('items/test.jpg');

      const fullPath = path.join(uploadDirectory, 'items', 'test.jpg');

      expect(fs.promises.stat).toHaveBeenCalledWith(fullPath);
      expect(fs.promises.unlink).toHaveBeenCalledWith(fullPath);
    });

    it('throws NotFoundException if the file does not exist', async () => {
      (fs.promises.stat as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('Not found'), {
          code: 'ENOENT',
        }),
      );

      await expect(service.deleteFile('missing.jpg')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the path points to a directory', async () => {
      (fs.promises.stat as jest.Mock).mockResolvedValueOnce({
        isFile: () => false,
      });

      await expect(service.deleteFile('folder')).rejects.toThrow(NotFoundException);
    });

    it('rejects path traversal', async () => {
      await expect(service.deleteFile('../secret.txt')).rejects.toThrow(BadRequestException);

      expect(fs.promises.stat).not.toHaveBeenCalled();
    });

    it('rejects an empty file path', async () => {
      await expect(service.deleteFile('')).rejects.toThrow('Invalid file path');
    });

    it('throws BadRequestException for unexpected filesystem errors', async () => {
      (fs.promises.stat as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));

      await expect(service.deleteFile('test.jpg')).rejects.toThrow(BadRequestException);

      expect(errorSpy).toHaveBeenCalled();
    });

    it('removes empty parent folders after deleting a file', async () => {
      (fs.promises.readdir as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['another-folder']);

      await service.deleteFile('items/photos/test.jpg');

      expect(fs.promises.rmdir).toHaveBeenCalledWith(path.join(uploadDirectory, 'items', 'photos'));
    });

    it('does not fail deletion when empty-folder cleanup fails', async () => {
      (fs.promises.readdir as jest.Mock).mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(service.deleteFile('items/test.jpg')).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('generateSafeFilename', () => {
    it('generates a safe filename', () => {
      const result = (service as any).generateSafeFilename('test-file.jpg');

      expect(result).toMatch(/^test-file-\d+-[a-f0-9]{16}\.jpg$/);
    });

    it('replaces unsafe characters with hyphens', () => {
      const result = (service as any).generateSafeFilename('test !@ file.jpg');

      expect(result).toMatch(/^test-file-\d+-[a-f0-9]{16}\.jpg$/);
    });

    it('truncates the base filename to 50 characters', () => {
      const result = (service as any).generateSafeFilename(`${'a'.repeat(100)}.jpg`);

      expect(result).toMatch(/^a{50}-\d+-[a-f0-9]{16}\.jpg$/);
    });

    it('uses a fallback name when the filename has no safe characters', () => {
      const result = (service as any).generateSafeFilename('!!!.jpg');

      expect(result).toMatch(/^file-\d+-[a-f0-9]{16}\.jpg$/);
    });
  });

  describe('optimizeImage', () => {
    it('resizes and optimizes a JPEG image', async () => {
      const metadata = createMetadata({
        format: 'jpeg',
        width: 1920,
        height: 1080,
      });

      const pipeline = createSharpPipeline(metadata);

      await (service as any).optimizeImage('test.jpg', metadata);

      expect(sharp).toHaveBeenCalledWith('test.jpg', {
        failOn: 'error',
      });

      expect(pipeline.resize).toHaveBeenCalledWith({
        width: 800,
        height: 600,
        fit: 'inside',
        withoutEnlargement: true,
      });

      expect(pipeline.jpeg).toHaveBeenCalledWith({
        quality: 80,
      });

      expect(pipeline.toFile).toHaveBeenCalledWith('test.jpg.tmp');

      expect(fs.promises.rename).toHaveBeenNthCalledWith(
        1,
        'test.jpg',
        expect.stringMatching(/^test\.jpg\.[a-f0-9]{12}\.bak$/),
      );

      expect(fs.promises.rename).toHaveBeenNthCalledWith(2, 'test.jpg.tmp', 'test.jpg');
    });

    it('optimizes PNG without resizing a smaller image', async () => {
      const metadata = createMetadata({
        format: 'png',
        width: 400,
        height: 300,
        channels: 4,
        hasAlpha: true,
      });

      const pipeline = createSharpPipeline(metadata);

      await (service as any).optimizeImage('test.png', metadata);

      expect(pipeline.resize).not.toHaveBeenCalled();

      expect(pipeline.png).toHaveBeenCalledWith({
        quality: 80,
        compressionLevel: 9,
      });
    });

    it('optimizes WebP without changing its format', async () => {
      const metadata = createMetadata({
        format: 'webp',
        width: 400,
        height: 300,
      });

      const pipeline = createSharpPipeline(metadata);

      await (service as any).optimizeImage('test.webp', metadata);

      expect(pipeline.webp).toHaveBeenCalledWith({
        quality: 80,
      });
    });

    it('skips optimization when disabled in constructor config', async () => {
      const disabledService = await createService({
        ...mockConfig,
        imageOptimization: {
          ...mockConfig.imageOptimization,
          enabled: false,
        },
      });

      (sharp as unknown as jest.Mock).mockClear();

      await (disabledService as any).optimizeImage(
        'test.jpg',
        createMetadata({
          format: 'jpeg',
          width: 1000,
          height: 1000,
        }),
      );

      expect(sharp).not.toHaveBeenCalled();
    });

    it('handles non-critical Sharp errors and cleans the temporary file', async () => {
      (sharp as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Sharp error');
      });

      await expect(
        (service as any).optimizeImage(
          'test.jpg',
          createMetadata({
            format: 'jpeg',
            width: 1000,
            height: 1000,
          }),
        ),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
      expect(fs.promises.unlink).toHaveBeenCalledWith('test.jpg.tmp');
    });

    it('restores the original file when replacement fails', async () => {
      const metadata = createMetadata({
        format: 'jpeg',
        width: 1000,
        height: 1000,
      });

      createSharpPipeline(metadata);

      (fs.promises.rename as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Replace failed'))
        .mockResolvedValueOnce(undefined);

      await expect((service as any).optimizeImage('test.jpg', metadata)).resolves.toBeUndefined();

      expect(fs.promises.rename).toHaveBeenCalledTimes(3);

      expect(fs.promises.rename).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/^test\.jpg\.[a-f0-9]{12}\.bak$/),
        'test.jpg',
      );

      expect(warnSpy).toHaveBeenCalled();
    });

    it('warns when a stale backup cannot be removed after successful replacement', async () => {
      const metadata = createMetadata({
        format: 'jpeg',
        width: 1000,
        height: 1000,
      });

      createSharpPipeline(metadata);

      // Mock unlink to fail only for .bak files
      (fs.promises.unlink as jest.Mock).mockImplementation(async (filePath: string) => {
        if (filePath.endsWith('.bak')) {
          throw new Error('Backup delete failed');
        }
        return undefined;
      });

      await (service as any).optimizeImage('test.jpg', metadata);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unable to remove image backup'),
      );
    });
  });
});

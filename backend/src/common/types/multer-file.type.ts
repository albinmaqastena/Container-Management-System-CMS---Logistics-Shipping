// src/common/types/multer-file.type.ts

import type { Readable } from 'stream';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  stream: Readable;

  destination?: string;
  filename?: string;
  path?: string;
}
// src/services/files.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import { FILE } from '../utilis/constants';
import type {
  UploadedFileResponse,
  UploadedFilesResponse,
} from '../types';

// ================================================================
// FUNKSIONE NDIHMËSE PRIVATE
// ================================================================

const validateFile = (file: File): void => {
  if (file.size === 0) {
    throw new Error(`File "${file.name}" is empty`);
  }

  if (file.size > FILE.MAX_SIZE) {
    throw new Error(
      `File "${file.name}" exceeds the maximum allowed size of ${
        FILE.MAX_SIZE / 1024 / 1024
      }MB`,
    );
  }

  if (
    !FILE.ALLOWED_TYPES.includes(
      file.type as (typeof FILE.ALLOWED_TYPES)[number],
    )
  ) {
    throw new Error(
      `File "${file.name}" has unsupported type. Allowed types: ${
        FILE.ALLOWED_TYPES.join(', ')
      }`,
    );
  }
};

// ================================================================
// SERVICE
// ================================================================

export const filesService = {
  /**
   * Upload a single file
   */
  upload: async (
    file: File,
    folder?: string,
  ): Promise<UploadedFileResponse> => {
    validateFile(file);

    const formData = new FormData();
    formData.append('file', file);

    const normalizedFolder = folder?.trim();
    if (normalizedFolder) {
      formData.append('folder', normalizedFolder);
    }

    const response = await apiClient.post<UploadedFileResponse>(
      API_ENDPOINTS.FILES.UPLOAD,
      formData,
    );

    return response.data;
  },

  /**
   * Upload multiple files
   */
  uploadMultiple: async (
    files: File[],
    folder?: string,
  ): Promise<UploadedFilesResponse> => {
    if (files.length === 0) {
      throw new Error('At least one file is required');
    }

    if (files.length > FILE.MAX_FILES_PER_UPLOAD) {
      throw new Error(
        `A maximum of ${FILE.MAX_FILES_PER_UPLOAD} files can be uploaded at once`,
      );
    }

    files.forEach(validateFile);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const normalizedFolder = folder?.trim();
    if (normalizedFolder) {
      formData.append('folder', normalizedFolder);
    }

    const response = await apiClient.post<UploadedFilesResponse>(
      API_ENDPOINTS.FILES.UPLOAD_MULTIPLE,
      formData,
    );

    return response.data;
  },

  /**
   * Delete a file by its path
   */
  delete: async (filePath: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.FILES.DELETE(filePath));
  },
};
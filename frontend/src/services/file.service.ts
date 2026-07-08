// src/services/file.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import { UploadedFile } from '../types';

export const fileService = {
  // Upload single file
  upload: async (file: File): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<UploadedFile>(
      API_ENDPOINTS.FILES.UPLOAD,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Upload multiple files
  uploadMultiple: async (files: File[]): Promise<UploadedFile[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    const response = await apiClient.post<UploadedFile[]>(
      API_ENDPOINTS.FILES.UPLOAD_MULTIPLE,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Delete file
  delete: async (filePath: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.FILES.UPLOAD}/${filePath}`);
  },
};
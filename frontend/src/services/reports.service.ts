import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import type { ReportQuery } from '../types';

/**
 * Nxjerr emrin e file-it nga Content-Disposition header
 */
const getFilenameFromDisposition = (
  disposition?: string,
): string | undefined => {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1];
};

/**
 * Shkarkon një Blob si file
 */
const downloadBlob = (
  blob: Blob,
  filename: string,
): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoko URL-në pas një kohe të shkurtër për të lejuar shkarkimin
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
};

export const reportsService = {
  exportAllContainersExcel: async (
    params?: ReportQuery,
  ): Promise<void> => {
    const response = await apiClient.get<Blob>(
      API_ENDPOINTS.REPORTS.CONTAINERS_EXCEL,
      {
        params,
        responseType: 'blob',
      },
    );

    const filename =
      getFilenameFromDisposition(
        response.headers['content-disposition'],
      ) ?? 'containers-report.xlsx';

    downloadBlob(response.data, filename);
  },

  exportAllContainersPdf: async (
    params?: ReportQuery,
  ): Promise<void> => {
    const response = await apiClient.get<Blob>(
      API_ENDPOINTS.REPORTS.CONTAINERS_PDF,
      {
        params,
        responseType: 'blob',
      },
    );

    const filename =
      getFilenameFromDisposition(
        response.headers['content-disposition'],
      ) ?? 'containers-report.pdf';

    downloadBlob(response.data, filename);
  },

  exportContainerExcel: async (
    id: string,
  ): Promise<void> => {
    const response = await apiClient.get<Blob>(
      API_ENDPOINTS.REPORTS.CONTAINER_EXCEL(id),
      {
        responseType: 'blob',
      },
    );

    const filename =
      getFilenameFromDisposition(
        response.headers['content-disposition'],
      ) ?? `container-${id}.xlsx`;

    downloadBlob(response.data, filename);
  },

  exportContainerPdf: async (
    id: string,
  ): Promise<void> => {
    const response = await apiClient.get<Blob>(
      API_ENDPOINTS.REPORTS.CONTAINER_PDF(id),
      {
        responseType: 'blob',
      },
    );

    const filename =
      getFilenameFromDisposition(
        response.headers['content-disposition'],
      ) ?? `container-${id}.pdf`;

    downloadBlob(response.data, filename);
  },
};
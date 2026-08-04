export interface UploadedFile {
  filename: string;
  path: string;
  url: string;
}

export interface UploadedFileResponse
  extends UploadedFile {
  message: string;
}

export interface UploadedFilesResponse {
  message: string;
  files: UploadedFile[];
}
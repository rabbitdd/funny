export const MAX_PDF_SIZE = 3 * 1024 * 1024;

export type DocumentInfo = { name: string; size: number };

export function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

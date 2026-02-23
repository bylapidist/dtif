import { DiagnosticCodes, type DiagnosticCode } from '../diagnostics/codes.js';
import { DocumentLoaderError } from './document-loader.js';

export function diagnosticCodeForLoaderError(error: DocumentLoaderError): DiagnosticCode {
  switch (error.reason) {
    case 'MAX_BYTES_EXCEEDED':
      return DiagnosticCodes.loader.TOO_LARGE;
    case 'HTTP_HOST_NOT_ALLOWED':
      return DiagnosticCodes.loader.HOST_NOT_ALLOWED;
    default:
      return DiagnosticCodes.loader.FAILED;
  }
}

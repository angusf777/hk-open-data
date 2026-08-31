export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(statusCode: number, code: string, message: string, retryable = false) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
  }
}

export function notFound(resource: string): HttpError {
  return new HttpError(404, "NOT_FOUND", `${resource} was not found`);
}

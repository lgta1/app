export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError;
}

export function returnBusinessError(error: BusinessError) {
  return { error: { message: error.message, type: error.name } };
}

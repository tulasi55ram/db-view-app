/**
 * Error handling utilities
 */

/**
 * Converts unknown error types to Error instances
 * @param error - Unknown error value
 * @returns Error instance
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Gets error message from unknown error types
 * @param error - Unknown error value
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Wraps an error with additional context
 * @param error - Original error
 * @param context - Contextual message
 * @returns New error with combined message
 */
export function wrapError(error: unknown, context: string): Error {
  const originalError = toError(error);
  const wrappedError = new Error(`${context}: ${originalError.message}`);
  wrappedError.stack = originalError.stack;
  wrappedError.cause = originalError;
  return wrappedError;
}

/**
 * Creates a typed error class
 * @param name - Error name
 * @param BaseError - Base error class (defaults to Error)
 * @returns Error class
 */
export function createErrorClass(
  name: string,
  BaseError: typeof Error = Error
) {
  class CustomError extends BaseError {
    constructor(message: string) {
      super(message);
      this.name = name;
      // Maintains proper stack trace for where our error was thrown (only available on V8)
      const ErrorConstructor = Error as any;
      if (ErrorConstructor.captureStackTrace) {
        ErrorConstructor.captureStackTrace(this, CustomError);
      }
    }
  }
  return CustomError;
}

// Predefined error classes
export const DatabaseError = createErrorClass("DatabaseError");
export const ConnectionError = createErrorClass("ConnectionError");
export const QueryError = createErrorClass("QueryError");
export const ValidationError = createErrorClass("ValidationError");

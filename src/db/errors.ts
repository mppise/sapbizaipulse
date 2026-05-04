export type DataStoreErrorCode =
  | 'DS_CONN_FAILED'
  | 'DS_QUERY_FAILED'
  | 'DS_NOT_FOUND'
  | 'DS_DUPLICATE';

export class DataStoreError extends Error {
  readonly code: DataStoreErrorCode;
  readonly cause?: Error;

  constructor(code: DataStoreErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'DataStoreError';
    this.code = code;
    this.cause = cause;
  }
}

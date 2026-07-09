/** Thrown by HTTP providers on transport failures or unexpected response shapes. */
export class ProviderFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderFailureError';
  }
}

/** Thrown when a lookup (e.g. geocoding) legitimately finds nothing. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

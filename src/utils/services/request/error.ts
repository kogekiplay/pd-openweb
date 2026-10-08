export function isUnauthorizedError(error: unknown): boolean {
  const rejection = error as ApiRejection | null | undefined;
  return [rejection?.status, rejection?.response?.status, rejection?.errorCode].some(status => Number(status) === 401);
}

export function alertIfNotUnauthorized(error: unknown, ...args: Parameters<typeof alert>): void {
  if (!isUnauthorizedError(error)) {
    return alert(...args);
  }
}

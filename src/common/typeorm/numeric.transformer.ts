import type { ValueTransformer } from 'typeorm';

/**
 * For Postgres numeric -> number (note: may lose precision for very large values).
 * For household expenses in CUP this is typically acceptable.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

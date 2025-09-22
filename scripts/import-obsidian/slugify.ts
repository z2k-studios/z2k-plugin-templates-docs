// Thin wrapper to normalize slugify's export shape for TypeScript.
// Use ESM import (no require) so it runs under Node16+ ESM execution.
import slugifyPkg from 'slugify';

const _slugify: any = (slugifyPkg && (slugifyPkg as any).default) ? (slugifyPkg as any).default : slugifyPkg;

export default function slugify(input: string, options?: any): string {
  return _slugify(input, options);
}

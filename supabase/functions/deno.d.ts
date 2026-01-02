// deno.d.ts
/// <reference types="https://deno.land/x/deno@v1.28.0/lib/deno.d.ts" />

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}
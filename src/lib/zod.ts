import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Adds `.openapi()` to every Zod schema. Imported from here rather than from
// 'zod' directly so the extension is guaranteed to have run first.
extendZodWithOpenApi(z);

export { z };

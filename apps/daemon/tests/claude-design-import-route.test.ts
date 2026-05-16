import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../src/server.js';

// Red spec for the missing MulterError handler on POST
// /api/import/claude-design.
//
// The route mounts `importUpload.single('file')` as raw middleware. A
// MulterError raised by that middleware (unexpected field name, file
// over the size limit, etc.) is thrown BEFORE the route handler runs,
// so the handler's own try/catch never sees it — it falls through to
// Express' default error handler, which replies with an HTML error
// page and a 500 status instead of the JSON envelope every other
// daemon route returns.
//
// The sibling project-upload route wraps multer in `handleProjectUpload`
// → `sendMulterError`, which maps each MulterError code to a structured
// `{ error: { message, code } }` body. The import route should do the
// same. This spec posts a file under an unexpected field name (cheap,
// deterministic `LIMIT_UNEXPECTED_FILE` trigger) and asserts the
// response is a structured 400 JSON error.

describe('POST /api/import/claude-design — multer errors', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterAll(() => {
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns a structured JSON 400 when the file arrives under an unexpected field name', async () => {
    const form = new FormData();
    // `importUpload.single('file')` expects the field name `file`. A
    // file under any other name raises MulterError LIMIT_UNEXPECTED_FILE.
    form.append(
      'not-the-file-field',
      new Blob(['PK\x03\x04'], { type: 'application/zip' }),
      'design.zip',
    );

    const resp = await fetch(`${baseUrl}/api/import/claude-design`, {
      method: 'POST',
      body: form,
    });

    // Must not be Express' default 500 HTML page.
    expect(resp.status).toBe(400);
    expect(resp.headers.get('content-type') ?? '').toMatch(/application\/json/);

    const body = (await resp.json()) as {
      error?: { message?: string; code?: string };
    };
    expect(body.error?.code).toBe('BAD_REQUEST');
    expect(body.error?.message).toMatch(/unexpected file field/i);
  });
});

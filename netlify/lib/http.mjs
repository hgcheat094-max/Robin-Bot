// Small response helpers shared by the functions.

export class HttpError extends Error {
  constructor(status, message, code = 'bad_request', headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function errorResponse(message, status = 400, code = 'bad_request', headers = {}) {
  return json({ error: message, code }, status, headers);
}

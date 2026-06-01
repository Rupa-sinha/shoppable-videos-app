/**
 * Utility: HMAC Verification
 *
 * Verifies webhook authenticity using HMAC-SHA256
 */

import crypto from 'crypto';

export function verifyWebhookHmac(hmacHeader, rawBody, secret) {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  return computed === hmacHeader;
}

export function verifyOAuthHmac(queryString, secret) {
  const hmac = queryString.hmac;
  const params = Object.fromEntries(
    Object.entries(queryString).filter(([key]) => key !== 'hmac')
  );

  const message = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const computed = crypto
    .createHmac('sha256', secret)
    .update(message, 'utf8')
    .digest('hex');

  return computed === hmac;
}

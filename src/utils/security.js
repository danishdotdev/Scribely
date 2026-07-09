const crypto = require('crypto');

function timingSafeEqualString(actual, expected) {
  if (!actual || !expected) return false;
  const a = Buffer.from(String(actual));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validateMeetingUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const candidate = url.trim();
  if (candidate.length > 2000 || !candidate.startsWith('https://')) return null;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const allowed = [
      'meet.google.com',
      'zoom.us',
      'zoom.com',
      'teams.microsoft.com',
      'teams.live.com',
      'teams.microsoft.us'
    ];
    if (!allowed.some(domain => host === domain || host.endsWith(`.${domain}`))) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

function hmacSha256(secret, rawBody) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function verifyHmacSignature(secret, rawBody, providedSignature) {
  if (!secret || !providedSignature || !rawBody) return false;
  return timingSafeEqualString(hmacSha256(secret, rawBody), providedSignature);
}

module.exports = {
  hmacSha256,
  timingSafeEqualString,
  validateMeetingUrl,
  verifyHmacSignature
};


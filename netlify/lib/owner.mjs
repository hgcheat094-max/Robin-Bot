// Fixed answer for "who is the owner / co-founder?" questions.
// Handled before the model is called, so the reply is always the same and uses no API quota.

export const OWNER_NAME = 'Yogesh Bangari';

const KEYWORD = /\b(co[\s-]?founders?|founders?|owners?)\b/;
// "who owns / founded you|this|dragon"
const WHO_OWNS = /\bwho\s+(owns|founded|cofounded|co[\s-]founded)\s+(you|this|dragon|the\s+(app|site|website|company|platform))\b/;
// "owner of Google", "founder of Tesla": about something else, so the model answers.
const OF_OTHER = /\b(co[\s-]?founders?|founders?|owners?)\s+of\s+(?!(this|the|dragon|you|your)\b)/;
const ABOUT_US = /\b(who|whose|name|you|your|this|dragon|app|site|website|company|platform)\b/;

export function isOwnerQuestion(text) {
  if (typeof text !== 'string') return false;
  const t = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80) return false;
  if (WHO_OWNS.test(t)) return true;
  if (!KEYWORD.test(t) || OF_OTHER.test(t)) return false;
  // A bare "owner" or "co founder" counts; longer messages must be about this app.
  return t.split(' ').length <= 4 || ABOUT_US.test(t);
}

export function ownerReply(messages) {
  const last = Array.isArray(messages) ? messages[messages.length - 1] : null;
  return last && last.role === 'user' && isOwnerQuestion(last.text) ? OWNER_NAME : null;
}

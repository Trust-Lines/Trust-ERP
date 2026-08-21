import { randomBytes, createHash } from 'crypto';

export const APPROVAL_LINK_ROLES = ['ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm'];

export function generateReviewToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashReviewToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

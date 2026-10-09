import { describe, expect, it } from 'vitest';
import { canAccess, canPerform, isAdminRole, landingPath } from './permissions';
describe('role workspace boundaries', () => {
  it('separates coaching and support', () => {
    expect(canAccess('coach', 'coaching')).toBe(true);
    expect(canAccess('staff', 'coaching')).toBe(false);
    expect(canPerform('coach', 'reply-support')).toBe(false);
    expect(canPerform('staff', 'publish-content')).toBe(false);
  });
  it('reserves platform control for admins and keeps analysts read-only', () => {
    expect(canPerform('moderator', 'moderate-members')).toBe(true);
    for (const role of ['moderator', 'staff', 'coach', 'readonly'] as const) expect(canPerform(role, 'manage-roles')).toBe(false);
    expect(canPerform('readonly', 'publish-announcements')).toBe(false);
    expect(canAccess('moderator', 'settings')).toBe(false);
  });
  it('fails closed for unrecognized roles', () => {
    expect(isAdminRole('owner')).toBe(false);
    expect(isAdminRole('toString')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(canAccess(null, 'overview')).toBe(false);
    expect(landingPath(null)).toBe('/dashboard');
  });
});

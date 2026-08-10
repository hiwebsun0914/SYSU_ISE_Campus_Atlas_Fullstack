'use strict';

const ADMIN_ROLES = new Set(['admin', 'owner']);

function csvSet(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  );
}

function isConfiguredOwner(user) {
  if (!user) return false;
  const ids = csvSet(process.env.ADMIN_OWNER_IDS);
  const usernames = csvSet(process.env.ADMIN_OWNER_USERNAMES);
  return ids.has(String(user.id)) || usernames.has(String(user.username || ''));
}

function effectiveRole(user) {
  if (!user) return 'visitor';
  if (String(user.role || '') === 'owner' || isConfiguredOwner(user)) return 'owner';
  return String(user.role || '') === 'admin' ? 'admin' : 'visitor';
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(String(role || ''));
}

function canManageRoles(role) {
  return String(role || '') === 'owner';
}

module.exports = {
  effectiveRole,
  isAdminRole,
  canManageRoles,
  isConfiguredOwner
};

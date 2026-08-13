const LEGACY_KEY = 'ISETI_PERSONALITY_V1'
const ANONYMOUS_KEY = 'PLACE_PERSONALITY_ANONYMOUS_V1'
const ACCOUNT_KEY_PREFIX = 'PLACE_PERSONALITY_ACCOUNT_V1:'

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function normalizedAccountId(value) {
  const id = String(value ?? '').trim()
  return id && /^[A-Za-z0-9_-]+$/.test(id) ? id : ''
}

export function currentAccountId() {
  const user = safeJsonParse(localStorage.getItem('userInfo'))
  return normalizedAccountId(user?.id)
}

export function accountPersonalityKey(accountId) {
  const id = normalizedAccountId(accountId)
  return id ? `${ACCOUNT_KEY_PREFIX}${id}` : ''
}

export function readAccountPersonality(accountId) {
  const key = accountPersonalityKey(accountId)
  return key ? safeJsonParse(localStorage.getItem(key)) : null
}

export function saveAccountPersonality(accountId, personality) {
  const key = accountPersonalityKey(accountId)
  if (!key || !personality) return false
  localStorage.setItem(key, JSON.stringify(personality))
  return true
}

export function readAnonymousPersonality() {
  return safeJsonParse(localStorage.getItem(ANONYMOUS_KEY))
}

export function saveAnonymousPersonality(personality) {
  if (!personality) return
  localStorage.setItem(ANONYMOUS_KEY, JSON.stringify(personality))
}

export function clearAnonymousPersonality() {
  localStorage.removeItem(ANONYMOUS_KEY)
}

export function discardLegacyPersonality() {
  localStorage.removeItem(LEGACY_KEY)
}

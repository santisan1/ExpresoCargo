const ROLE_LABELS = { admin: 'Usuario admin', supervisor: 'Usuario supervisor', operario: 'Usuario operario' }

export function buildUsersMap(users = []) {
  return Object.fromEntries(users.map((user) => [user.uid || user.id, user]))
}

export function getOperationalUserName(uid, embeddedName, usersById = {}) {
  if (embeddedName && embeddedName !== uid) return embeddedName
  const user = uid ? usersById[uid] : null
  if (user?.displayName) return user.displayName
  if (user?.name) return user.name
  if (user?.role) return ROLE_LABELS[user.role] || `Usuario ${user.role}`
  return 'Usuario operativo'
}

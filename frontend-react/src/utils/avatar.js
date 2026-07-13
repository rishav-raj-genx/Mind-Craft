/**
 * Generate a gender-aware avatar URL for users who don't have a profile picture.
 * Uses avatar.iran.liara.run for gendered avatars.
 *
 * @param {string} name - User's display name
 * @param {string} [gender] - 'Male', 'Female', or undefined/other
 * @returns {string} Avatar URL
 */
export function getAvatarUrl(name, gender) {
  const encoded = encodeURIComponent(name || 'User');
  if (gender === 'Male') return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}&top=shortHair`;
  if (gender === 'Female') return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}&top=longHair`;
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}`;
}

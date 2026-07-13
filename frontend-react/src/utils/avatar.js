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
  if (gender === 'Male') return `https://avatar.iran.liara.run/public/boy?username=${encoded}`;
  if (gender === 'Female') return `https://avatar.iran.liara.run/public/girl?username=${encoded}`;
  return `https://avatar.iran.liara.run/public?username=${encoded}`;
}

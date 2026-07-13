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
  // Since avatar.iran.liara.run is down globally and DiceBear v9 avataaars broke the 'top' param,
  // we use standard avataaars. The seed inherently generates a unique but random gender-agnostic avatar.
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}`;
}

/** A light tap on phones that can (Android); quietly nothing everywhere else. */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Some browsers throw without a user gesture; a missing buzz is fine.
  }
}

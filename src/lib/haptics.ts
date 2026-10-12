/**
 * A light tap on phones that can; quietly nothing everywhere else.
 *
 * Android has the vibration API. iPhones don't, but Safari (iOS 18 on) gives
 * a tick when a switch-style checkbox flips, so a hidden one is flipped
 * instead; the length is Android's only.
 */
export function haptic(ms = 8) {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
      return;
    }
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.append(input);
    // In <head>, so the click never reaches the app's own handlers.
    document.head.append(label);
    label.click();
    label.remove();
  } catch {
    // Some browsers throw without a user gesture; a missing buzz is fine.
  }
}

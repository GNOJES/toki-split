// One same-document entry lets browser Back use the app's back action.
// Activate it from a real user gesture: Android Chrome may skip entries added
// without activation. Back reuses the existing entry via forward(), because
// pushState from popstate can mark the entire app history as skippable.
const KEY = "toki-split-back";
export function bindBrowserBack(onBack) {
  const activationEvents = ["pointerup", "click"];
  const removeActivationListeners = () =>
    activationEvents.forEach((type) =>
      window.removeEventListener(type, activate, true),
    );
  const activate = (event) => {
    if (!event.isTrusted) return;
    if (history.state?.[KEY] !== "guard") {
      history.replaceState({ ...history.state, [KEY]: "base" }, "");
      history.pushState({ [KEY]: "guard" }, "");
    }
    removeActivationListeners();
  };
  if (history.state?.[KEY] !== "guard")
    activationEvents.forEach((type) =>
      window.addEventListener(type, activate, true),
    );
  const handle = (event) => {
    if (event.state?.[KEY] !== "base") return;
    history.forward();
    onBack();
  };
  window.addEventListener("popstate", handle);
  return () => {
    removeActivationListeners();
    window.removeEventListener("popstate", handle);
  };
}

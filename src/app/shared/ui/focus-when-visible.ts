/** Focus an opening overlay once its CSS visibility is applied, without a fixed delay. */
export function focusWhenVisible(
  container: HTMLElement | undefined,
  target: HTMLElement | undefined | null,
  isOpen: () => boolean,
): void {
  if (!container || !target) return;
  let frames = 0;
  const focus = () => {
    if (!container.isConnected || !target.isConnected || !isOpen()) return;
    if (container.contains(document.activeElement)) return;
    const style = getComputedStyle(container);
    if (style.visibility === 'visible' && style.display !== 'none' && !target.closest('[inert]')) {
      target.focus({ preventScroll: true });
      if (document.activeElement === target) return;
    }
    // A bounded retry covers an entering panel and cancels naturally on close/destroy.
    if (++frames < 60) requestAnimationFrame(focus);
  };
  requestAnimationFrame(focus);
}

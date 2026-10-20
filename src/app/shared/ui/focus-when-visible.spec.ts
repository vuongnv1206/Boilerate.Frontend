import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusWhenVisible } from './focus-when-visible';

describe('Overlay focus after CSS visibility changes', () => {
  let frames: FrameRequestCallback[];
  let panel: HTMLDivElement;
  let target: HTMLButtonElement;

  const nextFrame = (): void => {
    const pending = frames;
    frames = [];
    pending.forEach((callback) => callback(0));
  };

  beforeEach(() => {
    frames = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
    );
    panel = document.createElement('div');
    target = document.createElement('button');
    target.textContent = 'Đóng bảng';
    panel.append(target);
    document.body.append(panel);
  });

  afterEach(() => {
    panel.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('waits while the panel is hidden, then focuses on the first visible animation frame', () => {
    panel.style.visibility = 'hidden';
    const focus = vi.spyOn(target, 'focus');
    focusWhenVisible(panel, target, () => true);
    nextFrame();
    expect(focus).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    panel.style.visibility = 'visible';
    nextFrame();
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(document.activeElement).toBe(target);
    expect(frames).toHaveLength(0);
  });

  it('cancels delayed focus when an entering panel is closed before becoming visible', () => {
    let open = true;
    panel.style.visibility = 'hidden';
    const focus = vi.spyOn(target, 'focus');
    focusWhenVisible(panel, target, () => open);
    nextFrame();
    open = false;
    panel.style.visibility = 'visible';
    nextFrame();
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(target);
    expect(frames).toHaveLength(0);
  });

  it('preserves focus that the user has already placed inside the opening panel', () => {
    panel.style.visibility = 'visible';
    const otherControl = document.createElement('button');
    otherControl.textContent = 'Nội dung khác';
    panel.append(otherControl);
    const focus = vi.spyOn(target, 'focus');
    focusWhenVisible(panel, target, () => true);
    otherControl.focus();
    nextFrame();
    expect(document.activeElement).toBe(otherControl);
    expect(focus).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });
});

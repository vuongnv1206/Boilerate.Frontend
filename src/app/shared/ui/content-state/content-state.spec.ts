import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ContentState, ContentStateKind } from './content-state';

@Component({
  imports: [ContentState],
  template:
    '<ui-content-state [kind]="kind()" title="Nội dung" message="Thông tin"><button type="button">Thử lại</button></ui-content-state>',
})
class StateHost {
  readonly kind = signal<ContentStateKind>('empty');
}

describe('ContentState', () => {
  it('announces loading and errors without moving focus or dropping the recovery action', () => {
    const fixture = TestBed.createComponent(StateHost);
    fixture.detectChanges();
    const state: HTMLElement = fixture.nativeElement.querySelector('ui-content-state');
    const button: HTMLButtonElement = state.querySelector('button') as HTMLButtonElement;
    expect(state.getAttribute('role')).toBeNull();
    button.focus();
    fixture.componentInstance.kind.set('loading');
    fixture.detectChanges();
    expect(state.getAttribute('role')).toBe('status');
    expect(state.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(button);
    fixture.componentInstance.kind.set('error');
    fixture.detectChanges();
    expect(state.getAttribute('role')).toBe('alert');
    expect(state.hasAttribute('aria-busy')).toBe(false);
    expect(state.querySelector('button')).toBe(button);
    expect(document.activeElement).toBe(button);
  });
});

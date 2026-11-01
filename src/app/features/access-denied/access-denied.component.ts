import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { WORKSPACE_NAVIGATION } from '@core/navigation/workspace-navigation';

@Component({
  selector: 'app-access-denied',
  imports: [RouterLink, ContentState, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ui-content-state
    kind="error"
    layout="page"
    title="Không có quyền truy cập"
    message="Tài khoản của bạn chưa được cấp quyền cho chức năng này. Hãy chọn chức năng được phép hoặc liên hệ người quản trị."
  >
    @if (canReturn()) {
      <a pButton severity="secondary" outlined routerLink="/admin">Về trang được phép</a>
    } @else {
      <a pButton severity="secondary" outlined routerLink="/shop">Đến cửa hàng</a>
    }
  </ui-content-state>`,
})
export class AccessDenied {
  private readonly navigation = inject(WORKSPACE_NAVIGATION);
  readonly canReturn = computed(
    () => this.navigation.collections().length > 0 || this.navigation.system().length > 0,
  );
}

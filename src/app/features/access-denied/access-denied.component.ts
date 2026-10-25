import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ContentState } from '@shared/ui/content-state/content-state.component';

@Component({
  selector: 'app-access-denied',
  imports: [RouterLink, ContentState, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ui-content-state
    kind="error"
    layout="page"
    title="Không có quyền truy cập"
    message="Tài khoản của bạn chưa được cấp quyền cho chức năng này. Chọn chức năng được phép hoặc đăng xuất bằng nút trong thanh điều hướng."
    ><a pButton severity="secondary" outlined routerLink="/admin">Về workspace</a></ui-content-state
  >`,
})
export class AccessDenied {}

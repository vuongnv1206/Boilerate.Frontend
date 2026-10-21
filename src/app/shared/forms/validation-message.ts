import { AbstractControl } from '@angular/forms';

/** Presentation-ready message; domain validators retain their own error keys. */
export function validationMessage(control: AbstractControl | undefined): string {
  if (!control || !(control.touched || control.dirty) || !control.errors) return '';
  const server: unknown = control.errors['server'];
  if (Array.isArray(server))
    return server.filter((value): value is string => typeof value === 'string').join(' ');
  if (control.hasError('required')) return 'Vui lòng nhập giá trị cho trường này.';
  if (control.hasError('maxlength')) return 'Nội dung vượt quá độ dài cho phép.';
  if (control.hasError('vndPrice'))
    return 'Giá VND phải là số nguyên không âm trong phạm vi an toàn.';
  if (control.hasError('fieldNumber')) return 'Nhập số hợp lệ, tối đa 4 chữ số thập phân.';
  if (control.hasError('duplicateCodes')) return 'Mã không được trùng nhau.';
  return 'Giá trị không đúng định dạng.';
}

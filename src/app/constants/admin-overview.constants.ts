import { OverviewRangePreset, OverviewWorkKey } from '@models/admin-overview.dto';

export const OVERVIEW_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const OVERVIEW_MAX_DAYS = 90;
export const OVERVIEW_MAX_THRESHOLD = 999;
export const OVERVIEW_PAGE_SIZES = [10, 20, 50] as const;
export const OVERVIEW_RANGE_OPTIONS: readonly { label: string; value: OverviewRangePreset }[] = [
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày', value: '7' },
  { label: '30 ngày', value: '30' },
  { label: 'Tùy chọn', value: 'custom' },
];
export const OVERVIEW_WORK_LABELS: Readonly<Record<OverviewWorkKey, string>> = {
  'awaiting-payment': 'Đơn chờ thanh toán',
  'awaiting-processing': 'Đơn chờ hoàn tất',
  'needs-review': 'Đơn cần kiểm tra',
  'renewal-awaiting-work': 'Gia hạn chờ thực hiện',
  'renewal-pending-verification': 'Gia hạn chờ xác minh',
};
export const OVERVIEW_WORK_DESCRIPTIONS: Readonly<Record<OverviewWorkKey, string>> = {
  'awaiting-payment': 'Đơn chưa nhận tiền và còn thời hạn thanh toán.',
  'awaiting-processing': 'Đơn đang chờ thực hiện hoặc đang được xử lý.',
  'needs-review': 'Đơn đã nhận tiền cần kiểm tra trước khi tiếp tục.',
  'renewal-awaiting-work': 'Yêu cầu đã đủ điều kiện và đang chờ nhân viên thực hiện.',
  'renewal-pending-verification': 'Cần xác minh kết quả thực tế, kể cả khi đơn đã đóng.',
};

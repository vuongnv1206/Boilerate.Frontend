import { GalleryOption, PreviewRecord } from '../models/preview-record.model';

export const GALLERY_CATEGORIES = [
  { label: 'Đồ dùng trong nhà', value: 'home' },
  { label: 'Phụ kiện cá nhân', value: 'accessories' },
  { label: 'Ấn phẩm & văn phòng', value: 'stationery' },
] as const satisfies readonly GalleryOption[];
export const GALLERY_TAGS = [
  { label: 'Mới ra mắt', value: 'new' },
  { label: 'Làm thủ công', value: 'handmade' },
  { label: 'Vật liệu tự nhiên', value: 'natural' },
  { label: 'Phiên bản giới hạn', value: 'limited' },
] as const satisfies readonly GalleryOption[];
export const GALLERY_PREVIEW_RECORDS = [
  {
    id: '01',
    name: 'Bình gốm dáng cao — màu cát',
    category: 'Đồ dùng trong nhà',
    status: 'Đã xuất bản',
  },
  {
    id: '02',
    name: 'Túi vải dệt từ sợi bông tự nhiên',
    category: 'Phụ kiện cá nhân',
    status: 'Bản nháp',
  },
  {
    id: '03',
    name: 'Sổ tay giấy ngà, bìa vải xanh',
    category: 'Ấn phẩm & văn phòng',
    status: 'Đã xuất bản',
  },
  {
    id: '04',
    name: 'Khay gỗ nhỏ cho góc làm việc',
    category: 'Đồ dùng trong nhà',
    status: 'Bản nháp',
  },
  {
    id: '05',
    name: 'Cốc gốm men mờ — bộ hai chiếc',
    category: 'Đồ dùng trong nhà',
    status: 'Đã xuất bản',
  },
  {
    id: '06',
    name: 'Thiệp cảm ơn in trên giấy tái chế',
    category: 'Ấn phẩm & văn phòng',
    status: 'Bản nháp',
  },
] as const satisfies readonly PreviewRecord[];

export const GALLERY_SAVE_DELAY_MS = 1200;
export const GALLERY_TOAST_LIFETIME_MS = 4500;

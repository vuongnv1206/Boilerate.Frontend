import { OverviewFinanceDay } from '@models/admin-overview.dto';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatOverviewMoney(value: string): string {
  return moneyFormatter.format(BigInt(value));
}

export interface OverviewChartBar {
  readonly date: string;
  readonly receivedX: number;
  readonly receivedY: number;
  readonly receivedHeight: number;
  readonly refundedX: number;
  readonly refundedY: number;
  readonly refundedHeight: number;
  readonly width: number;
  readonly captionX: number;
  readonly caption: string;
  readonly showCaption: boolean;
  readonly label: string;
}

export interface OverviewChart {
  readonly zeroY: number;
  readonly netPoints: string;
  readonly bars: readonly OverviewChartBar[];
}

/** Only chart coordinates lose precision; every monetary label uses the original integer string. */
export function overviewChart(days: readonly OverviewFinanceDay[]): OverviewChart {
  const values = days.flatMap((day) => [
    BigInt(day.received),
    BigInt(day.refunded),
    BigInt(day.net),
  ]);
  const maximum = values.reduce((max, value) => (value > max ? value : max), 1n);
  const minimum = values.reduce((min, value) => (value < min ? value : min), 0n);
  const span = maximum - minimum;
  const y = (value: bigint): number => 16 + Number(((maximum - value) * 190_000n) / span) / 1000;
  const zeroY = y(0n);
  const step = 900 / Math.max(days.length, 1);
  const width = Math.max(1, Math.min(18, step * 0.32));
  const captionStep = Math.max(1, Math.ceil(days.length / 7));
  return {
    zeroY,
    netPoints: days
      .map((day, index) => `${30 + step * (index + 0.5)},${y(BigInt(day.net))}`)
      .join(' '),
    bars: days.map((day, index) => {
      const receivedY = y(BigInt(day.received));
      const refundedY = y(BigInt(day.refunded));
      return {
        date: day.date,
        receivedX: 30 + step * (index + 0.5) - width - 1,
        receivedY,
        receivedHeight: Math.max(0, zeroY - receivedY),
        refundedX: 30 + step * (index + 0.5) + 1,
        refundedY,
        refundedHeight: Math.max(0, zeroY - refundedY),
        width,
        captionX: 30 + step * (index + 0.5),
        caption: `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`,
        showCaption: index % captionStep === 0 || index === days.length - 1,
        label: `${day.date}: đã nhận ${formatOverviewMoney(day.received)}, đã hoàn ${formatOverviewMoney(day.refunded)}, thu ròng ${formatOverviewMoney(day.net)}`,
      };
    }),
  };
}

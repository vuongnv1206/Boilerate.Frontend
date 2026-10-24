import type { BrowserContext, Route } from '@playwright/test';
import type {
  ConfirmRefundRequest,
  PhysicalReturnDto,
  ReceiveReturnRequest,
  RefundDto,
  RefundResult,
  ReturnResult,
} from '../../src/app/models/order.dto';
import { installOrdersApi, ORDER_ID, SHIPPING_GRANTS } from './orders-api';

export const AFTER_SALES_GRANTS = [
  ...SHIPPING_GRANTS,
  'Permissions.AfterSales.View',
  'Permissions.Refund.Confirm',
  'Permissions.Return.Receive',
  'Permissions.Inventory.Adjust',
];

export async function installAfterSalesApi(context: BrowserContext, paid = true) {
  const orders = await installOrdersApi(context);
  if (paid) {
    orders.order.paymentMethod = 1;
    orders.order.paymentStatus = 2;
    orders.order.paidAtUtc = '2026-10-21T00:00:00Z';
  }
  const refunds: RefundDto[] = [];
  const returns: PhysicalReturnDto[] = [];
  const writes: { path: string; body: ConfirmRefundRequest | ReceiveReturnRequest }[] = [];
  const operations = new Map<string, { snapshot: string; result: RefundResult | ReturnResult }>();
  let conflictRefund = false;
  let loseRefund = false;
  let loseReturn = false;
  let version = 0;
  let closed = false;
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const conflict = (route: Route) =>
    reply(route, { status: 409, title: 'Dữ liệu đã thay đổi' }, 409);
  const bump = () => {
    orders.order.version = `after-sales-${++version}`;
  };
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.split('/api/')[1] ?? '';
    if (!path.startsWith(`admin/orders/${ORDER_ID}/`)) return route.fallback();
    const method = route.request().method();
    if (method === 'GET' && path.endsWith('/after-sales')) {
      const refundedAmount = refunds.reduce((sum, refund) => sum + refund.amount, 0);
      const receivedAmount = paid ? orders.order.total : 0;
      return reply(route, {
        orderId: ORDER_ID,
        orderVersion: orders.order.version,
        closed,
        receivedAmount,
        refundedAmount,
        refundableAmount: receivedAmount - refundedAmount,
        refunds,
        returns,
      });
    }
    if (method !== 'POST' || (!path.endsWith('/refunds') && !path.endsWith('/returns')))
      return route.fallback();
    const body = route.request().postDataJSON() as ConfirmRefundRequest | ReceiveReturnRequest;
    writes.push({ path, body });
    const snapshot = JSON.stringify({ path, body });
    const previous = operations.get(body.operationId);
    if (previous)
      return previous.snapshot === snapshot ? reply(route, previous.result) : conflict(route);
    if (conflictRefund && path.endsWith('/refunds')) {
      conflictRefund = false;
      bump();
      return conflict(route);
    }
    if (body.orderVersion !== orders.order.version) return conflict(route);
    bump();
    if (path.endsWith('/refunds')) {
      const request = body as ConfirmRefundRequest;
      const refund: RefundDto = {
        id: `refund-${refunds.length}`,
        receiptId: 'receipt',
        reference: request.reference,
        source: request.source,
        amount: request.amount,
        currency: request.currency,
        reason: request.reason,
        refundedAtUtc: request.refundedAtUtc,
      };
      refunds.push(refund);
      const result: RefundResult = { refund, orderVersion: orders.order.version, closed };
      operations.set(body.operationId, { snapshot, result });
      if (loseRefund) {
        loseRefund = false;
        return route.abort('failed');
      }
      return reply(route, result);
    }
    const request = body as ReceiveReturnRequest;
    closed = request.closeRemainingCod;
    if (closed) orders.order.status = 6;
    const receipt: PhysicalReturnDto = {
      id: `return-${returns.length}`,
      reference: request.reference,
      reason: request.reason,
      receivedAtUtc: new Date().toISOString(),
      closeRemainingCod: request.closeRemainingCod,
      items: structuredClone(request.items),
    };
    returns.push(receipt);
    const result: ReturnResult = { return: receipt, orderVersion: orders.order.version, closed };
    operations.set(body.operationId, { snapshot, result });
    if (loseReturn) {
      loseReturn = false;
      return route.abort('failed');
    }
    return reply(route, result);
  });
  return {
    ...orders,
    refunds,
    returns,
    afterSalesWrites: writes,
    conflictNextRefund: () => {
      conflictRefund = true;
    },
    loseNextRefundResponse: () => {
      loseRefund = true;
    },
    loseNextReturnResponse: () => {
      loseReturn = true;
    },
  };
}

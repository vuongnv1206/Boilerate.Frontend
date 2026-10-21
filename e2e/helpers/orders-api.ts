import { type BrowserContext, type Route } from '@playwright/test';

export const ORDER_ID = '50000000-0000-0000-0000-000000000001';
export const SHIPPING_GRANTS = [
  'Permissions.Order.View',
  'Permissions.Shipping.View',
  'Permissions.Shipping.Dispatch',
  'Permissions.Shipping.Deliver',
];

interface ShippingLine {
  orderItemId: string;
  quantity: number;
}
interface Shipment {
  id: string;
  orderId: string;
  orderVersion: string;
  version: string;
  carrier: string;
  trackingNumber: string;
  status: number;
  dispatchedAtUtc: string;
  deliveredAtUtc: string | null;
  items: ShippingLine[];
}
interface DispatchBody {
  orderVersion: string;
  operationId: string;
  carrier: string;
  trackingNumber: string;
  items: ShippingLine[];
}
interface DeliveryBody {
  orderVersion: string;
  version: string;
  operationId: string;
}

export async function installOrdersApi(context: BrowserContext) {
  let version = 1;
  let conflictNext = false;
  let loseDispatch = false;
  let loseDelivery = false;
  const writes: { path: string; body: DispatchBody | DeliveryBody }[] = [];
  const shipments: Shipment[] = [];
  const dispatches = new Map<string, { body: DispatchBody; shipment: Shipment }>();
  const deliveries = new Map<string, { body: DeliveryBody; shipment: Shipment }>();
  const order = {
    id: ORDER_ID,
    number: 'ORD-001',
    version: 'order-v1',
    status: 2,
    paymentMethod: 2,
    subtotal: 300000,
    shippingAmount: 0,
    total: 300000,
    currency: 'VND',
    expiresAt: null,
    recipientName: 'Nguyễn Văn An',
    email: 'shopper@example.test',
    phone: '0901234567',
    shippingAddress: '12 Đường Nguyễn Huệ, Thành phố Hồ Chí Minh',
    paymentStatus: 1,
    fulfillmentStatus: 1,
    paidAtUtc: null,
    createdOn: '2026-10-21T00:00:00Z',
    physicalDispatchStarted: false,
    items: [
      {
        id: 'line-a',
        productId: 'product-a',
        variantId: 'variant-a',
        name: 'Túi vải phiên bản có tên dài',
        sku: 'TOTE-A',
        optionDescription: 'Màu xanh',
        fulfillmentKind: 1,
        unitPrice: 100000,
        quantity: 2,
      },
      {
        id: 'line-b',
        productId: 'product-b',
        variantId: 'variant-b',
        name: 'Sổ tay',
        sku: 'NOTE-B',
        optionDescription: '',
        fulfillmentKind: 1,
        unitPrice: 100000,
        quantity: 1,
      },
    ],
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const conflict = (route: Route) =>
    reply(route, { status: 409, title: 'Dữ liệu đã thay đổi' }, 409);
  const bump = () => {
    order.version = `order-v${++version}`;
    order.physicalDispatchStarted = true;
    order.fulfillmentStatus = 3;
  };
  const addShipment = (body: DispatchBody) => {
    bump();
    const shipment: Shipment = {
      id: `shipment-${shipments.length + 1}`,
      orderId: ORDER_ID,
      orderVersion: order.version,
      version: `shipment-v${version}`,
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
      status: 1,
      dispatchedAtUtc: new Date().toISOString(),
      deliveredAtUtc: null,
      items: structuredClone(body.items),
    };
    shipments.push(shipment);
    return shipment;
  };
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/api/')[1] ?? '';
    if (!path.startsWith('admin/orders')) return route.fallback();
    const method = route.request().method();
    if (method === 'GET') {
      if (path === 'admin/orders')
        return reply(route, { items: [order], total: 1, pageNumber: 1, pageSize: 20 });
      if (path === `admin/orders/${ORDER_ID}`) return reply(route, order);
      if (path.endsWith('/shipments')) return reply(route, shipments);
      if (path.endsWith('/history'))
        return reply(
          route,
          shipments.map((s) => ({
            id: s.id,
            occurredAtUtc: s.dispatchedAtUtc,
            action: 'Dispatch',
            actorDisplayName: 'Nhân viên kho',
            relatedEntityType: 'Shipment',
            safeSummary: `Đã xuất ${s.trackingNumber}`,
          })),
        );
      if (path.endsWith('/after-sales'))
        return reply(route, {
          orderId: ORDER_ID,
          orderVersion: order.version,
          closed: false,
          receivedAmount: 0,
          refundedAmount: 0,
          refundableAmount: 0,
          refunds: [],
          returns: [],
        });
    }
    if (method === 'POST' && path.endsWith('/shipments')) {
      const body = route.request().postDataJSON() as DispatchBody;
      writes.push({ path, body });
      const previous = dispatches.get(body.operationId);
      if (previous)
        return JSON.stringify(previous.body) === JSON.stringify(body)
          ? reply(route, previous.shipment)
          : conflict(route);
      if (conflictNext) {
        conflictNext = false;
        addShipment({
          ...body,
          carrier: 'Hãng khác',
          trackingNumber: 'EXTERNAL',
          items: [{ orderItemId: 'line-a', quantity: 2 }],
        });
        return conflict(route);
      }
      if (body.orderVersion !== order.version) return conflict(route);
      const shipment = addShipment(body);
      dispatches.set(body.operationId, {
        body: structuredClone(body),
        shipment: structuredClone(shipment),
      });
      if (loseDispatch) {
        loseDispatch = false;
        return route.abort('failed');
      }
      return reply(route, shipment);
    }
    if (method === 'POST' && path.endsWith('/deliver')) {
      const body = route.request().postDataJSON() as DeliveryBody;
      writes.push({ path, body });
      const previous = deliveries.get(body.operationId);
      if (previous)
        return JSON.stringify(previous.body) === JSON.stringify(body)
          ? reply(route, previous.shipment)
          : conflict(route);
      const shipment = shipments.find((s) => s.id === path.split('/')[4]);
      if (!shipment || body.orderVersion !== order.version || body.version !== shipment.version)
        return conflict(route);
      bump();
      shipment.version = `shipment-v${version}`;
      shipment.orderVersion = order.version;
      shipment.status = 2;
      shipment.deliveredAtUtc = new Date().toISOString();
      deliveries.set(body.operationId, {
        body: structuredClone(body),
        shipment: structuredClone(shipment),
      });
      if (loseDelivery) {
        loseDelivery = false;
        return route.abort('failed');
      }
      return reply(route, shipment);
    }
    return reply(route, { status: 501, title: `Unexpected order request ${method} ${path}` }, 501);
  });
  return {
    order,
    shipments,
    writes,
    conflictNextDispatch: () => {
      conflictNext = true;
    },
    loseNextDispatchResponse: () => {
      loseDispatch = true;
    },
    loseNextDeliveryResponse: () => {
      loseDelivery = true;
    },
    seedShipment: () =>
      addShipment({
        orderVersion: order.version,
        operationId: 'seed',
        carrier: 'Hãng A',
        trackingNumber: 'TRACK-SEED',
        items: [{ orderItemId: 'line-a', quantity: 1 }],
      }),
  };
}

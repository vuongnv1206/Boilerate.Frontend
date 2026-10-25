import { expect, test, type Page, type Route } from '@playwright/test';

type Kind = 'physical' | 'digital';

function cartDto(
  kind: Kind,
  lines: readonly { variantId: string; quantity: number }[],
  version: number,
) {
  const unitPrice = 123000;
  const items = lines.map((line) => ({
    ...line,
    name: kind === 'physical' ? 'Áo thun thử nghiệm' : 'Bản quyền phần mềm thử nghiệm',
    sku: kind === 'physical' ? 'SHIRT-TEST' : 'LICENSE-TEST',
    unitPrice,
    isAvailable: true,
    fulfillmentKind: kind === 'physical' ? 1 : 2,
  }));
  const subtotal = items.reduce((total, item) => total + item.quantity * unitPrice, 0);
  const shippingAmount = kind === 'physical' ? 30000 : 0;
  return {
    id: 'cart-guest-1',
    version: `cart-v${version}`,
    items,
    subtotal,
    shippingAmount,
    total: subtotal + shippingAmount,
    canCheckout: true,
    hasDigitalItems: kind === 'digital',
  };
}

async function installStorefront(
  page: Page,
  kind: Kind,
  onCheckout: (body: Record<string, unknown>) => void,
  options: {
    firstCheckoutConflicts?: boolean;
    bankTransferEnabled?: boolean;
    wrongOtp?: boolean;
  } = {},
) {
  const variantId = kind === 'physical' ? 'variant-shirt-1' : 'variant-license-1';
  const productId = kind === 'physical' ? 'product-shirt-1' : 'product-license-1';
  const slug = kind === 'physical' ? 'ao-thun-thu-nghiem' : 'ban-quyen-thu-nghiem';
  const name = kind === 'physical' ? 'Áo thun thử nghiệm' : 'Bản quyền phần mềm thử nghiệm';
  let cart = cartDto(kind, [], 1);
  let version = 1;
  let order: Record<string, unknown> | null = null;

  const product = {
    id: productId,
    productTypeId: 'type-standard',
    name,
    slug,
    description: 'Mô tả tiếng Việt dài để kiểm tra bố cục trên desktop và tablet.',
    status: 2,
    version: 'product-v1',
    categoryIds: [],
    options: [],
    variants: [
      {
        id: variantId,
        sku: kind === 'physical' ? 'SHIRT-TEST' : 'LICENSE-TEST',
        combinationKey: '',
        price: 123000,
        compareAtPrice: null,
        currency: 'VND',
        isDefault: true,
        isActive: true,
        imageMediaId: null,
        inStock: true,
        selections: [],
      },
    ],
    fields: [],
    media: [],
    fulfillmentKind: kind === 'physical' ? 1 : 2,
  };

  await page.route('**/api/catalog/categories', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/catalog/products/search', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: productId,
            name,
            slug,
            status: 2,
            fromPrice: 123000,
            inStock: true,
            fulfillmentKind: kind === 'physical' ? 1 : 2,
          },
        ],
        total: 1,
        pageNumber: 1,
        pageSize: 20,
      },
    }),
  );
  await page.route(`**/api/catalog/products/${slug}`, (route) => route.fulfill({ json: product }));
  await page.route('**/api/storefront/cart', async (route: Route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: cart });
    const body = route.request().postDataJSON() as {
      items: { variantId: string; quantity: number }[];
    };
    cart = cartDto(kind, body.items, ++version);
    return route.fulfill({ json: cart });
  });
  await page.route('**/api/storefront/settings', (route) =>
    route.fulfill({
      json: {
        bankName: 'Ngân hàng thử nghiệm',
        accountNumber: '1234567890',
        accountHolder: 'CỬA HÀNG THỬ NGHIỆM',
        branch: 'Chi nhánh Đà Nẵng',
        instructions: 'Ghi mã đơn trong nội dung chuyển khoản.',
        bankTransferEnabled: options.bankTransferEnabled ?? true,
      },
    }),
  );
  await page.route('**/api/storefront/access/request-code', (route) =>
    route.fulfill({ status: 202, json: { message: 'Đã gửi mã.' } }),
  );
  await page.route('**/api/storefront/access/verify-code', (route) =>
    options.wrongOtp
      ? route.fulfill({ status: 400, json: { code: 'invalid_otp' } })
      : route.fulfill({ json: { email: 'BUYER@EXAMPLE.TEST' } }),
  );
  let checkoutAttempts = 0;
  await page.route('**/api/storefront/checkout', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    onCheckout(body);
    checkoutAttempts++;
    if (options.firstCheckoutConflicts && checkoutAttempts === 1) {
      cart = {
        ...cart,
        version: `cart-v${++version}`,
        items: cart.items.map((item) => ({ ...item, unitPrice: item.unitPrice! + 1000 })),
      };
      cart.subtotal = cart.items.reduce((sum, item) => sum + item.quantity * item.unitPrice!, 0);
      cart.total = cart.subtotal + cart.shippingAmount;
      return route.fulfill({ status: 409, json: { status: 409, detail: 'Total changed.' } });
    }
    order = {
      id: 'order-guest-1',
      number: 'GUEST-1001',
      version: 'order-v1',
      status: body['paymentMethod'] === 2 ? 2 : 1,
      paymentMethod: body['paymentMethod'],
      subtotal: cart.subtotal,
      shippingAmount: cart.shippingAmount,
      total: cart.total,
      currency: 'VND',
      expiresAt: body['paymentMethod'] === 1 ? '2026-10-24T09:00:00Z' : null,
      recipientName: body['recipientName'],
      email: body['email'],
      phone: body['phone'],
      shippingAddress: body['shippingAddress'],
      items: cart.items.map((item) => ({
        id: `line-${item.variantId}`,
        productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        optionDescription: '',
        fulfillmentKind: item.fulfillmentKind,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      paymentStatus: 1,
      fulfillmentStatus: 1,
      paidAtUtc: null,
      createdOn: '2026-10-24T08:00:00Z',
      physicalDispatchStarted: false,
    };
    return route.fulfill({ json: order });
  });
  await page.route('**/api/storefront/orders/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/shipments') || path.endsWith('/digital-deliveries'))
      return route.fulfill({ json: [] });
    return route.fulfill({ json: order });
  });
  await page.goto('/shop/products');
}

async function reachCheckout(page: Page) {
  const productLink = page.getByRole('link', {
    name: /Bản quyền phần mềm thử nghiệm|Áo thun thử nghiệm/,
  });
  await productLink.focus();
  await expect(productLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: /Bản quyền phần mềm thử nghiệm|Áo thun thử nghiệm/ }),
  ).toBeVisible();
  await expect(
    page.getByText('Mô tả tiếng Việt dài để kiểm tra bố cục trên desktop và tablet.'),
  ).toBeVisible();
  const addButton = page.getByRole('button', { name: /Thêm vào giỏ hàng/ });
  await expect(addButton).toBeEnabled();
  await addButton.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Giỏ hàng').click();
  await page.getByRole('button', { name: /Tiến hành đặt hàng/ }).click();
  await expect(page.getByRole('heading', { name: 'Xác nhận & Đặt hàng' })).toBeVisible();
}

async function installCatalogPreview(page: Page) {
  const categories = [
    {
      id: 'category-home',
      version: 'category-home-v1',
      name: 'Không gian sống',
      slug: 'khong-gian-song',
      description: null,
      parentId: null,
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'category-work',
      version: 'category-work-v1',
      name: 'Công nghệ & làm việc',
      slug: 'cong-nghe-lam-viec',
      description: null,
      parentId: null,
      sortOrder: 2,
      isActive: true,
    },
  ];
  const products = [
    {
      id: 'product-lamp',
      name: 'Đèn bàn tối giản',
      slug: 'den-ban-toi-gian',
      status: 2,
      fromPrice: 890000,
      inStock: true,
      fulfillmentKind: 1,
      thumbnailMediaId: 'catalog-camera',
      categoryId: 'category-home',
    },
    {
      id: 'product-notebook',
      name: 'Sổ tay cho ý tưởng mới',
      slug: 'so-tay-y-tuong-moi',
      status: 2,
      fromPrice: 145000,
      inStock: true,
      fulfillmentKind: 1,
      thumbnailMediaId: null,
      categoryId: 'category-work',
    },
    {
      id: 'product-chair',
      name: 'Ghế lounge gỗ sồi',
      slug: 'ghe-lounge-go-soi',
      status: 2,
      fromPrice: 3250000,
      inStock: true,
      fulfillmentKind: 1,
      thumbnailMediaId: 'broken-catalog-image',
      categoryId: 'category-home',
    },
    {
      id: 'product-headphones',
      name: 'Tai nghe chụp tai khử tiếng ồn cho không gian làm việc',
      slug: 'tai-nghe-over-ear',
      status: 2,
      fromPrice: 1490000,
      inStock: true,
      fulfillmentKind: 1,
      thumbnailMediaId: null,
      categoryId: 'category-work',
    },
  ];
  const requests: Record<string, unknown>[] = [];
  const headphone = {
    id: 'product-headphones',
    productTypeId: 'type-standard',
    name: products[3]!.name,
    slug: products[3]!.slug,
    description: 'Thiết kế thoải mái cho những phiên làm việc dài. Mô tả hỗ trợ tiếng Việt có dấu.',
    status: 2,
    version: 'product-v1',
    categoryIds: ['category-work'],
    options: [
      {
        id: 'option-color',
        code: 'color',
        name: 'Màu sắc',
        sortOrder: 1,
        values: [
          { id: 'color-black', code: 'black', label: 'Màu đen', sortOrder: 1 },
          { id: 'color-blue', code: 'blue', label: 'Màu xanh', sortOrder: 2 },
        ],
      },
    ],
    variants: [
      {
        id: 'variant-headphones-black',
        sku: 'AUDIO-BLACK',
        combinationKey: 'color=black',
        price: 1490000,
        compareAtPrice: null,
        currency: 'VND',
        isDefault: true,
        isActive: true,
        imageMediaId: null,
        inStock: true,
        selections: [{ optionId: 'option-color', optionValueId: 'color-black' }],
      },
      {
        id: 'variant-headphones-blue',
        sku: 'AUDIO-BLUE',
        combinationKey: 'color=blue',
        price: 1590000,
        compareAtPrice: null,
        currency: 'VND',
        isDefault: false,
        isActive: true,
        imageMediaId: null,
        inStock: false,
        selections: [{ optionId: 'option-color', optionValueId: 'color-blue' }],
      },
    ],
    fields: [],
    media: [],
    fulfillmentKind: 1,
  };

  await page.route('**/api/catalog/categories', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/catalog/products/search', async (route) => {
    const body = route.request().postDataJSON() as {
      categoryId?: string;
      search?: string;
    };
    requests.push(body);
    const query = body.search?.toLocaleLowerCase('vi-VN') ?? '';
    const items = products.filter(
      (product) =>
        (!body.categoryId || product.categoryId === body.categoryId) &&
        (!query || product.name.toLocaleLowerCase('vi-VN').includes(query)),
    );
    return route.fulfill({
      json: { items, total: items.length, pageNumber: 1, pageSize: 20 },
    });
  });
  await page.route('**/api/catalog/products/tai-nghe-over-ear', (route) =>
    route.fulfill({ json: headphone }),
  );
  await page.route('**/api/catalog/media/**', async (route) => {
    if (route.request().url().endsWith('/broken-catalog-image')) {
      return route.fulfill({ status: 404, json: { status: 404 } });
    }
    return route.fulfill({ path: 'public/images/lamp.svg', contentType: 'image/svg+xml' });
  });

  let cartVersion = 1;
  let lines: { variantId: string; quantity: number }[] = [];
  const makeCart = () => {
    const items = lines.map((line) => ({
      ...line,
      name: `${headphone.name} · AUDIO-BLACK`,
      sku: 'AUDIO-BLACK',
      unitPrice: 1490000,
      isAvailable: true,
      fulfillmentKind: 1,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return {
      id: 'catalog-preview-cart',
      version: `catalog-cart-v${cartVersion}`,
      items,
      subtotal,
      shippingAmount: 0,
      total: subtotal,
      canCheckout: items.length > 0,
      hasDigitalItems: false,
    };
  };
  await page.route('**/api/storefront/cart', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: makeCart() });
    const body = route.request().postDataJSON() as {
      items: { variantId: string; quantity: number }[];
    };
    lines = body.items;
    cartVersion++;
    return route.fulfill({ json: makeCart() });
  });
  await page.route('**/api/storefront/settings', (route) =>
    route.fulfill({
      json: {
        bankName: 'Ngân hàng thử nghiệm',
        accountNumber: '1234567890',
        accountHolder: 'CỬA HÀNG THỬ NGHIỆM',
        branch: null,
        instructions: null,
        bankTransferEnabled: true,
      },
    }),
  );

  await page.goto('/shop/products');
  return { requests, products };
}

async function verifyEmail(page: Page) {
  await page.getByLabel(/Email dùng để xác minh/).fill('buyer@example.test');
  await page.getByRole('button', { name: 'Gửi mã xác minh' }).click();
  await page.getByLabel('Mã xác minh').fill('123456');
  await page.getByRole('button', { name: 'Xác minh email' }).click();
  await expect(page.getByText(/Email đã được xác minh/)).toBeVisible();
}

test('guest checkout verifies email before placing a COD physical order', async ({ page }) => {
  let request: Record<string, unknown> | null = null;
  await installStorefront(page, 'physical', (body) => {
    request = body;
  });
  await reachCheckout(page);
  await expect(page).toHaveScreenshot('storefront-checkout-verification.png', { fullPage: true });
  await verifyEmail(page);
  await page.getByLabel('Họ và tên').fill('Nguyễn Thị Bích Ngọc');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.getByLabel('Địa chỉ nhận hàng').fill('12 Đường Nguyễn Huệ, Phường Hải Châu, Đà Nẵng');
  await page.getByLabel(/Thu hộ tiền mặt khi nhận hàng/).check();
  await page.getByRole('button', { name: /Đặt hàng ngay/ }).click();
  await expect(page.getByRole('heading', { name: /Đơn hàng #GUEST-1001/ })).toBeVisible();
  expect(request).toMatchObject({
    paymentMethod: 2,
    email: 'buyer@example.test',
    expectedTotal: 153000,
  });
});

test('invalid OTP keeps email unverified and blocks checkout', async ({ page }) => {
  await installStorefront(page, 'physical', () => undefined, { wrongOtp: true });
  await reachCheckout(page);
  await page.getByLabel(/Email dùng để xác minh/).fill('buyer@example.test');
  await page.getByRole('button', { name: 'Gửi mã xác minh' }).click();
  await page.getByLabel('Mã xác minh').fill('000000');
  await page.getByRole('button', { name: 'Xác minh email' }).click();
  await expect(
    page.getByText('Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.'),
  ).toBeVisible();
  await expect(page.getByText(/Email đã được xác minh/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Đặt hàng ngay/ })).toBeDisabled();
});

test('cart empty state guides the customer back to the catalog', async ({ page }) => {
  await installStorefront(page, 'physical', () => undefined);
  await page.getByLabel('Giỏ hàng').click();
  await expect(page.getByRole('heading', { name: 'Giỏ hàng đang chờ bạn' })).toBeVisible();
  await expect(page).toHaveScreenshot('storefront-cart-empty.png', { fullPage: true });
  await expect(page.getByRole('link', { name: /Khám phá sản phẩm/ })).toHaveAttribute(
    'href',
    '/shop/products',
  );
});

test('My Orders verifies the email before showing the empty order state', async ({ page }) => {
  await page.route('**/api/storefront/access/me', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/storefront/access/request-code', (route) =>
    route.fulfill({ status: 202, json: { message: 'Đã gửi mã.' } }),
  );
  await page.route('**/api/storefront/access/verify-code', (route) =>
    route.fulfill({ json: { email: 'BUYER@EXAMPLE.TEST' } }),
  );
  await page.route('**/api/storefront/orders**', (route) =>
    route.fulfill({ json: { items: [], total: 0, pageNumber: 1, pageSize: 20 } }),
  );
  await page.goto('/shop/orders');
  await expect(page.getByRole('heading', { name: 'Đơn hàng gắn với email của bạn' })).toBeVisible();
  await expect(page).toHaveScreenshot('storefront-orders-verification.png', { fullPage: true });
  await page.getByLabel('Email', { exact: true }).fill('buyer@example.test');
  await page.getByRole('button', { name: 'Gửi mã xác minh' }).click();
  await page.getByLabel('Mã xác minh 6 chữ số').fill('123456');
  await page.getByRole('button', { name: 'Xác minh và xem đơn' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có đơn hàng nào' })).toBeVisible();
  await expect(page).toHaveScreenshot('storefront-orders-empty.png', { fullPage: true });
});

test('storefront catalog and detail keep image fallbacks and purchase states legible', async ({
  page,
}) => {
  const { requests, products } = await installCatalogPreview(page);
  await expect(page.locator('.product-card')).toHaveCount(4);
  await expect(page.locator('[data-product-id="product-lamp"] .product-thumbnail')).toHaveAttribute(
    'src',
    /catalog-camera$/,
  );
  await expect(
    page.locator('[data-product-id="product-notebook"] .product-thumbnail'),
  ).toHaveAttribute('src', '/images/notebook.svg');
  await expect(
    page.locator('[data-product-id="product-chair"] .product-thumbnail'),
  ).toHaveAttribute('src', '/images/chair.svg');
  await expect(page.locator('img.product-thumbnail').nth(0)).toHaveJSProperty('complete', true);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('storefront-catalog.png', { fullPage: true });

  await page.getByRole('button', { name: 'Không gian sống' }).click();
  await expect(page.locator('.product-card')).toHaveCount(2);
  expect(requests.at(-1)).toMatchObject({ categoryId: 'category-home' });
  await page.getByRole('button', { name: 'Tất cả' }).click();
  await page.getByRole('searchbox', { name: /Tìm sản phẩm/ }).fill('tai nghe');
  await expect(page.locator('.product-card')).toHaveCount(1);
  expect(requests.at(-1)).toMatchObject({ search: 'tai nghe' });

  await page.getByRole('link', { name: /Tai nghe chụp tai/ }).click();
  await expect(page.getByRole('heading', { name: /Tai nghe chụp tai/ })).toBeVisible();
  await page.getByRole('button', { name: 'Màu xanh' }).click();
  await expect(page.getByText('1.590.000 ₫')).toBeVisible();
  await expect(page.getByText('Tạm hết hàng')).toBeVisible();
  await expect(page.getByRole('button', { name: /Thêm vào giỏ hàng/ })).toBeDisabled();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('storefront-product-out-of-stock.png', { fullPage: true });
  products.push({
    id: 'product-no-image',
    name: 'Sản phẩm mẫu không có ảnh',
    slug: 'unknown-no-image',
    status: 2,
    fromPrice: 450000,
    inStock: true,
    fulfillmentKind: 1,
    thumbnailMediaId: 'broken-catalog-image',
    categoryId: 'category-work',
  });
  await page
    .getByRole('navigation', { name: 'Điều hướng cửa hàng' })
    .getByRole('link', { name: 'Sản phẩm' })
    .click();
  await page.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' }).fill('không có ảnh');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-image-frame .product-image-empty')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('digital products require prepaid and display configured manual transfer instructions', async ({
  page,
}) => {
  let request: Record<string, unknown> | null = null;
  await installStorefront(page, 'digital', (body) => {
    request = body;
  });
  await reachCheckout(page);
  await verifyEmail(page);
  await page.getByLabel('Họ và tên').fill('Lê Minh Anh');
  await page.getByLabel('Số điện thoại').fill('0912345678');
  await expect(page.getByLabel(/Thu hộ tiền mặt khi nhận hàng/)).toBeDisabled();
  await page.getByRole('button', { name: /Đặt hàng ngay/ }).click();
  await expect(page.getByRole('heading', { name: /Đơn hàng #GUEST-1001/ })).toBeVisible();
  await expect(page.getByText('1234567890')).toBeVisible();
  await expect(page.getByText(/Nhân viên sẽ đối soát và xác nhận tiền thủ công/)).toBeVisible();
  expect(request).toMatchObject({
    paymentMethod: 1,
    email: 'buyer@example.test',
    expectedTotal: 123000,
    shippingAddress: null,
  });
});

test('409 keeps the cart and requires reviewing the updated server total before retry', async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await installStorefront(page, 'physical', (body) => requests.push(body), {
    firstCheckoutConflicts: true,
  });
  await reachCheckout(page);
  await verifyEmail(page);
  await page.getByLabel('Họ và tên').fill('Nguyễn Thị Bích Ngọc');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.getByLabel('Địa chỉ nhận hàng').fill('12 Đường Nguyễn Huệ, Đà Nẵng');
  await page.getByLabel(/Thu hộ tiền mặt khi nhận hàng/).check();
  await page.getByRole('button', { name: /Đặt hàng ngay/ }).click();
  await expect(page.getByText('Tổng tiền hoặc tồn kho đã thay đổi.')).toBeVisible();
  await expect(page.getByText('Áo thun thử nghiệm')).toBeVisible();
  await expect(page.getByRole('button', { name: /Đặt hàng ngay.*154\.000/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Tôi đã xem lại tổng mới' }).click();
  await page.getByRole('button', { name: /Đặt hàng ngay.*154\.000/ }).click();
  await expect(page.getByRole('heading', { name: /Đơn hàng #GUEST-1001/ })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0]['expectedTotal']).toBe(153000);
  expect(requests[1]['expectedTotal']).toBe(154000);
  expect(requests[1]['operationId']).not.toBe(requests[0]['operationId']);
});

test('prepaid checkout stays disabled until transfer settings are configured', async ({ page }) => {
  await installStorefront(page, 'digital', () => undefined, { bankTransferEnabled: false });
  await reachCheckout(page);
  await verifyEmail(page);
  await page.getByLabel('Họ và tên').fill('Lê Minh Anh');
  await page.getByLabel('Số điện thoại').fill('0912345678');
  await expect(page.getByText(/Chuyển khoản hiện chưa được cấu hình/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Đặt hàng ngay/ })).toBeDisabled();
});

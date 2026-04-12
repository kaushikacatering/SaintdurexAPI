import { InvoiceService } from './invoice.service';

describe('InvoiceService PDF delivery date', () => {
  it('renders delivery_date_time when delivery_date is missing', async () => {
    const dataSource = {
      query: jest.fn(async (query: string, params?: any[]) => {
        if (query.includes('FROM settings') && query.includes('setting_key')) {
          return [];
        }

        if (query.includes('FROM orders o') && query.includes('WHERE o.order_id = $1')) {
          return [
            {
              order_id: params?.[0],
              order_date: '2026-02-05T08:57:33.238Z',
              delivery_date: null,
              delivery_date_time: '2026-02-27T00:00:00.000Z',
              delivery_fee: '0.00',
              order_status: 1,
              payment_status: 'pending',
              payment_date: null,
              order_comments: null,
              delivery_address: 'Test Address',
              order_total: '10.00',
              customer_name: 'Test Customer',
              customer_email: 'test@example.com',
              customer_phone: '000',
              customer_type: 'Retail',
              company_name: null,
              company_abn: null,
              department_name: null,
              location_name: null,
              location_address: null,
              location_phone: null,
              coupon_id: null,
              stored_coupon_discount: '0.00',
              coupon_code: null,
              coupon_type: null,
              coupon_discount: null,
              delivery_method: null,
              delivery_contact: null,
              delivery_details: null,
              amount_paid: '0.00',
            },
          ];
        }

        if (query.includes('FROM order_product op') && query.includes('WHERE op.order_id = $1')) {
          return [
            {
              product_name: 'Prime',
              quantity: 1,
              price: '10.00',
              total: '10.00',
              order_product_id: 1,
              order_product_comment: null,
            },
          ];
        }

        if (query.includes('FROM order_product_option opo')) {
          return [];
        }

        throw new Error(`Unhandled query: ${query}`);
      }),
    } as any;

    const orderRepository = {} as any;
    const s3Service = {} as any;
    const configService = { get: jest.fn() } as any;

    const invoiceService = new InvoiceService(orderRepository, dataSource, s3Service, configService);
    const pdfBuffer = await invoiceService.getInvoicePDF(338);

    const pdfText = pdfBuffer.toString('latin1');
    expect(pdfText).toContain('Delivery Date:');
    expect(pdfText).toContain('27 Feb 2026');
    expect(pdfText).toContain('00:00');
  });
});


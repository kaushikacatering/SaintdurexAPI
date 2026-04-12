import { PricingService } from '../../common/services/pricing.service';
import { StoreProductsService } from './store-products.service';

describe('StoreProductsService.getProduct option pricing', () => {
  it('uses option wholesale_price for wholesale customers', async () => {
    const dataSource = {
      query: jest.fn(async (query: string, params?: any[]) => {
        if (query.includes('information_schema.columns') && query.includes("table_name = 'customer'")) {
          return [{ column_name: 'discount_percentage' }];
        }
        if (query.includes("FROM customer c") && query.includes('WHERE c.user_id = $1')) {
          return [{ customer_type: 'Wholesale', discount_percentage: null }];
        }
        if (query.trim() === 'SELECT customer_type FROM customer WHERE user_id = $1') {
          return [{ customer_type: 'Wholesale' }];
        }
        if (query.includes('FROM product p') && query.includes('WHERE p.product_id = $1')) {
          return [
            {
              product_id: params?.[0],
              product_name: 'Prime',
              product_price: '10.00',
              retail_price: '8.00',
              retail_discount_percentage: '0.00',
              user_price: null,
              product_status: 1,
              customer_type_visibility: 'all',
              product_images: [],
            },
          ];
        }
        if (query.includes('FROM category c') && query.includes('JOIN product_category')) {
          return [];
        }
        if (query.includes('FROM product_option po') && query.includes('JOIN option_value ov')) {
          return [
            {
              option_id: 6,
              option_name: 'Prime Size',
              option_value_id: 22,
              option_value: '250g',
              standard_price: '21.00',
              wholesale_price: '18.00',
              sort_order: 1,
              product_option_id: 46,
              required: 0,
              product_option_price_base: '21.00',
              product_option_price_prefix: '+',
              retail_discount_percentage: '0.00',
            },
          ];
        }
        if (query.trim() === 'SELECT customer_id FROM customer WHERE user_id = $1') {
          return [{ customer_id: 123 }];
        }
        if (query.includes('FROM customer_product_discount')) {
          return [];
        }
        if (query.includes('FROM customer_product_option_discount')) {
          return [];
        }
        throw new Error(`Unhandled query: ${query}`);
      }),
    } as any;

    const jwtService = {
      decode: jest.fn(() => ({ user_id: 1 })),
    } as any;

    const pricingService = new PricingService({} as any);
    const service = new StoreProductsService(dataSource, jwtService, pricingService);

    const result = await service.getProduct(189, 'Bearer token');

    expect(result.product.options[0].values[0].wholesale_price).toBe('18.00');
    expect(result.product.options[0].values[0].product_option_price).toBe(18);
    expect(result.product.options[0].values[0].original_option_price).toBe(18);
  });

  it('uses product_option_price for retail customers even when wholesale_price exists', async () => {
    const dataSource = {
      query: jest.fn(async (query: string, params?: any[]) => {
        if (query.includes('FROM product p') && query.includes('WHERE p.product_id = $1')) {
          return [
            {
              product_id: params?.[0],
              product_name: 'Prime',
              product_price: '10.00',
              retail_price: '8.00',
              retail_discount_percentage: '0.00',
              user_price: null,
              product_status: 1,
              customer_type_visibility: 'all',
              product_images: [],
            },
          ];
        }
        if (query.includes('FROM category c') && query.includes('JOIN product_category')) {
          return [];
        }
        if (query.includes('FROM product_option po') && query.includes('JOIN option_value ov')) {
          return [
            {
              option_id: 6,
              option_name: 'Prime Size',
              option_value_id: 22,
              option_value: '250g',
              standard_price: '0.00',
              wholesale_price: '18.00',
              sort_order: 1,
              product_option_id: 46,
              required: 0,
              product_option_price_base: '21.00',
              product_option_price_prefix: '+',
              retail_discount_percentage: '0.00',
            },
          ];
        }
        throw new Error(`Unhandled query: ${query}`);
      }),
    } as any;

    const jwtService = {
      decode: jest.fn(),
    } as any;

    const pricingService = new PricingService({} as any);
    const service = new StoreProductsService(dataSource, jwtService, pricingService);

    const result = await service.getProduct(189);

    expect(result.product.options[0].values[0].wholesale_price).toBe('18.00');
    expect(result.product.options[0].values[0].product_option_price).toBe(21);
    expect(result.product.options[0].values[0].original_option_price).toBe(21);
  });
});


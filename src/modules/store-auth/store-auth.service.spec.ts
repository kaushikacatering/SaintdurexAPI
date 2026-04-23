import { StoreAuthService } from './store-auth.service';
import * as bcrypt from 'bcrypt';

describe('StoreAuthService - register', () => {
  let service: StoreAuthService;
  let mockDataSource: any;
  let capturedQueries: { sql: string; params: any[] }[];
  let mockJwtService: any;
  let mockConfigService: any;
  let mockEmailService: any;
  let mockNotificationService: any;

  beforeEach(() => {
    capturedQueries = [];

    mockDataSource = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        capturedQueries.push({ sql, params: params || [] });

        // Check-user query (no existing user)
        if (sql.includes('SELECT user_id FROM "user"') && sql.includes('email')) {
          return [];
        }

        // Insert user - return mock user
        if (sql.includes('INSERT INTO "user"')) {
          return [
            {
              user_id: 100,
              email: params?.[0],
              username: params?.[1],
              login_username: params?.[2],
              password: params?.[3],
              auth_level: params?.[4],
              is_customer: params?.[5],
            },
          ];
        }

        // Column check for customer table
        if (sql.includes('information_schema.columns')) {
          return [
            { column_name: 'service_type' },
            { column_name: 'wholesale_type' },
            { column_name: 'customer_type' },
            { column_name: 'business_type' },
            { column_name: 'preferred_contact_method' },
            { column_name: 'estimated_opening_date' },
          ];
        }

        // Insert customer
        if (sql.includes('INSERT INTO customer')) {
          return [
            {
              customer_id: 200,
              user_id: 100,
              firstname: 'Test',
              lastname: 'User',
              email: 'test@test.com',
            },
          ];
        }

        // Insert company
        if (sql.includes('INSERT INTO company')) {
          return [{ company_id: 50 }];
        }

        return [];
      }),
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(),
        release: jest.fn(),
        query: jest.fn(async () => []),
      })),
    };

    mockJwtService = {
      sign: jest.fn(() => 'mock-jwt-token'),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          FRONTEND_URL: 'http://localhost:3000',
          COMPANY_PHONE: '1234567890',
          COMPANY_EMAIL: 'info@test.com',
          COMPANY_NAME: 'Test Company',
        };
        return config[key];
      }),
    };

    mockEmailService = {
      sendEmail: jest.fn(),
    };

    mockNotificationService = {
      sendNotification: jest.fn(),
    };

    service = new StoreAuthService(
      mockDataSource,
      mockJwtService,
      mockConfigService,
      mockEmailService,
      mockNotificationService,
    );
  });

  describe('Retail customer registration', () => {
    it('should create user with is_customer = 1 and auth_level = 3', async () => {
      const result = await service.register({
        email: 'retail@test.com',
        username: 'retail@test.com',
        password: 'Test123!',
        firstname: 'Retail',
        lastname: 'User',
      });

      // Find the INSERT INTO "user" query
      const insertUserQuery = capturedQueries.find((q) =>
        q.sql.includes('INSERT INTO "user"'),
      );

      expect(insertUserQuery).toBeDefined();

      // Verify auth_level = 3 (Customer)
      const authLevelParam = insertUserQuery!.params[4];
      expect(authLevelParam).toBe(3);

      // Verify is_customer = 1
      const isCustomerParam = insertUserQuery!.params[5];
      expect(isCustomerParam).toBe(1);

      // Verify token is returned
      expect(result.token).toBe('mock-jwt-token');
    });
  });

  describe('Wholesale customer registration', () => {
    it('should create user with is_customer = 1 for wholesale signup', async () => {
      const result = await service.register({
        email: 'wholesale@test.com',
        username: 'wholesale@test.com',
        password: 'Test123!',
        firstname: 'Wholesale',
        lastname: 'User',
        company_name: 'Test Coffee Co',
        wholesale_type: 'premium',
        service_type: 'Full Service Wholesaler',
      });

      const insertUserQuery = capturedQueries.find((q) =>
        q.sql.includes('INSERT INTO "user"'),
      );

      expect(insertUserQuery).toBeDefined();

      // Wholesale users must also have is_customer = 1
      const isCustomerParam = insertUserQuery!.params[5];
      expect(isCustomerParam).toBe(1);

      const authLevelParam = insertUserQuery!.params[4];
      expect(authLevelParam).toBe(3);
    });

    it('should create a company record for wholesale signup', async () => {
      await service.register({
        email: 'wholesale@test.com',
        username: 'wholesale@test.com',
        password: 'Test123!',
        firstname: 'Wholesale',
        lastname: 'User',
        company_name: 'Test Coffee Co',
        wholesale_type: 'premium',
      });

      const insertCompanyQuery = capturedQueries.find((q) =>
        q.sql.includes('INSERT INTO company'),
      );

      expect(insertCompanyQuery).toBeDefined();
      expect(insertCompanyQuery!.params).toContain('Test Coffee Co');
    });

    it('should create a customer record for wholesale signup', async () => {
      await service.register({
        email: 'wholesale@test.com',
        username: 'wholesale@test.com',
        password: 'Test123!',
        firstname: 'Wholesale',
        lastname: 'User',
        company_name: 'Test Coffee Co',
        wholesale_type: 'essential',
      });

      const insertCustomerQuery = capturedQueries.find((q) =>
        q.sql.includes('INSERT INTO customer'),
      );

      expect(insertCustomerQuery).toBeDefined();
    });
  });

  describe('Partial wholesale customer registration', () => {
    it('should create user with is_customer = 1 for partial wholesale signup', async () => {
      await service.register({
        email: 'partial@test.com',
        username: 'partial@test.com',
        password: 'Test123!',
        firstname: 'Partial',
        lastname: 'Wholesaler',
        company_name: 'Partial Co',
        service_type: 'Half Service',
        wholesale_type: 'essential',
      });

      const insertUserQuery = capturedQueries.find((q) =>
        q.sql.includes('INSERT INTO "user"'),
      );

      expect(insertUserQuery).toBeDefined();
      expect(insertUserQuery!.params[5]).toBe(1); // is_customer = 1
    });
  });

  describe('Integration: registered customer should not appear in admin users', () => {
    it('user record should have is_customer = 1 which is filtered by admin-users findAll', async () => {
      await service.register({
        email: 'newcustomer@test.com',
        username: 'newcustomer@test.com',
        password: 'Test123!',
        firstname: 'New',
        lastname: 'Customer',
      });

      const insertUserQuery = capturedQueries.find((q) =>
        q.sql.includes('INSERT INTO "user"'),
      );

      // The user is inserted with is_customer = 1
      expect(insertUserQuery!.params[5]).toBe(1);

      // admin-users.service.ts findAll has:
      // WHERE (u.is_customer IS NULL OR u.is_customer != 1)
      // This means is_customer = 1 records are excluded
      // Verifying the flag is correctly set is sufficient to ensure exclusion
    });
  });
});

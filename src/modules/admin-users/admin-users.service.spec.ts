import { AdminUsersService } from './admin-users.service';
import { AuthLevel } from '../../common/roles/role-permissions';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let mockDataSource: any;
  let capturedQueries: { sql: string; params: any[] }[];

  beforeEach(() => {
    capturedQueries = [];

    mockDataSource = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        capturedQueries.push({ sql, params: params || [] });

        // Default: return empty results for SELECT queries
        if (sql.includes('SELECT COUNT')) {
          return [{ count: '0' }];
        }
        return [];
      }),
    };

    service = new AdminUsersService(mockDataSource);
  });

  describe('findAll - is_customer filter', () => {
    it('should exclude storefront customers (is_customer=1) from the main query', async () => {
      await service.findAll({});

      const mainQuery = capturedQueries.find(
        (q) => q.sql.includes('SELECT') && !q.sql.includes('COUNT'),
      );

      expect(mainQuery).toBeDefined();
      expect(mainQuery!.sql).toContain(
        'u.is_customer IS NULL OR u.is_customer != 1',
      );
    });

    it('should exclude storefront customers (is_customer=1) from the count query', async () => {
      await service.findAll({});

      const countQuery = capturedQueries.find((q) =>
        q.sql.includes('SELECT COUNT'),
      );

      expect(countQuery).toBeDefined();
      expect(countQuery!.sql).toContain(
        'is_customer IS NULL OR is_customer != 1',
      );
    });

    it('should not return users where is_customer = 1', async () => {
      // Simulate DB returning mixed users (admin + customer)
      mockDataSource.query = jest.fn(async (sql: string) => {
        if (sql.includes('SELECT COUNT')) {
          return [{ count: '1' }];
        }
        // Only admin users should come back from DB since query filters is_customer
        return [
          {
            user_id: 1,
            email: 'admin@test.com',
            username: 'admin',
            auth_level: AuthLevel.ADMIN,
            role_id: null,
            company_name: null,
            account_email: null,
            created_at: new Date(),
            updated_at: new Date(),
            is_customer: null,
          },
        ];
      });

      const result = await service.findAll({}, AuthLevel.SUPER_ADMIN);

      expect(result.users).toHaveLength(1);
      expect(result.users[0].username).toBe('admin');
    });

    it('should still apply search filters alongside is_customer filter', async () => {
      await service.findAll({ search: 'test' });

      const mainQuery = capturedQueries.find(
        (q) => q.sql.includes('SELECT') && !q.sql.includes('COUNT'),
      );

      expect(mainQuery!.sql).toContain(
        'u.is_customer IS NULL OR u.is_customer != 1',
      );
      expect(mainQuery!.sql).toContain('username ILIKE');
    });

    it('should apply role-based filtering alongside is_customer filter', async () => {
      await service.findAll({}, AuthLevel.ADMIN);

      const mainQuery = capturedQueries.find(
        (q) => q.sql.includes('SELECT') && !q.sql.includes('COUNT'),
      );

      expect(mainQuery!.sql).toContain(
        'u.is_customer IS NULL OR u.is_customer != 1',
      );
      expect(mainQuery!.sql).toContain('auth_level >=');
    });
  });
});

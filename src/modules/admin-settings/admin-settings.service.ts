import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Ensure settings table exists and has default values
   */
  private async ensureSettingsTableExists(): Promise<void> {
    try {
      // Check if table exists
      const tableCheck = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'settings'
        ) as exists
      `);

      if (!tableCheck[0]?.exists) {
        this.logger.log('Creating settings table...');

        // Create table
        await this.dataSource.query(`
          CREATE TABLE settings (
            setting_id SERIAL PRIMARY KEY,
            setting_key VARCHAR(255) UNIQUE NOT NULL,
            setting_value TEXT,
            setting_category VARCHAR(100) DEFAULT 'general',
            setting_type VARCHAR(50) DEFAULT 'string',
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create indexes
        await this.dataSource.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key)
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(setting_category)
        `);

        this.logger.log('Settings table created successfully');
      }

      // Insert default settings if they don't exist
      const defaultSettings = [
        // Payment settings
        { key: 'stripe_secret_key', value: '', category: 'payment', type: 'string', description: 'Stripe API Secret Key' },
        { key: 'stripe_publishable_key', value: '', category: 'payment', type: 'string', description: 'Stripe Publishable Key' },
        { key: 'stripe_test_mode', value: 'true', category: 'payment', type: 'boolean', description: 'Enable Stripe Test Mode' },
        { key: 'stripe_webhook_secret', value: '', category: 'payment', type: 'string', description: 'Stripe Webhook Secret' },
        // Email settings
        { key: 'smtp_host', value: '', category: 'email', type: 'string', description: 'SMTP Server Host' },
        { key: 'smtp_port', value: '587', category: 'email', type: 'number', description: 'SMTP Server Port' },
        { key: 'smtp_user', value: '', category: 'email', type: 'string', description: 'SMTP Username' },
        { key: 'smtp_password', value: '', category: 'email', type: 'string', description: 'SMTP Password' },
        { key: 'smtp_from_email', value: '', category: 'email', type: 'string', description: 'From Email Address' },
        { key: 'smtp_from_name', value: 'St Dreux Coffee', category: 'email', type: 'string', description: 'From Name' },
        { key: 'smtp_secure', value: 'false', category: 'email', type: 'boolean', description: 'Use SSL/TLS' },
        // General settings
        { key: 'company_name', value: 'St Dreux Coffee Roasters', category: 'general', type: 'string', description: 'Company Name' },
        { key: 'company_email', value: '', category: 'general', type: 'string', description: 'Company Email' },
        { key: 'company_phone', value: '', category: 'general', type: 'string', description: 'Company Phone' },
        { key: 'company_address', value: '', category: 'general', type: 'string', description: 'Company Address' },
        { key: 'company_abn', value: '', category: 'general', type: 'string', description: 'Company ABN' },
        { key: 'gst_rate', value: '10', category: 'general', type: 'number', description: 'GST Rate (%)' },
        { key: 'default_delivery_fee', value: '0', category: 'general', type: 'number', description: 'Default Delivery Fee' },
      ];

      for (const setting of defaultSettings) {
        await this.dataSource.query(
          `INSERT INTO settings (setting_key, setting_value, setting_category, setting_type, description)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (setting_key) DO NOTHING`,
          [setting.key, setting.value, setting.category, setting.type, setting.description],
        );
      }
    } catch (error) {
      this.logger.error('Error ensuring settings table exists:', error);
      throw error;
    }
  }

  async findAll(category?: string): Promise<any> {
    // Ensure table exists before querying
    await this.ensureSettingsTableExists();
    let query = 'SELECT setting_key, setting_value, setting_category, setting_type FROM settings';
    const params: any[] = [];

    if (category) {
      query += ' WHERE setting_category = $1';
      params.push(category);
    }

    query += ' ORDER BY setting_category, setting_key';

    const result = await this.dataSource.query(query, params);

    const settings: Record<string, any> = {};
    const settingsByCategory: Record<string, Record<string, any>> = {};

    result.forEach((row: any) => {
      let value: any = row.setting_value;

      if (row.setting_type === 'boolean') {
        value = row.setting_value === 'true' || row.setting_value === '1';
      } else if (row.setting_type === 'number') {
        value = parseFloat(row.setting_value) || 0;
      } else if (row.setting_type === 'json') {
        try {
          value = JSON.parse(row.setting_value);
        } catch {
          value = row.setting_value;
        }
      }

      const camelKey = row.setting_key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

      settings[camelKey] = value;

      if (!settingsByCategory[row.setting_category]) {
        settingsByCategory[row.setting_category] = {};
      }
      settingsByCategory[row.setting_category][camelKey] = value;
    });

    return { settings, settingsByCategory };
  }

  async update(settings: any): Promise<any> {
    if (!settings || typeof settings !== 'object') {
      throw new BadRequestException('Settings object is required');
    }

    // Ensure table exists before updating
    await this.ensureSettingsTableExists();

    return this.dataSource.transaction(async (manager) => {
      for (const [camelKey, value] of Object.entries(settings)) {
        const snakeKey = camelKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        const typeResult = await manager.query('SELECT setting_type FROM settings WHERE setting_key = $1', [snakeKey]);

        if (typeResult.length === 0) {
          // Key doesn't exist yet - insert it as a new string setting
          const stringValue = value === null || value === undefined ? '' : String(value);
          const category = snakeKey.startsWith('smtp_') ? 'email' : 
                           snakeKey.startsWith('stripe_') ? 'payment' : 'general';
          await manager.query(
            `INSERT INTO settings (setting_key, setting_value, setting_category, setting_type, description)
             VALUES ($1, $2, $3, 'string', $4)
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
            [snakeKey, stringValue, category, camelKey]
          );
          continue;
        }

        const settingType = typeResult[0].setting_type;
        let stringValue: string;

        if (settingType === 'boolean') {
          stringValue = value ? 'true' : 'false';
        } else if (settingType === 'number') {
          stringValue = String(value);
        } else if (settingType === 'json') {
          stringValue = JSON.stringify(value);
        } else {
          stringValue = String(value);
        }

        await manager.query('UPDATE settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2', [stringValue, snakeKey]);
      }

      const result = await manager.query('SELECT setting_key, setting_value, setting_category, setting_type FROM settings ORDER BY setting_category, setting_key');

      const updatedSettings: Record<string, any> = {};
      result.forEach((row: any) => {
        let value: any = row.setting_value;

        if (row.setting_type === 'boolean') {
          value = row.setting_value === 'true' || row.setting_value === '1';
        } else if (row.setting_type === 'number') {
          value = parseFloat(row.setting_value) || 0;
        } else if (row.setting_type === 'json') {
          try {
            value = JSON.parse(row.setting_value);
          } catch {
            value = row.setting_value;
          }
        }

        const camelKey = row.setting_key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
        updatedSettings[camelKey] = value;
      });

      return { settings: updatedSettings, message: 'Settings updated successfully' };
    });
  }

  async getSystemHealth(): Promise<any> {
    const dbCheck = await this.dataSource.query('SELECT NOW() as current_time');
    const dbConnected = !!dbCheck[0];

    const dbStats = await this.dataSource.query(`
      SELECT 
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM customer) as total_customers,
        (SELECT COUNT(*) FROM product) as total_products,
        (SELECT COUNT(*) FROM company) as total_companies
    `);

    return {
      database: {
        connected: dbConnected,
        currentTime: dbCheck[0]?.current_time,
      },
      stats: {
        orders: parseInt(dbStats[0]?.total_orders || '0'),
        customers: parseInt(dbStats[0]?.total_customers || '0'),
        products: parseInt(dbStats[0]?.total_products || '0'),
        companies: parseInt(dbStats[0]?.total_companies || '0'),
      },
      system: {
        cpuUsage: Math.floor(Math.random() * 30) + 20,
        memoryUsage: Math.floor(Math.random() * 30) + 60,
        diskUsage: Math.floor(Math.random() * 20) + 40,
      },
    };
  }
}

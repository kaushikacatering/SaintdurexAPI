import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationService } from '../../common/services/notification.service';
import { ConfigService } from '@nestjs/config';

interface SubscriptionSchedule {
  schedule_id: number;
  subscription_order_id: number;
  next_delivery_date: Date | null;
  frequency_days: number;
  is_active: boolean;
  is_paused: boolean;
  paused_at: Date | null;
  resume_date: Date | null;
  last_generated_order_id: number | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class StoreSubscriptionsService {
  private readonly logger = new Logger(StoreSubscriptionsService.name);
  private tablesChecked = false;
  private tablesExist = false;

  constructor(
    private dataSource: DataSource,
    private notificationService: NotificationService,
    private configService: ConfigService,
  ) { }

  /**
   * Ensure future_orders and subscription_schedules tables exist
   */
  private async ensureTablesExist(): Promise<boolean> {
    if (this.tablesChecked) return this.tablesExist;

    try {
      // Check if future_orders table exists
      const futureOrdersCheck = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'future_orders'
        ) as exists
      `);

      if (!futureOrdersCheck[0]?.exists) {
        // Create future_orders table
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS future_orders (
            future_order_id SERIAL PRIMARY KEY,
            subscription_order_id INT NOT NULL,
            scheduled_delivery_date TIMESTAMP NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            generated_order_id INT,
            generated_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subscription_order_id, scheduled_delivery_date)
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_future_orders_subscription ON future_orders(subscription_order_id)
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_future_orders_status ON future_orders(status)
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_future_orders_date ON future_orders(scheduled_delivery_date)
        `);
        this.logger.log('Created future_orders table');
      }

      // Check if subscription_schedules table exists
      const schedulesCheck = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'subscription_schedules'
        ) as exists
      `);

      if (!schedulesCheck[0]?.exists) {
        // Create subscription_schedules table
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS subscription_schedules (
            schedule_id SERIAL PRIMARY KEY,
            subscription_order_id INT NOT NULL UNIQUE,
            next_delivery_date TIMESTAMP,
            frequency_days INT NOT NULL,
            is_active BOOLEAN DEFAULT true,
            is_paused BOOLEAN DEFAULT false,
            paused_at TIMESTAMP,
            resume_date TIMESTAMP,
            last_generated_order_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_subscription_schedules_order ON subscription_schedules(subscription_order_id)
        `);
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_subscription_schedules_active ON subscription_schedules(is_active)
        `);
        this.logger.log('Created subscription_schedules table');
      }

      this.tablesExist = true;
      this.tablesChecked = true;
      return true;
    } catch (error) {
      this.logger.error('Error ensuring subscription tables exist:', error);
      this.tablesChecked = true;
      this.tablesExist = false;
      return false;
    }
  }

  /**
   * Helper to get customer_id from user_id
   */
  private async getCustomerId(userId: number): Promise<number> {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);

    if (customerResult.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    return customerResult[0].customer_id;
  }

  /**
   * Helper to verify subscription belongs to customer
   */
  private async verifySubscriptionOwnership(subscriptionId: number, customerId: number): Promise<any> {
    const query = `
      SELECT * FROM orders
      WHERE order_id = $1 AND customer_id = $2 AND standing_order != 0
    `;
    const result = await this.dataSource.query(query, [Number(subscriptionId), customerId]);

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    return result[0];
  }

  /**
   * List user's subscriptions (standing orders)
   */
  async listSubscriptions(userId: number) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Get customer_id from user_id
    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);

    if (customerResult.length === 0) {
      return { subscriptions: [], count: 0 };
    }

    const customerId = customerResult[0].customer_id;

    const query = `
      SELECT 
        o.order_id,
        o.order_status,
        o.order_total,
        o.delivery_fee,
        o.date_added,
        o.date_modified,
        o.delivery_date_time,
        o.customer_order_name,
        o.order_comments,
        o.delivery_address,
        o.standing_order,
        ss.next_delivery_date as schedule_next_date,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'product_image', p.product_image,
            'options', COALESCE((
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity
              ))
              FROM order_product_option opo
              WHERE opo.order_product_id = op.order_product_id
            ), '[]'::json)
          ))
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ) as products
      FROM orders o
      LEFT JOIN subscription_schedules ss ON o.order_id = ss.subscription_order_id
      WHERE o.customer_id = $1 AND o.standing_order != 0
      ORDER BY o.date_added DESC
    `;

    const result = await this.dataSource.query(query, [customerId]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM orders o
      WHERE o.customer_id = $1 AND o.standing_order != 0
    `;
    const countResult = await this.dataSource.query(countQuery, [customerId]);
    const count = parseInt(countResult[0].count);

    const now = new Date();
    const reminderThreshold = 3; // days

    const subscriptions = (result || []).map((row: any) => {
      const totalVal = parseFloat(row.order_total || '0');
      const deliveryFeeVal = parseFloat(row.delivery_fee || '0');
      const taxablePortion = totalVal - deliveryFeeVal;
      const gstVal = 0; // GST removed as per primary objective

      const weeks = Math.round(row.standing_order / 7) || 1;
      let reminder: string | null = null;

      // Determine the next delivery date to check against
      const nextDate = row.schedule_next_date ? new Date(row.schedule_next_date) : (row.delivery_date_time ? new Date(row.delivery_date_time) : null);

      if (nextDate) {
        const timeDiff = nextDate.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // Only show reminder if within threshold (and not in the past)
        if (daysDiff <= reminderThreshold && daysDiff >= -1) {
          reminder = `Next payment will be after ${weeks} week${weeks > 1 ? 's' : ''}`;
        }
      }

      return {
        ...row,
        status_name: row.order_status === 5 ? 'Completed' : (row.order_status === 1 ? 'New' : (row.order_status === 2 ? 'Paid' : (row.order_status === 4 ? 'Awaiting Approval' : (row.order_status === 7 ? 'Approved' : 'Updated')))),
        gst: gstVal.toFixed(4),
        reminder,
      };
    });

    return { subscriptions, count };
  }

  /**
   * Get single subscription
   */
  async getSubscription(userId: number, subscriptionId: number) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Get customer_id from user_id
    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);

    if (customerResult.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    const customerId = customerResult[0].customer_id;

    const query = `
      SELECT 
        o.*,
        ss.next_delivery_date as schedule_next_date,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'product_image', p.product_image,
            'options', COALESCE((
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity
              ))
              FROM order_product_option opo
              WHERE opo.order_product_id = op.order_product_id
            ), '[]'::json)
          ))
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ) as products
      FROM orders o
      LEFT JOIN subscription_schedules ss ON o.order_id = ss.subscription_order_id
      WHERE o.order_id = $1 AND o.customer_id = $2 AND o.standing_order != 0
    `;

    const result = await this.dataSource.query(query, [Number(subscriptionId), customerId]);

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    const subscription = result[0];
    const totalVal = parseFloat(subscription.order_total || '0');
    const deliveryFeeVal = parseFloat(subscription.delivery_fee || '0');
    const taxablePortion = totalVal - deliveryFeeVal;
    const gstVal = 0; // GST removed as per primary objective

    const weeks = Math.round(subscription.standing_order / 7) || 1;

    // Reminder logic: only within 3 days of next delivery
    const now = new Date();
    const reminderThreshold = 3;
    let reminder: string | null = null;
    const nextDate = subscription.schedule_next_date ? new Date(subscription.schedule_next_date) : (subscription.delivery_date_time ? new Date(subscription.delivery_date_time) : null);

    if (nextDate) {
      const timeDiff = nextDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      if (daysDiff <= reminderThreshold && daysDiff >= -1) {
        reminder = `Next payment will be after ${weeks} week${weeks > 1 ? 's' : ''}`;
      }
    }

    subscription.reminder = reminder;
    subscription.gst = gstVal.toFixed(4);
    subscription.status_name = subscription.order_status === 5 ? 'Completed' : (subscription.order_status === 1 ? 'New' : (subscription.order_status === 2 ? 'Paid' : (subscription.order_status === 4 ? 'Awaiting Approval' : (subscription.order_status === 7 ? 'Approved' : 'Updated'))));

    return { subscription };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: number, subscriptionId: number) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Get customer_id from user_id
    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);

    if (customerResult.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    const customerId = customerResult[0].customer_id;

    // Verify subscription belongs to customer
    const verifyQuery = `
      SELECT order_id FROM orders 
      WHERE order_id = $1 AND customer_id = $2 AND standing_order != 0
    `;
    const verifyResult = await this.dataSource.query(verifyQuery, [Number(subscriptionId), customerId]);

    if (verifyResult.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    // Cancel subscription (set status to 0 - cancelled)
    const updateQuery = `
      UPDATE orders 
      SET order_status = 0, date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $1
      RETURNING *
    `;
    const result = await this.dataSource.query(updateQuery, [Number(subscriptionId)]);

    // Cancel future orders for this subscription
    try {
      const cancelFutureOrdersQuery = `
        UPDATE future_orders
        SET status = 'cancelled'
        WHERE subscription_order_id = $1 AND status = 'pending'
      `;
      await this.dataSource.query(cancelFutureOrdersQuery, [Number(subscriptionId)]);

      // Deactivate schedule
      const deactivateScheduleQuery = `
        UPDATE subscription_schedules
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE subscription_order_id = $1
      `;
      await this.dataSource.query(deactivateScheduleQuery, [Number(subscriptionId)]);
    } catch (error) {
      // Log error but don't fail the cancellation if future orders table doesn't exist
      this.logger.warn('Failed to cancel future orders (table may not exist):', error);
    }

    // Send cancellation email to customer
    try {
      const infoQuery = `
        SELECT 
          c.email as customer_email,
          COALESCE(c.firstname || ' ' || c.lastname, u.username) as customer_name
        FROM orders o
        JOIN customer c ON o.customer_id = c.customer_id
        JOIN "user" u ON c.user_id = u.user_id
        WHERE o.order_id = $1
      `;
      const infoResult = await this.dataSource.query(infoQuery, [Number(subscriptionId)]);
      const info = infoResult[0];
      if (info?.customer_email) {
        const companyName = this.configService.get<string>('COMPANY_NAME') || 'St Dreux Coffee';
        const contactNumber = this.configService.get<string>('COMPANY_PHONE') || '';
        const contactEmail = this.configService.get<string>('COMPANY_EMAIL') || '';
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
        const loginUrl = `${frontendUrl}/auth/login`;

        await this.notificationService.sendNotification({
          templateKey: 'subscription_cancelled',
          recipientEmail: info.customer_email,
          recipientName: info.customer_name || 'Customer',
          variables: {},
          customSubject: 'Subscription Cancelled – St Dreux Coffee',
          customBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2952E6; color: #ffffff !important; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${companyName}</h1>
    </div>
    <div class="content">
      <p>Dear ${info.customer_name || 'Customer'},</p>
      <p>This email confirms that your subscription has been cancelled.</p>
      <p>You will continue to have access to your account until the end of your current subscription period.</p>
      <p>If you wish to reactivate your subscription, please contact our admin team on ${contactNumber}.</p>
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button" style="color: #ffffff !important; text-decoration: none; display: inline-block;">
          <span style="color: #ffffff !important; text-decoration: none;">Login Here</span>
        </a>
      </div>
      <p>If you have any questions, please contact us at ${contactNumber} or ${contactEmail}.</p>
      <p>Kind regards,<br/>${companyName} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
          `,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to send subscription cancelled email:', error);
    }

    return {
      message: 'Subscription cancelled successfully',
      subscription: result[0],
    };
  }

  /**
   * Update subscription (frequency, delivery time, address)
   */
  async updateSubscription(
    userId: number,
    subscriptionId: number,
    updateData: {
      standing_order?: number;
      delivery_date_time?: string;
      delivery_address?: string;
      order_comments?: string;
    },
  ) {
    const customerId = await this.getCustomerId(userId);
    await this.verifySubscriptionOwnership(subscriptionId, customerId);

    const { standing_order, delivery_date_time, delivery_address, order_comments } = updateData;

    // Build dynamic update query
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (standing_order !== undefined && standing_order > 0) {
      updateFields.push(`standing_order = $${paramIndex++}`);
      params.push(standing_order);
    }
    if (delivery_date_time !== undefined) {
      updateFields.push(`delivery_date_time = $${paramIndex++}`);
      params.push(new Date(delivery_date_time));
    }
    if (delivery_address !== undefined) {
      updateFields.push(`delivery_address = $${paramIndex++}`);
      params.push(delivery_address);
    }
    if (order_comments !== undefined) {
      updateFields.push(`order_comments = $${paramIndex++}`);
      params.push(order_comments);
    }

    if (updateFields.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updateFields.push('date_modified = CURRENT_TIMESTAMP');
    params.push(Number(subscriptionId));

    const updateQuery = `
      UPDATE orders
      SET ${updateFields.join(', ')}
      WHERE order_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.dataSource.query(updateQuery, params);

    // Update subscription schedule if frequency changed
    if (standing_order && standing_order > 0) {
      await this.ensureTablesExist();
      try {
        await this.dataSource.query(`
          UPDATE subscription_schedules
          SET frequency_days = $1, updated_at = CURRENT_TIMESTAMP
          WHERE subscription_order_id = $2
        `, [standing_order, Number(subscriptionId)]);
      } catch (error) {
        this.logger.warn('Failed to update subscription schedule:', error);
      }
    }

    return {
      message: 'Subscription updated successfully',
      subscription: result[0],
    };
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(userId: number, subscriptionId: number, resumeDate?: string) {
    const customerId = await this.getCustomerId(userId);
    await this.verifySubscriptionOwnership(subscriptionId, customerId);

    // Update order status to paused (using status 9 for paused, or keep active but mark schedule paused)
    const updateQuery = `
      UPDATE orders
      SET date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $1
      RETURNING *
    `;
    const result = await this.dataSource.query(updateQuery, [Number(subscriptionId)]);

    // Update subscription schedule to paused
    await this.ensureTablesExist();
    try {
      // Check if schedule exists
      const scheduleCheck = await this.dataSource.query(`
        SELECT schedule_id FROM subscription_schedules WHERE subscription_order_id = $1
      `, [Number(subscriptionId)]);

      if (scheduleCheck.length > 0) {
        await this.dataSource.query(`
          UPDATE subscription_schedules
          SET is_paused = true,
              paused_at = CURRENT_TIMESTAMP,
              resume_date = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE subscription_order_id = $2
        `, [resumeDate ? new Date(resumeDate) : null, Number(subscriptionId)]);
      } else {
        // Create schedule entry as paused
        const subscription = result[0];
        await this.dataSource.query(`
          INSERT INTO subscription_schedules (
            subscription_order_id, frequency_days, is_active, is_paused, paused_at, resume_date
          ) VALUES ($1, $2, true, true, CURRENT_TIMESTAMP, $3)
        `, [Number(subscriptionId), subscription.standing_order, resumeDate ? new Date(resumeDate) : null]);
      }

      // Cancel pending future orders (they will be regenerated when resumed)
      await this.dataSource.query(`
        UPDATE future_orders
        SET status = 'paused'
        WHERE subscription_order_id = $1 AND status = 'pending'
      `, [Number(subscriptionId)]);
    } catch (error) {
      this.logger.warn('Failed to pause subscription schedule:', error);
    }

    return {
      message: 'Subscription paused successfully',
      subscription: result[0],
      resume_date: resumeDate || null,
    };
  }

  /**
   * Resume/reactivate subscription
   */
  async resumeSubscription(userId: number, subscriptionId: number) {
    const customerId = await this.getCustomerId(userId);
    const subscription = await this.verifySubscriptionOwnership(subscriptionId, customerId);

    // Check if subscription is cancelled (status 0)
    const isCancelled = subscription.order_status === 0;

    // Reactivate order if cancelled
    if (isCancelled) {
      await this.dataSource.query(`
        UPDATE orders
        SET order_status = 7, date_modified = CURRENT_TIMESTAMP
        WHERE order_id = $1
      `, [Number(subscriptionId)]);
    }

    // Update subscription schedule
    await this.ensureTablesExist();
    try {
      // Check if schedule exists
      const scheduleCheck = await this.dataSource.query(`
        SELECT schedule_id FROM subscription_schedules WHERE subscription_order_id = $1
      `, [Number(subscriptionId)]);

      if (scheduleCheck.length > 0) {
        await this.dataSource.query(`
          UPDATE subscription_schedules
          SET is_active = true,
              is_paused = false,
              paused_at = NULL,
              resume_date = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE subscription_order_id = $1
        `, [Number(subscriptionId)]);
      } else {
        // Create schedule entry
        await this.dataSource.query(`
          INSERT INTO subscription_schedules (
            subscription_order_id, frequency_days, is_active, is_paused, next_delivery_date
          ) VALUES ($1, $2, true, false, $3)
        `, [Number(subscriptionId), subscription.standing_order, subscription.delivery_date_time]);
      }

      // Reactivate paused future orders
      await this.dataSource.query(`
        UPDATE future_orders
        SET status = 'pending'
        WHERE subscription_order_id = $1 AND status = 'paused'
      `, [Number(subscriptionId)]);
    } catch (error) {
      this.logger.warn('Failed to resume subscription schedule:', error);
    }

    // Get updated subscription
    const updatedResult = await this.dataSource.query(`
      SELECT * FROM orders WHERE order_id = $1
    `, [Number(subscriptionId)]);

    return {
      message: 'Subscription resumed successfully',
      subscription: updatedResult[0],
    };
  }

  /**
   * Get upcoming deliveries for a subscription
   */
  async getUpcomingDeliveries(userId: number, subscriptionId: number, limit: number = 10) {
    const customerId = await this.getCustomerId(userId);
    await this.verifySubscriptionOwnership(subscriptionId, customerId);

    await this.ensureTablesExist();

    try {
      const query = `
        SELECT
          fo.future_order_id,
          fo.scheduled_delivery_date,
          fo.status,
          fo.created_at
        FROM future_orders fo
        WHERE fo.subscription_order_id = $1
          AND fo.status IN ('pending', 'paused')
          AND fo.scheduled_delivery_date >= CURRENT_DATE
        ORDER BY fo.scheduled_delivery_date ASC
        LIMIT $2
      `;

      const result = await this.dataSource.query(query, [Number(subscriptionId), limit]);

      // If no future orders exist, generate estimated dates based on frequency
      if (result.length === 0) {
        const subscriptionQuery = await this.dataSource.query(`
          SELECT standing_order, delivery_date_time FROM orders WHERE order_id = $1
        `, [Number(subscriptionId)]);

        if (subscriptionQuery.length > 0) {
          const subscription = subscriptionQuery[0];
          const frequency = subscription.standing_order;
          const startDate = new Date(subscription.delivery_date_time);
          const now = new Date();

          // Calculate next delivery dates
          const upcomingDates: any[] = [];
          let currentDate = new Date(startDate);

          // Move to next occurrence after today
          while (currentDate <= now) {
            currentDate.setDate(currentDate.getDate() + frequency);
          }

          // Generate upcoming dates
          for (let i = 0; i < limit && i < 12; i++) {
            upcomingDates.push({
              future_order_id: null,
              scheduled_delivery_date: new Date(currentDate).toISOString(),
              status: 'estimated',
              created_at: null,
            });
            currentDate.setDate(currentDate.getDate() + frequency);
          }

          return {
            upcoming_deliveries: upcomingDates,
            count: upcomingDates.length,
            note: 'These are estimated delivery dates. Actual orders will be generated closer to the date.',
          };
        }
      }

      return {
        upcoming_deliveries: result,
        count: result.length,
      };
    } catch (error) {
      this.logger.warn('Failed to get upcoming deliveries:', error);

      // Fallback: calculate from subscription data
      const subscriptionQuery = await this.dataSource.query(`
        SELECT standing_order, delivery_date_time FROM orders WHERE order_id = $1
      `, [Number(subscriptionId)]);

      if (subscriptionQuery.length > 0) {
        const subscription = subscriptionQuery[0];
        const frequency = subscription.standing_order;
        const startDate = new Date(subscription.delivery_date_time);
        const now = new Date();

        const upcomingDates: any[] = [];
        let currentDate = new Date(startDate);

        while (currentDate <= now) {
          currentDate.setDate(currentDate.getDate() + frequency);
        }

        for (let i = 0; i < limit && i < 12; i++) {
          upcomingDates.push({
            future_order_id: null,
            scheduled_delivery_date: new Date(currentDate).toISOString(),
            status: 'estimated',
          });
          currentDate.setDate(currentDate.getDate() + frequency);
        }

        return {
          upcoming_deliveries: upcomingDates,
          count: upcomingDates.length,
        };
      }

      return { upcoming_deliveries: [], count: 0 };
    }
  }

  /**
   * Skip a specific delivery
   */
  async skipDelivery(userId: number, subscriptionId: number, deliveryDate: string) {
    const customerId = await this.getCustomerId(userId);
    await this.verifySubscriptionOwnership(subscriptionId, customerId);

    if (!deliveryDate) {
      throw new BadRequestException('Delivery date is required');
    }

    await this.ensureTablesExist();

    try {
      // Try to find and skip existing future order
      const updateResult = await this.dataSource.query(`
        UPDATE future_orders
        SET status = 'skipped'
        WHERE subscription_order_id = $1
          AND DATE(scheduled_delivery_date) = DATE($2)
          AND status = 'pending'
        RETURNING *
      `, [Number(subscriptionId), new Date(deliveryDate)]);

      if (updateResult.length > 0) {
        return {
          message: 'Delivery skipped successfully',
          skipped_delivery: updateResult[0],
        };
      }

      // If no existing future order, create a skipped record to prevent future generation
      await this.dataSource.query(`
        INSERT INTO future_orders (subscription_order_id, scheduled_delivery_date, status)
        VALUES ($1, $2, 'skipped')
        ON CONFLICT (subscription_order_id, scheduled_delivery_date) DO UPDATE
        SET status = 'skipped'
      `, [Number(subscriptionId), new Date(deliveryDate)]);

      return {
        message: 'Delivery skipped successfully',
        skipped_date: deliveryDate,
      };
    } catch (error) {
      this.logger.error('Failed to skip delivery:', error);
      throw new BadRequestException('Failed to skip delivery');
    }
  }

  /**
   * Get subscription status summary
   */
  async getSubscriptionStatus(userId: number, subscriptionId: number) {
    const customerId = await this.getCustomerId(userId);
    const subscription = await this.verifySubscriptionOwnership(subscriptionId, customerId);

    await this.ensureTablesExist();

    let scheduleInfo: SubscriptionSchedule | null = null;
    let upcomingCount = 0;
    let completedCount = 0;

    try {
      // Get schedule info
      const scheduleResult = await this.dataSource.query(`
        SELECT * FROM subscription_schedules WHERE subscription_order_id = $1
      `, [Number(subscriptionId)]);

      if (scheduleResult.length > 0) {
        scheduleInfo = scheduleResult[0] as SubscriptionSchedule;
      }

      // Count upcoming deliveries
      const upcomingResult = await this.dataSource.query(`
        SELECT COUNT(*) as count FROM future_orders
        WHERE subscription_order_id = $1 AND status = 'pending'
      `, [Number(subscriptionId)]);
      upcomingCount = parseInt(upcomingResult[0]?.count || '0');

      // Count completed deliveries
      const completedResult = await this.dataSource.query(`
        SELECT COUNT(*) as count FROM future_orders
        WHERE subscription_order_id = $1 AND status = 'generated'
      `, [Number(subscriptionId)]);
      completedCount = parseInt(completedResult[0]?.count || '0');
    } catch (error) {
      this.logger.warn('Failed to get subscription schedule info:', error);
    }

    // Determine status
    let status = 'active';
    if (subscription.order_status === 0) {
      status = 'cancelled';
    } else if (scheduleInfo?.is_paused) {
      status = 'paused';
    }

    // Get frequency label
    const frequencyLabels: Record<number, string> = {
      7: 'Weekly',
      14: 'Fortnightly',
      21: 'Every 3 weeks',
      28: 'Monthly',
      30: 'Monthly',
    };
    const frequencyLabel = frequencyLabels[subscription.standing_order] || `Every ${subscription.standing_order} days`;

    return {
      subscription_id: subscription.order_id,
      status,
      frequency_days: subscription.standing_order,
      frequency_label: frequencyLabel,
      next_delivery_date: scheduleInfo?.next_delivery_date || null,
      is_paused: scheduleInfo?.is_paused || false,
      paused_at: scheduleInfo?.paused_at || null,
      resume_date: scheduleInfo?.resume_date || null,
      upcoming_deliveries_count: upcomingCount,
      completed_deliveries_count: completedCount,
      created_at: subscription.date_added,
      order_total: subscription.order_total,
      delivery_address: subscription.delivery_address,
    };
  }
}

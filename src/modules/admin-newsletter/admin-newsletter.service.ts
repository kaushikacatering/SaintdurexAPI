import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminNewsletterService {
    private readonly logger = new Logger(AdminNewsletterService.name);

    constructor(private dataSource: DataSource) { }

    /**
     * Get all newsletter subscriptions
     */
    async findAll({ page = 1, limit = 10, search = '', status = '' }) {
        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        const params: any[] = [];

        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND email ILIKE $${params.length}`;
        }

        if (status) {
            params.push(status);
            whereClause += ` AND status = $${params.length}`;
        }

        const countQuery = `
      SELECT COUNT(*) as total 
      FROM newsletter_subscriptions 
      WHERE ${whereClause}
    `;
        const countResult = await this.dataSource.query(countQuery, params);
        const total = parseInt(countResult[0].total, 10);

        const query = `
      SELECT subscription_id, email, status, source, ip_address, user_agent, 
             subscribed_at, unsubscribed_at, updated_at
      FROM newsletter_subscriptions
      WHERE ${whereClause}
      ORDER BY subscribed_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

        const results = await this.dataSource.query(query, [...params, limit, offset]);

        return {
            data: results,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Unsubscribe a user
     */
    async unsubscribe(id: number) {
        const checkQuery = `SELECT * FROM newsletter_subscriptions WHERE subscription_id = $1`;
        const checkResult = await this.dataSource.query(checkQuery, [id]);

        if (checkResult.length === 0) {
            throw new NotFoundException(`Subscription with ID ${id} not found`);
        }

        const updateQuery = `
      UPDATE newsletter_subscriptions
      SET status = 'unsubscribed',
          unsubscribed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1
      RETURNING *
    `;

        const result = await this.dataSource.query(updateQuery, [id]);
        return result[0];
    }

    /**
     * Reactivate a subscription
     */
    async reactivate(id: number) {
        const checkQuery = `SELECT * FROM newsletter_subscriptions WHERE subscription_id = $1`;
        const checkResult = await this.dataSource.query(checkQuery, [id]);

        if (checkResult.length === 0) {
            throw new NotFoundException(`Subscription with ID ${id} not found`);
        }

        const updateQuery = `
      UPDATE newsletter_subscriptions
      SET status = 'active',
          subscribed_at = CURRENT_TIMESTAMP,
          unsubscribed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1
      RETURNING *
    `;

        const result = await this.dataSource.query(updateQuery, [id]);
        return result[0];
    }

    /**
     * Delete a subscription
       */
    async delete(id: number) {
        const checkQuery = `SELECT * FROM newsletter_subscriptions WHERE subscription_id = $1`;
        const checkResult = await this.dataSource.query(checkQuery, [id]);

        if (checkResult.length === 0) {
            throw new NotFoundException(`Subscription with ID ${id} not found`);
        }

        const deleteQuery = `DELETE FROM newsletter_subscriptions WHERE subscription_id = $1`;
        await this.dataSource.query(deleteQuery, [id]);

        return { message: 'Subscription deleted successfully' };
    }
}

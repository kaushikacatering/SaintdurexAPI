import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminOptionsService {
  private readonly logger = new Logger(AdminOptionsService.name);

  constructor(private dataSource: DataSource) { }

  async findAll(query: any): Promise<any> {
    const { limit = 20, offset = 0, search } = query;

    let sqlQuery = `
      SELECT 
        o.*,
        (
          SELECT json_agg(
            json_build_object(
              'option_value_id', ov.option_value_id,
              'name', ov.name,
              'sort_order', ov.sort_order,
              'standard_price', ov.standard_price,
              'wholesale_price', ov.wholesale_price,
              'wholesale_price_premium', ov.wholesale_price_premium
            ) ORDER BY ov.sort_order
          )
          FROM option_value ov
          WHERE ov.option_id = o.option_id
        ) as values
      FROM options o
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND o.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sqlQuery += ' ORDER BY o.option_id DESC';
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    let countQuery = 'SELECT COUNT(*) FROM options o WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND o.name ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { options: result, count, limit: Number(limit), offset: Number(offset) };
  }

  async findOne(id: number): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT 
        o.*,
        (
          SELECT json_agg(
            json_build_object(
              'option_value_id', ov.option_value_id,
              'name', ov.name,
              'sort_order', ov.sort_order,
              'standard_price', ov.standard_price,
              'wholesale_price', ov.wholesale_price,
              'wholesale_price_premium', ov.wholesale_price_premium
            ) ORDER BY ov.sort_order
          )
          FROM option_value ov
          WHERE ov.option_id = o.option_id
        ) as values
      FROM options o
      WHERE o.option_id = $1`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException('Option not found');
    }

    return { option: result[0] };
  }

  async create(createOptionDto: any): Promise<any> {
    const { name, option_type, values } = createOptionDto;

    if (!name) {
      throw new BadRequestException('Option name is required');
    }

    const validOptionTypes = ['radio', 'checkbox', 'dropdown', 'text'];
    const finalOptionType = option_type && validOptionTypes.includes(option_type) ? option_type : 'dropdown';

    return this.dataSource.transaction(async (manager) => {
      await manager.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'option_value' AND column_name = 'wholesale_price_premium'
          ) THEN
            ALTER TABLE option_value ADD COLUMN wholesale_price_premium DECIMAL(15,4);
          END IF;
        END
        $$;
      `);
      const result = await manager.query(`INSERT INTO options (name, option_type) VALUES ($1, $2) RETURNING *`, [name, finalOptionType]);
      const newOption = result[0];

      if (values && Array.isArray(values) && values.length > 0) {
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          await manager.query(
            `INSERT INTO option_value (option_id, name, sort_order, standard_price, wholesale_price, wholesale_price_premium) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              newOption.option_id,
              value.name,
              value.sort_order || i + 1,
              value.standard_price || 0,
              value.wholesale_price || (value.standard_price || 0) * 0.9,
              value.wholesale_price_premium ?? null,
            ]
          );
        }
      }

      const completeOption = await manager.query(
        `SELECT 
          o.*,
          (
            SELECT json_agg(
              json_build_object(
                'option_value_id', ov.option_value_id,
                'name', ov.name,
                'sort_order', ov.sort_order,
                'standard_price', ov.standard_price,
                'wholesale_price', ov.wholesale_price,
                'wholesale_price_premium', ov.wholesale_price_premium
              ) ORDER BY ov.sort_order
            )
            FROM option_value ov
            WHERE ov.option_id = o.option_id
          ) as values
        FROM options o
        WHERE o.option_id = $1`,
        [newOption.option_id],
      );

      return { option: completeOption[0], message: 'Option created successfully' };
    });
  }

  async update(id: number, updateOptionDto: any): Promise<any> {
    const { name, option_type, values } = updateOptionDto;

    return this.dataSource.transaction(async (manager) => {
      await manager.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'option_value' AND column_name = 'wholesale_price_premium'
          ) THEN
            ALTER TABLE option_value ADD COLUMN wholesale_price_premium DECIMAL(15,4);
          END IF;
        END
        $$;
      `);
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(name);
      }
      if (option_type !== undefined) {
        const validOptionTypes = ['radio', 'checkbox', 'dropdown', 'text'];
        if (validOptionTypes.includes(option_type)) {
          updates.push(`option_type = $${paramIndex++}`);
          params.push(option_type);
        }
      }

      if (updates.length > 0) {
        params.push(id);
        const result = await manager.query(
          `UPDATE options SET ${updates.join(', ')} WHERE option_id = $${paramIndex} RETURNING *`,
          params,
        );
        if (result.length === 0) {
          throw new NotFoundException('Option not found');
        }
      } else {
        const result = await manager.query(`SELECT * FROM options WHERE option_id = $1`, [id]);
        if (result.length === 0) {
          throw new NotFoundException('Option not found');
        }
      }

      if (values && Array.isArray(values)) {
        // Get existing specific option values
        const existingValuesResult = await manager.query('SELECT option_value_id FROM option_value WHERE option_id = $1', [id]);
        const existingValueIds = existingValuesResult.map((v: any) => v.option_value_id);

        const incomingValueIds = values
          .filter((v: any) => v.option_value_id)
          .map((v: any) => v.option_value_id);

        // Delete removed values
        const valuesToDelete = existingValueIds.filter((id: number) => !incomingValueIds.includes(id));
        if (valuesToDelete.length > 0) {
          await manager.query('DELETE FROM option_value WHERE option_value_id = ANY($1)', [valuesToDelete]);
        }

        // Upsert values
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (value.option_value_id) {
            // Update existing
            await manager.query(
              `UPDATE option_value 
               SET name = $1, sort_order = $2, standard_price = $3, wholesale_price = $4, wholesale_price_premium = $5
               WHERE option_value_id = $6`,
              [
                value.name,
                value.sort_order || i + 1,
                value.standard_price || 0,
                value.wholesale_price || (value.standard_price || 0) * 0.9,
                value.wholesale_price_premium ?? null,
                value.option_value_id
              ]
            );
          } else {
            // Insert new
            await manager.query(
              `INSERT INTO option_value (option_id, name, sort_order, standard_price, wholesale_price, wholesale_price_premium) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                id,
                value.name,
                value.sort_order || i + 1,
                value.standard_price || 0,
                value.wholesale_price || (value.standard_price || 0) * 0.9,
                value.wholesale_price_premium ?? null,
              ]
            );
          }
        }
      }

      const completeOption = await manager.query(
        `SELECT 
          o.*,
          (
            SELECT json_agg(
              json_build_object(
                'option_value_id', ov.option_value_id,
                'name', ov.name,
                'sort_order', ov.sort_order,
                'standard_price', ov.standard_price,
                'wholesale_price', ov.wholesale_price,
                'wholesale_price_premium', ov.wholesale_price_premium
              ) ORDER BY ov.sort_order
            )
            FROM option_value ov
            WHERE ov.option_id = o.option_id
          ) as values
        FROM options o
        WHERE o.option_id = $1`,
        [id],
      );

      return { option: completeOption[0], message: 'Option updated successfully' };
    });
  }

  async delete(id: number): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM option_value WHERE option_id = $1', [id]);
      const result = await manager.query('DELETE FROM options WHERE option_id = $1 RETURNING *', [id]);

      if (result.length === 0) {
        throw new NotFoundException('Option not found');
      }
    });
  }
}

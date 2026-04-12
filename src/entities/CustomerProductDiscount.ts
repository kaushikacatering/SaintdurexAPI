import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { Customer } from "./Customer"
import { Product } from "./Product"

@Entity("customer_product_discount")
@Index(["customer_id"])
@Index(["product_id"])
@Index(["customer_id", "product_id"], { unique: true })
export class CustomerProductDiscount {
  @PrimaryGeneratedColumn()
  customer_product_discount_id!: number

  @Column({ type: "int" })
  customer_id!: number

  @Column({ type: "int" })
  product_id!: number

  @Column({ type: "decimal", precision: 5, scale: 2 })
  discount_percentage!: number

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updated_at!: Date

  // Relations
  @ManyToOne(() => Customer)
  @JoinColumn({ name: "customer_id" })
  customer!: Customer

  @ManyToOne(() => Product)
  @JoinColumn({ name: "product_id" })
  product!: Product
}


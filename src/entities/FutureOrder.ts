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
import { Order } from "./Order"

@Entity("future_orders")
@Index(["subscription_order_id"])
@Index(["status"])
@Index(["scheduled_delivery_date"])
@Index(["subscription_order_id", "scheduled_delivery_date"], { unique: true })
export class FutureOrder {
  @PrimaryGeneratedColumn()
  future_order_id!: number

  @Column({ type: "int" })
  subscription_order_id!: number

  @Column({ type: "timestamp" })
  scheduled_delivery_date!: Date

  @Column({ type: "varchar", length: 50, default: "pending" })
  status!: string

  @Column({ type: "int", nullable: true })
  generated_order_id!: number

  @Column({ type: "timestamp", nullable: true })
  generated_at!: Date

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updated_at!: Date

  // Relations
  @ManyToOne(() => Order)
  @JoinColumn({ name: "subscription_order_id" })
  subscription_order!: Order

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: "generated_order_id" })
  generated_order!: Order
}


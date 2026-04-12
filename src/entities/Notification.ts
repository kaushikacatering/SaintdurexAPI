import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { User } from "./User"
import { Order } from "./Order"

@Entity("notification")
@Index(["userid"])
@Index(["orderid"])
@Index(["read_status"])
@Index(["created_at"])
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: "int" })
  userid!: number

  @Column({ type: "text" })
  description!: string

  @Column({ type: "int", default: 0 })
  orderid!: number

  @Column({ type: "date" })
  date_added!: Date

  @Column({ type: "time" })
  time_added!: string

  @Column({ type: "boolean", default: false })
  read_status!: boolean

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: "userid" })
  user!: User

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: "orderid" })
  order!: Order
}


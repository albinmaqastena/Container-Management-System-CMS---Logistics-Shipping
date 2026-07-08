// src/modules/items/entities/item.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Container } from '../../containers/entities/container.entity';

@Entity('items')
export class Item {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({ unique: true })
  uniqueNumber!: string;

  @ApiProperty()
  @Column()
  name!: string;

  @ApiProperty()
  @Column({ nullable: true })
  photo!: string;

  @ApiProperty()
  @Column('int')
  packageQuantity!: number;

  @ApiProperty()
  @Column('int')
  productsPerPackage!: number;

  @ApiProperty()
  @Column('decimal', { precision: 10, scale: 2 })
  packagePrice!: number;

  @ApiProperty()
  @Column('decimal', { precision: 10, scale: 2 })
  volume!: number;

  @ApiProperty()
  @Column('decimal', { precision: 10, scale: 2 })
  totalVolume!: number;

  @ApiProperty({ type: () => Container })
  @ManyToOne(() => Container, (container) => container.items)
  @JoinColumn({ name: 'containerId' })
  container!: Container;

  @ApiProperty()
  @Column()
  containerId!: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @ApiProperty()
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotalVolume() {
    this.totalVolume = this.packageQuantity * this.volume;
  }

  constructor(partial: Partial<Item>) {
    Object.assign(this, partial);
  }
}
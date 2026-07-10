// src/modules/items/entities/item.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Container } from '../../containers/entities/container.entity';

@Entity('items')
export class Item {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({ type: 'varchar', unique: true })
  uniqueNumber!: string;

  @ApiProperty()
  @Column({ type: 'varchar' })
  name!: string;

  @ApiProperty()
  @Column({ type: 'varchar', nullable: true })
  photo!: string | null;

  @ApiProperty()
  @Column({ type: 'int' })
  packageQuantity!: number;

  @ApiProperty()
  @Column({ type: 'int' })
  productsPerPackage!: number;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  packagePrice!: number;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  volume!: number;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalVolume!: number;

  @ApiProperty({ type: () => Container })
  @ManyToOne(() => Container, (container) => container.items, {
    onDelete: 'CASCADE',
  })
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
  deletedAt!: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotalVolume() {
    this.totalVolume = this.packageQuantity * this.volume;
  }

  constructor(partial: Partial<Item>) {
    Object.assign(this, partial);
  }
}
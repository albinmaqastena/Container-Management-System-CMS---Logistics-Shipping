// src/modules/items/entities/item.entity.ts

import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Container } from '../../containers/entities/container.entity';

const decimalTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};

@Entity('items')
export class Item {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  uniqueNumber!: string;

  @ApiProperty()
  @Column({
    type: 'varchar',
    length: 200,
  })
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  photo!: string | null;

  @ApiProperty()
  @Column({
    type: 'int',
  })
  packageQuantity!: number;

  @ApiProperty()
  @Column({
    type: 'int',
  })
  productsPerPackage!: number;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  packagePrice!: number;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 10,
    transformer: decimalTransformer,
  })
  volume!: number;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 10,
    transformer: decimalTransformer,
  })
  totalVolume!: number;

  @ApiProperty({
    type: () => Container,
  })
  @ManyToOne(() => Container, (container) => container.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'containerId',
  })
  container!: Container;

  @ApiProperty()
  @Column({
    type: 'uuid',
  })
  containerId!: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @ApiProperty({
    description: 'Whether the item was deleted together with its container',
    default: false,
  })
  @Column({
    type: 'boolean',
    default: false,
  })
  deletedByContainer!: boolean;

  @ApiPropertyOptional({
    nullable: true,
  })
  @DeleteDateColumn({
    nullable: true,
  })
  deletedAt!: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotalVolume(): void {
    this.totalVolume = Number((this.packageQuantity * this.volume).toFixed(2));
  }

  constructor(partial?: Partial<Item>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}

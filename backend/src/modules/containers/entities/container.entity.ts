// src/modules/containers/entities/container.entity.ts
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';
import { Item } from '../../items/entities/item.entity';

export enum ContainerStatus {
  ACTIVE = 'active',
  SHIPPED = 'shipped',
  ARCHIVED = 'archived',
}

const decimalTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};

@Entity('containers')
export class Container {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;

  @ApiProperty()
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  containerCode!: string;

  @ApiProperty()
  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalVolume!: number;

  @ApiProperty()
  @Column('decimal', {
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  usedVolume!: number;

  @ApiProperty({
    enum: ContainerStatus,
  })
  @Column({
    type: 'varchar',
    length: 50,
    default: ContainerStatus.ACTIVE,
  })
  status!: ContainerStatus;

  @ApiPropertyOptional()
  @Column({
    type: 'varchar',
    length: 500,
    default: '',
  })
  description!: string;

  @ApiProperty({
    type: () => User,
  })
  @ManyToOne(
    () => User,
    (user) => user.containers,
    {
      nullable: false,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({
    name: 'createdById',
  })
  createdBy!: User;

  @ApiProperty()
  @Column({
    type: 'uuid',
  })
  createdById!: string;

  @ApiProperty({
    type: () => [Item],
  })
  @OneToMany(
    () => Item,
    (item) => item.container,
  )
  items!: Item[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @ApiPropertyOptional()
  @DeleteDateColumn({
    nullable: true,
  })
  deletedAt?: Date | null;

  @ApiProperty({
    description: 'Remaining available volume',
  })
  get availableVolume(): number {
    return Math.max(
      0,
      Number(this.totalVolume) - Number(this.usedVolume),
    );
  }

  constructor(partial?: Partial<Container>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
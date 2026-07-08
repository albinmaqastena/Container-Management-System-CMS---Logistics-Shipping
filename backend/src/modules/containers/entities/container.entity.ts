// src/modules/containers/entities/container.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';
import { Item } from '../../items/entities/item.entity';

export enum ContainerStatus {
  ACTIVE = 'active',
  SHIPPED = 'shipped',
  ARCHIVED = 'archived',
}

@Entity('containers')
export class Container {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column()
  name!: string;

  @ApiProperty()
  @Column({ unique: true })
  containerCode!: string;

  @ApiProperty()
  @Column('decimal', { precision: 10, scale: 2 })
  totalVolume!: number;

  @ApiProperty()
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  usedVolume!: number;

  @ApiProperty({ enum: ContainerStatus })
  @Column({
    type: 'varchar',
    length: 50,
    default: ContainerStatus.ACTIVE,
  })
  status!: ContainerStatus;

  @ApiProperty()
  @Column({ nullable: true })
  description!: string;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.containers)
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @ApiProperty()
  @Column()
  createdById!: string;

  @ApiProperty({ type: () => [Item] })
  @OneToMany(() => Item, (item) => item.container)
  items!: Item[];

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
  generateContainerCode() {
    const timestamp = Date.now();
    const shortName = this.name.substring(0, 3).toUpperCase();
    this.containerCode = `${timestamp}-${shortName}`;
  }

  @BeforeUpdate()
  updateUsedVolume() {
    if (this.items) {
      this.usedVolume = this.items.reduce((sum, item) => sum + item.totalVolume, 0);
    }
  }

  get availableVolume(): number {
    return this.totalVolume - this.usedVolume;
  }

  constructor(partial: Partial<Container>) {
    Object.assign(this, partial);
  }
}
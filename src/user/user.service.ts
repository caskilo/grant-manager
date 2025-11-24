import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
// import * as argon2 from 'argon2'; // Temporarily disabled
import { AuditActionType } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(createUserDto: CreateUserDto, creatorId: string) {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = createUserDto.password + '-temp'; // Temporary plain text

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        name: createUserDto.name,
        role: createUserDto.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: creatorId,
        action: AuditActionType.CREATE,
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      },
    });

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, updaterId: string) {
    const existing = await this.findOne(id);

    const data: any = {};
    if (updateUserDto.name) data.name = updateUserDto.name;
    if (updateUserDto.role) data.role = updateUserDto.role;
    if (updateUserDto.isActive !== undefined) data.isActive = updateUserDto.isActive;
    if (updateUserDto.password) {
      data.passwordHash = updateUserDto.password + '-temp'; // Temporary plain text
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: updaterId,
        action: AuditActionType.UPDATE,
        entityType: 'USER',
        entityId: user.id,
        metadata: { changes: JSON.parse(JSON.stringify(updateUserDto)) },
      },
    });

    return user;
  }

  async deactivate(id: string, deactivatorId: string) {
    const user = await this.update(id, { isActive: false }, deactivatorId);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: deactivatorId,
        action: AuditActionType.DELETE,
        entityType: 'USER',
        entityId: user.id,
        metadata: { action: 'deactivated' },
      },
    });

    return user;
  }
}

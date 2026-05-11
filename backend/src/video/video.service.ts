import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VideoService {
  constructor(private prisma: PrismaService) {}

  async createPlaylist(data: { name: string; description?: string }) {
    return this.prisma.videoPlaylist.create({ data });
  }

  async getPlaylists() {
    return this.prisma.videoPlaylist.findMany({
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async updatePlaylist(id: string, data: any) {
    return this.prisma.videoPlaylist.update({ where: { id }, data });
  }

  async deletePlaylist(id: string) {
    return this.prisma.videoPlaylist.delete({ where: { id } });
  }

  async addVideoItem(playlistId: string, data: { title: string; fileUrl: string; duration?: number }) {
    const lastItem = await this.prisma.videoPlaylistItem.findFirst({
      where: { playlistId },
      orderBy: { sortOrder: 'desc' },
    });
    
    return this.prisma.videoPlaylistItem.create({
      data: {
        ...data,
        playlistId,
        sortOrder: lastItem ? lastItem.sortOrder + 1 : 1,
      },
    });
  }

  async removeVideoItem(itemId: string) {
    return this.prisma.videoPlaylistItem.delete({ where: { id: itemId } });
  }

  async updateItemOrder(updates: { id: string; sortOrder: number }[]) {
    return this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.videoPlaylistItem.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        })
      )
    );
  }
}

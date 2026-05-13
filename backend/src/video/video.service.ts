import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VideoService {
  constructor(private prisma: PrismaService) {}

  // Get or create a default playlist for simple uploads
  private async getDefaultPlaylist() {
    let playlist = await this.prisma.videoPlaylist.findFirst({
      where: { name: 'Default' },
    });
    if (!playlist) {
      playlist = await this.prisma.videoPlaylist.create({
        data: { name: 'Default' },
      });
    }
    return playlist;
  }

  // Simple upload: just save file, auto-assign to default playlist
  async uploadSimpleVideo(data: { title: string; fileUrl: string }) {
    const playlist = await this.getDefaultPlaylist();
    const lastItem = await this.prisma.videoPlaylistItem.findFirst({
      where: { playlistId: playlist.id },
      orderBy: { sortOrder: 'desc' },
    });

    return this.prisma.videoPlaylistItem.create({
      data: {
        title: data.title,
        fileUrl: data.fileUrl,
        playlistId: playlist.id,
        sortOrder: lastItem ? lastItem.sortOrder + 1 : 1,
        isActive: true,
      },
    });
  }

  // Get ALL videos (for admin page)
  async getAllVideos() {
    return this.prisma.videoPlaylistItem.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Get ACTIVE videos only (for TV displays)
  async getActiveVideos() {
    return this.prisma.videoPlaylistItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Toggle video active/inactive
  async toggleVideoItem(id: string) {
    const item = await this.prisma.videoPlaylistItem.findUnique({ where: { id } });
    if (!item) throw new Error('Video not found');
    return this.prisma.videoPlaylistItem.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
  }

  // Keep old methods for compatibility
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

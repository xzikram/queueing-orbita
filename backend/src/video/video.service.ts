import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private displayGateway: DisplayGateway,
  ) {}

  private async notifyDisplays() {
    // A simple event to tell ALL displays to fetch their updated playlists from the API
    this.displayGateway.server.emit('playlistChanged');
  }

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

    const res = await this.prisma.videoPlaylistItem.create({
      data: {
        title: data.title,
        fileUrl: data.fileUrl,
        playlistId: playlist.id,
        sortOrder: lastItem ? lastItem.sortOrder + 1 : 1,
        isActive: true,
      },
    });
    await this.notifyDisplays();
    return res;
  }

  // Get ALL videos (for admin page) with their targets
  async getAllVideos() {
    return this.prisma.videoPlaylistItem.findMany({
      include: { targets: { include: { display: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Get ACTIVE videos only (for TV displays)
  async getActiveVideos(displayCode?: string) {
    if (!displayCode) {
      return this.prisma.videoPlaylistItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    // Find display
    const display = await this.prisma.display.findUnique({
      where: { code: displayCode },
    });

    if (!display) {
      return this.prisma.videoPlaylistItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    // Return videos that either have NO targets (global) OR target this specific display
    const videos = await this.prisma.videoPlaylistItem.findMany({
      where: { isActive: true },
      include: { targets: true },
      orderBy: { sortOrder: 'asc' },
    });

    return videos.filter(v => 
      v.targets.length === 0 || v.targets.some(t => t.displayId === display.id)
    );
  }

  // Set display targets for a video
  async setVideoTargets(videoId: string, displayIds: string[]) {
    await this.prisma.videoDisplayTarget.deleteMany({
      where: { videoItemId: videoId },
    });

    if (displayIds && displayIds.length > 0) {
      await this.prisma.videoDisplayTarget.createMany({
        data: displayIds.map(id => ({
          videoItemId: videoId,
          displayId: id,
        })),
      });
    }

    const res = await this.prisma.videoPlaylistItem.findUnique({
      where: { id: videoId },
      include: { targets: { include: { display: true } } },
    });
    await this.notifyDisplays();
    return res;
  }

  // Toggle video active/inactive
  async toggleVideoItem(id: string) {
    const item = await this.prisma.videoPlaylistItem.findUnique({ where: { id } });
    if (!item) throw new Error('Video not found');
    const res = await this.prisma.videoPlaylistItem.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
    await this.notifyDisplays();
    return res;
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
    const res = await this.prisma.videoPlaylistItem.delete({ where: { id: itemId } });
    await this.notifyDisplays();
    return res;
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

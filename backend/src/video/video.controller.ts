import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException
} from '@nestjs/common';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

// Ensure upload dir exists
const uploadDir = './public/uploads/videos';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('video')
export class VideoController {
  constructor(private videoService: VideoService) {}

  // Get all videos (for admin management)
  @Get('all')
  async getAllVideos() {
    return this.videoService.getAllVideos();
  }

  // Get only active videos (for TV displays)
  @Get('active')
  async getActiveVideos() {
    return this.videoService.getActiveVideos();
  }

  @Get('active/:displayCode')
  async getActiveVideosForDisplay(@Param('displayCode') displayCode: string) {
    return this.videoService.getActiveVideos(displayCode);
  }

  // Set video targets
  @Put('items/:id/targets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async setVideoTargets(@Param('id') id: string, @Body() body: { displayIds: string[] }) {
    return this.videoService.setVideoTargets(id, body.displayIds);
  }

  // Keep old endpoints for compatibility
  @Get('playlists')
  async getPlaylists() {
    return this.videoService.getPlaylists();
  }

  @Post('playlists')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createPlaylist(@Body() body: any) {
    return this.videoService.createPlaylist(body);
  }

  @Delete('playlists/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deletePlaylist(@Param('id') id: string) {
    return this.videoService.deletePlaylist(id);
  }

  // Simple upload - just file, auto-generate title from filename
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'video-' + uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB max
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only video files are allowed!'), false);
      }
    },
  }))
  async uploadSimple(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Video file is required');
    const fileUrl = `/uploads/videos/${file.filename}`;
    const title = file.originalname.replace(/\.[^/.]+$/, ''); // Use filename as title
    return this.videoService.uploadSimpleVideo({ title, fileUrl });
  }

  // Old upload endpoint (keep for compatibility)
  @Post('playlists/:id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'video-' + uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB max
    fileFilter: (req, file, cb) => {
      if (file.mimetype.match(/\/(mp4|webm|ogg)$/)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only video files are allowed!'), false);
      }
    },
  }))
  async uploadVideo(
    @Param('id') playlistId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title: string }
  ) {
    if (!file) throw new BadRequestException('Video file is required');
    const fileUrl = `/uploads/videos/${file.filename}`;
    return this.videoService.addVideoItem(playlistId, { title: body.title, fileUrl });
  }

  // Toggle video on/off
  @Put('items/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async toggleItem(@Param('id') id: string) {
    return this.videoService.toggleVideoItem(id);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteItem(@Param('id') id: string) {
    return this.videoService.removeVideoItem(id);
  }

  @Put('items/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reorderItems(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.videoService.updateItemOrder(body.items);
  }
}

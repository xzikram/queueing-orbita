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

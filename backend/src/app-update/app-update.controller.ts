import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('app-update')
export class AppUpdateController {
  private get ManifestPath() {
    return path.join(process.cwd(), 'public', 'updates', 'manifest.json');
  }

  @Get('check')
  checkUpdate(@Query('currentVersion') currentVersion?: string) {
    try {
      if (!fs.existsSync(this.ManifestPath)) {
        return {
          hasUpdate: false,
          latestVersion: currentVersion || '1.0.0',
          message: 'Belum ada manifest rilis baru.',
        };
      }

      const raw = fs.readFileSync(this.ManifestPath, 'utf8');
      const manifest = JSON.parse(raw);

      const clientVer = currentVersion || '1.0.0';
      const hasUpdate = this.isVersionHigher(manifest.latestVersion, clientVer);

      return {
        hasUpdate,
        latestVersion: manifest.latestVersion,
        minSupportedVersion: manifest.minSupportedVersion || '1.0.0',
        releaseNotes: manifest.releaseNotes || 'Pembaruan stabilitas dan fitur baru.',
        downloadUrl: manifest.downloadUrl || 'http://192.168.40.131:3001/api/app-update/download',
        forceUpdate: manifest.forceUpdate || false,
        pubDate: manifest.pubDate || new Date().toISOString(),
      };
    } catch (err) {
      return {
        hasUpdate: false,
        latestVersion: currentVersion || '1.0.0',
        error: 'Gagal membaca manifest rilis',
      };
    }
  }

  @Get('download')
  downloadUpdate(@Res() res: Response) {
    const updateZipPath = path.join(process.cwd(), 'public', 'updates', 'OrbitaQueueCaller-update.zip');
    if (!fs.existsSync(updateZipPath)) {
      return res.status(404).json({ message: 'File paket pembaruan belum tersedia di server.' });
    }
    return res.download(updateZipPath, 'OrbitaQueueCaller-update.zip');
  }

  private isVersionHigher(latest: string, current: string): boolean {
    const p1 = latest.split('.').map((x) => parseInt(x, 10) || 0);
    const p2 = current.split('.').map((x) => parseInt(x, 10) || 0);

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const v1 = p1[i] || 0;
      const v2 = p2[i] || 0;
      if (v1 > v2) return true;
      if (v1 < v2) return false;
    }
    return false;
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
  path: '/api/socket.io/',
})
export class DisplayGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('DisplayGateway');

  constructor(private reportsService: ReportsService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinDisplay')
  handleJoinDisplay(client: Socket, displayCode: string) {
    client.join(displayCode);
    this.logger.log(`Client ${client.id} joined display: ${displayCode}`);
    return { event: 'joinedDisplay', data: displayCode };
  }

  @SubscribeMessage('leaveDisplay')
  handleLeaveDisplay(client: Socket, displayCode: string) {
    client.leave(displayCode);
    this.logger.log(`Client ${client.id} left display: ${displayCode}`);
  }

  @SubscribeMessage('joinDashboard')
  handleJoinDashboard(client: Socket) {
    client.join('dashboard');
    this.logger.log(`Client ${client.id} joined dashboard room`);
    return { event: 'joinedDashboard', data: 'dashboard' };
  }

  @SubscribeMessage('leaveDashboard')
  handleLeaveDashboard(client: Socket) {
    client.leave('dashboard');
    this.logger.log(`Client ${client.id} left dashboard room`);
  }

  /**
   * Broadcast a queue call to a specific display channel
   */
  broadcastCall(displayCode: string, payload: {
    ticketNo: string;
    patientType: string;
    counterName?: string;
    roomName?: string;
    doctorName?: string;
    unitType: string;
    calledAt: Date;
    visitId?: string;
  }) {
    this.server.to(displayCode).emit('queueCall', payload);
    this.logger.log(`Broadcast to ${displayCode}: ${payload.ticketNo} → ${payload.counterName || payload.roomName}`);
  }

  /**
   * Broadcast updated queue list to a display
   */
  broadcastQueueUpdate(displayCode: string, payload: any) {
    this.server.to(displayCode).emit('queueUpdate', payload);
  }

  /**
   * Fetch live stats and broadcast to all connected dashboard clients.
   * Called by unit services whenever patient state changes.
   */
  async triggerDashboardRefresh() {
    try {
      const stats = await this.reportsService.getLiveStats();
      this.server.to('dashboard').emit('dashboardUpdate', stats);
    } catch (err) {
      this.logger.error('Failed to broadcast dashboard update', err);
    }
  }

  /**
   * Broadcast playlist update to a specific display
   */
  broadcastPlaylistToDisplay(displayCode: string, payload: any) {
    this.server.to(displayCode).emit('playlistUpdate', payload);
    this.logger.log(`Broadcast playlist update to ${displayCode}`);
  }
}

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
}

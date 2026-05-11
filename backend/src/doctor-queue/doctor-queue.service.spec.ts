import { Test, TestingModule } from '@nestjs/testing';
import { DoctorQueueService } from './doctor-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { DisplayGateway } from '../websocket/display.gateway';
import { NotFoundException } from '@nestjs/common';

describe('DoctorQueueService Auto-Routing', () => {
  let service: DoctorQueueService;
  let journeyService: JourneyService;

  const mockPrismaService = {
    journeyUnitSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    visit: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    room: {
      findFirst: jest.fn(),
    },
  };

  const mockJourneyService = {
    finishService: jest.fn(),
    createSession: jest.fn(),
  };

  const mockDisplayGateway = {
    broadcastCall: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorQueueService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JourneyService, useValue: mockJourneyService },
        { provide: DisplayGateway, useValue: mockDisplayGateway },
      ],
    }).compile();

    service = module.get<DoctorQueueService>(DoctorQueueService);
    journeyService = module.get<JourneyService>(JourneyService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('nextDestination (Auto-Routing)', () => {
    it('should route to next destination correctly and create next unit session', async () => {
      const mockVisit = {
        id: 'visit-123',
        queueTicketId: 'ticket-123',
      };

      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.visit.update.mockResolvedValue(mockVisit);
      mockPrismaService.room.findFirst.mockResolvedValue({ id: 'room-pharmacy' });
      mockJourneyService.createSession.mockResolvedValue({ id: 'new-session' });

      const result = await service.setNextDestination('visit-123', 'PHARMACY', 'Doctor A');

      expect(mockPrismaService.visit.update).toHaveBeenCalledWith({
        where: { id: 'visit-123' },
        data: { currentUnitType: 'PHARMACY', currentStatus: 'WAITING' },
      });
      expect(journeyService.createSession).toHaveBeenCalledWith({
        visitId: 'visit-123',
        unitType: 'PHARMACY',
        roomId: 'room-pharmacy',
        queueTicketId: 'ticket-123',
        createdBy: 'Doctor A',
      });
      expect(result.message).toBe('Pasien diarahkan ke PHARMACY');
    });

    it('should mark visit as FINISHED if destination is FINISHED', async () => {
      const mockVisit = { id: 'visit-123' };

      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockPrismaService.visit.update.mockResolvedValue(mockVisit);

      const result = await service.setNextDestination('visit-123', 'FINISHED', 'Doctor B');

      expect(mockPrismaService.visit.update).toHaveBeenCalledWith({
        where: { id: 'visit-123' },
        data: {
          currentUnitType: null,
          currentStatus: 'FINISHED',
          finishedAt: expect.any(Date),
        },
      });
      expect(journeyService.createSession).not.toHaveBeenCalled();
      expect(result.message).toBe('Kunjungan selesai');
    });
  });
});

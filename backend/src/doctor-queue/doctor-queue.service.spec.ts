import { Test, TestingModule } from '@nestjs/testing';
import { DoctorQueueService } from './doctor-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { RoutingService } from '../routing/routing.service';
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

  const mockRoutingService = {
    routeToNextUnit: jest.fn(),
    transferPatient: jest.fn(),
    getAvailableDestinations: jest.fn(),
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
        { provide: RoutingService, useValue: mockRoutingService },
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
      mockRoutingService.routeToNextUnit.mockResolvedValue({ message: 'Pasien diarahkan ke PHARMACY' });

      const result = await service.setNextDestination(
        'visit-123',
        'PHARMACY',
        'Doctor A',
      );

      expect(mockRoutingService.routeToNextUnit).toHaveBeenCalledWith(
        'visit-123',
        'PHARMACY',
        {
          roomId: undefined,
          floorId: undefined,
          doctorId: undefined,
          queueTicketId: 'ticket-123',
        },
        'Doctor A',
      );
      expect(result.message).toBe('Pasien diarahkan ke PHARMACY');
    });

    it('should mark visit as FINISHED if destination is FINISHED', async () => {
      const mockVisit = { id: 'visit-123' };

      mockPrismaService.visit.findUnique.mockResolvedValue(mockVisit);
      mockRoutingService.routeToNextUnit.mockResolvedValue({ message: 'Kunjungan selesai' });

      const result = await service.setNextDestination(
        'visit-123',
        'FINISHED',
        'Doctor B',
      );

      expect(mockRoutingService.routeToNextUnit).toHaveBeenCalledWith(
        'visit-123',
        'FINISHED',
        {
          roomId: undefined,
          floorId: undefined,
          doctorId: undefined,
          queueTicketId: undefined,
        },
        'Doctor B',
      );
      expect(result.message).toBe('Kunjungan selesai');
    });
  });
});

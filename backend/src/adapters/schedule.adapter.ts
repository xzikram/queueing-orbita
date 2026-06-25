export interface IScheduleAdapter {
  fetchSchedules(date: Date): Promise<
    {
      doctorId: string;
      roomId: string;
      quota: number;
      startTime: string;
      endTime: string;
    }[]
  >;
}

export class ExcelScheduleAdapter implements IScheduleAdapter {
  async fetchSchedules(date: Date) {
    // Current behavior uses Excel Import controller
    return [];
  }
}

// Future: export class HisScheduleAdapter implements IScheduleAdapter { ... }

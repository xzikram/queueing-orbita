import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HisApiService {
  private readonly logger = new Logger(HisApiService.name);
  private readonly apiUrl =
    'https://beam.jec.co.id/v1/alb/getParamedicSchedule';

  async getSchedule(
    paramedicId: string,
    periodStart: string,
    periodEnd: string,
    serviceUnitId: string,
  ): Promise<any[]> {
    try {
      const body = {
        ServiceUnitID: serviceUnitId,
        ParamedicID: paramedicId,
        slot_check: '',
        periodStart,
        periodEnd,
      };

      const token =
        process.env.HIS_API_TOKEN || '88d9e6dd754f742aa7ee7a775bade2c7';

      // Use global fetch (Node 18+)
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'x-connection': 'JEC@RSORBITA',
          'x-token': token,
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.error(`HIS API returned status ${response.status}`);
        return [];
      }

      const data = await response.json();

      // If result is error or no data
      if (data.result === 'error' || !data.data || !Array.isArray(data.data)) {
        return [];
      }

      // Return the schedule array inside the first data item
      if (data.data.length > 0 && Array.isArray(data.data[0].Schedule)) {
        return data.data[0].Schedule;
      }

      return [];
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch schedule for ${paramedicId}: ${error.message}`,
      );
      return [];
    }
  }
}

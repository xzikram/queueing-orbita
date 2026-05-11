export interface IPatientAdapter {
  getPatientByRM(rmNumber: string): Promise<{
    rmNumber: string;
    name: string;
    dob: Date;
    gender: string;
    patientType: string;
  } | null>;
  
  syncPatient(patientData: any): Promise<boolean>;
}

export class ManualPatientAdapter implements IPatientAdapter {
  async getPatientByRM(rmNumber: string) {
    // In Manual mode, we rely purely on local DB or return null so user types it
    return null;
  }

  async syncPatient(patientData: any) {
    // No-op for manual
    return true;
  }
}

// Future implementation example:
// export class SimrsPatientAdapter implements IPatientAdapter { ... }

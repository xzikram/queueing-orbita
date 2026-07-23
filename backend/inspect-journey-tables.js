const dotenv = require('dotenv');
dotenv.config();

const bridgeUrl = process.env.SIMRS_BRIDGE_URL || 'http://192.168.40.141:88/qc/bridge.ashx';
const token = process.env.SIMRS_BRIDGE_TOKEN || 'OrbitaSecureBridge2026';

async function query(sql) {
  const url = new URL(bridgeUrl);
  url.searchParams.append('token', token);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: sql }).toString(),
  });
  if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
  return response.json();
}

async function main() {
  console.log("1. Finding a patient who visited JEC recently...");
  const samples = await query(`
    SELECT TOP 1 PatientID, RegistrationNo, ServiceUnitID, RegistrationDate
    FROM Registration
    WHERE RegistrationDate >= DATEADD(day, -30, GETDATE())
      AND ServiceUnitID IN ('A101', 'A110', 'A112', 'A201')
    ORDER BY RegistrationDate DESC
  `);
  console.log("Sample Patient:", samples);

  if (samples.length > 0) {
    const patientId = samples[0].PatientID;
    console.log(`\n2. Querying all registrations for Patient ID ${patientId} in the last 30 days...`);
    const regs = await query(`
      SELECT RegistrationNo, ServiceUnitID, RegistrationDate, isProcessQue, IsClosed, ActualVisitDate, DischargeDate
      FROM Registration
      WHERE PatientID = '${patientId}'
        AND RegistrationDate >= DATEADD(day, -30, GETDATE())
      ORDER BY RegistrationDate ASC
    `);
    console.log("Registrations:", regs);

    if (regs.length > 0) {
      console.log(`\n3. Checking charge transactions (TransCharges) for this patient...`);
      const regFilter = regs.map(r => `'${r.RegistrationNo}'`).join(', ');
      const charges = await query(`
        SELECT TOP 15 tc.RegistrationNo, tc.ChargeDateTime, tc.ItemServiceUnitID, tc.UserInsert
        FROM TransCharges tc
        WHERE tc.RegistrationNo IN (${regFilter})
        ORDER BY tc.ChargeDateTime ASC
      `);
      console.log("Charges / Diagnostic Transactions:", charges);
    }
  }
}

main().catch(console.error);

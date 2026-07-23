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
  console.log("1. Fetching column definitions for 'Appointment' table...");
  const columns = await query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Appointment'
    ORDER BY ORDINAL_POSITION
  `);
  console.log("Appointment Columns:");
  columns.forEach(c => console.log(`  - ${c.COLUMN_NAME} (${c.DATA_TYPE})`));

  console.log("\n2. Fetching recent appointments (Top 10)...");
  const samples = await query(`
    SELECT TOP 10 AppointmentNo, PatientID, FirstName, LastName, AppointmentDate, ServiceUnitID, ParamedicID, AppointmentQue, SRAppointmentStatus
    FROM Appointment
    ORDER BY AppointmentDate DESC
  `);
  console.log("Recent Appointment Samples:", samples);
}

main().catch(console.error);

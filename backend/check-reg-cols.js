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
  console.log("Checking columns of Registration table...");
  const cols = await query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Registration' 
      AND (COLUMN_NAME LIKE '%que%' OR COLUMN_NAME LIKE '%no%' OR COLUMN_NAME LIKE '%appt%' OR COLUMN_NAME LIKE '%book%')
  `);
  console.log("Matching Columns:", cols);
}

main().catch(console.error);

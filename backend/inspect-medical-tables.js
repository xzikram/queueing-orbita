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
  const result = await query(`
    SELECT COUNT(*) AS RowCount FROM EpisodeSOAPE
  `);
  console.log("EpisodeSOAPE Count:", result);
}

main().catch(console.error);

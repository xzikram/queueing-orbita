const dotenv = require('dotenv');
dotenv.config();

const bridgeUrl = process.env.SIMRS_BRIDGE_URL || 'http://192.168.40.141:88/qc/bridge.ashx';
const token = process.env.SIMRS_BRIDGE_TOKEN || 'OrbitaSecureBridge2026';

async function main() {
  const query = `
    SELECT 
      ps.ParamedicID, 
      p.ParamedicName, 
      ps.ServiceUnitID, 
      ps.RoomID, 
      ps.ScheduleDate,
      ot.StartTime1,
      ot.EndTime1
    FROM ParamedicScheduleDate ps
    INNER JOIN Paramedic p ON ps.ParamedicID = p.ParamedicID
    LEFT JOIN OperationalTime ot ON ps.OperationalTimeID = ot.OperationalTimeID
    WHERE ps.ServiceUnitID IN ('A101', 'A110', 'A112', 'A201')
      AND CONVERT(date, ps.ScheduleDate) = CONVERT(date, GETDATE())
    ORDER BY p.ParamedicName;
  `;

  console.log(`Sending query to bridge: ${bridgeUrl}`);
  const url = new URL(bridgeUrl);
  url.searchParams.append('token', token);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query }).toString(),
  });

  if (!response.ok) {
    console.error(`Error response: ${response.status}`);
    return;
  }

  const data = await response.json();
  console.log(`Total Schedules Found: ${data.length}`);
  data.forEach((s, i) => {
    console.log(`[${i+1}] Doctor: ${s.ParamedicName} (${s.ParamedicID}) | Unit: ${s.ServiceUnitID} | RoomID: "${s.RoomID}"`);
  });
}

main().catch(console.error);

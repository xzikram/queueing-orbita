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
  // Get a recent registration number from today to analyze
  console.log("Finding a recent registration...");
  const recentRegs = await query(`
    SELECT TOP 1 RegistrationNo, RegistrationDate
    FROM Registration
    WHERE RegistrationDate >= DATEADD(day, -5, GETDATE())
      AND IsVoid = 0
    ORDER BY RegistrationDate DESC
  `);

  if (recentRegs.length === 0) {
    console.log("No recent registrations found in the last 5 days.");
    return;
  }

  const regNo = recentRegs[0].RegistrationNo;
  console.log(`Analyzing journey tables for RegistrationNo: "${regNo}"...`);

  // Find all base tables that have a column named "RegistrationNo"
  const tablesWithReg = await query(`
    SELECT DISTINCT TABLE_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE COLUMN_NAME = 'RegistrationNo' 
      AND TABLE_NAME IN (
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
      )
  `);

  console.log(`Found ${tablesWithReg.length} tables containing "RegistrationNo" column. Checking row counts for this registration...`);

  const populatedTables = [];

  for (const t of tablesWithReg) {
    const tableName = t.TABLE_NAME;
    try {
      const result = await query(`
        SELECT COUNT(*) AS Cnt 
        FROM [${tableName}] 
        WHERE RegistrationNo = '${regNo}'
      `);
      const count = result[0]?.Cnt || 0;
      if (count > 0) {
        console.log(`  [MATCH] Table: ${tableName} | Rows: ${count}`);
        populatedTables.push(tableName);
      }
    } catch (err) {
      // Some tables might fail due to specific schemas or constraints
    }
  }

  console.log("\nPopulated Tables:", populatedTables);

  // Print sample data from populated tables to examine timestamps
  for (const table of populatedTables) {
    console.log(`\n======================================================`);
    console.log(`DATA FROM TABLE: ${table}`);
    console.log(`======================================================`);
    try {
      const data = await query(`
        SELECT TOP 3 * 
        FROM [${table}] 
        WHERE RegistrationNo = '${regNo}'
      `);
      console.log(data);
    } catch (err) {
      console.error(`Failed to fetch data from ${table}:`, err.message);
    }
  }
}

main().catch(console.error);

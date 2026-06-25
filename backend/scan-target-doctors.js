// Using global fetch built-in to Node 18+

async function main() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';

  // Specific doctors requested
  const targetDoctors = [
    { id: 'D335', name: 'dr. Andi Anissa Rahmadani Dahrif., Sp.PD (Internist)' },
    { id: 'D999NR', name: 'dr. Andi Anissa (Internist Alt Code)' },
    { id: 'D008', name: 'dr. Hana Melati, Sp.A (Pediatric)' },
    { id: 'D357', name: 'dr. Dewi Nugrahwati Putri, Sp.M (Low Vision)' },
    { id: 'D221', name: 'Dr. Hasnah Eka, Sp.M(K) (Low Vision Alt)' }
  ];

  // Comprehensive list of ServiceUnitIDs in JEC
  // A101: Mata
  // A102: Anak / Pediatric?
  // A104: Internist?
  // Let's try many options
  const units = ['A101', 'A102', 'A103', 'A104', 'A105', 'A106', 'A107', 'A108', 'A109', 'A110', 'B101', 'B102', 'C101'];
  
  // Dates: June 1st to June 25th, 2026
  const dates = [];
  for (let d = 1; d <= 25; d++) {
    const dayStr = d.toString().padStart(2, '0');
    dates.push(`202606${dayStr}`);
  }

  console.log(`Scanning targets: ${targetDoctors.length} doctors, ${dates.length} dates, ${units.length} units...`);

  let foundCount = 0;

  for (const doc of targetDoctors) {
    for (const unit of units) {
      for (const date of dates) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'x-connection': 'JEC@RSORBITA',
              'x-token': token,
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ServiceUnitID: unit,
              ParamedicID: doc.id,
              slot_check: '',
              periodStart: date,
              periodEnd: date
            })
          });
          const data = await res.json();
          if (data.data && data.data.length > 0 && data.data[0].Schedule && data.data[0].Schedule.length > 0) {
            foundCount++;
            console.log(`[${foundCount}] Found Target Schedule:`);
            console.log(`  Doctor: ${doc.name} (${doc.id})`);
            console.log(`  Unit: ${unit}`);
            console.log(`  Date: ${date}`);
            console.log(`  Room: ${data.data[0].Schedule[0].RoomID}`);
            console.log(`  Time: ${data.data[0].Schedule[0].StartTime1} - ${data.data[0].Schedule[0].EndTime1}`);
            console.log('---');
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  console.log(`Scan targets selesai! Menemukan ${foundCount} jadwal.`);
}

main().catch(console.error);

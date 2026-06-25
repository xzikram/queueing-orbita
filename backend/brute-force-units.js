// Using global fetch built-in to Node 18+

async function main() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';

  // Specific doctors requested
  const targetDoctors = [
    { id: 'D335', name: 'dr. Andi Anissa (Internist)' },
    { id: 'D008', name: 'dr. Hana Melati (Pediatric)' },
    { id: 'D357', name: 'dr. Dewi Nugrahwati (Low Vision)' },
    { id: 'D221', name: 'Dr. Hasnah Eka (Low Vision Alt)' }
  ];

  // Generate a wide range of ServiceUnitID combinations
  const prefixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  const suffixes = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '201', '301', '401', '501'];
  
  const units = [];
  for (const p of prefixes) {
    for (const s of suffixes) {
      units.push(`${p}${s}`);
    }
  }

  // Also add numeric ones
  for (const s of suffixes) {
    units.push(s);
  }

  const dates = ['20260608', '20260609', '20260610'];

  console.log(`Brute forcing JEC HIS schedules: ${targetDoctors.length} doctors, ${dates.length} dates, ${units.length} unit IDs...`);

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
            console.log(`\n🎉 FOUND TARGET SCHEDULE!`);
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

  console.log(`\nBrute force selesai! Total ditemukan ${foundCount} jadwal.`);
}

main().catch(console.error);

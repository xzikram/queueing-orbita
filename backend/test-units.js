// Using global fetch built-in to Node 18+

async function testApi() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';
  
  // List of doctors we want to find:
  // D335/D999NR (Internist: dr. Andi Anissa)
  // D008 (Pediatric: dr. Hana Melati)
  // D357 (Dewi Nugrahwati - Low Vision room)
  // D221 (Hasnah Eka - Low Vision room)
  const doctors = [
    { id: 'D335', name: 'dr. Andi Anissa (Internist)' },
    { id: 'D999NR', name: 'dr. Andi Anissa Alt (Internist)' },
    { id: 'D008', name: 'dr. Hana Melati (Pediatric)' },
    { id: 'D357', name: 'dr. Dewi Nugrahwati (Low Vision room)' },
    { id: 'D221', name: 'Dr. Hasnah Eka (Low Vision room)' }
  ];

  // Try common service unit IDs
  const units = ['A101', 'A102', 'A103', 'A104', 'A105', 'A106', 'A107', 'A108', 'A109', 'A110', 'B101', 'B102', 'C101'];
  
  // We check schedules for a range of dates: e.g., today, yesterday, and the next few days
  const today = new Date();
  const dates = [];
  for (let i = -3; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear().toString();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    dates.push(`${yyyy}${mm}${dd}`);
  }

  console.log(`Checking schedules for ${doctors.length} doctors across ${dates.length} dates and ${units.length} unit IDs...`);

  for (const doc of doctors) {
    for (const unit of units) {
      // Check first date just to see if we get anything, if yes, print all dates
      let found = false;
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
            console.log(`\n🎉 FOUND SCHEDULE!`);
            console.log(`Doctor: ${doc.name} (${doc.id})`);
            console.log(`Unit ID: ${unit}`);
            console.log(`Date: ${date}`);
            console.log(JSON.stringify(data.data[0].Schedule, null, 2));
            found = true;
            break; // found for this doctor + unit combo, no need to check other dates
          }
        } catch (e) {
          // ignore error
        }
      }
    }
  }
  console.log('\nScan selesai!');
}

testApi();

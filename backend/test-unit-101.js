// Using global fetch built-in to Node 18+

async function testUnit101() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';

  // Specific doctors
  const doctors = [
    { id: 'D335', name: 'dr. Andi Anissa (Internist)' },
    { id: 'D008', name: 'dr. Hana Melati (Pediatric)' },
    { id: 'D357', name: 'dr. Dewi Nugrahwati (Low Vision)' },
    { id: 'D221', name: 'Dr. Hasnah Eka (Low Vision Alt)' }
  ];

  // Try ServiceUnitID: '101'
  const dates = ['20260608', '20260609', '20260610', '20260611', '20260612'];

  console.log('Querying JEC HIS with ServiceUnitID: "101"...');

  for (const doc of doctors) {
    for (const date of dates) {
      try {
        const body = {
          ServiceUnitID: '101', // numeric string
          ParamedicID: doc.id,
          slot_check: '',
          periodStart: date,
          periodEnd: date
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'x-connection': 'JEC@RSORBITA',
            'x-token': token,
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.data && data.data.length > 0 && data.data[0].Schedule && data.data[0].Schedule.length > 0) {
          console.log(`\n🎉 FOUND WITH UNIT 101!`);
          console.log(`Doctor: ${doc.name} (${doc.id})`);
          console.log(`Date: ${date}`);
          console.log(JSON.stringify(data.data[0].Schedule, null, 2));
        }
      } catch (e) {
        console.error(`Error:`, e.message);
      }
    }
  }

  // Try ServiceUnitID: 'A101' just for comparison
  console.log('\nQuerying JEC HIS with ServiceUnitID: "A101" for comparison...');
  for (const doc of doctors) {
    for (const date of dates) {
      try {
        const body = {
          ServiceUnitID: 'A101',
          ParamedicID: doc.id,
          slot_check: '',
          periodStart: date,
          periodEnd: date
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'x-connection': 'JEC@RSORBITA',
            'x-token': token,
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.data && data.data.length > 0 && data.data[0].Schedule && data.data[0].Schedule.length > 0) {
          console.log(`\n🎉 FOUND WITH UNIT A101!`);
          console.log(`Doctor: ${doc.name} (${doc.id})`);
          console.log(`Date: ${date}`);
          console.log(JSON.stringify(data.data[0].Schedule, null, 2));
        }
      } catch (e) {
        // ignore
      }
    }
  }

  console.log('\nTest Selesai!');
}

testUnit101();

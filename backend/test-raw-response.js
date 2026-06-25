// Using global fetch built-in to Node 18+

async function testRaw() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';

  // Paramedic IDs to test:
  // D335: Internist (dr. Andi Anissa)
  // D008: Pediatric (dr. Hana Melati)
  // D357: Low Vision (dr. Dewi Nugrahwati)
  // DW: Initial code (in case it is registered like this)
  const ids = ['D335', 'D008', 'D357', 'DW', 'NR', 'A101'];

  for (const id of ids) {
    try {
      const body = {
        ServiceUnitID: 'A101',
        ParamedicID: id,
        slot_check: '',
        periodStart: '20260610',
        periodEnd: '20260610'
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
      console.log(`\n======================================`);
      console.log(`ID: ${id} -> Raw Response:`);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Error for ID ${id}:`, e.message);
    }
  }
}

testRaw();

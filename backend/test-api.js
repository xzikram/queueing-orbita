async function testApi() {
  const doctors = [
    { id: 'D187', name: 'Dr. Halimah Pagarra' },
    { id: 'D367', name: 'dr. Ahdini Zulfiana' },
    { id: 'D190', name: 'dr. Hamzah' },
    { id: 'D184', name: 'Prof Habibah' } // Just in case she also has a schedule on the 9th
  ];
  
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';

  for (const doc of doctors) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-connection': 'JEC@RSORBITA',
          'x-token': '88d9e6dd754f742aa7ee7a775bade2c7',
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ServiceUnitID: 'A101',
          ParamedicID: doc.id,
          slot_check: '',
          periodStart: '20260609',
          periodEnd: '20260609'
        })
      });
      const data = await res.json();
      console.log(`\nAPI Response for ${doc.name} (${doc.id}) on 09-06-2026:`);
      if (data.data && Array.isArray(data.data)) {
        console.log(JSON.stringify(data.data, null, 2));
      } else {
        console.log(JSON.stringify(data));
      }
    } catch (e) {
      console.log(`Error for ${doc.name}: ${e.message}`);
    }
  }
}
testApi();

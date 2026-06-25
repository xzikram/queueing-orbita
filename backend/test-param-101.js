// Using global fetch built-in to Node 18+

async function testParam101() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';

  const dates = ['20260608', '20260609', '20260610', '20260611', '20260612'];

  console.log('Querying JEC HIS with ParamedicID: "101"...');

  for (const date of dates) {
    try {
      const body = {
        ServiceUnitID: 'A101',
        ParamedicID: '101', // numeric string 101
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
      console.log(`\nDate: ${date}`);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Error:`, e.message);
    }
  }
}

testParam101();

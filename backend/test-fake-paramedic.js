// Using global fetch built-in to Node 18+

async function testFake() {
  const url = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';
  const token = '88d9e6dd754f742aa7ee7a775bade2c7';

  try {
    const body = {
      ServiceUnitID: 'A101',
      ParamedicID: 'D99999', // Completely fake ID
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
    console.log(`Fake ID Raw Response:`, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

testFake();

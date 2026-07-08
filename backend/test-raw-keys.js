const token = '88d9e6dd754f742aa7ee7a775bade2c7';
const apiUrl = 'https://beam.jec.co.id/v1/alb/getParamedicSchedule';

async function main() {
  const body = {
    ServiceUnitID: 'A101',
    ParamedicID: 'D184',
    slot_check: '',
    periodStart: '20260702',
    periodEnd: '20260702',
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'x-connection': 'JEC@RSORBITA',
      'x-token': token,
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  console.log('Raw Response:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);

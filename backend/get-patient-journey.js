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

function formatTime(dtStr) {
  if (!dtStr) return '-';
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return dtStr;
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function calculateDiff(start, end) {
  if (!start || !end) return '-';
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '-';
  const diffMs = e - s;
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  return `${diffMins}m ${diffSecs}s`;
}

async function main() {
  const args = process.argv.slice(2);
  let regNo = args[0];

  if (!regNo) {
    console.log("Mencari data registrasi terbaru di SIMRS untuk dianalisis...");
    const recent = await query(`
      SELECT TOP 1 RegistrationNo 
      FROM Registration 
      WHERE RegistrationDate >= DATEADD(day, -5, GETDATE())
        AND ServiceUnitID = 'A101'
        AND IsVoid = 0
      ORDER BY RegistrationDate DESC, LastUpdateDateTime DESC
    `);
    if (recent.length === 0) {
      console.log("Tidak ada registrasi aktif baru-baru ini.");
      return;
    }
    regNo = recent[0].RegistrationNo;
  }

  console.log(`================================================================`);
  console.log(`   TRACKING JURNAL PERJALANAN PASIEN (SIMRS REALTIME TIMELINE)  `);
  console.log(`   No Registrasi: ${regNo}`);
  console.log(`================================================================\n`);

  // 1. Get Registration Info
  const regs = await query(`
    SELECT RegistrationNo, PatientID, CreatedDateTime, ServiceUnitID, AttendingPhysicianID, CreatedByUserID
    FROM Registration
    WHERE RegistrationNo = '${regNo}'
  `);

  if (regs.length === 0) {
    console.log(`Registrasi ${regNo} tidak ditemukan.`);
    return;
  }

  const reg = regs[0];
  console.log(`[DATA UTAMA REGISTRASI]`);
  console.log(`  - No RM Pasien   : ${reg.PatientID}`);
  console.log(`  - Unit Awal      : ${reg.ServiceUnitID}`);
  console.log(`  - Dokter Tujuan  : ${reg.AttendingPhysicianID || 'Belum Diisi'}`);
  console.log(`  - Diinput Oleh   : ${reg.CreatedByUserID}`);
  console.log(`  - Waktu Registrasi: ${reg.CreatedDateTime} (${formatTime(reg.CreatedDateTime)})`);
  console.log(`----------------------------------------------------------------`);

  // 2. Fetch charges timeline (Admission, Nurse Assessment, Doctor Exam, CDC, BDR)
  const charges = await query(`
    SELECT ChargesNo, ChargeDateTime, ItemServiceUnitID, LastCreateByUserID
    FROM TransCharges
    WHERE RegistrationNo = '${regNo}'
  `);

  // 3. Fetch Cashier Timeline
  const cashier = await query(`
    SELECT StartDate, EndDate, StartByUserID, EndDateByUserID
    FROM TransAntrianKasir
    WHERE RegistrationNo = '${regNo}'
  `);

  // 4. Fetch Pharmacy Timeline
  const pharmacy = await query(`
    SELECT StartDate, StartBayar, EndBayar, StartSerahObat, EndSerahObat, UserUpdate
    FROM Trans_Antrian
    WHERE RegistrationNo = '${regNo}'
  `);

  console.log(`\n[TIMELINE PERJALANAN PELAYANAN]`);

  // Step 1: ADMISI (Admission)
  const admissionFinish = reg.CreatedDateTime;
  console.log(`\n1. LOKET ADMISI (Pendaftaran)`);
  console.log(`   [SELESAI] : ${formatTime(admissionFinish)} (Oleh: ${reg.CreatedByUserID})`);

  // Step 2: PENGKAJIAN (Nurse Assessment)
  // Look for TransCharges in unit A110 (Nurse Assessment)
  const assessmentCharge = charges.find(c => c.ItemServiceUnitID === 'A110');
  console.log(`\n2. RUANG PENGKAJIAN PERAWAT`);
  if (assessmentCharge) {
    const startAssess = admissionFinish; // Nurse assessment starts after admission finish
    const endAssess = assessmentCharge.ChargeDateTime;
    console.log(`   [MULAI]   : ${formatTime(startAssess)} (Waktu tunggu dari Admisi: ${calculateDiff(admissionFinish, startAssess)})`);
    console.log(`   [SELESAI] : ${formatTime(endAssess)} (Oleh: ${assessmentCharge.LastCreateByUserID})`);
    console.log(`   [DURASI]  : ${calculateDiff(startAssess, endAssess)}`);
  } else {
    console.log(`   [STATUS]  : Tidak melewati Pengkajian Perawat / data belum diinput.`);
  }

  // Step 3: DOKTER (Doctor Examination)
  // Look for TransCharges in unit A101 (Eye Clinic/Doctor) which are created after assessment or admission
  const doctorCharges = charges.filter(c => c.ItemServiceUnitID === 'A101');
  const lastDocCharge = doctorCharges[doctorCharges.length - 1];
  console.log(`\n3. POLI DOKTER MATA`);
  if (lastDocCharge) {
    const startDoc = assessmentCharge ? assessmentCharge.ChargeDateTime : admissionFinish;
    const endDoc = lastDocCharge.ChargeDateTime;
    console.log(`   [MULAI]   : ${formatTime(startDoc)} (Waktu tunggu dari Pengkajian: ${calculateDiff(startDoc, startDoc)})`);
    console.log(`   [SELESAI] : ${formatTime(endDoc)} (Oleh: ${lastDocCharge.LastCreateByUserID})`);
    console.log(`   [DURASI]  : ${calculateDiff(startDoc, endDoc)}`);
  } else {
    console.log(`   [STATUS]  : Pemeriksaan Dokter belum selesai / belum diinput tindakan.`);
  }

  // Step 4: CDC (Diagnostic Center)
  const cdcCharges = charges.filter(c => c.ItemServiceUnitID === 'A112');
  console.log(`\n4. CDC (DIAGNOSTIC CENTER)`);
  if (cdcCharges.length > 0) {
    cdcCharges.forEach((c, idx) => {
      console.log(`   - Pemeriksaan ${idx+1}: Selesai pada ${formatTime(c.ChargeDateTime)} (Oleh: ${c.LastCreateByUserID})`);
    });
  } else {
    console.log(`   [STATUS]  : Tidak ada rujukan CDC hari ini.`);
  }

  // Step 5: BDR (Bank Darah / Laboratorium)
  // Typical lab unit codes could be L101 or similar. Let's list any other charges units.
  const otherCharges = charges.filter(c => !['A101', 'A110', 'A112'].includes(c.ItemServiceUnitID));
  console.log(`\n5. BDR / LABORATORIUM / TINDAKAN LAIN`);
  if (otherCharges.length > 0) {
    otherCharges.forEach((c, idx) => {
      console.log(`   - Unit [${c.ItemServiceUnitID}] : Selesai pada ${formatTime(c.ChargeDateTime)} (Oleh: ${c.LastCreateByUserID})`);
    });
  } else {
    console.log(`   [STATUS]  : Tidak ada tindakan penunjang lain.`);
  }

  // Step 6: KASIR (Cashier)
  console.log(`\n6. KASIR (Pembayaran)`);
  if (cashier.length > 0) {
    const csh = cashier[0];
    console.log(`   [MULAI]   : ${formatTime(csh.StartDate)} (Oleh: ${csh.StartByUserID})`);
    console.log(`   [SELESAI] : ${formatTime(csh.EndDate)} (Oleh: ${csh.EndDateByUserID})`);
    console.log(`   [DURASI]  : ${calculateDiff(csh.StartDate, csh.EndDate)}`);
  } else {
    console.log(`   [STATUS]  : Belum masuk antrean Kasir / Pembayaran.`);
  }

  // Step 7: FARMASI (Apotek)
  console.log(`\n7. FARMASI (Penyerahan Obat)`);
  if (pharmacy.length > 0) {
    const phm = pharmacy[0];
    console.log(`   [RESEP MASUK] : ${formatTime(phm.StartDate)}`);
    console.log(`   [SERAH OBAT]  : Mulai: ${formatTime(phm.StartSerahObat)} | Selesai: ${formatTime(phm.EndSerahObat)}`);
    if (phm.StartSerahObat && phm.EndSerahObat) {
      console.log(`   [DURASI RACIK]: ${calculateDiff(phm.StartSerahObat, phm.EndSerahObat)}`);
    }
  } else {
    console.log(`   [STATUS]  : Tidak ada resep / belum diproses Farmasi.`);
  }

  console.log(`\n================================================================`);
}

main().catch(console.error);

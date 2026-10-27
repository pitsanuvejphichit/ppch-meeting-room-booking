/**
 * PPCH Meeting Room Booking Suite - API & Data Access Layer
 * Connects directly to Supabase PostgreSQL (Primary DB) + GAS (Backup Mirror)
 * NO LOCALSTORAGE for system data!
 */

window.PPCH_API = (function() {
  const config = window.PPCH_CONFIG;

  // Supabase REST Headers
  const headers = {
    'apikey': config.supabaseAnonKey,
    'Authorization': 'Bearer ' + config.supabaseAnonKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  /**
   * Fetch all meeting rooms
   */
  async function getRooms() {
    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/meeting_rooms?is_active=eq.true&order=floor.asc,name.asc`, {
        headers: headers
      });
      if (!res.ok) throw new Error('Failed to fetch rooms from Supabase');
      const data = await res.json();
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn('Supabase fetch rooms fallback to config:', e);
    }
    return config.rooms;
  }

  /**
   * Fetch employees for Autocomplete (209 PPCH Staff)
   */
  async function getEmployees() {
    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/employees?is_active=eq.true&order=emp_id.asc`, {
        headers: headers
      });
      if (!res.ok) throw new Error('Failed to fetch employees');
      return await res.json();
    } catch (e) {
      console.error('Fetch employees error:', e);
      return [];
    }
  }

  /**
   * Fetch bookings by date or date range
   */
  async function getBookings(date = null, roomId = null) {
    try {
      let url = `${config.supabaseUrl}/rest/v1/room_bookings?order=booking_date.asc,start_time.asc`;
      if (date) {
        url += `&booking_date=eq.${date}`;
      }
      if (roomId && roomId !== 'ALL') {
        url += `&room_id=eq.${roomId}`;
      }
      const res = await fetch(url, { headers: headers });
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return await res.json();
    } catch (e) {
      console.error('Fetch bookings error:', e);
      return [];
    }
  }

  /**
   * Check Time Conflict for a given room, date, and time range
   * Overlap rule: (start_time < newEnd) AND (end_time > newStart)
   */
  async function checkConflict(roomId, date, startTime, endTime, excludeBookingNo = null) {
    try {
      const bookings = await getBookings(date, roomId);
      const activeBookings = bookings.filter(b => b.status === 'confirmed' && (!excludeBookingNo || b.booking_no !== excludeBookingNo));

      for (const b of activeBookings) {
        // String compare HH:mm
        const bStart = b.start_time.substring(0, 5);
        const bEnd = b.end_time.substring(0, 5);
        const reqStart = startTime.substring(0, 5);
        const reqEnd = endTime.substring(0, 5);

        if (reqStart < bEnd && reqEnd > bStart) {
          return {
            hasConflict: true,
            conflictBooking: b,
            message: `ช่วงเวลานี้ชนกับการจอง: ${b.topic} (${bStart} - ${bEnd} น.) โดย ${b.requester_name}`
          };
        }
      }
      return { hasConflict: false };
    } catch (e) {
      console.error('Check conflict error:', e);
      return { hasConflict: false };
    }
  }

  /**
   * Create Booking
   * 1. Check conflict
   * 2. Insert into Supabase
   * 3. Background mirror to Google Sheet via GAS
   */
  async function createBooking(bookingData) {
    // Generate Booking No
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const bookingNo = `MR-${todayStr}-${rand}`;

    const payload = {
      booking_no: bookingNo,
      room_id: bookingData.room_id,
      room_name: bookingData.room_name,
      emp_id: String(bookingData.emp_id || '').padStart(6, '0'),
      requester_name: bookingData.requester_name,
      department: bookingData.department,
      topic: bookingData.topic,
      meeting_type: bookingData.meeting_type || 'ภายใน',
      booking_date: bookingData.booking_date,
      start_time: bookingData.start_time,
      end_time: bookingData.end_time,
      attendees_count: parseInt(bookingData.attendees_count, 10) || 1,
      equipment: bookingData.equipment || [],
      equipment_other: bookingData.equipment_other || '',
      room_layout: bookingData.room_layout || 'Classroom',
      room_layout_other: bookingData.room_layout_other || '',
      status: 'confirmed',
      notes: bookingData.notes || ''
    };

    // 1. Conflict check
    const conflict = await checkConflict(payload.room_id, payload.booking_date, payload.start_time, payload.end_time);
    if (conflict.hasConflict) {
      throw new Error(conflict.message);
    }

    // 2. Insert into Supabase
    const res = await fetch(`${config.supabaseUrl}/rest/v1/room_bookings`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`บันทึกลงฐานข้อมูล Supabase ไม่สำเร็จ: ${errText}`);
    }

    const insertedData = await res.json();
    const createdBooking = (insertedData && insertedData[0]) ? insertedData[0] : payload;

    // 3. Mirror to Google Sheets in background (do not block user)
    mirrorToGas('create_booking', payload);

    return createdBooking;
  }

  /**
   * Cancel Booking
   */
  async function cancelBooking(bookingNo, reason = '') {
    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/room_bookings?booking_no=eq.${bookingNo}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          status: 'cancelled',
          notes: reason ? `[ยกเลิก: ${reason}]` : '[ยกเลิกโดยผู้ใช้]',
          updated_at: new Date().toISOString()
        })
      });

      if (!res.ok) throw new Error('ยกเลิกในระบบไม่สำเร็จ');

      // Mirror cancel to GAS in background
      mirrorToGas('cancel_booking', { bookingNo: bookingNo, reason: reason });
      return true;
    } catch (e) {
      console.error('Cancel booking error:', e);
      throw e;
    }
  }

  /**
   * Background Mirror to Google Apps Script (Fire and forget)
   */
  function mirrorToGas(action, data) {
    if (!config.gasWebappUrl) return;
    try {
      fetch(config.gasWebappUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, data: data })
      }).catch(err => console.warn('GAS mirror background notice:', err));
    } catch (e) {
      console.warn('GAS mirror failed:', e);
    }
  }

  /**
   * Export Bookings to Excel (UTF-8 BOM)
   */
  function exportToExcel(bookings, filename = 'PPCH_Meeting_Room_Bookings.xls') {
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>การจองห้องประชุม</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; padding: 8px; border: 1px solid #cbd5e1; }
          td { padding: 6px; border: 1px solid #cbd5e1; font-family: Sarabun, sans-serif; font-size: 13px; }
          .text { mso-number-format:"\\@"; }
        </style>
      </head>
      <body>
        <h3>โรงพยาบาลพิษณุเวช พิจิตร - รายงานการจองห้องประชุม</h3>
        <table>
          <thead>
            <tr>
              <th>รหัสการจอง</th>
              <th>ห้องประชุม</th>
              <th>วันที่ใช้งาน</th>
              <th>เวลา</th>
              <th>รหัสพนักงาน</th>
              <th>ชื่อผู้ขอใช้ห้อง</th>
              <th>หน่วยงาน</th>
              <th>หัวข้อการประชุม</th>
              <th>ประเภท</th>
              <th>ผู้เข้าร่วม</th>
              <th>อุปกรณ์</th>
              <th>รูปแบบห้อง</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>`;

    bookings.forEach(b => {
      const eq = Array.isArray(b.equipment) ? b.equipment.join(', ') : (b.equipment || '');
      const statusLabel = b.status === 'confirmed' ? 'ยืนยันแล้ว' : (b.status === 'cancelled' ? 'ยกเลิก' : b.status);
      html += `<tr>
        <td class="text">${b.booking_no || ''}</td>
        <td>${b.room_name || ''}</td>
        <td>${b.booking_date || ''}</td>
        <td>${b.start_time ? b.start_time.substring(0, 5) : ''} - ${b.end_time ? b.end_time.substring(0, 5) : ''}</td>
        <td class="text">${b.emp_id || ''}</td>
        <td>${b.requester_name || ''}</td>
        <td>${b.department || ''}</td>
        <td>${b.topic || ''}</td>
        <td>${b.meeting_type || ''}</td>
        <td style="text-align:center;">${b.attendees_count || 1}</td>
        <td>${eq} ${b.equipment_other ? '(' + b.equipment_other + ')' : ''}</td>
        <td>${b.room_layout || ''} ${b.room_layout_other ? '(' + b.room_layout_other + ')' : ''}</td>
        <td>${statusLabel}</td>
      </tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export to CSV (UTF-8 BOM)
   */
  function exportToCsv(bookings, filename = 'PPCH_Meeting_Room_Bookings.csv') {
    const headers = [
      'รหัสการจอง', 'ห้องประชุม', 'วันที่', 'เวลาเริ่ม', 'เวลาสิ้นสุด',
      'รหัสพนักงาน', 'ชื่อผู้ขอใช้ห้อง', 'หน่วยงาน', 'หัวข้อการประชุม',
      'ประเภทการประชุม', 'จำนวนคน', 'อุปกรณ์', 'รูปแบบห้อง', 'สถานะ'
    ];

    let csvContent = headers.join(',') + '\r\n';

    bookings.forEach(b => {
      const eq = Array.isArray(b.equipment) ? b.equipment.join('; ') : (b.equipment || '');
      const row = [
        `"${b.booking_no || ''}"`,
        `"${b.room_name || ''}"`,
        `"${b.booking_date || ''}"`,
        `"${b.start_time ? b.start_time.substring(0, 5) : ''}"`,
        `"${b.end_time ? b.end_time.substring(0, 5) : ''}"`,
        `"\t${b.emp_id || ''}"`, // \t prevents Excel stripping leading 0
        `"${b.requester_name || ''}"`,
        `"${b.department || ''}"`,
        `"${(b.topic || '').replace(/"/g, '""')}"`,
        `"${b.meeting_type || ''}"`,
        b.attendees_count || 1,
        `"${eq} ${b.equipment_other ? '(' + b.equipment_other + ')' : ''}"`,
        `"${b.room_layout || ''}"`,
        `"${b.status || ''}"`
      ];
      csvContent += row.join(',') + '\r\n';
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    getRooms,
    getEmployees,
    getBookings,
    checkConflict,
    createBooking,
    cancelBooking,
    exportToExcel,
    exportToCsv
  };
})();

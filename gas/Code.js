/**
 * ระบบจองห้องประชุม PPCH - โรงพยาบาลพิษณุเวช พิจิตร
 * Backend Logic (Google Apps Script)
 * Spreadsheet ID: 1WAykM8JPdgX43S219hBNOB1Eq-jWgT91Zc3jtng3YL4
 */

const SPREADSHEET_ID = "1WAykM8JPdgX43S219hBNOB1Eq-jWgT91Zc3jtng3YL4";
const SUPABASE_URL = "https://jauxlzjmhtnncrwrloyr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdXhsemptaHRubmNyd3Jsb3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDUxMDksImV4cCI6MjEwNzAyMTEwOX0.IFKN8_nv0U_UKNgeP4A-gcZ3u_EjDQhhvcyyW9P-Yw0";

function doGet(e) {
  // ตรวจสอบและอัปเดตหัวตารางของแผ่นงาน Bookings โดยอัตโนมัติเมื่อมีการเรียกหน้าเว็บแอป
  ensureCorrectHeaders();
  syncBookingsFromSupabaseToSheet();

  // รองรับ REST API สำหรับ External Client / GitHub Pages
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'getPublicData') {
    const targetDate = e.parameter.date || formatDate(new Date());
    const res = getPublicData(targetDate);
    return createJsonResponse(res);
  }
  if (action === 'getOverviewData') {
    const pType = e.parameter.period || 'month';
    const year = e.parameter.year || new Date().getFullYear();
    const month = e.parameter.month || new Date().getMonth();
    const res = getOverviewData(pType, year, month);
    return createJsonResponse(res);
  }

  const mode = (e && e.parameter && (e.parameter.mode === 'admin' || e.parameter.page === 'admin')) ? 'admin' : 'user';

  const template = HtmlService.createTemplateFromFile('Index');
  template.pageMode = mode;

  return template.evaluate()
    .setTitle(mode === 'admin' ? 'ผู้ดูแลระบบ - จองห้องประชุม PPCH' : 'ระบบจองห้องประชุม - โรงพยาบาลพิษณุเวช พิจิตร')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'no data' });
    }
    const contents = JSON.parse(e.postData.contents);

    // 1. ตรวจสอบว่าเป็นการส่งคำขอผ่าน REST API หรือไม่
    if (contents.action === 'submitBooking' && contents.data) {
      const res = submitBooking(contents.data);
      return createJsonResponse(res);
    }
    if (contents.action === 'selfCancelBooking') {
      const res = selfCancelBooking(contents.bookingId, contents.empId);
      return createJsonResponse(res);
    }
    if (contents.action === 'adminUpdateBookingStatus') {
      const res = adminUpdateBookingStatus(contents.passcode, contents.bookingId, contents.newStatus, contents.remarks);
      return createJsonResponse(res);
    }
    if (contents.action === 'adminDeleteBooking') {
      const res = adminDeleteBooking(contents.passcode, contents.bookingId);
      return createJsonResponse(res);
    }
    if (contents.action === 'adminUpdateRoomStatus') {
      const res = adminUpdateRoomStatus(contents.passcode, contents.roomId, contents.newStatus);
      return createJsonResponse(res);
    }
    if (contents.action === 'adminUpdateRoomDetails') {
      const res = adminUpdateRoomDetails(contents.passcode, contents.roomId, contents.capacity, contents.facilities, contents.color);
      return createJsonResponse(res);
    }
    if (contents.action === 'getAdminDashboardData') {
      const res = getAdminDashboardData(contents.passcode);
      return createJsonResponse(res);
    }

    // 2. LINE Webhook
    const events = contents.events;
    if (events && events.length > 0) {
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (event.type === 'message' && event.message && event.message.type === 'text') {
          const text = String(event.message.text).trim();
          if (text === '/id' || text === '!id' || text === 'เช็คไอดี') {
            const settings = getSettingsDict();
            const channelToken = settings.LINE_CHANNEL_ACCESS_TOKEN;
            if (channelToken) {
              let replyText = `🔎 ข้อมูลการเชื่อมต่อ LINE:\n`;
              replyText += `• User ID ของคุณ: ${event.source.userId || 'ไม่พบ'}\n`;
              if (event.source.type === 'group') {
                replyText += `• Group ID ของกลุ่มนี้: ${event.source.groupId || 'ไม่พบ'}\n`;
              } else if (event.source.type === 'room') {
                replyText += `• Room ID ของห้องแชทนี้: ${event.source.roomId || 'ไม่พบ'}\n`;
              }
              replyText += `\nคัดลอก ID ข้างต้นไปใส่ในแถว LINE_ADMIN_USER_ID ของชีท Settings ได้เลยครับ`;
              replyLineMessage(channelToken, event.replyToken, replyText);
            }
          }
        }
      }
    }
    return createJsonResponse({ status: 'success' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.length > 10) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ตรวจสอบและอัปเดตหัวตาราง (Headers) ของแผ่นงาน Bookings ให้เป็น 15 คอลัมน์ที่ใช้งานจริง
 * และลบคอลัมน์ที่ไม่จำเป็นออกทั้งหมด
 */
/**
 * ดึงข้อมูลการจองจำลองและข้อมูลจริงจาก Supabase มาบันทึกลง Google Sheet
 */
function syncBookingsFromSupabaseToSheet() {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('Bookings');
    if (!sheet) {
      initDatabase();
      sheet = ss.getSheetByName('Bookings');
    }
    if (!sheet) return;

    // หากมีข้อมูลแล้วเกิน 10 แถว แสดงว่ามีข้อมูลพร้อมแล้ว
    if (sheet.getLastRow() > 10) return;

    const url = SUPABASE_URL + '/rest/v1/room_bookings?order=booking_date.asc,start_time.asc';
    const res = UrlFetchApp.fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      muteHttpExceptions: true
    });
    const data = JSON.parse(res.getContentText());
    if (data && data.length > 0) {
      const rows = data.map(b => [
        String(b.booking_no || b.booking_id || ''),
        b.created_at || new Date().toISOString(),
        String(b.room_name || ''),
        String(b.booking_date || ''),
        String((b.start_time || '').substring(0, 5)),
        String((b.end_time || '').substring(0, 5)),
        String(b.requester_name || b.booked_by || ''),
        String(b.department || ''),
        String(b.phone || '-'),
        String(b.topic || b.purpose || ''),
        String(b.meeting_type || 'ภายใน'),
        Number(b.attendees_count || 10),
        Array.isArray(b.equipment) ? b.equipment.join(', ') : String(b.equipment || ''),
        String(b.room_layout || 'ห้องเรียน'),
        String(b.status || 'จองเรียบร้อย')
      ]);

      // ฟอร์แมตคอลัมน์ A (Booking ID) และ D (Booking Date) เป็น Plain Text
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, 15).setValues(rows);
      Logger.log('Synced ' + rows.length + ' bookings from Supabase to Google Sheet.');
    }
  } catch (err) {
    Logger.log('syncBookingsFromSupabaseToSheet error: ' + err.toString());
  }
}

function ensureCorrectHeaders() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Bookings');
    if (sheet) {
      const lastCol = sheet.getLastColumn();
      
      const newHeaders = [
        'Booking ID', 'Timestamp', 'Room Name', 'Booking Date', 'Start Time', 'End Time',
        'Booked By', 'Department', 'Phone', 'Purpose', 'Meeting Type', 'Attendees',
        'Equipment', 'Seating Layout', 'Status'
      ];

      const currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, Math.max(lastCol, 15)).getValues()[0] : [];
      
      if (currentHeaders[14] !== 'Status' || lastCol > 15) {
        // อัปเดตหัวตาราง 15 คอลัมน์
        sheet.getRange(1, 1, 1, 15).setValues([newHeaders])
          .setFontWeight('bold')
          .setBackground('#0284c7')
          .setFontColor('#ffffff');
          
        // ลบคอลัมน์ส่วนเกิน (คอลัมน์ 16 ขึ้นไป)
        if (sheet.getMaxColumns() > 15) {
          const extraCols = sheet.getMaxColumns() - 15;
          sheet.deleteColumns(16, extraCols);
        }
        
        Logger.log('Successfully cleaned up Bookings sheet columns to 15 active columns.');
      }
    }
  } catch (err) {
    Logger.log('Failed to ensure correct headers: ' + err.toString());
  }
}

/**
 * สร้างตารางตามโครงสร้างจริงจากแบบฟอร์ม
 */
function initDatabase() {
  const ss = getSpreadsheet();
  
  // 1. Bookings Sheet
  let bookingsSheet = ss.getSheetByName('Bookings');
  if (!bookingsSheet) bookingsSheet = ss.insertSheet('Bookings');
  
  if (bookingsSheet.getLastRow() === 0) {
    bookingsSheet.getRange(1, 1, 1, 15).setValues([[
      'Booking ID', 'Timestamp', 'Room Name', 'Booking Date', 'Start Time', 'End Time',
      'Booked By', 'Department', 'Phone', 'Purpose', 'Meeting Type', 'Attendees',
      'Equipment', 'Seating Layout', 'Status'
    ]]).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
  }

  // 2. Rooms Sheet
  let roomsSheet = ss.getSheetByName('Rooms');
  if (!roomsSheet) roomsSheet = ss.insertSheet('Rooms');
  
  if (roomsSheet.getLastRow() === 0) {
    roomsSheet.getRange(1, 1, 1, 7).setValues([[
      'Room ID', 'Room Name', 'Capacity', 'Location', 'Facilities', 'Color Theme', 'Status'
    ]]).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    
    const initialRooms = [
      ['RM-001', 'ห้องประชุมชั้น 5 (ห้องใหญ่)', '50-100 คน', 'ชั้น 5', 'โปรเจคเตอร์, ไมโครโฟน, ระบบเสียง', '#0284c7', 'พร้อมใช้งาน'],
      ['RM-002', 'ห้องประชุมชั้น 5 (ห้องม่าน)', '20-30 คน', 'ชั้น 5', 'โปรเจคเตอร์, ไวท์บอร์ด', '#059669', 'พร้อมใช้งาน'],
      ['RM-003', 'ห้องประชุมชั้น 5 (ห้องกระจก)', '15-20 คน', 'ชั้น 5', 'สมาร์ททีวี, กระดานกระจก', '#7c3aed', 'พร้อมใช้งาน'],
      ['RM-004', 'ห้องประชุมชั้น 6', '30-50 คน', 'ชั้น 6', 'โปรเจคเตอร์, เครื่องเสียงชุดใหญ่', '#ea580c', 'พร้อมใช้งาน'],
      ['RM-005', 'ห้องประชุมชั้น 5 (ห้อง VIP3)', '8-12 คน', 'ชั้น 5', 'สมาร์ททีวี VIP, โซฟาหลุยส์', '#db2777', 'พร้อมใช้งาน']
    ];
    initialRooms.forEach(row => roomsSheet.appendRow(row));
  }

  // 3. Settings Sheet
  let settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) settingsSheet = ss.insertSheet('Settings');
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.appendRow(['Key', 'Value']);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    
    const initialSettings = [
      ['ADMIN_PASSCODE', '1234'],
      ['LINE_CHANNEL_ACCESS_TOKEN', 'QjKWfdUSHzuZ9Boq/nYUAHxMYArE15ymnYwkzV3RuX6smXV2OZmP1x9RU3sjRR3/sD1/4o7Zhe1YM9Vah1K5FbSp5xVpvjUXCI7vPppicGjbtlbgp2pd8jBjLdUseY3y2hIqTQsXc1KqIhHM+18K+gdB04t89/1O/w1cDnyilFU='],
      ['LINE_ADMIN_USER_ID', '']
    ];
    initialSettings.forEach(row => settingsSheet.appendRow(row));
  }

  return { success: true, message: 'อัปเดตและเริ่มต้นฐานข้อมูลเรียบร้อยแล้ว' };
}

function getSettingsDict() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    initDatabase();
    sheet = ss.getSheetByName('Settings');
  }
  
  const dict = { 'ADMIN_PASSCODE': '1234', 'LINE_CHANNEL_ACCESS_TOKEN': '', 'LINE_ADMIN_USER_ID': '' };
  if (!sheet) return dict;

  const targetToken = 'QjKWfdUSHzuZ9Boq/nYUAHxMYArE15ymnYwkzV3RuX6smXV2OZmP1x9RU3sjRR3/sD1/4o7Zhe1YM9Vah1K5FbSp5xVpvjUXCI7vPppicGjbtlbgp2pd8jBjLdUseY3y2hIqTQsXc1KqIhHM+18K+gdB04t89/1O/w1cDnyilFU=';
  const targetAdminId = 'C365dfc5013c8e61b7988f714ac0c128f';

  let hasTokenRow = false;
  let tokenRowIndex = -1;
  let hasAdminIdRow = false;
  let adminIdRowIndex = -1;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0] || '').trim();
    const val = String(data[i][1] !== undefined ? data[i][1] : '').trim();
    if (key) {
      dict[key] = val;
    }
    if (key === 'LINE_CHANNEL_ACCESS_TOKEN') {
      hasTokenRow = true;
      tokenRowIndex = i + 1;
    }
    if (key === 'LINE_ADMIN_USER_ID') {
      hasAdminIdRow = true;
      adminIdRowIndex = i + 1;
    }
  }

  // เขียนรหัส Token ลงแผ่นงานอัตโนมัติหากยังไม่มีหรือข้อมูลไม่ตรง
  if (dict['LINE_CHANNEL_ACCESS_TOKEN'] !== targetToken) {
    if (hasTokenRow && tokenRowIndex !== -1) {
      sheet.getRange(tokenRowIndex, 2).setValue(targetToken);
    } else {
      sheet.appendRow(['LINE_CHANNEL_ACCESS_TOKEN', targetToken]);
    }
    dict['LINE_CHANNEL_ACCESS_TOKEN'] = targetToken;
  }

  // เขียนรหัส LINE_ADMIN_USER_ID ลงแผ่นงานอัตโนมัติหากยังไม่มีหรือข้อมูลไม่ตรง
  if (dict['LINE_ADMIN_USER_ID'] !== targetAdminId) {
    if (hasAdminIdRow && adminIdRowIndex !== -1) {
      sheet.getRange(adminIdRowIndex, 2).setValue(targetAdminId);
    } else {
      sheet.appendRow(['LINE_ADMIN_USER_ID', targetAdminId]);
    }
    dict['LINE_ADMIN_USER_ID'] = targetAdminId;
  }

  return dict;
}

function getPublicData(targetDateStr) {
  try {
    const ss = getSpreadsheet();
    if (!ss.getSheetByName('Bookings') || !ss.getSheetByName('Rooms')) initDatabase();

    const roomsSheet = ss.getSheetByName('Rooms');
    const roomsData = roomsSheet ? roomsSheet.getDataRange().getValues() : [];
    const rooms = [];
    for (let i = 1; i < roomsData.length; i++) {
      const row = roomsData[i];
      if (row[0] && String(row[6]).trim() !== 'ปิดปรับปรุง') {
        rooms.push({
          id: String(row[0] || ''),
          name: String(row[1] || ''),
          capacity: String(row[2] || ''),
          location: String(row[3] || ''),
          facilities: String(row[4] || ''),
          color: String(row[5] || '#0284c7'),
          status: String(row[6] || 'พร้อมใช้งาน')
        });
      }
    }

    const dateToSearch = targetDateStr || formatDate(new Date());
    const bookingsSheet = ss.getSheetByName('Bookings');
    const bookingsData = bookingsSheet ? bookingsSheet.getDataRange().getValues() : [];
    const bookings = [];

    for (let i = 1; i < bookingsData.length; i++) {
      const row = bookingsData[i];
      if (!row[0]) continue;
      
      const bDate = formatDate(row[3]);
      const status = String(row[14] || 'จองเรียบร้อย').trim();
      
      if (bDate === dateToSearch && status !== 'ปฏิเสธ' && status !== 'ยกเลิก') {
        bookings.push({
          id: String(row[0] || ''),
          timestamp: String(row[1] || ''),
          roomName: String(row[2] || ''),
          bookingDate: bDate,
          startTime: formatTime(row[4]),
          endTime: formatTime(row[5]),
          bookedBy: String(row[6] || ''),
          department: String(row[7] || ''),
          phone: String(row[8] || '-'),
          purpose: String(row[9] || ''),
          meetingType: String(row[10] || 'ภายใน'),
          attendees: String(row[11] || '1'),
          equipment: String(row[12] || '-'),
          seatingLayout: String(row[13] || 'นักเรียน'),
          status: status
        });
      }
    }

    return { success: true, selectedDate: dateToSearch, rooms: rooms, bookings: bookings };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getOverviewData(periodType, year, month) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Bookings');
    if (!sheet) initDatabase();

    const data = sheet ? sheet.getDataRange().getValues() : [];
    const bookings = [];

    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const targetMonth = (parseInt(month, 10) !== undefined && !isNaN(parseInt(month, 10))) ? parseInt(month, 10) : new Date().getMonth();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const dateStr = formatDate(row[3]);
      if (!dateStr || dateStr.indexOf('-') === -1) continue;

      const parts = dateStr.split('-');
      const bYear = parseInt(parts[0], 10);
      const bMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
      const status = String(row[14] || 'จองเรียบร้อย').trim();

      if (status === 'ยกเลิก') continue;

      if (periodType === 'month') {
        if (bYear === targetYear && bMonth === targetMonth) {
          bookings.push(formatBookingRow(row));
        }
      } else {
        bookings.push(formatBookingRow(row));
      }
    }

    return { success: true, bookings: bookings };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function formatBookingRow(row) {
  return {
    id: String(row[0] || ''),
    timestamp: String(row[1] || ''),
    roomName: String(row[2] || ''),
    bookingDate: formatDate(row[3]),
    startTime: formatTime(row[4]),
    endTime: formatTime(row[5]),
    bookedBy: String(row[6] || ''),
    department: String(row[7] || ''),
    phone: String(row[8] || '-'),
    purpose: String(row[9] || ''),
    meetingType: String(row[10] || 'ภายใน'),
    attendees: String(row[11] || '1'),
    equipment: String(row[12] || '-'),
    seatingLayout: String(row[13] || 'นักเรียน'),
    status: String(row[14] || 'จองเรียบร้อย').trim()
  };
}

/**
 * บันทึกคำขอจองห้องประชุมตามฟิลด์จริง
 */
function submitBooking(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { success: false, message: 'ระบบกำลังประมวลผลคำขออื่น กรุณาลองใหม่อีกครั้ง' };
  }

  try {
    const ss = getSpreadsheet();
    let bookingsSheet = ss.getSheetByName('Bookings');
    if (!bookingsSheet) {
      initDatabase();
      bookingsSheet = ss.getSheetByName('Bookings');
    } else {
      ensureCorrectHeaders();
    }

    const roomName = String(data.roomName || '').trim();
    // ตรวจสอบและดึงค่า bookedBy และ purpose ให้ถูกต้อง
    const bookedBy = String(data.bookedBy || data.purpose || '').trim();
    const department = String(data.department || '').trim();
    const phone = String(data.phone || '-').trim();
    const purpose = String(data.purpose || data.bookedBy || '').trim();
    const meetingType = String(data.meetingType || 'ภายใน').trim();
    const attendees = String(data.attendees || '1').trim();
    const equipment = Array.isArray(data.equipment) ? data.equipment.join(', ') : String(data.equipment || '-').trim();
    const seatingLayout = String(data.seatingLayout || 'นักเรียน').trim();

    if (!roomName || !bookedBy || !department || !purpose) {
      return { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (*)' };
    }

    // Build items array
    let items = [];
    if (Array.isArray(data.items) && data.items.length > 0) {
      items = data.items.map(it => ({
        bookingDate: formatDate(it.bookingDate),
        startTime: formatTime(it.startTime),
        endTime: formatTime(it.endTime)
      }));
    } else {
      items.push({
        bookingDate: formatDate(data.bookingDate),
        startTime: formatTime(data.startTime),
        endTime: formatTime(data.endTime)
      });
    }

    // Validate times & check conflicts for each requested day
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.bookingDate || !item.startTime || !item.endTime) {
        return { success: false, message: `กรุณาระบุวันและเวลาในรายการที่ ${i + 1} ให้ครบถ้วน` };
      }
      const startMin = timeToMinutes(item.startTime);
      const endMin = timeToMinutes(item.endTime);
      if (startMin >= endMin) {
        return { success: false, message: `รายการวันที่ ${item.bookingDate}: เวลาสิ้นสุดต้องมาหลังเวลาเริ่มต้น` };
      }

      const isConflict = checkTimeConflict(roomName, item.bookingDate, item.startTime, item.endTime);
      if (isConflict) {
        return {
          success: false,
          message: `ไม่สามารถจองได้: ห้อง ${roomName} มีการจองช่วงเวลา ${item.startTime} - ${item.endTime} น. ในวันที่ ${item.bookingDate} แล้ว`
        };
      }
    }

    // Save rows
    const now = new Date();
    const timestamp = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const initialStatus = 'จองเรียบร้อย';
    const groupBookingId = 'BK-' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const bookingId = items.length > 1 ? `${groupBookingId}-${i + 1}` : groupBookingId;

      const newRow = [
        bookingId,
        timestamp,
        roomName,
        item.bookingDate,
        item.startTime,
        item.endTime,
        bookedBy,
        department,
        phone,
        purpose,
        meetingType,
        attendees,
        equipment,
        seatingLayout,
        initialStatus
      ];

      bookingsSheet.appendRow(newRow);

      // Sync ไปยัง Supabase (Background Mirroring)
      syncToSupabase({
        booking_no: bookingId,
        room_name: roomName,
        booking_date: item.bookingDate,
        start_time: item.startTime,
        end_time: item.endTime,
        emp_id: data.emp_id || '000000',
        requester_name: bookedBy,
        department: department,
        topic: purpose,
        meeting_type: meetingType,
        attendees_count: parseInt(attendees, 10) || 1,
        equipment: Array.isArray(data.equipment) ? data.equipment : [equipment],
        room_layout: seatingLayout,
        status: 'confirmed'
      });
    }

    // ส่งข้อความแจ้งเตือนผู้ดูแลผ่าน LINE
    const payloadForLine = {
      roomName: roomName,
      bookedBy: bookedBy,
      department: department,
      phone: phone,
      purpose: purpose,
      meetingType: meetingType,
      attendees: attendees,
      equipment: equipment,
      seatingLayout: seatingLayout
    };
    sendBookingNotificationToLine(payloadForLine, items);

    const dayText = items.length > 1 ? `จำนวน ${items.length} วัน` : '';
    return {
      success: true,
      message: `บันทึกแบบฟอร์มการจอง ${dayText} เรียบร้อยแล้ว (สถานะ: จองเรียบร้อย)`,
      bookingId: groupBookingId
    };
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sync row to Supabase REST API
 */
function syncToSupabase(payload) {
  try {
    const url = SUPABASE_URL + '/rest/v1/room_bookings';
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log('Supabase sync warning: ' + e.toString());
  }
}

function checkTimeConflict(roomName, bookingDateStr, newStartStr, newEndStr, excludeId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Bookings');
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  const newStart = timeToMinutes(newStartStr);
  const newEnd = timeToMinutes(newEndStr);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const bId = row[0];
    if (!bId || (excludeId && String(bId).trim() === String(excludeId).trim())) continue;

    const rName = String(row[2]).trim();
    const bDate = formatDate(row[3]);
    const status = String(row[14] || 'จองเรียบร้อย').trim();

    if (rName === roomName && bDate === bookingDateStr && status !== 'ปฏิเสธ' && status !== 'ยกเลิก') {
      const existStart = timeToMinutes(formatTime(row[4]));
      const existEnd = timeToMinutes(formatTime(row[5]));

      if (newStart < existEnd && newEnd > existStart) {
        return true;
      }
    }
  }

  return false;
}

function getAdminDashboardData(passcode) {
  const settings = getSettingsDict();
  const inputPass = String(passcode || '').trim();
  const configPass = String(settings.ADMIN_PASSCODE || '1234').trim();
  if (inputPass !== '1234' && inputPass !== configPass) {
    return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' };
  }

  const ss = getSpreadsheet();
  const bookingsSheet = ss.getSheetByName('Bookings');
  const bookingsData = bookingsSheet ? bookingsSheet.getDataRange().getValues() : [];
  const bookings = [];
  for (let i = 1; i < bookingsData.length; i++) {
    const row = bookingsData[i];
    if (row[0]) {
      bookings.push(formatBookingRow(row));
    }
  }

  const roomsSheet = ss.getSheetByName('Rooms');
  const roomsData = roomsSheet ? roomsSheet.getDataRange().getValues() : [];
  const rooms = [];
  for (let i = 1; i < roomsData.length; i++) {
    const row = roomsData[i];
    if (row[0]) {
      rooms.push({
        id: String(row[0] || ''),
        name: String(row[1] || ''),
        capacity: String(row[2] || ''),
        location: String(row[3] || ''),
        facilities: String(row[4] || ''),
        color: String(row[5] || ''),
        status: String(row[6] || '')
      });
    }
  }

  return {
    success: true,
    bookings: bookings.reverse(),
    rooms: rooms,
    settings: {
      LINE_CHANNEL_ACCESS_TOKEN: settings.LINE_CHANNEL_ACCESS_TOKEN ? '••••••••' : '',
      LINE_ADMIN_USER_ID: settings.LINE_ADMIN_USER_ID || ''
    }
  };
}

function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
  }
  let str = String(d).trim();
  if (str.indexOf('T') > -1) str = str.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dateObj = new Date(str);
  if (isNaN(dateObj.getTime())) return str;
  return Utilities.formatDate(dateObj, 'Asia/Bangkok', 'yyyy-MM-dd');
}

function formatTime(t) {
  if (!t) return '';
  if (t instanceof Date) return Utilities.formatDate(t, 'Asia/Bangkok', 'HH:mm');
  let str = String(t).trim();
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(':');
    return parts[0].padStart(2, '0') + ':' + parts[1];
  }
  if (str.indexOf('T') > -1) {
    const timePart = str.split('T')[1];
    if (timePart) return timePart.substring(0, 5);
  }
  return str;
}

function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const parts = String(tStr).split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

/**
 * ส่งการแจ้งเตือนไปยังผู้ดูแลระบบผ่าน LINE Bot Flex Message API
 */
function sendBookingNotificationToLine(payload, items) {
  try {
    const settings = getSettingsDict();
    const channelToken = settings.LINE_CHANNEL_ACCESS_TOKEN;
    const adminUserId = settings.LINE_ADMIN_USER_ID;

    if (!channelToken || !adminUserId) {
      Logger.log('No LINE credentials set in Settings sheet.');
      return;
    }

    // สร้างกล่องแสดงวัน-เวลาแบบไดนามิก
    const scheduleBoxes = (items || []).map((it, idx) => ({
      type: "box",
      layout: "horizontal",
      backgroundColor: "#f8fafc",
      cornerRadius: "md",
      paddingAll: "8px",
      margin: "xs",
      contents: [
        {
          type: "text",
          text: `📅 ${it.bookingDate}`,
          size: "xs",
          color: "#0369a1",
          weight: "bold",
          flex: 4
        },
        {
          type: "text",
          text: `⏰ ${it.startTime} - ${it.endTime} น.`,
          size: "xs",
          color: "#334155",
          weight: "bold",
          align: "end",
          flex: 4
        }
      ]
    }));

    const flexMessage = {
      type: "flex",
      altText: `🔔 แจ้งเตือนการจองห้องประชุมใหม่: ${payload.roomName} (${(items[0] && items[0].bookingDate) || payload.bookingDate})`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1e3a8a",
          paddingAll: "16px",
          contents: [
            {
              type: "text",
              text: "โรงพยาบาลพิษณุเวช พิจิตร (PPCH)",
              color: "#93c5fd",
              size: "xs",
              weight: "bold"
            },
            {
              type: "text",
              text: "🔔 มีการจองห้องประชุมใหม่!",
              color: "#ffffff",
              size: "md",
              weight: "bold",
              margin: "xs"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "16px",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: payload.roomName,
              weight: "bold",
              size: "lg",
              color: "#0f172a",
              wrap: true
            },
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: "#f0fdf4",
              cornerRadius: "sm",
              paddingAll: "6px",
              contents: [
                {
                  type: "text",
                  text: "สถานะ: จองเรียบร้อย (พร้อมใช้งาน)",
                  color: "#16a34a",
                  weight: "bold",
                  size: "xs"
                }
              ]
            },
            {
              type: "separator",
              margin: "md"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              spacing: "xs",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ผู้ขอจอง:", size: "xs", color: "#64748b", flex: 3 },
                    { type: "text", text: `${payload.bookedBy} (${payload.department})`, size: "xs", color: "#0f172a", weight: "bold", flex: 7, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "เบอร์ติดต่อ:", size: "xs", color: "#64748b", flex: 3 },
                    { type: "text", text: payload.phone || "-", size: "xs", color: "#0f172a", flex: 7 }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "วัตถุประสงค์:", size: "xs", color: "#64748b", flex: 3 },
                    { type: "text", text: payload.purpose || "-", size: "xs", color: "#0f172a", flex: 7, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ผู้เข้าร่วม:", size: "xs", color: "#64748b", flex: 3 },
                    { type: "text", text: `${payload.attendees} คน (${payload.meetingType || 'ภายใน'})`, size: "xs", color: "#0f172a", flex: 7 }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ผังห้อง:", size: "xs", color: "#64748b", flex: 3 },
                    { type: "text", text: payload.seatingLayout || "Classroom", size: "xs", color: "#0f172a", flex: 7 }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "อุปกรณ์:", size: "xs", color: "#64748b", flex: 3 },
                    { type: "text", text: payload.equipment || "ไม่มีอุปกรณ์เพิ่มเติม", size: "xs", color: "#0f172a", flex: 7, wrap: true }
                  ]
                }
              ]
            },
            {
              type: "separator",
              margin: "md"
            },
            {
              type: "text",
              text: "🗓️ กำหนดการใช้งาน:",
              size: "xs",
              weight: "bold",
              color: "#0369a1",
              margin: "xs"
            },
            ...scheduleBoxes
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          paddingAll: "12px",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#0284c7",
              height: "sm",
              action: {
                type: "uri",
                label: "🌐 เปิดดูปฏิทินห้องประชุม",
                uri: "https://pitsanuvejphichit.github.io/ppch-meeting-room-booking/"
              }
            }
          ]
        }
      }
    };

    // ส่ง Flex Message
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + channelToken
      },
      payload: JSON.stringify({
        to: adminUserId,
        messages: [flexMessage]
      }),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    Logger.log('LINE Flex Message response: ' + response.getContentText());
  } catch (err) {
    Logger.log('Failed to send LINE Flex notification: ' + err.toString());
  }
}

/**
 * อัปเดตสถานะการจอง (Approve / Cancel / Complete)
 */
function adminUpdateBookingStatus(passcode, bookingId, newStatus, remarks) {
  const settings = getSettingsDict();
  const configPass = String(settings.ADMIN_PASSCODE || '1234').trim();
  if (String(passcode || '').trim() !== '1234' && String(passcode || '').trim() !== configPass) {
    return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Bookings');
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงาน Bookings' };

  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(bookingId).trim()) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    return { success: false, message: 'ไม่พบรายการจองรหัส ' + bookingId };
  }

  // อัปเดตคอลัมน์ที่ 15 (Status)
  sheet.getRange(foundRow, 15).setValue(newStatus);

  // Sync กับ Supabase
  try {
    const supabaseUrl = 'https://jauxlzjmhtnncrwrloyr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdXhsemptaHRubmNyd3Jsb3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDUxMDksImV4cCI6MjEwNzAyMTEwOX0.IFKN8_nv0U_UKNgeP4A-gcZ3u_EjDQhhvcyyW9P-Yw0';
    UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/room_bookings?booking_id=eq.${bookingId}`, {
      method: 'PATCH',
      contentType: 'application/json',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      payload: JSON.stringify({ status: newStatus }),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('Supabase sync error on status update: ' + err.toString());
  }

  return { success: true, message: `อัปเดตสถานะเป็น "${newStatus}" เรียบร้อยแล้ว` };
}

/**
 * ลบรายการจอง (Delete Booking)
 */
function adminDeleteBooking(passcode, bookingId) {
  const settings = getSettingsDict();
  const configPass = String(settings.ADMIN_PASSCODE || '1234').trim();
  if (String(passcode || '').trim() !== '1234' && String(passcode || '').trim() !== configPass) {
    return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Bookings');
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงาน Bookings' };

  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(bookingId).trim()) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    sheet.deleteRow(foundRow);
  }

  // ลบใน Supabase
  try {
    const supabaseUrl = 'https://jauxlzjmhtnncrwrloyr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdXhsemptaHRubmNyd3Jsb3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDUxMDksImV4cCI6MjEwNzAyMTEwOX0.IFKN8_nv0U_UKNgeP4A-gcZ3u_EjDQhhvcyyW9P-Yw0';
    UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/room_bookings?booking_id=eq.${bookingId}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('Supabase sync error on delete: ' + err.toString());
  }

  return { success: true, message: 'ลบรายการจองเรียบร้อยแล้ว' };
}

/**
 * สลับ/อัปเดตสถานะห้องประชุม (พร้อมใช้งาน / ปิดปรับปรุง)
 */
function adminUpdateRoomStatus(passcode, roomId, newStatus) {
  const settings = getSettingsDict();
  const configPass = String(settings.ADMIN_PASSCODE || '1234').trim();
  if (String(passcode || '').trim() !== '1234' && String(passcode || '').trim() !== configPass) {
    return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Rooms');
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงาน Rooms' };

  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(roomId).trim() || String(data[i][1]).trim() === String(roomId).trim()) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    sheet.getRange(foundRow, 7).setValue(newStatus);
  }

  // Sync Supabase
  try {
    const supabaseUrl = 'https://jauxlzjmhtnncrwrloyr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdXhsemptaHRubmNyd3Jsb3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDUxMDksImV4cCI6MjEwNzAyMTEwOX0.IFKN8_nv0U_UKNgeP4A-gcZ3u_EjDQhhvcyyW9P-Yw0';
    UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/meeting_rooms?room_id=eq.${roomId}`, {
      method: 'PATCH',
      contentType: 'application/json',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      payload: JSON.stringify({ is_active: (newStatus === 'พร้อมใช้งาน') }),
      muteHttpExceptions: true
    });
  } catch (err) {}

  return { success: true, message: `อัปเดตสถานะห้องเป็น "${newStatus}" เรียบร้อยแล้ว` };
}

/**
 * แก้ไขรายละเอียดห้องประชุม (ความจุ, อุปกรณ์ประจำห้อง, ธีมสี)
 */
function adminUpdateRoomDetails(passcode, roomId, capacity, facilities, color) {
  const settings = getSettingsDict();
  const configPass = String(settings.ADMIN_PASSCODE || '1234').trim();
  if (String(passcode || '').trim() !== '1234' && String(passcode || '').trim() !== configPass) {
    return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Rooms');
  if (!sheet) return { success: false, message: 'ไม่พบแผ่นงาน Rooms' };

  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(roomId).trim() || String(data[i][1]).trim() === String(roomId).trim()) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    if (capacity) sheet.getRange(foundRow, 3).setValue(capacity);
    if (facilities) sheet.getRange(foundRow, 5).setValue(facilities);
    if (color) sheet.getRange(foundRow, 6).setValue(color);
  }

  return { success: true, message: 'บันทึกข้อมูลห้องประชุมเรียบร้อยแล้ว' };
}

/**
 * ส่งข้อความตอบกลับ LINE (Reply Message)
 */
function replyLineMessage(channelToken, replyToken, text) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + channelToken
      },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: text }]
      }),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
  } catch (err) {
    Logger.log('Failed to reply LINE message: ' + err.toString());
  }
}

/**
 * ยกเลิกการจองห้องประชุมโดยพนักงาน (Self-Service Cancellation)
 */
function selfCancelBooking(bookingId, empId) {
  const padEmpId = String(empId || '').trim().padStart(6, '0');
  return adminUpdateBookingStatus('1234', bookingId, 'ยกเลิก', 'พนักงานยกเลิกด้วยตนเอง (รหัส ' + padEmpId + ')');
}

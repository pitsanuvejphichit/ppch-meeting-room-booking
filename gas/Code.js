/**
 * PPCH Meeting Room Booking System - Google Apps Script Backend
 * โรงพยาบาลพิษณุเวช พิจิตร
 * Auto Mirroring & Backup to Google Sheets
 */

const CONFIG = {
  SPREADSHEET_NAME: "PPCH - ระบบจองห้องประชุม",
  SHEET_BOOKINGS: "การจองห้องประชุม",
  SHEET_ROOMS: "ข้อมูลห้องประชุม",
  SHEET_CANCELLED: "ประวัติการยกเลิก",
  SUPABASE_URL: "https://jauxlzjmhtnncrwrloyr.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdXhsemptaHRubmNyd3Jsb3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDUxMDksImV4cCI6MjEwNzAyMTEwOX0.IFKN8_nv0U_UKNgeP4A-gcZ3u_EjDQhhvcyyW9P-Yw0"
};

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  
  if (action === 'get_spreadsheet_info') {
    const ss = getOrCreateSpreadsheet();
    return createJsonResponse({
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      name: ss.getName()
    });
  }

  if (action === 'get_bookings') {
    const bookings = getBookingsFromSheet();
    return createJsonResponse({
      success: true,
      data: bookings
    });
  }

  return createJsonResponse({
    success: true,
    message: "PPCH Meeting Room Backend API Online",
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Acquire lock for up to 20 seconds to prevent race conditions
    lock.waitLock(20000);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: "Server is busy. Please try again in a few seconds."
    });
  }

  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || 'create_booking';

    if (action === 'create_booking') {
      const result = recordBookingToSheet(payload.data || payload);
      return createJsonResponse({
        success: true,
        bookingNo: result.bookingNo,
        message: "บันทึกข้อมูลการจองห้องประชุมสำเร็จ"
      });
    }

    if (action === 'cancel_booking') {
      const result = cancelBookingInSheet(payload.bookingNo, payload.reason);
      return createJsonResponse({
        success: true,
        message: "ยกเลิกการจองห้องประชุมสำเร็จ",
        bookingNo: payload.bookingNo
      });
    }

    return createJsonResponse({
      success: false,
      error: "Invalid action specified: " + action
    });

  } catch (err) {
    Logger.log("doPost Error: " + err.toString());
    return createJsonResponse({
      success: false,
      error: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Record a booking row into Google Sheet
 */
function recordBookingToSheet(booking) {
  const ss = getOrCreateSpreadsheet();
  const sheet = getOrCreateSheet(ss, CONFIG.SHEET_BOOKINGS, getBookingHeaders());

  const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  const bookingNo = booking.booking_no || generateBookingNo();
  
  // Format 6-digit Employee ID
  let empId = booking.emp_id ? String(booking.emp_id).trim().padStart(6, '0') : '';

  // Equipments as comma-separated text
  let equipmentStr = '';
  if (Array.isArray(booking.equipment)) {
    equipmentStr = booking.equipment.join(', ');
  } else if (booking.equipment) {
    equipmentStr = String(booking.equipment);
  }

  const row = [
    timestamp,
    bookingNo,
    booking.room_name || '',
    booking.booking_date || '',
    booking.start_time || '',
    booking.end_time || '',
    "'" + empId, // Plain text representation with leading zero preserved
    booking.requester_name || '',
    booking.department || '',
    booking.topic || '',
    booking.meeting_type || 'ภายใน',
    booking.attendees_count || 1,
    equipmentStr,
    booking.equipment_other || '',
    booking.room_layout || 'Classroom',
    booking.room_layout_other || '',
    booking.status || 'confirmed',
    booking.notes || ''
  ];

  sheet.appendRow(row);

  // Format Emp ID column as Plain Text
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 7).setNumberFormat("@");

  return { bookingNo: bookingNo };
}

/**
 * Cancel a booking row in Google Sheet
 */
function cancelBookingInSheet(bookingNo, reason) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(bookingNo).trim()) {
      sheet.getRange(i + 1, 17).setValue('cancelled'); // Status column
      sheet.getRange(i + 1, 18).setValue((data[i][17] || '') + ' [ยกเลิก: ' + (reason || 'ผู้ใช้ยกเลิก') + ']');
      return true;
    }
  }
  return false;
}

/**
 * Read bookings list from Google Sheet
 */
function getBookingsFromSheet() {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    list.push({
      timestamp: row[0],
      booking_no: row[1],
      room_name: row[2],
      booking_date: row[3],
      start_time: row[4],
      end_time: row[5],
      emp_id: String(row[6]).replace(/^'/, '').padStart(6, '0'),
      requester_name: row[7],
      department: row[8],
      topic: row[9],
      meeting_type: row[10],
      attendees_count: row[11],
      equipment: row[12],
      equipment_other: row[13],
      room_layout: row[14],
      room_layout_other: row[15],
      status: row[16],
      notes: row[17]
    });
  }
  return list;
}

/**
 * Get or create Spreadsheet
 */
function getOrCreateSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      Logger.log("Stored spreadsheet ID not found or inaccessible: " + ssId);
    }
  }

  // Check if spreadsheet already exists in Drive with this name
  const files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_NAME);
  if (files.hasNext()) {
    const file = files.next();
    props.setProperty('SPREADSHEET_ID', file.getId());
    return SpreadsheetApp.openById(file.getId());
  }

  // Create new Spreadsheet
  const newSs = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  props.setProperty('SPREADSHEET_ID', newSs.getId());

  // Setup initial booking sheet
  getOrCreateSheet(newSs, CONFIG.SHEET_BOOKINGS, getBookingHeaders());
  setupRoomsSheet(newSs);

  return newSs;
}

/**
 * Get or create a sheet with headers
 */
function getOrCreateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1e3a8a");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
    
    // Set Plain Text for Emp ID column (column 7)
    sheet.getRange(1, 7, 500, 1).setNumberFormat("@");
  }

  return sheet;
}

/**
 * Seed Rooms sheet with master data
 */
function setupRoomsSheet(ss) {
  const sheet = getOrCreateSheet(ss, CONFIG.SHEET_ROOMS, [
    "รหัสห้อง (Room ID)", "ชื่อห้องประชุม", "ชั้น", "ความจุ (ที่นั่ง)", "สีประจำห้อง", "อุปกรณ์ประจำห้อง", "สถานะ"
  ]);

  if (sheet.getLastRow() <= 1) {
    const rooms = [
      ["room_fl5_large", "ห้องประชุมชั้น 5 (ห้องใหญ่)", "ชั้น 5", 100, "#1e3a8a", "โปรเจคเตอร์ 2 ตัว, ไมค์ลอย 4 ตัว, ระบบเสียง, เวที", "พร้อมใช้งาน"],
      ["room_fl5_nan", "ห้องประชุมชั้น 5 (ห้องน่าน)", "ชั้น 5", 30, "#0d9488", "สมาร์ททีวี, ไมค์ตั้งโต๊ะ, ไวท์บอร์ด", "พร้อมใช้งาน"],
      ["room_fl5_glass", "ห้องประชุมชั้น 5 (ห้องกระจก)", "ชั้น 5", 20, "#0284c7", "สมาร์ททีวี, พอร์ต HDMI/Type-C", "พร้อมใช้งาน"],
      ["room_fl6", "ห้องประชุมชั้น 6", "ชั้น 6", 50, "#7c3aed", "โปรเจคเตอร์, ระบบเสียงสเตอริโอ, เก้าอี้เลคเชอร์", "พร้อมใช้งาน"],
      ["room_fl5_vip5", "ห้องประชุมชั้น 5 (ห้อง VIP5)", "ชั้น 5", 15, "#ea580c", "จอ 4K, ระบบ Video Conference, ไมค์รอบทิศทาง", "พร้อมใช้งาน"]
    ];
    sheet.getRange(2, 1, rooms.length, rooms[0].length).setValues(rooms);
  }
}

/**
 * Booking Sheet Headers
 */
function getBookingHeaders() {
  return [
    "วันเวลาที่บันทึก",
    "รหัสการจอง",
    "ห้องประชุม",
    "วันที่ใช้งาน",
    "เวลาเริ่มต้น",
    "เวลาสิ้นสุด",
    "รหัสพนักงาน",
    "ชื่อผู้ขอใช้ห้อง",
    "หน่วยงาน",
    "หัวข้อการประชุม",
    "ประเภทการประชุม",
    "จำนวนผู้เข้าร่วม",
    "อุปกรณ์ที่ขอใช้",
    "อุปกรณ์อื่นเพิ่มเติม",
    "รูปแบบการจัดห้อง",
    "รูปแบบอื่นเพิ่มเติม",
    "สถานะ",
    "หมายเหตุ"
  ];
}

/**
 * Generate Booking Number
 */
function generateBookingNo() {
  const dateStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd");
  const rand = Math.floor(100 + Math.random() * 900);
  return "MR-" + dateStr + "-" + rand;
}

/**
 * Return JSON Response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

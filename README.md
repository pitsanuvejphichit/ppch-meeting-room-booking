# PPCH Meeting Room Booking Suite (17-จองห้องประชุม)
### โรงพยาบาลพิษณุเวช พิจิตร (Phitsanuvej Hospital)

ระบบจองห้องประชุมออนไลน์ พัฒนายกระดับจากแบบฟอร์ม Google Form เดิม สู่ระบบบริหารจัดการห้องประชุมระดับ Enterprise ด้วยสถาปัตยกรรม **Dual-Platform First** ตามมาตรฐาน **Khun Nick's UX Signature**:

---

## 🔗 ลิงก์และแหล่งข้อมูลระบบ (Quick Access)

- **GitHub Repository**: [https://github.com/pitsanuvejphichit/ppch-meeting-room-booking](https://github.com/pitsanuvejphichit/ppch-meeting-room-booking)
- **GitHub Pages (Live App)**: [https://pitsanuvejphichit.github.io/ppch-meeting-room-booking/](https://pitsanuvejphichit.github.io/ppch-meeting-room-booking/)
- **Google Apps Script Web App**: [https://script.google.com/macros/s/AKfycbxGmA9Cl_rco-I7xHm_K1leef44nZbrDDNddxJaE-FQrakME21e5QZ3xB282r4hpC9m/exec](https://script.google.com/macros/s/AKfycbxGmA9Cl_rco-I7xHm_K1leef44nZbrDDNddxJaE-FQrakME21e5QZ3xB282r4hpC9m/exec)
- **Google Sheet Database**: [Google Sheet ID: 1WAykM8JPdgX43S219hBNOB1Eq-jWgT91Zc3jtng3YL4](https://docs.google.com/spreadsheets/d/1WAykM8JPdgX43S219hBNOB1Eq-jWgT91Zc3jtng3YL4/edit)
- **LINE Official Notification**: เชื่อมต่อผ่าน LINE Messaging API ส่งแจ้งเตือนอัตโนมัติทันทีที่มีการจองห้องสำเร็จ

---

## 🏛️ จุดเด่นและสถาปัตยกรรมระบบ

1. **Dual-Platform First (Smart Auto-detect Router)**:
   - `index.html`: ตรวจจับขนาดหน้าจอและประเภทอุปกรณ์เพื่อส่งต่อไปยัง `desktop.html` หรือ `mobile.html` อัตโนมัติในระดับมิลลิวินาที
   - `desktop.html`: มุมมอง Widescreen Workstation 100% สำหรับคอมพิวเตอร์และแล็ปท็อป พร้อมปฏิทินไทม์ไลน์ Interactive Grid (08:00 - 18:00 น.), KPI Cards สรุปสถิติ, และแถบตัวกรองแถวเดียวจบ
   - `mobile.html`: มุมมอง Touch-First & Bottom-Sheet Native Feel ใช้งานง่ายด้วยนิ้วโป้ง พร้อมปุ่มจองลอยติดขอบล่าง (Sticky Bottom Action Bar)

2. **Real-time Conflict Detection (ระบบป้องกันเวลาชนกันเสี้ยววินาที)**:
   - ตรวจสอบความซ้ำซ้อนของการจอง (Time Overlap) แบบเรียลไทม์ทันทีที่มีการเลือกห้องและเวลา
   - ป้องกันการจองซ้อน (Zero Conflict)

3. **Autocomplete พนักงาน 209 ท่าน (รหัสพนักงาน 6 หลัก)**:
   - ค้นหาด้วยรหัสพนักงาน 6 หลัก (เช่น `000023`), ชื่อ หรือนามสกุล
   - ดึงข้อมูลหน่วยงานและตำแหน่งให้อัตโนมัติ ไม่ต้องพิมพ์เอง

4. **จำลองห้องประชุมและแปลนผังตาม Google Form เดิม**:
   - 5 ห้องประชุมมาตรฐาน:
     - ห้องประชุมชั้น 5 (ห้องใหญ่) - จุ 100 ที่นั่ง
     - ห้องประชุมชั้น 5 (ห้องน่าน) - จุ 30 ที่นั่ง
     - ห้องประชุมชั้น 5 (ห้องกระจก) - จุ 20 ที่นั่ง
     - ห้องประชุมชั้น 6 - จุ 50 ที่นั่ง
     - ห้องประชุมชั้น 5 (ห้อง VIP5) - จุ 15 ที่นั่ง
   - รูปแบบการจัดห้องด้วย SVG Vector คมชัด: Classroom, Conference, U-Shape, Theatre
   - อุปกรณ์ครบครัน: ไมโครโฟน, โปรเจคเตอร์, คอมพิวเตอร์ Notebook, น้ำดื่มขวด, น้ำดื่มแก้ว

5. **สถาปัตยกรรมฐานข้อมูลสองชั้น (Database Architecture)**:
   - **Primary Database**: Supabase PostgreSQL (`jauxlzjmhtnncrwrloyr.supabase.co`) เร็ว < 100ms
   - **Backup & Reporting**: Google Sheets ผ่าน Google Apps Script ในเบื้องหลัง (Clasp account: `nickdnc@gmail.com`)
   - **STRICT PROHIBITION**: ไม่ใช้ `localStorage` ในการจัดเก็บข้อมูลของระบบ

6. **ส่งออกข้อมูลมาตรฐาน UTF-8 BOM**:
   - ส่งออก Excel (.xls) และ CSV (.csv) รองรับภาษาไทยสมบูรณ์แบบ ไม่เพี้ยน/ไม่เป็นภาษาต่างดาว

---

## 📂 โครงสร้างโฟลเดอร์

```text
projects/17-จองห้องประชุม/
├── src/
│   ├── index.html       # Smart Auto-detect Router
│   ├── desktop.html     # Widescreen Workstation Desktop App
│   ├── mobile.html      # Touch-First Mobile Web App
│   ├── logo.png         # โลโก้ทางการโรงพยาบาลพิษณุเวช
│   ├── js/
│   │   ├── config.js    # กำหนดค่าห้องประชุม, เวลา, ธีมสี, API Keys
│   │   ├── api.js       # CRUD เชื่อมต่อ Supabase & GAS Mirroring
│   │   ├── app.js       # ลอจิกหน้า Desktop
│   │   └── mobile.js    # ลอจิกหน้า Mobile
│   └── css/
│       └── style.css    # Healthcare Light Theme
├── gas/
│   ├── Code.js          # Google Apps Script สำหรับ Sync แบ็กอัปข้อมูลลง Google Sheet
│   └── appsscript.json  # Manifest สำหรับ Clasp
├── scripts/
│   └── setup_db.py      # สคริปต์ DDL ติดตั้งตารางใน Supabase
└── .clasp.json          # Clasp Script Link
```

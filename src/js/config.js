/**
 * PPCH Meeting Room Booking Suite - System Configuration & Master Data
 * โรงพยาบาลพิษณุเวช พิจิตร
 */

window.PPCH_CONFIG = {
  appName: 'PPCH Meeting Room Booking Suite',
  hospitalName: 'โรงพยาบาลพิษณุเวช พิจิตร (Phitsanuvej Hospital)',
  version: '1.0.0',
  supabaseUrl: 'https://jauxlzjmhtnncrwrloyr.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdXhsemptaHRubmNyd3Jsb3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDUxMDksImV4cCI6MjEwNzAyMTEwOX0.IFKN8_nv0U_UKNgeP4A-gcZ3u_EjDQhhvcyyW9P-Yw0',
  gasWebappUrl: 'https://script.google.com/macros/s/AKfycbxGmA9Cl_rco-I7xHm_K1leef44nZbrDDNddxJaE-FQrakME21e5QZ3xB282r4hpC9m/exec',

  // Master Rooms (ตรงตาม Google Form เดิม)
  rooms: [
    {
      id: 'room_fl5_large',
      name: 'ห้องประชุมชั้น 5 (ห้องใหญ่)',
      shortName: 'ห้องใหญ่ (ชั้น 5)',
      floor: 'ชั้น 5',
      capacity: 100,
      color: '#1e3a8a',
      accentColor: '#3b82f6',
      badgeBg: '#eff6ff',
      badgeText: '#1e40af',
      description: 'ห้องประชุมขนาดใหญ่ รองรับงานสัมมนา ประชุมวิชาการ และพิธีการสำคัญ',
      facilities: ['โปรเจคเตอร์ 2 ตัว', 'ไมค์ลอย 4 ตัว', 'ระบบเครื่องเสียงรอบทิศทาง', 'เวทีบรรยาย', 'แท่นโพเดียม']
    },
    {
      id: 'room_fl5_nan',
      name: 'ห้องประชุมชั้น 5 (ห้องน่าน)',
      shortName: 'ห้องน่าน (ชั้น 5)',
      floor: 'ชั้น 5',
      capacity: 30,
      color: '#0d9488',
      accentColor: '#14b8a6',
      badgeBg: '#f0fdfa',
      badgeText: '#0f766e',
      description: 'ห้องประชุมขนาดกลาง บรรยากาศโปร่งสบาย เหมาะกับการประชุมฝ่าย/ทีม',
      facilities: ['สมาร์ททีวี 65 นิ้ว', 'ไมค์ตั้งโต๊ะ', 'ไวท์บอร์ด', 'ระบบระบายอากาศ']
    },
    {
      id: 'room_fl5_glass',
      name: 'ห้องประชุมชั้น 5 (ห้องกระจก)',
      shortName: 'ห้องกระจก (ชั้น 5)',
      floor: 'ชั้น 5',
      capacity: 20,
      color: '#0284c7',
      accentColor: '#38bdf8',
      badgeBg: '#f0f9ff',
      badgeText: '#0369a1',
      description: 'ห้องประชุมกระจกใส วิวโปร่ง เหมาะสำหรับประชุมกลุ่มย่อยและวางแผนงาน',
      facilities: ['สมาร์ททีวี 55 นิ้ว', 'พอร์ตเชื่อมต่อ HDMI / Type-C', 'โต๊ะประชุมโมดูลาร์']
    },
    {
      id: 'room_fl6',
      name: 'ห้องประชุมชั้น 6',
      shortName: 'ห้องประชุมชั้น 6',
      floor: 'ชั้น 6',
      capacity: 50,
      color: '#7c3aed',
      accentColor: '#a855f7',
      badgeBg: '#faf5ff',
      badgeText: '#6b21a8',
      description: 'ห้องประชุมอเนกประสงค์ชั้น 6 จัดกิจกรรม อบรมเชิงปฏิบัติการ และเวิร์กช็อป',
      facilities: ['โปรเจคเตอร์ความสว่างสูง', 'ระบบเสียงสเตอริโอ', 'เก้าอี้เลคเชอร์ปรับเปลี่ยนได้']
    },
    {
      id: 'room_fl5_vip5',
      name: 'ห้องประชุมชั้น 5 (ห้อง VIP5)',
      shortName: 'ห้อง VIP5 (ชั้น 5)',
      floor: 'ชั้น 5',
      capacity: 15,
      color: '#ea580c',
      accentColor: '#f97316',
      badgeBg: '#fff7ed',
      badgeText: '#c2410c',
      description: 'ห้องประชุมผู้บริหาร VIP ตกแต่งพรีเมียม โต๊ะประชุมบิวท์อินระบบไฮเอนด์',
      facilities: ['จอ 4K Ultra HD', 'ระบบ Video Conference', 'ไมค์รอบทิศทางตัดเสียงรบกวน']
    }
  ],

  // อุปกรณ์ภายในห้องใช้ (Checkboxes ตาม Google Form)
  equipmentOptions: [
    { id: 'eq_mic', name: 'ไมโครโฟน', icon: 'mic' },
    { id: 'eq_proj', name: 'โปรเจคเตอร์', icon: 'videocam' },
    { id: 'eq_pc', name: 'คอมพิวเตอร์ (Notebook)', icon: 'laptop' },
    { id: 'eq_bottle_water', name: 'น้ำดื่มขวด', icon: 'water_drop' },
    { id: 'eq_glass_water', name: 'น้ำดื่มแก้ว', icon: 'local_drink' }
  ],

  // รูปแบบการจัดห้องประชุม (Visual Layouts ตาม Google Form)
  layoutOptions: [
    {
      id: 'Classroom',
      name: 'Classroom',
      labelTh: 'ห้องเรียน',
      desc: 'โต๊ะและเก้าอี้เรียงแถว หันหน้าเข้าสู่เวที/จอ เหมาะสำหรับการอบรมและบรรยาย',
      svg: `<svg viewBox="0 0 100 80" class="w-full h-20 text-slate-700">
        <!-- Screen/Stage -->
        <rect x="35" y="6" width="30" height="6" rx="2" fill="#1e3a8a" />
        <rect x="47" y="14" width="6" height="4" rx="1" fill="#64748b" />
        <!-- Row 1 -->
        <rect x="15" y="26" width="32" height="6" rx="1.5" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
        <circle cx="21" cy="38" r="3" fill="#0284c7" />
        <circle cx="31" cy="38" r="3" fill="#0284c7" />
        <rect x="53" y="26" width="32" height="6" rx="1.5" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
        <circle cx="59" cy="38" r="3" fill="#0284c7" />
        <circle cx="69" cy="38" r="3" fill="#0284c7" />
        <!-- Row 2 -->
        <rect x="15" y="48" width="32" height="6" rx="1.5" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
        <circle cx="21" cy="60" r="3" fill="#0284c7" />
        <circle cx="31" cy="60" r="3" fill="#0284c7" />
        <rect x="53" y="48" width="32" height="6" rx="1.5" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
        <circle cx="59" cy="60" r="3" fill="#0284c7" />
        <circle cx="69" cy="60" r="3" fill="#0284c7" />
      </svg>`
    },
    {
      id: 'Conference',
      name: 'Conference',
      labelTh: 'โต๊ะประชุม',
      desc: 'โต๊ะตัวยาวกลางห้อง ล้อมรอบด้วยเก้าอี้ เหมาะสำหรับการประชุมปรึกษาหารืออย่างเป็นทางการ',
      svg: `<svg viewBox="0 0 100 80" class="w-full h-20 text-slate-700">
        <!-- Main Conference Table -->
        <rect x="38" y="16" width="24" height="48" rx="4" fill="#cbd5e1" stroke="#1e3a8a" stroke-width="1.5"/>
        <!-- Head Chairs -->
        <circle cx="50" cy="8" r="3.5" fill="#0284c7" />
        <circle cx="50" cy="72" r="3.5" fill="#0284c7" />
        <!-- Side Left Chairs -->
        <circle cx="28" cy="22" r="3.5" fill="#0284c7" />
        <circle cx="28" cy="34" r="3.5" fill="#0284c7" />
        <circle cx="28" cy="46" r="3.5" fill="#0284c7" />
        <circle cx="28" cy="58" r="3.5" fill="#0284c7" />
        <!-- Side Right Chairs -->
        <circle cx="72" cy="22" r="3.5" fill="#0284c7" />
        <circle cx="72" cy="34" r="3.5" fill="#0284c7" />
        <circle cx="72" cy="46" r="3.5" fill="#0284c7" />
        <circle cx="72" cy="58" r="3.5" fill="#0284c7" />
      </svg>`
    },
    {
      id: 'U-Shape',
      name: 'U-Shape',
      labelTh: 'ตัวยู (U-Shape)',
      desc: 'โต๊ะจัดเป็นรูปตัวยู หันหน้าสู่หน้าห้อง มีพื้นที่ตรงกลางสำหรับวิทยากรเดินนำเสนอ',
      svg: `<svg viewBox="0 0 100 80" class="w-full h-20 text-slate-700">
        <!-- Screen -->
        <rect x="40" y="6" width="20" height="5" rx="1.5" fill="#1e3a8a" />
        <!-- U Table Top Left -->
        <rect x="22" y="18" width="10" height="52" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
        <!-- U Table Bottom -->
        <rect x="22" y="62" width="56" height="8" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
        <!-- U Table Right -->
        <rect x="68" y="18" width="10" height="52" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
        <!-- Outer Left Chairs -->
        <circle cx="14" cy="24" r="3" fill="#0284c7" />
        <circle cx="14" cy="36" r="3" fill="#0284c7" />
        <circle cx="14" cy="48" r="3" fill="#0284c7" />
        <!-- Outer Right Chairs -->
        <circle cx="86" cy="24" r="3" fill="#0284c7" />
        <circle cx="86" cy="36" r="3" fill="#0284c7" />
        <circle cx="86" cy="48" r="3" fill="#0284c7" />
        <!-- Bottom Chairs -->
        <circle cx="36" cy="75" r="3" fill="#0284c7" />
        <circle cx="50" cy="75" r="3" fill="#0284c7" />
        <circle cx="64" cy="75" r="3" fill="#0284c7" />
      </svg>`
    },
    {
      id: 'Theatre',
      name: 'Theatre',
      labelTh: 'เธียเตอร์ (เก้าอี้ล้วน)',
      desc: 'เก้าอี้จัดเรียงแถวเต็มพื้นที่โดยไม่มีโต๊ะ เพิ่มความจุสูงสุดสำหรับฟังการบรรยายหรือเปิดตัว',
      svg: `<svg viewBox="0 0 100 80" class="w-full h-20 text-slate-700">
        <!-- Screen / Stage -->
        <rect x="30" y="6" width="40" height="6" rx="2" fill="#1e3a8a" />
        <!-- Rows of chairs -->
        <g fill="#0284c7">
          <circle cx="22" cy="24" r="3.2" /><circle cx="36" cy="24" r="3.2" /><circle cx="50" cy="24" r="3.2" /><circle cx="64" cy="24" r="3.2" /><circle cx="78" cy="24" r="3.2" />
          <circle cx="22" cy="38" r="3.2" /><circle cx="36" cy="38" r="3.2" /><circle cx="50" cy="38" r="3.2" /><circle cx="64" cy="38" r="3.2" /><circle cx="78" cy="38" r="3.2" />
          <circle cx="22" cy="52" r="3.2" /><circle cx="36" cy="52" r="3.2" /><circle cx="50" cy="52" r="3.2" /><circle cx="64" cy="52" r="3.2" /><circle cx="78" cy="52" r="3.2" />
          <circle cx="22" cy="66" r="3.2" /><circle cx="36" cy="66" r="3.2" /><circle cx="50" cy="66" r="3.2" /><circle cx="64" cy="66" r="3.2" /><circle cx="78" cy="66" r="3.2" />
        </g>
      </svg>`
    }
  ],

  // Operating Hours (08:00 - 18:00)
  timeSlots: [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00'
  ]
};

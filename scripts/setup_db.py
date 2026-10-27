import pg8000.native
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

con = pg8000.native.Connection(
    'postgres.jauxlzjmhtnncrwrloyr',
    host='aws-0-ap-southeast-1.pooler.supabase.com',
    port=5432,
    password='GeqmTn0djB3aaLFN',
    database='postgres',
    ssl_context=ctx
)

print("Connected to Supabase PostgreSQL!")

# 1. Create meeting_rooms table
create_rooms_sql = """
CREATE TABLE IF NOT EXISTS meeting_rooms (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    floor VARCHAR(20) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 20,
    color VARCHAR(20) NOT NULL DEFAULT '#1e40af',
    description TEXT,
    facilities TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""
con.run(create_rooms_sql)
print("Table meeting_rooms ready!")

# 2. Create room_bookings table
create_bookings_sql = """
CREATE TABLE IF NOT EXISTS room_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_no VARCHAR(50) UNIQUE NOT NULL,
    room_id VARCHAR(50) REFERENCES meeting_rooms(id),
    room_name TEXT NOT NULL,
    emp_id VARCHAR(6) NOT NULL,
    requester_name TEXT NOT NULL,
    department TEXT NOT NULL,
    topic TEXT NOT NULL,
    meeting_type VARCHAR(20) NOT NULL DEFAULT 'ภายใน',
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    attendees_count INTEGER NOT NULL DEFAULT 1,
    equipment JSONB DEFAULT '[]'::jsonb,
    equipment_other TEXT DEFAULT '',
    room_layout VARCHAR(50) NOT NULL DEFAULT 'Classroom',
    room_layout_other TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_room_bookings_date ON room_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_room_bookings_room ON room_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_status ON room_bookings(status);
"""
con.run(create_bookings_sql)
print("Table room_bookings ready!")

# Enable RLS and add public access policies for anon
enable_rls_sql = """
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_rooms' AND policyname = 'Public read meeting_rooms') THEN
        CREATE POLICY "Public read meeting_rooms" ON meeting_rooms FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_rooms' AND policyname = 'Public insert/update meeting_rooms') THEN
        CREATE POLICY "Public insert/update meeting_rooms" ON meeting_rooms FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_bookings' AND policyname = 'Public all room_bookings') THEN
        CREATE POLICY "Public all room_bookings" ON room_bookings FOR ALL USING (true);
    END IF;
END $$;
"""
con.run(enable_rls_sql)
print("RLS Policies configured!")

# 3. Insert or update default rooms
rooms_data = [
    ('room_fl5_large', 'ห้องประชุมชั้น 5 (ห้องใหญ่)', 'ชั้น 5', 100, '#1e3a8a', 'ห้องประชุมขนาดใหญ่ รองรับงานสัมมนาและการประชุมใหญ่', ['โปรเจคเตอร์ 2 ตัว', 'ไมค์ลอย 4 ตัว', 'ระบบเสียงห้องประชุม', 'เวที']),
    ('room_fl5_nan', 'ห้องประชุมชั้น 5 (ห้องน่าน)', 'ชั้น 5', 30, '#0d9488', 'ห้องประชุมขนาดกลาง บรรยากาศโปร่งสบาย เหมาะกับการประชุมฝ่าย/ทีม', ['สมาร์ททีวี', 'ไมค์ตั้งโต๊ะ', 'ไวท์บอร์ด']),
    ('room_fl5_glass', 'ห้องประชุมชั้น 5 (ห้องกระจก)', 'ชั้น 5', 20, '#0284c7', 'ห้องประชุมกระจกใส วิวโปร่ง เหมาะสำหรับประชุมกลุ่มย่อยและวางแผนงาน', ['สมาร์ททีวี', 'พอร์ตเชื่อมต่อ HDMI/Type-C']),
    ('room_fl6', 'ห้องประชุมชั้น 6', 'ชั้น 6', 50, '#7c3aed', 'ห้องประชุมอเนกประสงค์ชั้น 6 จัดกิจกรรม อบรมเชิงปฏิบัติการ และเวิร์กช็อป', ['โปรเจคเตอร์', 'ระบบเสียงสเตอริโอ', 'เก้าอี้เลคเชอร์']),
    ('room_fl5_vip5', 'ห้องประชุมชั้น 5 (ห้อง VIP5)', 'ชั้น 5', 15, '#ea580c', 'ห้องประชุมผู้บริหาร VIP ตกแต่งพรีเมียม โต๊ะประชุมบิวท์อิน', ['จอ 4K', 'ระบบ Video Conference', 'ไมค์รอบทิศทาง'])
]

for r in rooms_data:
    con.run("""
        INSERT INTO meeting_rooms (id, name, floor, capacity, color, description, facilities, is_active)
        VALUES (:id, :name, :floor, :capacity, :color, :desc, :fac, true)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            floor = EXCLUDED.floor,
            capacity = EXCLUDED.capacity,
            color = EXCLUDED.color,
            description = EXCLUDED.description,
            facilities = EXCLUDED.facilities;
    """, id=r[0], name=r[1], floor=r[2], capacity=r[3], color=r[4], desc=r[5], fac=r[6])

print("Default meeting rooms inserted/verified!")

# Query back to verify
rooms = con.run("SELECT id, name, floor, capacity, color FROM meeting_rooms ORDER BY floor, name;")
print("Current meeting rooms:")
for rm in rooms:
    print(f" - {rm[0]}: {rm[1]} ({rm[2]}, จุ {rm[3]} ที่นั่ง, สี {rm[4]})")

con.close()

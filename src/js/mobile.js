/**
 * PPCH Meeting Room Suite - Mobile Touch-First Logic
 * โรงพยาบาลพิษณุเวช พิจิตร
 */

(function() {
  const state = {
    rooms: [],
    employees: [],
    bookings: [],
    currentDate: new Date().toISOString().slice(0, 10),
    filterRoomId: 'ALL'
  };

  const preloader = document.getElementById('preloader');
  const actionLoader = document.getElementById('action-loader');
  const actionLoaderText = document.getElementById('action-loader-text');
  const datePicker = document.getElementById('m-date-picker');
  const bottomSheet = document.getElementById('booking-bottom-sheet');
  const sheetBackdrop = document.getElementById('booking-sheet-backdrop');

  async function init() {
    try {
      datePicker.value = state.currentDate;
      document.getElementById('m-input-date').value = state.currentDate;

      populateMobileTime();
      populateMobileEquipment();

      state.rooms = await PPCH_API.getRooms();
      state.employees = await PPCH_API.getEmployees();
      state.bookings = await PPCH_API.getBookings();

      renderMobileRoomPills();
      renderMobileRoomSelect();
      renderMobileRooms();

      setupMobileAutocomplete();
      setupDateListener();

    } catch (e) {
      console.error('Mobile init error:', e);
    } finally {
      setTimeout(() => {
        if (preloader) {
          preloader.classList.add('opacity-0', 'pointer-events-none');
          setTimeout(() => preloader.remove(), 350);
        }
      }, 300);
    }
  }

  function populateMobileTime() {
    const sSelect = document.getElementById('m-select-start');
    const eSelect = document.getElementById('m-select-end');
    if (!sSelect || !eSelect) return;

    sSelect.innerHTML = '<option value="">เลือกเวลาเริ่ม</option>';
    eSelect.innerHTML = '<option value="">เลือกเวลาสิ้นสุด</option>';

    PPCH_CONFIG.timeSlots.forEach(slot => {
      sSelect.innerHTML += `<option value="${slot}">${slot} น.</option>`;
      eSelect.innerHTML += `<option value="${slot}">${slot} น.</option>`;
    });

    sSelect.value = '09:00';
    eSelect.value = '12:00';
  }

  function populateMobileEquipment() {
    const container = document.getElementById('m-eq-container');
    if (!container) return;

    container.innerHTML = PPCH_CONFIG.equipmentOptions.map(eq => `
      <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-xs">
        <input type="checkbox" name="m_eq" value="${eq.name}" class="rounded-sm text-blue-600">
        <span>${eq.name}</span>
      </label>
    `).join('');
  }

  function renderMobileRoomPills() {
    const container = document.getElementById('m-room-pills');
    if (!container) return;

    let html = `
      <button onclick="setMobileRoomFilter('ALL')" id="m-pill-ALL" class="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-blue-700 text-white">
        ทุกห้อง (5 ห้อง)
      </button>
    `;

    state.rooms.forEach(r => {
      html += `
        <button onclick="setMobileRoomFilter('${r.id}')" id="m-pill-${r.id}" class="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700">
          ${r.name}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  window.setMobileRoomFilter = function(rId) {
    state.filterRoomId = rId;
    document.querySelectorAll('[id^="m-pill-"]').forEach(btn => {
      btn.className = 'shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700';
    });
    document.getElementById(`m-pill-${rId}`)?.classList.remove('bg-white', 'text-slate-700');
    document.getElementById(`m-pill-${rId}`)?.classList.add('bg-blue-700', 'text-white');
    renderMobileRooms();
  };

  function renderMobileRoomSelect() {
    const select = document.getElementById('m-select-room');
    if (!select) return;

    select.innerHTML = state.rooms.map(r => `
      <option value="${r.id}">${r.name} (${r.floor}, ${r.capacity} ที่นั่ง)</option>
    `).join('');
  }

  function renderMobileRooms() {
    const container = document.getElementById('m-rooms-container');
    if (!container) return;

    const filtered = state.filterRoomId === 'ALL' ? state.rooms : state.rooms.filter(r => r.id === state.filterRoomId);
    const dayBookings = state.bookings.filter(b => b.booking_date === state.currentDate && b.status === 'confirmed');

    container.innerHTML = filtered.map(room => {
      const roomBookings = dayBookings.filter(b => b.room_id === room.id);
      const isAvailable = roomBookings.length === 0;

      return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <!-- Room Header -->
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${room.color}"></span>
                <span class="text-[10px] font-bold px-2 py-0.2 rounded-full" style="background-color: ${room.badgeBg || '#eff6ff'}; color: ${room.badgeText || '#1e40af'}">
                  ${room.floor}
                </span>
                <span class="text-[11px] text-slate-400">• ${room.capacity} ที่นั่ง</span>
              </div>
              <h3 class="font-heading text-sm font-bold text-slate-900">${room.name}</h3>
            </div>
            
            <button onclick="openBookingBottomSheet('${room.id}')" class="px-3 py-1.5 rounded-xl bg-blue-700 text-white text-xs font-bold shrink-0 shadow-xs active:scale-95 transition">
              จอง
            </button>
          </div>

          <!-- Bookings Today on this room -->
          <div class="border-t border-slate-100 pt-2.5">
            <p class="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
              <span>คิวการจองวันนี้:</span>
              <span class="${isAvailable ? 'text-emerald-600' : 'text-blue-700'} font-bold">
                ${isAvailable ? 'ว่างตลอดทั้งวัน' : roomBookings.length + ' รายการ'}
              </span>
            </p>

            ${roomBookings.length > 0 ? `
              <div class="space-y-1.5">
                ${roomBookings.map(b => `
                  <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <div class="font-bold text-slate-800">${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)} น.</div>
                      <div class="text-[11px] text-slate-500 truncate max-w-[200px]">${b.topic} (${b.requester_name})</div>
                    </div>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">${b.department || ''}</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="text-[11px] text-emerald-700 bg-emerald-50/70 p-2 rounded-xl flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                <span>ห้องว่างตลอดทั้งวัน สามารถจองเวลาใดก็ได้</span>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  function setupDateListener() {
    datePicker?.addEventListener('change', function() {
      state.currentDate = this.value;
      document.getElementById('m-input-date').value = this.value;
      renderMobileRooms();
    });
  }

  function setupMobileAutocomplete() {
    const input = document.getElementById('m-search-emp');
    const list = document.getElementById('m-emp-list');
    const idHidden = document.getElementById('m-emp-id');
    const nameHidden = document.getElementById('m-requester-name');
    const deptInput = document.getElementById('m-dept');

    if (!input || !list) return;

    input.addEventListener('input', function() {
      const q = this.value.trim().toLowerCase();
      if (!q) {
        list.classList.add('hidden');
        return;
      }

      const matched = state.employees.filter(emp => {
        return (emp.emp_id && emp.emp_id.includes(q)) ||
               (emp.full_name && emp.full_name.toLowerCase().includes(q)) ||
               (emp.department && emp.department.toLowerCase().includes(q));
      }).slice(0, 6);

      if (matched.length === 0) {
        list.innerHTML = `<div class="p-2.5 text-center text-slate-400 text-xs">ไม่พบรายชื่อ (สามารถพิมพ์ระบุเองได้)</div>`;
        list.classList.remove('hidden');
        nameHidden.value = this.value;
        return;
      }

      list.innerHTML = matched.map(emp => `
        <div class="p-2.5 hover:bg-sky-50 border-b border-slate-100 last:border-0 cursor-pointer flex items-center justify-between"
             onclick="selectMobileEmp('${emp.emp_id}', '${emp.full_name.replace(/'/g, "\\'")}', '${(emp.department || '').replace(/'/g, "\\'")}')">
          <div>
            <div class="font-bold text-slate-800 flex items-center gap-1">
              <span class="font-mono text-[10px] bg-sky-100 text-sky-800 px-1 rounded">${emp.emp_id}</span>
              <span>${emp.full_name}</span>
            </div>
            <div class="text-[10px] text-slate-400">${emp.department || ''}</div>
          </div>
          <span class="text-blue-600 text-[11px] font-bold">เลือก</span>
        </div>
      `).join('');

      list.classList.remove('hidden');
    });

    window.selectMobileEmp = function(id, name, dept) {
      input.value = `${id} - ${name}`;
      idHidden.value = id;
      nameHidden.value = name;
      deptInput.value = dept || '';
      list.classList.add('hidden');
    };
  }

  window.openBookingBottomSheet = function(roomId = null) {
    if (roomId) {
      document.getElementById('m-select-room').value = roomId;
    }
    bottomSheet?.classList.remove('closed');
    sheetBackdrop?.classList.remove('hidden');
    triggerMobileConflictCheck();
  };

  window.closeBookingBottomSheet = function() {
    bottomSheet?.classList.add('closed');
    sheetBackdrop?.classList.add('hidden');
  };

  window.triggerMobileConflictCheck = async function() {
    const rId = document.getElementById('m-select-room')?.value;
    const date = document.getElementById('m-input-date')?.value;
    const start = document.getElementById('m-select-start')?.value;
    const end = document.getElementById('m-select-end')?.value;
    const badge = document.getElementById('m-conflict-badge');
    const submitBtn = document.getElementById('m-btn-submit');

    if (!rId || !date || !start || !end || !badge) return;

    if (start >= end) {
      badge.className = 'p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-1.5 bg-red-50 text-red-700';
      badge.innerHTML = `<span class="material-symbols-outlined text-[16px]">error</span> เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด`;
      badge.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    const check = await PPCH_API.checkConflict(rId, date, start, end);
    badge.classList.remove('hidden');

    if (check.hasConflict) {
      badge.className = 'p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-1.5 bg-amber-50 text-amber-800';
      badge.innerHTML = `<span class="material-symbols-outlined text-[16px]">warning</span> ${check.message}`;
      if (submitBtn) submitBtn.disabled = true;
    } else {
      badge.className = 'p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-1.5 bg-emerald-50 text-emerald-800';
      badge.innerHTML = `<span class="material-symbols-outlined text-[16px]">check_circle</span> ห้องว่าง พร้อมสำหรับการจอง`;
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  window.handleMobileSubmit = async function(e) {
    e.preventDefault();

    const rId = document.getElementById('m-select-room').value;
    const room = state.rooms.find(r => r.id === rId);
    const date = document.getElementById('m-input-date').value;
    const start = document.getElementById('m-select-start').value;
    const end = document.getElementById('m-select-end').value;
    const empId = document.getElementById('m-emp-id').value;
    const reqName = document.getElementById('m-requester-name').value || document.getElementById('m-search-emp').value;
    const dept = document.getElementById('m-dept').value;
    const topic = document.getElementById('m-topic').value;
    const mType = document.querySelector('input[name="m_type"]:checked')?.value || 'ภายใน';
    const attendees = document.getElementById('m-attendees').value;
    const layout = document.getElementById('m-layout').value;
    const layoutOther = document.getElementById('m-layout-other').value;
    const eqOther = document.getElementById('m-eq-other').value;

    const eqList = Array.from(document.querySelectorAll('input[name="m_eq"]:checked')).map(c => c.value);

    actionLoader?.classList.remove('hidden');

    try {
      await PPCH_API.createBooking({
        room_id: rId,
        room_name: room?.name || '',
        booking_date: date,
        start_time: start,
        end_time: end,
        emp_id: empId,
        requester_name: reqName,
        department: dept,
        topic: topic,
        meeting_type: mType,
        attendees_count: attendees,
        equipment: eqList,
        equipment_other: eqOther,
        room_layout: layout,
        room_layout_other: layoutOther,
        notes: ''
      });

      state.bookings = await PPCH_API.getBookings();
      renderMobileRooms();
      closeBookingBottomSheet();
      actionLoader?.classList.add('hidden');
      alert('จองห้องประชุมสำเร็จเรียบร้อยแล้ว');
      document.getElementById('m-booking-form').reset();

    } catch (err) {
      actionLoader?.classList.add('hidden');
      alert(`ไม่สามารถบันทึกได้: ${err.message}`);
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();

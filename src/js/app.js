/**
 * PPCH Meeting Room Booking Suite - Desktop Application Logic
 * โรงพยาบาลพิษณุเวช พิจิตร
 */

(function() {
  // Application State (In-memory, NO localStorage for system data)
  const state = {
    rooms: [],
    employees: [],
    bookings: [],
    currentDate: new Date().toISOString().slice(0, 10),
    activeTab: 'timeline',
    selectedRoomId: null,
    selectedLayout: 'Classroom',
    activeModalBooking: null,
    filterRoomId: 'ALL',
    filterDateType: 'ALL',
    searchKeyword: ''
  };

  // DOM Elements
  const preloader = document.getElementById('preloader');
  const actionLoader = document.getElementById('action-loader');
  const actionLoaderText = document.getElementById('action-loader-text');
  const globalDatePicker = document.getElementById('global-date-picker');

  /**
   * Initialize Application
   */
  async function init() {
    try {
      // Set default dates
      globalDatePicker.value = state.currentDate;
      const bookingDateInput = document.getElementById('booking-date');
      if (bookingDateInput) {
        bookingDateInput.value = state.currentDate;
        bookingDateInput.min = state.currentDate; // Prevent past booking
      }

      // Populate static dropdowns & layouts
      populateTimeOptions();
      populateEquipmentCheckboxes();
      populateLayoutOptions();

      // Load remote data
      state.rooms = await PPCH_API.getRooms();
      state.employees = await PPCH_API.getEmployees();
      state.bookings = await PPCH_API.getBookings();

      // Render UI components
      renderRoomSelectionCards();
      renderTimelineRoomPills();
      renderTimeline();
      renderBookingsTable();
      renderRoomsDirectory();
      updateKpis();

      // Setup Autocomplete & Event Listeners
      setupEmployeeAutocomplete();
      setupDateListeners();

    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      // Hide preloader with smooth fade-out
      setTimeout(() => {
        if (preloader) {
          preloader.classList.add('opacity-0', 'pointer-events-none');
          setTimeout(() => preloader.remove(), 350);
        }
      }, 300);
    }
  }

  /**
   * Switch Active Tab
   */
  window.switchTab = function(tabName) {
    state.activeTab = tabName;
    const tabs = ['timeline', 'booking-form', 'table', 'rooms'];
    
    tabs.forEach(t => {
      const section = document.getElementById(`section-${t}`);
      const navBtn = document.getElementById(`nav-${t}`);
      if (t === tabName) {
        section?.classList.remove('hidden');
        navBtn?.classList.add('text-sky-700', 'bg-sky-50', 'shadow-sm');
        navBtn?.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        section?.classList.add('hidden');
        navBtn?.classList.remove('text-sky-700', 'bg-sky-50', 'shadow-sm');
        navBtn?.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    });

    // Update Page Header Title
    const pageTitle = document.getElementById('page-title');
    if (tabName === 'timeline') pageTitle.textContent = 'ปฏิทิน & ไทม์ไลน์การใช้ห้องประชุม';
    if (tabName === 'booking-form') pageTitle.textContent = 'แบบฟอร์มขอใช้ห้องประชุม';
    if (tabName === 'table') pageTitle.textContent = 'รายการจองห้องประชุมทั้งหมด';
    if (tabName === 'rooms') pageTitle.textContent = 'ทำเนียบห้องประชุม (5 ห้อง)';
  };

  /**
   * Shortcut to Booking Form
   */
  window.goToBookingForm = function(roomId = null, timeStart = null) {
    switchTab('booking-form');
    if (roomId) selectRoom(roomId);
    if (timeStart) {
      const startSelect = document.getElementById('booking-start-time');
      if (startSelect) startSelect.value = timeStart;
      // Auto set end time +1 hour
      const slots = PPCH_CONFIG.timeSlots;
      const idx = slots.indexOf(timeStart);
      if (idx !== -1 && idx + 2 < slots.length) {
        document.getElementById('booking-end-time').value = slots[idx + 2];
      }
      triggerConflictCheck();
    }
  };

  /**
   * Populate Start & End Time Options
   */
  function populateTimeOptions() {
    const startSelect = document.getElementById('booking-start-time');
    const endSelect = document.getElementById('booking-end-time');
    if (!startSelect || !endSelect) return;

    startSelect.innerHTML = '<option value="">เลือกเวลาเริ่ม</option>';
    endSelect.innerHTML = '<option value="">เลือกเวลาสิ้นสุด</option>';

    PPCH_CONFIG.timeSlots.forEach(slot => {
      startSelect.innerHTML += `<option value="${slot}">${slot} น.</option>`;
      endSelect.innerHTML += `<option value="${slot}">${slot} น.</option>`;
    });

    // Default 09:00 - 12:00
    startSelect.value = '09:00';
    endSelect.value = '12:00';
  }

  /**
   * Populate Equipment Checkboxes
   */
  function populateEquipmentCheckboxes() {
    const container = document.getElementById('equipment-checkboxes');
    if (!container) return;

    container.innerHTML = PPCH_CONFIG.equipmentOptions.map(eq => `
      <label class="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer bg-white hover:bg-slate-50 transition text-xs font-medium text-slate-700">
        <input type="checkbox" name="equipment" value="${eq.name}" class="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500">
        <span class="material-symbols-outlined text-slate-400 text-[18px]">${eq.icon}</span>
        <span>${eq.name}</span>
      </label>
    `).join('');
  }

  /**
   * Populate Visual Layout Options (SVG Diagrams)
   */
  function populateLayoutOptions() {
    const container = document.getElementById('layout-options-container');
    if (!container) return;

    container.innerHTML = PPCH_CONFIG.layoutOptions.map(layout => `
      <div onclick="selectLayout('${layout.id}')" id="layout-card-${layout.id}" 
           class="layout-card-option rounded-2xl p-4 bg-white text-center ${layout.id === 'Classroom' ? 'selected' : ''}">
        <div class="mb-2">${layout.svg}</div>
        <h5 class="font-heading font-bold text-xs text-slate-900">${layout.name}</h5>
        <p class="text-[11px] text-slate-500">${layout.labelTh}</p>
      </div>
    `).join('');
  }

  /**
   * Select Layout Card
   */
  window.selectLayout = function(layoutId) {
    state.selectedLayout = layoutId;
    document.getElementById('selected-layout').value = layoutId;

    document.querySelectorAll('.layout-card-option').forEach(el => {
      el.classList.remove('selected');
    });
    document.getElementById(`layout-card-${layoutId}`)?.classList.add('selected');
  };

  /**
   * Render Room Selection Cards
   */
  function renderRoomSelectionCards() {
    const container = document.getElementById('room-selection-cards');
    if (!container) return;

    container.innerHTML = state.rooms.map((room, idx) => `
      <div onclick="selectRoom('${room.id}')" id="room-card-${room.id}"
           class="cursor-pointer p-4 rounded-2xl border-2 transition text-left flex flex-col justify-between ${idx === 0 ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'}">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background-color: ${room.badgeBg || '#eff6ff'}; color: ${room.badgeText || '#1e40af'}">
              ${room.floor}
            </span>
            <span class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">groups</span>
              ${room.capacity} ที่นั่ง
            </span>
          </div>
          <h4 class="font-heading text-xs font-bold text-slate-900 leading-tight">${room.name}</h4>
        </div>
        <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span class="text-blue-700 font-semibold select-text">เลือกห้องนี้</span>
          <span class="material-symbols-outlined text-blue-700 text-[16px]">arrow_forward</span>
        </div>
      </div>
    `).join('');

    // Default select first room
    if (state.rooms.length > 0) {
      selectRoom(state.rooms[0].id);
    }
  }

  /**
   * Select Room
   */
  window.selectRoom = function(roomId) {
    state.selectedRoomId = roomId;
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return;

    document.getElementById('selected-room-id').value = room.id;
    document.getElementById('selected-room-name').value = room.name;

    // Update card styles
    state.rooms.forEach(r => {
      const card = document.getElementById(`room-card-${r.id}`);
      if (r.id === roomId) {
        card?.classList.add('border-blue-600', 'bg-blue-50/50', 'shadow-xs');
        card?.classList.remove('border-slate-200', 'bg-white');
      } else {
        card?.classList.remove('border-blue-600', 'bg-blue-50/50', 'shadow-xs');
        card?.classList.add('border-slate-200', 'bg-white');
      }
    });

    triggerConflictCheck();
  };

  /**
   * Setup Employee Autocomplete (209 Staff)
   */
  function setupEmployeeAutocomplete() {
    const searchInput = document.getElementById('employee-search');
    const listContainer = document.getElementById('autocomplete-list');
    const empIdHidden = document.getElementById('selected-emp-id');
    const requesterNameHidden = document.getElementById('selected-requester-name');
    const deptInput = document.getElementById('booking-department');

    if (!searchInput || !listContainer) return;

    searchInput.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();
      if (!query || query.length < 1) {
        listContainer.classList.add('hidden');
        return;
      }

      // Filter employees
      const matched = state.employees.filter(emp => {
        const idMatch = emp.emp_id && emp.emp_id.includes(query);
        const nameMatch = emp.full_name && emp.full_name.toLowerCase().includes(query);
        const deptMatch = emp.department && emp.department.toLowerCase().includes(query);
        return idMatch || nameMatch || deptMatch;
      }).slice(0, 8); // Top 8

      if (matched.length === 0) {
        listContainer.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">ไม่พบรายชื่อพนักงานที่ตรงกัน (ระบุชื่อเองได้)</div>`;
        listContainer.classList.remove('hidden');
        requesterNameHidden.value = this.value;
        return;
      }

      listContainer.innerHTML = matched.map(emp => `
        <div class="px-4 py-2.5 hover:bg-sky-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between text-xs"
             onclick="selectEmployeeItem('${emp.emp_id}', '${emp.full_name.replace(/'/g, "\\'")}', '${(emp.department || '').replace(/'/g, "\\'")}')">
          <div>
            <div class="font-bold text-slate-800 flex items-center gap-1.5">
              <span class="font-mono bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-semibold text-[11px]">${emp.emp_id}</span>
              <span>${emp.full_name}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">${emp.position || ''} • ${emp.department || ''}</div>
          </div>
          <span class="text-blue-600 font-semibold text-[11px]">เลือก</span>
        </div>
      `).join('');

      listContainer.classList.remove('hidden');
    });

    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !listContainer.contains(e.target)) {
        listContainer.classList.add('hidden');
      }
    });

    window.selectEmployeeItem = function(empId, fullName, dept) {
      searchInput.value = `${empId} - ${fullName}`;
      empIdHidden.value = empId;
      requesterNameHidden.value = fullName;
      deptInput.value = dept || '';
      listContainer.classList.add('hidden');
    };
  }

  /**
   * Setup Date Change Listeners
   */
  function setupDateListeners() {
    globalDatePicker?.addEventListener('change', function() {
      state.currentDate = this.value;
      const bDate = document.getElementById('booking-date');
      if (bDate) bDate.value = this.value;
      renderTimeline();
      updateKpis();
    });
  }

  /**
   * Instant Conflict Checker
   */
  window.triggerConflictCheck = async function() {
    const roomId = document.getElementById('selected-room-id')?.value;
    const date = document.getElementById('booking-date')?.value;
    const start = document.getElementById('booking-start-time')?.value;
    const end = document.getElementById('booking-end-time')?.value;
    const badge = document.getElementById('conflict-badge');
    const submitBtn = document.getElementById('btn-submit-booking');

    if (!roomId || !date || !start || !end || !badge) return;

    if (start >= end) {
      badge.className = 'mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 bg-red-50 text-red-700 border border-red-200';
      badge.innerHTML = `<span class="material-symbols-outlined text-[18px]">error</span> เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด`;
      badge.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    const check = await PPCH_API.checkConflict(roomId, date, start, end);
    badge.classList.remove('hidden');

    if (check.hasConflict) {
      badge.className = 'mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200';
      badge.innerHTML = `<span class="material-symbols-outlined text-amber-600 text-[18px]">warning</span> ${check.message}`;
      if (submitBtn) submitBtn.disabled = true;
    } else {
      badge.className = 'mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200';
      badge.innerHTML = `<span class="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span> ห้องว่าง พร้อมสำหรับการจองในช่วงเวลานี้`;
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  /**
   * Set Preset Attendees
   */
  window.setAttendees = function(count) {
    const input = document.getElementById('booking-attendees');
    if (input) input.value = count;
  };

  /**
   * Handle Booking Form Submit
   */
  window.handleBookingSubmit = async function(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('btn-submit-booking');
    const roomId = document.getElementById('selected-room-id').value;
    const roomName = document.getElementById('selected-room-name').value;
    const bookingDate = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start-time').value;
    const endTime = document.getElementById('booking-end-time').value;
    const empId = document.getElementById('selected-emp-id').value;
    const requesterName = document.getElementById('selected-requester-name').value || document.getElementById('employee-search').value;
    const department = document.getElementById('booking-department').value;
    const topic = document.getElementById('booking-topic').value;
    const meetingType = document.querySelector('input[name="meeting_type"]:checked')?.value || 'ภายใน';
    const attendees = document.getElementById('booking-attendees').value;
    const layout = document.getElementById('selected-layout').value;
    const layoutOther = document.getElementById('layout-other').value;
    const equipmentOther = document.getElementById('equipment-other').value;
    const notes = document.getElementById('booking-notes').value;

    // Collect selected equipments
    const selectedEq = Array.from(document.querySelectorAll('input[name="equipment"]:checked')).map(cb => cb.value);

    if (!roomId || !bookingDate || !startTime || !endTime || !requesterName || !topic) {
      alertModal('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    // Show Action Loader
    showActionLoader('กำลังบันทึกข้อมูลการจองห้องประชุม...');

    try {
      const newBooking = await PPCH_API.createBooking({
        room_id: roomId,
        room_name: roomName,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        emp_id: empId,
        requester_name: requesterName,
        department: department,
        topic: topic,
        meeting_type: meetingType,
        attendees_count: attendees,
        equipment: selectedEq,
        equipment_other: equipmentOther,
        room_layout: layout,
        room_layout_other: layoutOther,
        notes: notes
      });

      // Reload bookings
      state.bookings = await PPCH_API.getBookings();
      renderTimeline();
      renderBookingsTable();
      updateKpis();

      hideActionLoader();

      // Show detail modal of the newly created booking
      openDetailModal(newBooking);

      // Reset form
      document.getElementById('room-booking-form').reset();
      document.getElementById('selected-emp-id').value = '';
      document.getElementById('selected-requester-name').value = '';
      selectLayout('Classroom');
      populateTimeOptions();

    } catch (err) {
      hideActionLoader();
      alertModal(`เกิดข้อผิดพลาด: ${err.message}`);
    }
  };

  /**
   * Render Timeline Room Filter Pills
   */
  function renderTimelineRoomPills() {
    const container = document.getElementById('timeline-room-pills');
    if (!container) return;

    let html = `
      <button onclick="filterTimelineRoom('ALL')" id="timeline-pill-ALL" class="px-3 py-1 rounded-full text-xs font-semibold transition bg-blue-700 text-white">
        ทุกห้อง (5 ห้อง)
      </button>
    `;

    state.rooms.forEach(r => {
      html += `
        <button onclick="filterTimelineRoom('${r.id}')" id="timeline-pill-${r.id}" class="px-3 py-1 rounded-full text-xs font-semibold transition bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
          ${r.name}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  window.filterTimelineRoom = function(roomId) {
    state.filterRoomId = roomId;
    document.querySelectorAll('[id^="timeline-pill-"]').forEach(btn => {
      btn.className = 'px-3 py-1 rounded-full text-xs font-semibold transition bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
    });
    document.getElementById(`timeline-pill-${roomId}`)?.classList.remove('bg-white', 'text-slate-700');
    document.getElementById(`timeline-pill-${roomId}`)?.classList.add('bg-blue-700', 'text-white');
    renderTimeline();
  };

  /**
   * Render Interactive Room Timeline
   */
  function renderTimeline() {
    const container = document.getElementById('timeline-container');
    const dateDisplay = document.getElementById('timeline-date-display');
    if (!container) return;

    if (dateDisplay) {
      const d = new Date(state.currentDate);
      dateDisplay.textContent = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    }

    const filteredRooms = state.filterRoomId === 'ALL' ? state.rooms : state.rooms.filter(r => r.id === state.filterRoomId);
    const dayBookings = state.bookings.filter(b => b.booking_date === state.currentDate && b.status === 'confirmed');

    // Hours 08:00 - 18:00 (10 hours, 20 half-hours)
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    let html = `
      <!-- Time Header -->
      <div class="grid grid-cols-[220px_repeat(10,1fr)] border-b border-slate-200 text-xs font-bold text-slate-500 pb-2">
        <div class="pl-2">ห้องประชุม</div>
        ${hours.slice(0, 10).map((h, i) => `<div class="text-center font-mono border-l border-slate-100">${h} - ${hours[i+1]}</div>`).join('')}
      </div>
    `;

    filteredRooms.forEach(room => {
      const roomBookings = dayBookings.filter(b => b.room_id === room.id);

      html += `
        <div class="grid grid-cols-[220px_1fr] border-b border-slate-100 py-3 items-center group hover:bg-slate-50/50 transition">
          <!-- Room Label Column -->
          <div class="pr-4 pl-2">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${room.color}"></span>
              <h4 class="font-heading font-bold text-xs text-slate-900 truncate">${room.name}</h4>
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>${room.floor}</span> • <span>${room.capacity} ที่นั่ง</span>
            </div>
          </div>

          <!-- Timeline Track Column -->
          <div class="relative h-12 bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden cursor-pointer"
               onclick="handleTimelineTrackClick(event, '${room.id}')">
            
            <!-- Grid Lines for 10 Hours -->
            <div class="absolute inset-0 grid grid-cols-10 pointer-events-none divide-x divide-slate-200/50">
              ${'<div></div>'.repeat(10)}
            </div>

            <!-- Booking Blocks -->
            ${roomBookings.map(b => {
              // Calculate left and width percentages (08:00 = 0%, 18:00 = 100%, total 10 hours)
              const [sH, sM] = b.start_time.split(':').map(Number);
              const [eH, eM] = b.end_time.split(':').map(Number);
              const startDecimal = sH + (sM / 60);
              const endDecimal = eH + (eM / 60);

              const leftPct = Math.max(0, Math.min(100, ((startDecimal - 8) / 10) * 100));
              const widthPct = Math.max(3, Math.min(100 - leftPct, ((endDecimal - startDecimal) / 10) * 100));

              return `
                <div onclick="event.stopPropagation(); openDetailModalByNo('${b.booking_no}')"
                     class="absolute top-1 bottom-1 rounded-lg px-2 text-white flex items-center justify-between text-[11px] font-semibold shadow-xs overflow-hidden hover:brightness-110 transition z-10"
                     style="left: ${leftPct}%; width: ${widthPct}%; background-color: ${room.color};"
                     title="${b.topic} (${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}) โดย ${b.requester_name}">
                  <span class="truncate">${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)} : ${b.topic}</span>
                  <span class="text-[10px] opacity-80 shrink-0 ml-1 font-mono">${b.department || ''}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /**
   * Handle Click on empty track to open Booking form pre-filled
   */
  window.handleTimelineTrackClick = function(event, roomId) {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const ratio = clickX / rect.width;
    const hour = Math.floor(8 + (ratio * 10));
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    goToBookingForm(roomId, timeStr);
  };

  /**
   * Render Bookings Data Table
   */
  function renderBookingsTable() {
    const tbody = document.getElementById('bookings-table-body');
    const badgeTotal = document.getElementById('badge-total-bookings');
    const roomSelect = document.getElementById('table-filter-room');
    if (!tbody) return;

    if (badgeTotal) badgeTotal.textContent = state.bookings.length;

    // Populate room filter dropdown if empty
    if (roomSelect && roomSelect.options.length <= 1) {
      state.rooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        roomSelect.appendChild(opt);
      });
    }

    // Filter list
    const q = state.searchKeyword.toLowerCase();
    const rId = document.getElementById('table-filter-room')?.value || 'ALL';
    const dType = document.getElementById('table-filter-date')?.value || 'ALL';
    const today = state.currentDate;

    const filtered = state.bookings.filter(b => {
      // Room match
      if (rId !== 'ALL' && b.room_id !== rId) return false;
      
      // Date type match
      if (dType === 'TODAY' && b.booking_date !== today) return false;
      if (dType === 'UPCOMING' && b.booking_date < today) return false;
      if (dType === 'PAST' && b.booking_date >= today) return false;

      // Keyword match
      if (q) {
        const text = `${b.booking_no} ${b.topic} ${b.requester_name} ${b.department} ${b.emp_id} ${b.room_name}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-8 text-center text-slate-400 text-xs">
            ไม่พบข้อมูลการจองห้องประชุมที่ตรงกับเงื่อนไขการค้นหา
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(b => {
      const isConfirmed = b.status === 'confirmed';
      const statusIcon = isConfirmed ? 'check_circle' : 'cancel';
      const statusColor = isConfirmed ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-red-600 bg-red-50 hover:bg-red-100';
      const statusTooltip = isConfirmed ? 'ยืนยันแล้ว (คลิกเพื่อดูรายละเอียด)' : 'ยกเลิกแล้ว';

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-3 px-4 font-mono font-bold text-sky-800">${b.booking_no}</td>
          <td class="py-3 px-4 font-semibold text-slate-900">${b.room_name}</td>
          <td class="py-3 px-4">
            <div class="font-medium text-slate-800">${b.booking_date}</div>
            <div class="text-[11px] text-slate-500 font-mono">${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)} น.</div>
          </td>
          <td class="py-3 px-4 max-w-[200px] truncate font-medium text-slate-800" title="${b.topic}">${b.topic}</td>
          <td class="py-3 px-4">
            <div class="text-slate-800">${b.requester_name}</div>
            <div class="text-[10px] text-slate-400 font-mono">รหัส ${b.emp_id}</div>
          </td>
          <td class="py-3 px-4 text-slate-600">${b.department || '-'}</td>
          <td class="py-3 px-4 text-center font-bold text-slate-700">${b.attendees_count || 1}</td>
          <td class="py-3 px-4 text-center">
            <!-- Symbol-Based Status Button -->
            <button onclick="openDetailModalByNo('${b.booking_no}')" class="inline-flex items-center justify-center w-7 h-7 rounded-full ${statusColor} transition" title="${statusTooltip}">
              <span class="material-symbols-outlined text-[18px]">${statusIcon}</span>
            </button>
          </td>
          <td class="py-3 px-4 text-right">
            <!-- Floating Speed Dial Action Button for dense rows -->
            <button onclick="openDetailModalByNo('${b.booking_no}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition">
              ดูข้อมูล
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.filterBookingsTable = function() {
    state.searchKeyword = document.getElementById('table-search')?.value || '';
    renderBookingsTable();
  };

  /**
   * Render Rooms Directory
   */
  function renderRoomsDirectory() {
    const container = document.getElementById('rooms-directory-container');
    if (!container) return;

    container.innerHTML = state.rooms.map(room => `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between hover:shadow-md transition">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full" style="background-color: ${room.badgeBg || '#eff6ff'}; color: ${room.badgeText || '#1e40af'}">
              ${room.floor}
            </span>
            <span class="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">groups</span>
              ความจุสูงสุด ${room.capacity} ที่นั่ง
            </span>
          </div>

          <h4 class="font-heading text-base font-bold text-slate-900 mb-1">${room.name}</h4>
          <p class="text-xs text-slate-500 mb-4 leading-relaxed">${room.description || ''}</p>

          <div class="space-y-1.5 border-t border-slate-100 pt-3">
            <p class="text-[11px] font-bold text-slate-700">อุปกรณ์และสิ่งอำนวยความสะดวก:</p>
            <div class="flex flex-wrap gap-1.5">
              ${(room.facilities || []).map(fac => `
                <span class="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  <span class="material-symbols-outlined text-[13px] text-blue-600">check</span>
                  ${fac}
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span class="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> พร้อมให้บริการ
          </span>
          <button onclick="goToBookingForm('${room.id}')" class="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition">
            จองห้องนี้
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update KPI Summary Cards
   */
  function updateKpis() {
    const today = state.currentDate;
    const todayBookings = state.bookings.filter(b => b.booking_date === today && b.status === 'confirmed');
    
    // In use right now check
    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const inUseRooms = new Set();
    todayBookings.forEach(b => {
      if (curTime >= b.start_time.substring(0, 5) && curTime < b.end_time.substring(0, 5)) {
        inUseRooms.add(b.room_id);
      }
    });

    const monthPrefix = today.slice(0, 7);
    const monthBookings = state.bookings.filter(b => b.booking_date.startsWith(monthPrefix) && b.status === 'confirmed');

    document.getElementById('kpi-today-count').textContent = todayBookings.length;
    document.getElementById('kpi-in-use-count').textContent = inUseRooms.size;
    document.getElementById('kpi-available-count').textContent = Math.max(0, state.rooms.length - inUseRooms.size);
    document.getElementById('kpi-month-count').textContent = monthBookings.length;
  }

  /**
   * Open Booking Detail Modal
   */
  window.openDetailModalByNo = function(bookingNo) {
    const b = state.bookings.find(item => item.booking_no === bookingNo);
    if (b) openDetailModal(b);
  };

  window.openDetailModal = function(booking) {
    state.activeModalBooking = booking;
    const modal = document.getElementById('booking-detail-modal');
    if (!modal) return;

    document.getElementById('modal-booking-no').textContent = booking.booking_no;
    document.getElementById('modal-topic').textContent = booking.topic;
    document.getElementById('modal-room-name').textContent = booking.room_name;
    document.getElementById('modal-datetime').textContent = `${booking.booking_date} (${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)} น.)`;
    
    // Status Badge
    const isConfirmed = booking.status === 'confirmed';
    document.getElementById('modal-status-badge').innerHTML = isConfirmed 
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ยืนยันแล้ว</span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> ยกเลิก</span>`;

    document.getElementById('modal-requester').textContent = `${booking.requester_name} (รหัส ${booking.emp_id || '-'})`;
    document.getElementById('modal-department').textContent = booking.department || '-';
    document.getElementById('modal-type').textContent = booking.meeting_type || 'ภายใน';
    document.getElementById('modal-attendees').textContent = `${booking.attendees_count || 1} ท่าน`;
    
    document.getElementById('modal-layout').textContent = `${booking.room_layout || 'Classroom'} ${booking.room_layout_other ? '(' + booking.room_layout_other + ')' : ''}`;

    // Equipment
    const eq = Array.isArray(booking.equipment) ? booking.equipment.join(', ') : (booking.equipment || '-');
    document.getElementById('modal-equipment').textContent = `${eq} ${booking.equipment_other ? '(' + booking.equipment_other + ')' : ''}`;

    // Notes
    document.getElementById('modal-notes').textContent = booking.notes || 'ไม่มีหมายเหตุ';

    // Show/hide cancel button
    const cancelBtn = document.getElementById('modal-btn-cancel-booking');
    if (cancelBtn) {
      cancelBtn.style.display = isConfirmed ? 'flex' : 'none';
    }

    modal.classList.remove('hidden');
  };

  window.closeDetailModal = function() {
    document.getElementById('booking-detail-modal')?.classList.add('hidden');
    state.activeModalBooking = null;
  };

  /**
   * Cancel Booking Confirmation Flow (No native confirm)
   */
  window.promptCancelBooking = async function() {
    if (!state.activeModalBooking) return;
    const booking = state.activeModalBooking;

    const reason = prompt('กรุณาระบุเหตุผลการยกเลิกการจองห้องประชุม (ถ้ามี):', 'เปลี่ยนแปลงกำหนดการ');
    if (reason === null) return; // User pressed cancel in prompt

    showActionLoader('กำลังดำเนินการยกเลิกการจอง...');

    try {
      await PPCH_API.cancelBooking(booking.booking_no, reason);
      state.bookings = await PPCH_API.getBookings();
      renderTimeline();
      renderBookingsTable();
      updateKpis();
      closeDetailModal();
      hideActionLoader();
    } catch (err) {
      hideActionLoader();
      alertModal(`ไม่สามารถยกเลิกได้: ${err.message}`);
    }
  };

  /**
   * Speed Dial Toggle & Export Handlers
   */
  window.toggleExportSpeedDial = function() {
    const tray = document.getElementById('export-speed-dial-tray');
    tray?.classList.toggle('hidden');
  };

  window.closeExportSpeedDial = function() {
    setTimeout(() => {
      document.getElementById('export-speed-dial-tray')?.classList.add('hidden');
    }, 1000);
  };

  window.handleExportExcel = function() {
    PPCH_API.exportToExcel(state.bookings);
    closeExportSpeedDial();
  };

  window.handleExportCsv = function() {
    PPCH_API.exportToCsv(state.bookings);
    closeExportSpeedDial();
  };

  /**
   * Action Loader Helpers
   */
  function showActionLoader(text) {
    if (actionLoaderText) actionLoaderText.textContent = text;
    actionLoader?.classList.remove('hidden');
  }

  function hideActionLoader() {
    actionLoader?.classList.add('hidden');
  }

  function alertModal(msg) {
    alert(msg); // Fallback notice
  }

  // Start on load
  document.addEventListener('DOMContentLoaded', init);

})();

// ============================================================
// CONFIG — paste your Supabase project URL and anon key here
// ============================================================
const SUPABASE_CONFIG = {
    url: localStorage.getItem('supabase_url') || '',
    anonKey: localStorage.getItem('supabase_anon_key') || ''
};

// ============================================================
// CONSTANTS
// ============================================================
const STORAGE_KEYS = {
    goalsByDate: 'tracker:v3-goals-by-date',
    legacyGoals: 'tracker:v2-focus-items',
    memories: 'tracker:v2-memories',
    dailyMood: 'tracker:v1-daily-mood'
};

const DEFAULT_TODAY_GOALS = [
    { id: createId(), text: 'Morning workout', done: true },
    { id: createId(), text: 'Study for 2 hours', done: true },
    { id: createId(), text: 'Read 30 pages', done: true },
    { id: createId(), text: 'Build side project', done: false },
    { id: createId(), text: 'Plan tomorrow', done: false }
];

const MONTH_FORMATTER  = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const HEADER_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const MEMORY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ============================================================
// APP STATE
// ============================================================
const today = startOfDay(new Date());
let selectedDate = new Date(today);
let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let supabaseClient = null;
let currentUser = null;       // auth.User
let currentProfile = null;    // profiles row
let selectedMemoryPhotoData = '';

const state = {
    goalsByDate: loadGoalsByDate(),
    memories: loadState(STORAGE_KEYS.memories, []),
    dailyMood: loadDailyMood()
};

const elements = {};

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    supabaseClient = createSupabaseClient();

    // ── Auth guard ─────────────────────────────────────────
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.replace('login.html');
            return;
        }
        currentUser = session.user;

        // Listen for sign-out / token refresh
        supabaseClient.auth.onAuthStateChange((_event, newSession) => {
            if (!newSession) {
                window.location.replace('login.html');
            } else {
                currentUser = newSession.user;
            }
        });
    }

    cacheElements();
    bindEvents();
    renderAll();

    if (supabaseClient) {
        await Promise.all([loadProfile(), loadRemoteData()]);
        renderAll();
    } else {
        // No Supabase — show local profile details
        const localName = localStorage.getItem('local_profile_name') || 'Local User';
        updateProfileUI({ display_name: localName, email: 'Local Mode 💻' });
    }
}

// ============================================================
// ELEMENT CACHE
// ============================================================
function cacheElements() {
    elements.selectedDateDisplay  = document.getElementById('selected-date-display');
    elements.scrapbookDate        = document.getElementById('scrapbook-date');
    elements.calendarTitle        = document.getElementById('calendar-title');
    elements.calendarDays         = document.getElementById('calendar-days');
    elements.calendarToday        = document.getElementById('calendar-today');
    elements.prevMonth            = document.getElementById('prev-month');
    elements.nextMonth            = document.getElementById('next-month');
    elements.goalsList            = document.getElementById('goals-list');
    elements.goalsDoneBadge       = document.getElementById('goals-done-badge');
    elements.addGoalForm          = document.getElementById('add-goal-form');
    elements.newGoalInput         = document.getElementById('new-goal-input');
    elements.addMemoryForm        = document.getElementById('add-memory-form');
    elements.memoryInput          = document.getElementById('new-memory-input');
    elements.memoryMood           = document.getElementById('memory-mood');
    elements.moodPicker           = document.getElementById('mood-picker-popup');
    elements.tabText              = document.getElementById('tab-text');
    elements.tabMood              = document.getElementById('tab-mood');
    elements.moodStatusText       = document.getElementById('mood-status-text');
    elements.dailyMoodStatus      = document.getElementById('daily-mood-status');
    elements.dailyMoodButtons     = document.querySelectorAll('.daily-mood-btn');
    elements.memoryCountBadge     = document.getElementById('memory-count-badge');
    elements.memoriesList         = document.getElementById('memories-list');
    elements.addPhotoMemoryForm   = document.getElementById('add-photo-memory-form');
    elements.photoMemoryInput     = document.getElementById('new-photo-memory-input');
    elements.photoMemoryFile      = document.getElementById('photo-memory-file');
    elements.photoMemoryUpload    = document.getElementById('photo-memory-upload');
    elements.photoMemoryPreview   = document.getElementById('photo-memory-preview');
    elements.photoMemoryPreviewImg = document.getElementById('photo-memory-preview-img');
    elements.removePhotoMemoryBtn = document.getElementById('remove-photo-memory-btn');
    elements.photoMemoryStatus    = document.getElementById('photo-memory-status');

    // Profile UI
    elements.profileTrigger       = document.getElementById('profile-trigger');
    elements.profileDropdown      = document.getElementById('profile-dropdown');
    elements.profileAvatar        = document.getElementById('profile-avatar');
    elements.profileName          = document.getElementById('profile-name');
    elements.profileEmail         = document.getElementById('profile-email');
    elements.dropdownEdit         = document.getElementById('dropdown-edit');
    elements.dropdownConnect      = document.getElementById('dropdown-connect');
    elements.dropdownSignout      = document.getElementById('dropdown-signout');
    elements.sidebarSettings      = document.getElementById('sidebar-settings');
    elements.sidebarLogout        = document.getElementById('sidebar-logout');

    // Profile modal
    elements.profileModalOverlay  = document.getElementById('profile-modal-overlay');
    elements.profileModalClose    = document.getElementById('profile-modal-close');
    elements.profileModalCancel   = document.getElementById('profile-modal-cancel');
    elements.profileModalSave     = document.getElementById('profile-modal-save');
    elements.profileInputName     = document.getElementById('profile-input-name');
    elements.profileInputPassword = document.getElementById('profile-input-password');
    elements.profileModalMsg      = document.getElementById('profile-modal-msg');
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
    elements.calendarToday.addEventListener('click', goToToday);
    elements.prevMonth.addEventListener('click', () => changeMonth(-1));
    elements.nextMonth.addEventListener('click', () => changeMonth(1));
    elements.addGoalForm.addEventListener('submit', addGoal);
    elements.addMemoryForm.addEventListener('submit', addMemory);
    elements.addPhotoMemoryForm.addEventListener('submit', addPhotoMemory);
    elements.tabText.addEventListener('click', () => elements.memoryInput.focus());
    elements.tabMood.addEventListener('click', toggleMoodPicker);
    elements.photoMemoryUpload.addEventListener('click', () => elements.photoMemoryFile.click());
    elements.photoMemoryFile.addEventListener('change', handleMemoryPhotoSelection);
    elements.removePhotoMemoryBtn.addEventListener('click', clearMemoryPhotoSelection);

    elements.dailyMoodButtons.forEach((button) => {
        button.addEventListener('click', () => selectDailyMood(button.dataset.dailyMood));
    });

    elements.moodPicker.querySelectorAll('.mood-btn').forEach((button) => {
        button.addEventListener('click', () => selectMood(button.dataset.mood));
    });

    document.addEventListener('click', (event) => {
        if (!elements.moodPicker.contains(event.target) && !elements.tabMood.contains(event.target)) {
            elements.moodPicker.classList.add('hidden');
        }
    });

    // ── Profile dropdown ───────────────────────────────────
    elements.profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = elements.profileDropdown.classList.toggle('open');
        elements.profileTrigger.classList.toggle('open', open);
        elements.profileTrigger.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (e) => {
        if (!elements.profileTrigger.contains(e.target) && !elements.profileDropdown.contains(e.target)) {
            closeProfileDropdown();
        }
    });

    elements.dropdownEdit.addEventListener('click', () => {
        closeProfileDropdown();
        openProfileModal();
    });

    if (elements.dropdownConnect) {
        if (supabaseClient) {
            elements.dropdownConnect.style.display = 'none';
        } else {
            elements.dropdownConnect.style.display = 'flex';
            elements.dropdownConnect.addEventListener('click', () => {
                closeProfileDropdown();
                window.location.href = 'login.html?config=1';
            });
        }
    }

    elements.dropdownSignout.addEventListener('click', () => {
        closeProfileDropdown();
        signOut();
    });

    elements.sidebarSettings.addEventListener('click', () => {
        console.log('Settings clicked');
    });

    elements.sidebarLogout.addEventListener('click', () => {
        closeProfileDropdown();
        signOut();
    });

    // ── Profile modal ──────────────────────────────────────
    elements.profileModalClose.addEventListener('click', closeProfileModal);
    elements.profileModalCancel.addEventListener('click', closeProfileModal);
    elements.profileModalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.profileModalOverlay) closeProfileModal();
    });
    elements.profileModalSave.addEventListener('click', saveProfile);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProfileDropdown();
            closeProfileModal();
        }
    });
}

// ============================================================
// SUPABASE — REMOTE DATA
// ============================================================
async function loadRemoteData() {
    await Promise.all([loadRemoteGoals(), loadRemoteMemories()]);
}

async function loadRemoteGoals() {
    const uid = currentUser?.id;
    if (!uid) return;

    const { data, error } = await supabaseClient
        .from('goals')
        .select('id,title,target_date,is_completed')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });

    if (error) {
        console.warn('Could not load goals from Supabase:', error.message);
        return;
    }

    state.goalsByDate = groupRemoteGoals(data || []);
    saveState(STORAGE_KEYS.goalsByDate, state.goalsByDate);
}

async function loadRemoteMemories() {
    const uid = currentUser?.id;
    if (!uid) return;

    const { data, error } = await supabaseClient
        .from('memories')
        .select('id,content,target_date,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('Could not load memories from Supabase:', error.message);
        return;
    }

    state.memories = (data || []).map((memory) => ({
        id: memory.id,
        date: memory.target_date,
        text: memory.content,
        mood: '',
        image: ''
    }));
    saveState(STORAGE_KEYS.memories, state.memories);
}

// ============================================================
// PROFILE
// ============================================================
async function loadProfile() {
    const uid = currentUser?.id;
    if (!uid) return;

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', uid)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.warn('Could not load profile:', error.message);
    }

    currentProfile = data || {};
    updateProfileUI({
        display_name: currentProfile.display_name || currentUser.email?.split('@')[0] || 'You',
        email: currentUser.email || ''
    });
}

function updateProfileUI({ display_name, email }) {
    const initials = (display_name || '?')
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

    elements.profileAvatar.textContent = initials;
    elements.profileName.textContent   = display_name || 'You';
    elements.profileEmail.textContent  = email || '';
}

function closeProfileDropdown() {
    elements.profileDropdown.classList.remove('open');
    elements.profileTrigger.classList.remove('open');
    elements.profileTrigger.setAttribute('aria-expanded', 'false');
}

function openProfileModal() {
    let name = '';
    if (supabaseClient && currentUser) {
        name = currentProfile?.display_name
            || currentUser?.email?.split('@')[0]
            || '';
        const pwdField = elements.profileInputPassword.closest('.profile-field');
        if (pwdField) pwdField.style.display = '';
    } else {
        name = localStorage.getItem('local_profile_name') || 'Local User';
        const pwdField = elements.profileInputPassword.closest('.profile-field');
        if (pwdField) pwdField.style.display = 'none';
    }
    elements.profileInputName.value     = name;
    elements.profileInputPassword.value = '';
    hideModalMsg();
    elements.profileModalOverlay.classList.remove('hidden');
    setTimeout(() => elements.profileInputName.focus(), 60);
}

function closeProfileModal() {
    elements.profileModalOverlay.classList.add('hidden');
}

function showModalMsg(text, type) {
    const el = elements.profileModalMsg;
    el.textContent = text;
    el.className = `profile-modal-msg profile-modal-${type}`;
}

function hideModalMsg() {
    const el = elements.profileModalMsg;
    el.textContent = '';
    el.className = 'profile-modal-msg hidden';
}

async function saveProfile() {
    const name     = elements.profileInputName.value.trim();
    const password = elements.profileInputPassword.value;

    hideModalMsg();
    elements.profileModalSave.disabled = true;

    let hasError = false;

    if (supabaseClient && currentUser) {
        const uid = currentUser.id;
        // Update display name in profiles table
        if (name) {
            const { error } = await supabaseClient
                .from('profiles')
                .upsert({ id: uid, display_name: name, updated_at: new Date().toISOString() });

            if (error) {
                showModalMsg('Could not update name: ' + error.message, 'error');
                hasError = true;
            } else {
                currentProfile = { ...currentProfile, display_name: name };
                updateProfileUI({ display_name: name, email: currentUser.email || '' });
            }
        }

        // Update password
        if (!hasError && password) {
            if (password.length < 6) {
                showModalMsg('Password must be at least 6 characters.', 'error');
                hasError = true;
            } else {
                const { error } = await supabaseClient.auth.updateUser({ password });
                if (error) {
                    showModalMsg('Could not update password: ' + error.message, 'error');
                    hasError = true;
                }
            }
        }
    } else {
        // Local mode profile update
        if (name) {
            localStorage.setItem('local_profile_name', name);
            updateProfileUI({ display_name: name, email: 'Local Mode 💻' });
        }
        if (password) {
            showModalMsg('Password cannot be set in Local Mode.', 'error');
            hasError = true;
        }
    }

    elements.profileModalSave.disabled = false;

    if (!hasError) {
        showModalMsg('✓ Profile updated!', 'success');
        setTimeout(closeProfileModal, 1400);
    }
}

async function signOut() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    window.location.replace('login.html');
}

// ============================================================
// RENDER
// ============================================================
function renderAll() {
    renderCalendar();
    renderDateLabels();
    renderGoals();
    renderMemories();
    renderDailyMood();
    refreshIcons();
}

function changeMonth(offset) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    renderCalendar();
    refreshIcons();
}

function goToToday() {
    selectedDate  = new Date(today);
    calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderAll();
}

function renderCalendar() {
    elements.calendarTitle.textContent = MONTH_FORMATTER.format(calendarMonth);
    elements.calendarDays.replaceChildren();

    const year       = calendarMonth.getFullYear();
    const month      = calendarMonth.getMonth();
    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const memoryDates = new Set(state.memories.map((m) => m.date));
    const goalDates   = new Set(Object.keys(state.goalsByDate).filter((k) => state.goalsByDate[k]?.length));

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('span');
        empty.className = 'calendar-empty';
        elements.calendarDays.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date   = new Date(year, month, day);
        const key    = toDateKey(date);
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'calendar-day';
        button.textContent = day;
        button.setAttribute('aria-label', MEMORY_FORMATTER.format(date));

        if (isSameDay(date, today))        button.classList.add('today');
        if (isSameDay(date, selectedDate)) button.classList.add('selected');
        if (memoryDates.has(key))          button.classList.add('has-memory');
        if (goalDates.has(key))            button.classList.add('has-goals');

        button.addEventListener('click', () => {
            selectedDate = date;
            renderDateLabels();
            renderGoals();
            renderMemories();
            renderCalendar();
            refreshIcons();
        });

        elements.calendarDays.appendChild(button);
    }
}

function renderDateLabels() {
    if (isSameDay(selectedDate, today)) {
        const headerDate = HEADER_FORMATTER.format(today).replace(',', ',');
        elements.selectedDateDisplay.textContent = `Today, ${headerDate}`;
        elements.scrapbookDate.textContent = 'Today';
        return;
    }
    elements.selectedDateDisplay.textContent = MEMORY_FORMATTER.format(selectedDate);
    elements.scrapbookDate.textContent       = MEMORY_FORMATTER.format(selectedDate);
}

function renderGoals() {
    elements.goalsList.replaceChildren();
    const goalsForDate = getGoalsForSelectedDate();

    if (!goalsForDate.length) {
        const empty = document.createElement('div');
        empty.className   = 'empty-state goal-empty-state';
        empty.textContent = 'No focus items saved for this date yet.';
        elements.goalsList.appendChild(empty);
    }

    const completedGoals = goalsForDate.filter((g) => g.done).length;
    elements.goalsDoneBadge.textContent = `${completedGoals}/${goalsForDate.length} done`;

    goalsForDate.forEach((goal) => {
        const item = document.createElement('article');
        item.className = `goal-item${goal.done ? ' done' : ''}`;

        const checkbox = document.createElement('button');
        checkbox.type      = 'button';
        checkbox.className = `goal-checkbox${goal.done ? ' checked' : ''}`;
        checkbox.setAttribute('aria-label', goal.done ? 'Mark goal as active' : 'Mark goal as done');
        checkbox.innerHTML = goal.done ? '<i data-lucide="check"></i>' : '';
        checkbox.addEventListener('click', () => toggleGoal(goal.id));

        const text = document.createElement('span');
        text.className       = 'goal-text';
        text.textContent     = goal.text;
        text.contentEditable = 'true';
        text.spellcheck      = false;
        text.setAttribute('role', 'textbox');
        text.setAttribute('aria-label', `Edit focus item: ${goal.text}`);
        text.addEventListener('blur',    () => updateGoalText(goal.id, text.textContent));
        text.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); text.blur(); }
        });

        const deleteButton = document.createElement('button');
        deleteButton.type      = 'button';
        deleteButton.className = 'goal-delete';
        deleteButton.setAttribute('aria-label', `Delete focus item: ${goal.text}`);
        deleteButton.innerHTML = '<i data-lucide="x"></i>';
        deleteButton.addEventListener('click', () => deleteGoal(goal.id));

        item.append(checkbox, text, deleteButton);
        elements.goalsList.appendChild(item);
    });

    saveGoalsByDate();
    renderCalendar();
    refreshIcons();
}

// ============================================================
// GOALS — CRUD
// ============================================================
async function addGoal(event) {
    event.preventDefault();
    const text = elements.newGoalInput.value.trim();
    if (!text) return;

    const dateKey = getSelectedDateKey();
    const goal    = { id: createId(), text, done: false };
    getGoalsForDate(dateKey).push(goal);
    elements.newGoalInput.value = '';
    saveGoalsByDate();
    renderGoals();

    if (supabaseClient && currentUser) {
        const { data, error } = await supabaseClient
            .from('goals')
            .insert({ user_id: currentUser.id, title: text, target_date: dateKey, is_completed: false })
            .select('id')
            .single();

        if (error) {
            console.warn('Could not save goal to Supabase:', error.message);
            return;
        }
        goal.id = data.id;
        saveGoalsByDate();
        renderGoals();
    }
}

async function toggleGoal(id) {
    const goal = getGoalsForSelectedDate().find((g) => g.id === id);
    if (!goal) return;
    goal.done = !goal.done;
    saveGoalsByDate();
    renderGoals();

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('goals')
            .update({ is_completed: goal.done })
            .eq('id', id);
        if (error) console.warn('Could not update goal in Supabase:', error.message);
    }
}

async function deleteGoal(id) {
    const dateKey = getSelectedDateKey();
    state.goalsByDate[dateKey] = getGoalsForDate(dateKey).filter((g) => g.id !== id);
    saveGoalsByDate();
    renderGoals();

    if (supabaseClient) {
        const { error } = await supabaseClient.from('goals').delete().eq('id', id);
        if (error) console.warn('Could not delete goal from Supabase:', error.message);
    }
}

async function updateGoalText(id, value) {
    const goal = getGoalsForSelectedDate().find((g) => g.id === id);
    if (!goal) return;

    const nextText = value.trim();
    if (!nextText) { renderGoals(); return; }

    goal.text = nextText;
    saveGoalsByDate();

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('goals')
            .update({ title: nextText })
            .eq('id', id);
        if (error) console.warn('Could not update goal text in Supabase:', error.message);
    }
}

// ============================================================
// MEMORIES — CRUD
// ============================================================
async function addMemory(event) {
    event.preventDefault();
    const text = elements.memoryInput.value.trim();
    if (!text) return;

    const dateKey = getSelectedDateKey();
    const memory  = { id: createId(), date: dateKey, text, mood: elements.memoryMood.value };

    state.memories.unshift(memory);
    elements.memoryInput.value = '';
    selectMood('');
    saveState(STORAGE_KEYS.memories, state.memories);
    renderMemories();
    renderCalendar();
    refreshIcons();

    if (supabaseClient && currentUser) {
        const { data, error } = await supabaseClient
            .from('memories')
            .insert({ user_id: currentUser.id, content: text, target_date: dateKey })
            .select('id')
            .single();

        if (error) {
            console.warn('Could not save memory to Supabase:', error.message);
            return;
        }
        memory.id = data.id;
        saveState(STORAGE_KEYS.memories, state.memories);
    }
}

async function addPhotoMemory(event) {
    event.preventDefault();
    const text = elements.photoMemoryInput.value.trim();
    if (!text && !selectedMemoryPhotoData) return;

    const dateKey = getSelectedDateKey();
    const memory  = { id: createId(), date: dateKey, text, mood: '', image: selectedMemoryPhotoData };

    state.memories.unshift(memory);
    elements.photoMemoryInput.value = '';
    clearMemoryPhotoSelection();
    saveState(STORAGE_KEYS.memories, state.memories);
    renderMemories();
    renderCalendar();
    refreshIcons();

    if (supabaseClient && currentUser && text) {
        const { data, error } = await supabaseClient
            .from('memories')
            .insert({ user_id: currentUser.id, content: text, target_date: dateKey })
            .select('id')
            .single();

        if (error) {
            console.warn('Could not save memory to Supabase:', error.message);
            return;
        }
        memory.id = data.id;
        saveState(STORAGE_KEYS.memories, state.memories);
    }
}

function renderMemories() {
    elements.memoriesList.replaceChildren();
    const selectedKey    = getSelectedDateKey();
    const memoriesForDate = state.memories.filter((m) => m.date === selectedKey);
    const entryLabel     = memoriesForDate.length === 1 ? 'entry' : 'entries';
    elements.memoryCountBadge.textContent = `${memoriesForDate.length} ${entryLabel}`;

    if (!memoriesForDate.length) {
        const empty = document.createElement('div');
        empty.className   = 'empty-state';
        empty.textContent = 'No memories logged for this date yet.';
        elements.memoriesList.appendChild(empty);
        return;
    }

    memoriesForDate.forEach((memory) => {
        const card    = document.createElement('article');
        card.className = 'memory-card';

        const topLine = document.createElement('div');
        topLine.className = 'memory-topline';

        const date = document.createElement('span');
        date.textContent = `${MEMORY_FORMATTER.format(fromDateKey(memory.date))}${memory.mood ? `  ${memory.mood}` : ''}`;

        const more = document.createElement('span');
        more.setAttribute('aria-hidden', 'true');
        more.textContent = '...';

        topLine.append(date, more);
        card.appendChild(topLine);

        if (memory.text) {
            const text = document.createElement('p');
            text.className   = 'memory-text';
            text.textContent = memory.text;
            card.appendChild(text);
        }

        if (memory.image) {
            const image = document.createElement('img');
            image.className = 'memory-photo';
            image.src = memory.image;
            image.alt = 'Saved memory';
            card.appendChild(image);
        }

        const actions = document.createElement('div');
        actions.className = 'memory-actions';
        actions.innerHTML = '<button type="button" aria-label="Favorite memory"><i data-lucide="heart"></i></button>';
        card.appendChild(actions);

        elements.memoriesList.appendChild(card);
    });
}

// ============================================================
// PHOTO MEMORY HELPERS
// ============================================================
function handleMemoryPhotoSelection() {
    const file = elements.photoMemoryFile.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
        selectedMemoryPhotoData = String(reader.result || '');
        elements.photoMemoryPreviewImg.src = selectedMemoryPhotoData;
        elements.photoMemoryPreview.classList.remove('hidden');
        elements.photoMemoryStatus.textContent = 'Photo added';
        elements.photoMemoryUpload.classList.add('active');
    });
    reader.readAsDataURL(file);
}

function clearMemoryPhotoSelection() {
    selectedMemoryPhotoData = '';
    elements.photoMemoryFile.value = '';
    elements.photoMemoryPreviewImg.removeAttribute('src');
    elements.photoMemoryPreview.classList.add('hidden');
    elements.photoMemoryStatus.textContent = 'Photo';
    elements.photoMemoryUpload.classList.remove('active');
}

// ============================================================
// MOOD
// ============================================================
function toggleMoodPicker() {
    elements.moodPicker.classList.toggle('hidden');
}

function selectMood(mood) {
    elements.memoryMood.value = mood;
    elements.moodStatusText.textContent = mood || 'Mood';
    elements.tabMood.classList.toggle('active', Boolean(mood));
    elements.moodPicker.classList.add('hidden');
}

function selectDailyMood(mood) {
    state.dailyMood = state.dailyMood === mood ? '' : mood;
    saveState(STORAGE_KEYS.dailyMood, { date: toDateKey(today), mood: state.dailyMood });
    renderDailyMood();
}

function renderDailyMood() {
    const selectedButton = Array.from(elements.dailyMoodButtons)
        .find((btn) => btn.dataset.dailyMood === state.dailyMood);

    elements.dailyMoodStatus.textContent = 'How are you feeling?';

    elements.dailyMoodButtons.forEach((btn) => {
        const isSelected = btn === selectedButton;
        btn.classList.toggle('active', isSelected);
        btn.setAttribute('aria-pressed', String(isSelected));
    });
}

// ============================================================
// DATA HELPERS
// ============================================================
function getSelectedDateKey()  { return toDateKey(selectedDate); }
function getGoalsForSelectedDate() { return getGoalsForDate(getSelectedDateKey()); }

function getGoalsForDate(dateKey) {
    if (!state.goalsByDate[dateKey]) state.goalsByDate[dateKey] = [];
    return state.goalsByDate[dateKey];
}

function saveGoalsByDate() {
    Object.keys(state.goalsByDate).forEach((k) => {
        if (!state.goalsByDate[k].length) delete state.goalsByDate[k];
    });
    saveState(STORAGE_KEYS.goalsByDate, state.goalsByDate);
}

function loadDailyMood() {
    const stored = loadState(STORAGE_KEYS.dailyMood, null);
    if (!stored || stored.date !== toDateKey(today)) return '';
    return stored.mood || '';
}

function loadGoalsByDate() {
    const stored = loadState(STORAGE_KEYS.goalsByDate, null);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) return stored;

    const legacyGoals = loadState(STORAGE_KEYS.legacyGoals, null);
    return {
        [toDateKey(today)]: Array.isArray(legacyGoals) && legacyGoals.length
            ? legacyGoals
            : DEFAULT_TODAY_GOALS
    };
}

function groupRemoteGoals(goals) {
    return goals.reduce((grouped, goal) => {
        const dateKey = goal.target_date;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push({ id: goal.id, text: goal.title, done: goal.is_completed });
        return grouped;
    }, {});
}

// ============================================================
// SUPABASE CLIENT
// ============================================================
function createSupabaseClient() {
    const mode = localStorage.getItem('supabase_mode');
    if (mode === 'local') return null; // Force local mode

    const url = SUPABASE_CONFIG.url || localStorage.getItem('supabase_url');
    const anonKey = SUPABASE_CONFIG.anonKey || localStorage.getItem('supabase_anon_key');

    const hasConfig = url && anonKey;
    if (!hasConfig || !window.supabase?.createClient) return null;
    return window.supabase.createClient(url, anonKey);
}

// ============================================================
// LUCIDE ICONS
// ============================================================
function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}

// ============================================================
// LOCAL STORAGE
// ============================================================
function loadState(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    } catch {
        return fallback;
    }
}

function saveState(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ============================================================
// DATE UTILS
// ============================================================
function toDateKey(date) {
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
    return toDateKey(a) === toDateKey(b);
}

function fromDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

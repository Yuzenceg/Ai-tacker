const STORAGE_KEYS = {
    goalsByDate: 'tracker:v3-goals-by-date',
    legacyGoals: 'tracker:v2-focus-items',
    memories: 'tracker:v2-memories',
    dailyMood: 'tracker:v1-daily-mood'
};

const SUPABASE_CONFIG = {
    url: '',
    anonKey: ''
};

const DEFAULT_TODAY_GOALS = [
    { id: createId(), text: 'Morning workout', done: true },
    { id: createId(), text: 'Study for 2 hours', done: true },
    { id: createId(), text: 'Read 30 pages', done: true },
    { id: createId(), text: 'Build side project', done: false },
    { id: createId(), text: 'Plan tomorrow', done: false }
];

const FOCUS_TIME_SLOTS = ['7:00 AM', '9:00 AM', '11:00 AM', '2:00 PM', '8:00 PM'];

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const HEADER_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const MEMORY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const today = startOfDay(new Date());
let selectedDate = new Date(today);
let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let supabaseClient = null;
let selectedMemoryPhotoData = '';

const state = {
    goalsByDate: loadGoalsByDate(),
    memories: loadState(STORAGE_KEYS.memories, []),
    dailyMood: loadDailyMood()
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    cacheElements();
    bindEvents();
    supabaseClient = createSupabaseClient();
    renderAll();
    await loadRemoteData();
}

function cacheElements() {
    elements.selectedDateDisplay = document.getElementById('selected-date-display');
    elements.scrapbookDate = document.getElementById('scrapbook-date');
    elements.calendarTitle = document.getElementById('calendar-title');
    elements.calendarDays = document.getElementById('calendar-days');
    elements.calendarToday = document.getElementById('calendar-today');
    elements.prevMonth = document.getElementById('prev-month');
    elements.nextMonth = document.getElementById('next-month');
    elements.goalsList = document.getElementById('goals-list');
    elements.goalsDoneBadge = document.getElementById('goals-done-badge');
    elements.addGoalForm = document.getElementById('add-goal-form');
    elements.newGoalInput = document.getElementById('new-goal-input');
    elements.addMemoryForm = document.getElementById('add-memory-form');
    elements.memoryInput = document.getElementById('new-memory-input');
    elements.memoryMood = document.getElementById('memory-mood');
    elements.moodPicker = document.getElementById('mood-picker-popup');
    elements.tabText = document.getElementById('tab-text');
    elements.tabMood = document.getElementById('tab-mood');
    elements.moodStatusText = document.getElementById('mood-status-text');
    elements.dailyMoodStatus = document.getElementById('daily-mood-status');
    elements.dailyMoodButtons = document.querySelectorAll('.daily-mood-btn');
    elements.memoryCountBadge = document.getElementById('memory-count-badge');
    elements.memoriesList = document.getElementById('memories-list');
    elements.addPhotoMemoryForm = document.getElementById('add-photo-memory-form');
    elements.photoMemoryInput = document.getElementById('new-photo-memory-input');
    elements.photoMemoryFile = document.getElementById('photo-memory-file');
    elements.photoMemoryUpload = document.getElementById('photo-memory-upload');
    elements.photoMemoryPreview = document.getElementById('photo-memory-preview');
    elements.photoMemoryPreviewImg = document.getElementById('photo-memory-preview-img');
    elements.removePhotoMemoryBtn = document.getElementById('remove-photo-memory-btn');
    elements.photoMemoryStatus = document.getElementById('photo-memory-status');
}

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
}

async function loadRemoteData() {
    if (!supabaseClient) return;

    await Promise.all([loadRemoteGoals(), loadRemoteMemories()]);
    renderAll();
}

async function loadRemoteGoals() {
    const { data, error } = await supabaseClient
        .from('goals')
        .select('id,title,target_date,is_completed')
        .order('created_at', { ascending: true });

    if (error) {
        console.warn('Could not load goals from Supabase:', error.message);
        return;
    }

    state.goalsByDate = groupRemoteGoals(data || []);
    saveState(STORAGE_KEYS.goalsByDate, state.goalsByDate);
}

async function loadRemoteMemories() {
    const { data, error } = await supabaseClient
        .from('memories')
        .select('id,content,target_date,created_at')
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
    selectedDate = new Date(today);
    calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderAll();
}

function renderCalendar() {
    elements.calendarTitle.textContent = MONTH_FORMATTER.format(calendarMonth);
    elements.calendarDays.replaceChildren();

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const memoryDates = new Set(state.memories.map((memory) => memory.date));
    const goalDates = new Set(Object.keys(state.goalsByDate).filter((dateKey) => state.goalsByDate[dateKey]?.length));

    for (let index = 0; index < firstDay; index += 1) {
        const empty = document.createElement('span');
        empty.className = 'calendar-empty';
        elements.calendarDays.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const key = toDateKey(date);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'calendar-day';
        button.textContent = day;
        button.setAttribute('aria-label', MEMORY_FORMATTER.format(date));

        if (isSameDay(date, today)) button.classList.add('today');
        if (isSameDay(date, selectedDate)) button.classList.add('selected');
        if (memoryDates.has(key)) button.classList.add('has-memory');
        if (goalDates.has(key)) button.classList.add('has-goals');

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
    elements.scrapbookDate.textContent = MEMORY_FORMATTER.format(selectedDate);
}

function renderGoals() {
    elements.goalsList.replaceChildren();
    const goalsForDate = getGoalsForSelectedDate();

    if (!goalsForDate.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state goal-empty-state';
        empty.textContent = 'No focus items saved for this date yet.';
        elements.goalsList.appendChild(empty);
    }

    const completedGoals = goalsForDate.filter((goal) => goal.done).length;
    elements.goalsDoneBadge.textContent = `${completedGoals}/${goalsForDate.length} done`;

    goalsForDate.forEach((goal, index) => {
        const item = document.createElement('article');
        item.className = `goal-item${goal.done ? ' done' : ''}`;

        const checkbox = document.createElement('button');
        checkbox.type = 'button';
        checkbox.className = `goal-checkbox${goal.done ? ' checked' : ''}`;
        checkbox.setAttribute('aria-label', goal.done ? 'Mark goal as active' : 'Mark goal as done');
        checkbox.innerHTML = goal.done ? '<i data-lucide="check"></i>' : '';
        checkbox.addEventListener('click', () => toggleGoal(goal.id));

        const text = document.createElement('span');
        text.className = 'goal-text';
        text.textContent = goal.text;
        text.contentEditable = 'true';
        text.spellcheck = false;
        text.setAttribute('role', 'textbox');
        text.setAttribute('aria-label', `Edit focus item: ${goal.text}`);
        text.addEventListener('blur', () => updateGoalText(goal.id, text.textContent));
        text.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                text.blur();
            }
        });

        const time = document.createElement('span');
        time.className = 'goal-time';
        time.textContent = getGoalTime(index);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'goal-delete';
        deleteButton.setAttribute('aria-label', `Delete focus item: ${goal.text}`);
        deleteButton.innerHTML = '<i data-lucide="x"></i>';
        deleteButton.addEventListener('click', () => deleteGoal(goal.id));

        item.append(checkbox, text, time, deleteButton);
        elements.goalsList.appendChild(item);
    });

    saveGoalsByDate();
    renderCalendar();
    refreshIcons();
}

async function addGoal(event) {
    event.preventDefault();
    const text = elements.newGoalInput.value.trim();
    if (!text) return;

    const dateKey = getSelectedDateKey();
    const goal = { id: createId(), text, done: false };
    getGoalsForDate(dateKey).push(goal);
    elements.newGoalInput.value = '';
    saveGoalsByDate();
    renderGoals();

    if (supabaseClient) {
        const { data, error } = await supabaseClient
            .from('goals')
            .insert({ title: text, target_date: dateKey, is_completed: false })
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
    const goal = getGoalsForSelectedDate().find((item) => item.id === id);
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
    state.goalsByDate[dateKey] = getGoalsForDate(dateKey).filter((item) => item.id !== id);
    saveGoalsByDate();
    renderGoals();

    if (supabaseClient) {
        const { error } = await supabaseClient.from('goals').delete().eq('id', id);
        if (error) console.warn('Could not delete goal from Supabase:', error.message);
    }
}

async function updateGoalText(id, value) {
    const goal = getGoalsForSelectedDate().find((item) => item.id === id);
    if (!goal) return;

    const nextText = value.trim();
    if (!nextText) {
        renderGoals();
        return;
    }

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

async function addMemory(event) {
    event.preventDefault();
    const text = elements.memoryInput.value.trim();
    if (!text) return;

    const dateKey = getSelectedDateKey();
    const memory = {
        id: createId(),
        date: dateKey,
        text,
        mood: elements.memoryMood.value
    };

    state.memories.unshift(memory);
    elements.memoryInput.value = '';
    selectMood('');
    saveState(STORAGE_KEYS.memories, state.memories);
    renderMemories();
    renderCalendar();
    refreshIcons();

    if (supabaseClient && text) {
        const { data, error } = await supabaseClient
            .from('memories')
            .insert({ content: text, target_date: dateKey })
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
    const memory = {
        id: createId(),
        date: dateKey,
        text,
        mood: '',
        image: selectedMemoryPhotoData
    };

    state.memories.unshift(memory);
    elements.photoMemoryInput.value = '';
    clearMemoryPhotoSelection();
    saveState(STORAGE_KEYS.memories, state.memories);
    renderMemories();
    renderCalendar();
    refreshIcons();

    if (supabaseClient && text) {
        const { data, error } = await supabaseClient
            .from('memories')
            .insert({ content: text, target_date: dateKey })
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
    const selectedKey = getSelectedDateKey();
    const memoriesForDate = state.memories.filter((memory) => memory.date === selectedKey);
    const entryLabel = memoriesForDate.length === 1 ? 'entry' : 'entries';
    elements.memoryCountBadge.textContent = `${memoriesForDate.length} ${entryLabel}`;

    if (!memoriesForDate.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No memories logged for this date yet.';
        elements.memoriesList.appendChild(empty);
        return;
    }

    memoriesForDate.forEach((memory) => {
        const card = document.createElement('article');
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
            text.className = 'memory-text';
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

function toggleMoodPicker() {
    elements.moodPicker.classList.toggle('hidden');
}

function getGoalTime(index) {
    return FOCUS_TIME_SLOTS[index] || '';
}

function selectMood(mood) {
    elements.memoryMood.value = mood;
    elements.moodStatusText.textContent = mood || 'Mood';
    elements.tabMood.classList.toggle('active', Boolean(mood));
    elements.moodPicker.classList.add('hidden');
}

function selectDailyMood(mood) {
    state.dailyMood = state.dailyMood === mood ? '' : mood;
    saveState(STORAGE_KEYS.dailyMood, {
        date: toDateKey(today),
        mood: state.dailyMood
    });
    renderDailyMood();
}

function renderDailyMood() {
    const selectedButton = Array.from(elements.dailyMoodButtons).find((button) => button.dataset.dailyMood === state.dailyMood);

    elements.dailyMoodStatus.textContent = 'How are you feeling?';

    elements.dailyMoodButtons.forEach((button) => {
        const isSelected = button === selectedButton;
        button.classList.toggle('active', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
    });
}

function getSelectedDateKey() {
    return toDateKey(selectedDate);
}

function getGoalsForSelectedDate() {
    return getGoalsForDate(getSelectedDateKey());
}

function getGoalsForDate(dateKey) {
    if (!state.goalsByDate[dateKey]) state.goalsByDate[dateKey] = [];
    return state.goalsByDate[dateKey];
}

function saveGoalsByDate() {
    Object.keys(state.goalsByDate).forEach((dateKey) => {
        if (!state.goalsByDate[dateKey].length) delete state.goalsByDate[dateKey];
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
        [toDateKey(today)]: Array.isArray(legacyGoals) && legacyGoals.length ? legacyGoals : DEFAULT_TODAY_GOALS
    };
}

function groupRemoteGoals(goals) {
    return goals.reduce((grouped, goal) => {
        const dateKey = goal.target_date;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push({
            id: goal.id,
            text: goal.title,
            done: goal.is_completed
        });
        return grouped;
    }, {});
}

function createSupabaseClient() {
    const hasConfig = SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey;
    if (!hasConfig || !window.supabase?.createClient) return null;
    return window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}

function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

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

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(firstDate, secondDate) {
    return toDateKey(firstDate) === toDateKey(secondDate);
}

function fromDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function createId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

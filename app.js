const STORAGE_KEYS = {
    goals: 'tracker:v1-goals',
    memories: 'tracker:v1-memories'
};

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const HEADER_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const MEMORY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

let calendarMonth = new Date(2026, 5, 1);
let selectedDate = new Date(2026, 5, 6);
let selectedPhotoData = '';

const state = {
    goals: loadState(STORAGE_KEYS.goals, [
        { id: createId(), text: 'Practice English', done: false },
        { id: createId(), text: 'Write script for Hackathon', done: false },
        { id: createId(), text: 'Improve the design of this website', done: false },
        { id: createId(), text: '20 minutes of no devices', done: false }
    ]),
    memories: loadState(STORAGE_KEYS.memories, [
        {
            id: createId(),
            date: toDateKey(new Date(2026, 5, 6)),
            text: 'The website looks sm better today',
            mood: '\uD83D\uDE0A',
            image: ''
        }
    ])
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
    cacheElements();
    bindEvents();
    renderAll();
}

function cacheElements() {
    elements.currentMonthYear = document.getElementById('current-month-year');
    elements.calendarDays = document.getElementById('calendar-days');
    elements.prevMonth = document.getElementById('prev-month');
    elements.nextMonth = document.getElementById('next-month');
    elements.selectedDateDisplay = document.getElementById('selected-date-display');
    elements.scrapbookDate = document.getElementById('scrapbook-date');
    elements.progressText = document.getElementById('progress-text');
    elements.progressBarFill = document.getElementById('progress-bar-fill');
    elements.goalsList = document.getElementById('goals-list');
    elements.addGoalForm = document.getElementById('add-goal-form');
    elements.newGoalInput = document.getElementById('new-goal-input');
    elements.addMemoryForm = document.getElementById('add-memory-form');
    elements.memoryInput = document.getElementById('new-memory-input');
    elements.memoryImageFile = document.getElementById('memory-image-file');
    elements.memoryMood = document.getElementById('memory-mood');
    elements.imagePreviewArea = document.getElementById('image-preview-area');
    elements.imagePreviewImg = document.getElementById('image-preview-img');
    elements.removeImageBtn = document.getElementById('remove-image-btn');
    elements.moodPicker = document.getElementById('mood-picker-popup');
    elements.tabText = document.getElementById('tab-text');
    elements.tabPhoto = document.getElementById('tab-photo');
    elements.tabMood = document.getElementById('tab-mood');
    elements.uploadStatusText = document.getElementById('upload-status-text');
    elements.moodStatusText = document.getElementById('mood-status-text');
    elements.memoriesList = document.getElementById('memories-list');
}

function bindEvents() {
    elements.prevMonth.addEventListener('click', () => changeMonth(-1));
    elements.nextMonth.addEventListener('click', () => changeMonth(1));
    elements.addGoalForm.addEventListener('submit', addGoal);
    elements.addMemoryForm.addEventListener('submit', addMemory);
    elements.tabText.addEventListener('click', () => elements.memoryInput.focus());
    elements.tabPhoto.addEventListener('click', () => elements.memoryImageFile.click());
    elements.tabMood.addEventListener('click', toggleMoodPicker);
    elements.memoryImageFile.addEventListener('change', handlePhotoSelection);
    elements.removeImageBtn.addEventListener('click', clearPhotoSelection);

    elements.moodPicker.querySelectorAll('.mood-btn').forEach((button) => {
        button.addEventListener('click', () => selectMood(button.dataset.mood));
    });

    document.addEventListener('click', (event) => {
        if (!elements.moodPicker.contains(event.target) && !elements.tabMood.contains(event.target)) {
            elements.moodPicker.classList.add('hidden');
        }
    });
}

function renderAll() {
    renderCalendar();
    renderDateLabels();
    renderGoals();
    renderMemories();
    refreshIcons();
}

function changeMonth(offset) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    renderCalendar();
    refreshIcons();
}

function renderCalendar() {
    elements.currentMonthYear.textContent = MONTH_FORMATTER.format(calendarMonth);
    elements.calendarDays.replaceChildren();

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const memoryDates = new Set(state.memories.map((memory) => memory.date));
    const progressDates = new Set(state.goals.some((goal) => goal.done) ? [toDateKey(selectedDate)] : []);

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

        if (key === toDateKey(selectedDate)) button.classList.add('selected');
        if (memoryDates.has(key)) button.classList.add('has-memory');
        if (progressDates.has(key)) button.classList.add('has-progress');

        button.addEventListener('click', () => {
            selectedDate = date;
            calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            renderAll();
        });

        elements.calendarDays.appendChild(button);
    }
}

function renderDateLabels() {
    const headerDate = HEADER_FORMATTER.format(selectedDate).replace(',', ',');
    elements.selectedDateDisplay.textContent = `Today, ${headerDate}`;
    elements.scrapbookDate.textContent = isReferenceDate(selectedDate) ? 'Today' : MEMORY_FORMATTER.format(selectedDate);
}

function renderGoals() {
    elements.goalsList.replaceChildren();

    state.goals.forEach((goal) => {
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

        item.append(checkbox, text);
        elements.goalsList.appendChild(item);
    });

    const done = state.goals.filter((goal) => goal.done).length;
    const total = state.goals.length;
    const percentage = total ? Math.round((done / total) * 100) : 0;
    elements.progressText.textContent = `${done}/${total} Goals`;
    elements.progressBarFill.style.width = `${percentage}%`;
    saveState(STORAGE_KEYS.goals, state.goals);
    renderCalendar();
    refreshIcons();
}

function addGoal(event) {
    event.preventDefault();
    const text = elements.newGoalInput.value.trim();
    if (!text) return;

    state.goals.push({ id: createId(), text, done: false });
    elements.newGoalInput.value = '';
    renderGoals();
}

function toggleGoal(id) {
    const goal = state.goals.find((item) => item.id === id);
    if (!goal) return;
    goal.done = !goal.done;
    renderGoals();
}

function addMemory(event) {
    event.preventDefault();
    const text = elements.memoryInput.value.trim();
    if (!text && !selectedPhotoData) return;

    state.memories.unshift({
        id: createId(),
        date: toDateKey(selectedDate),
        text,
        mood: elements.memoryMood.value,
        image: selectedPhotoData
    });

    elements.memoryInput.value = '';
    selectMood('');
    clearPhotoSelection();
    saveState(STORAGE_KEYS.memories, state.memories);
    renderMemories();
    renderCalendar();
    refreshIcons();
}

function renderMemories() {
    elements.memoriesList.replaceChildren();
    const selectedKey = toDateKey(selectedDate);
    const memoriesForDate = state.memories.filter((memory) => memory.date === selectedKey);

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

function handlePhotoSelection() {
    const file = elements.memoryImageFile.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
        selectedPhotoData = String(reader.result || '');
        elements.imagePreviewImg.src = selectedPhotoData;
        elements.imagePreviewArea.classList.remove('hidden');
        elements.uploadStatusText.textContent = 'Photo added';
        elements.tabPhoto.classList.add('active');
    });
    reader.readAsDataURL(file);
}

function clearPhotoSelection() {
    selectedPhotoData = '';
    elements.memoryImageFile.value = '';
    elements.imagePreviewImg.removeAttribute('src');
    elements.imagePreviewArea.classList.add('hidden');
    elements.uploadStatusText.textContent = 'Photo';
    elements.tabPhoto.classList.remove('active');
}

function toggleMoodPicker() {
    elements.moodPicker.classList.toggle('hidden');
}

function selectMood(mood) {
    elements.memoryMood.value = mood;
    elements.moodStatusText.textContent = mood || 'Mood';
    elements.tabMood.classList.toggle('active', Boolean(mood));
    elements.moodPicker.classList.add('hidden');
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

function fromDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function isReferenceDate(date) {
    return toDateKey(date) === '2026-06-06';
}

function createId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

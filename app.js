document.addEventListener('DOMContentLoaded', () => {
    // ---- Calendar ----
    const currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    const calendarDays = document.getElementById('calendar-days');
    const currentMonthYear = document.getElementById('current-month-year');
    
    // ---- Global State (Local Storage) & Migration ----
    
    function getStoredData() {
        const raw = JSON.parse(localStorage.getItem('hourself_native_data')) || {};
        let migrated = false;
        
        for (const dateStr in raw) {
            const entry = raw[dateStr];
            
            // Migrate hourly logs to todo list
            if (entry.hours && !entry.todos) {
                entry.todos = [];
                for (const hourIndex in entry.hours) {
                    const hourText = entry.hours[hourIndex];
                    if (hourText && hourText.trim() !== '') {
                        const ampm = hourIndex < 12 ? 'AM' : 'PM';
                        const displayHour = hourIndex == 0 ? 12 : (hourIndex > 12 ? hourIndex - 12 : hourIndex);
                        const label = `${displayHour} ${ampm}`;
                        entry.todos.push({
                            id: `migrated_${hourIndex}_${Date.now()}`,
                            text: `[${label}] ${hourText}`,
                            done: true
                        });
                    }
                }
                delete entry.hours;
                migrated = true;
            }

            // Migrate prodScore to focusSessions
            if (entry.prodScore !== undefined && entry.focusSessions === undefined) {
                entry.focusSessions = entry.prodScore;
                delete entry.prodScore;
                migrated = true;
            }
        }
        
        if (migrated) {
            localStorage.setItem('hourself_native_data', JSON.stringify(raw));
        }
        
        return raw;
    }

    function saveStoredData(data) {
        localStorage.setItem('hourself_native_data', JSON.stringify(data));
    }

    // ---- Data Helpers ----
    function saveDayTodos(dateStr, todos) {
        const data = getStoredData();
        if (!data[dateStr]) data[dateStr] = { todos: [], focusSessions: 0 };
        data[dateStr].todos = todos;
        saveStoredData(data);
        renderCalendar(true); 
    }

    function saveDayFocusSessions(dateStr, focusSessions) {
        const data = getStoredData();
        if (!data[dateStr]) data[dateStr] = { todos: [], focusSessions: 0 };
        data[dateStr].focusSessions = focusSessions;
        saveStoredData(data);
        renderCalendar(true);
    }

    let _dayDivMap = {};

    // ---- Render Calendar Grid ----
    function renderCalendar(onlyUpdateBadges = false) {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const data = getStoredData();

        if (!onlyUpdateBadges) {
            currentMonthYear.innerText = `${monthNames[currentMonth]} ${currentYear}`;
            calendarDays.innerHTML = ''; 

            const firstDay = new Date(currentYear, currentMonth, 1).getDay();
            
            for (let i = 0; i < firstDay; i++) {
                const emptyDiv = document.createElement('div');
                emptyDiv.classList.add('calendar-day', 'empty');
                calendarDays.appendChild(emptyDiv);
            }
            
            _dayDivMap = {};

            for (let i = 1; i <= daysInMonth; i++) {
                const dayDiv = document.createElement('div');
                dayDiv.classList.add('calendar-day');
                
                if (i === currentDate.getDate() && currentMonth === currentDate.getMonth() && currentYear === currentDate.getFullYear()) {
                    dayDiv.classList.add('today');
                }
                
                const dayNum = document.createElement('div');
                dayNum.classList.add('day-number');
                dayNum.innerText = i;
                dayDiv.appendChild(dayNum);
                
                const dateStr = `${currentYear}-${(currentMonth+1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
                
                dayDiv.addEventListener('click', () => {
                    openDailyModal(dateStr, i, monthNames[currentMonth]);
                });
                
                calendarDays.appendChild(dayDiv);
                _dayDivMap[dateStr] = { div: dayDiv };
            }
            
            updateCalendarBadges(daysInMonth, data);
        } else {
            updateCalendarBadges(daysInMonth, data);
        }
    }

    function updateCalendarBadges(daysInMonth, allData) {
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${(currentMonth+1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            const cell = _dayDivMap[dateStr];
            if (!cell) continue;

            const loader = cell.div.querySelector('.day-stats-loader');
            if (loader) loader.remove();

            const existingStats = cell.div.querySelector('.day-stats');
            if (existingStats) existingStats.remove();

            const dayInfo = allData[dateStr] || { todos: [], focusSessions: 0 };
            
            const todos = dayInfo.todos || [];
            const focusSessions = dayInfo.focusSessions || 0;
            const totalTasks = todos.length;
            const completedTasks = todos.filter(t => t.done).length;
            
            if (totalTasks > 0 || focusSessions > 0) {
                const statsContainer = document.createElement('div');
                statsContainer.classList.add('day-stats');
                
                if (totalTasks > 0) {
                    const preview = document.createElement('div');
                    preview.classList.add('day-badge');
                    preview.innerText = `${completedTasks}/${totalTasks} done`;
                    statsContainer.appendChild(preview);
                }
                
                if (focusSessions > 0) {
                    const fire = document.createElement('div');
                    fire.classList.add('day-badge', 'fire');
                    fire.innerHTML = `${focusSessions} <i class="fa-solid fa-stopwatch"></i>`;
                    statsContainer.appendChild(fire);
                }
                
                cell.div.appendChild(statsContainer);
            }
        }
    }
    
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    });

    // ---- Daily Planner Modal ----
    const dailyModal = document.getElementById('daily-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const modalDateTitle = document.getElementById('modal-date-title');
    const prodScoreCounter = document.getElementById('prod-score');
    
    const statTasksDone = document.getElementById('stat-tasks-done');
    const statTasksTodo = document.getElementById('stat-tasks-todo');
    const statFocusSessions = document.getElementById('stat-focus-sessions');
    
    const todoInput = document.getElementById('todo-input');
    const btnAddTodo = document.getElementById('btn-add-todo');
    const todoList = document.getElementById('todo-list');
    
    let activeDateStr = null;
    let activeFocusSessions = 0;

    function refreshFocusSessionsDisplay(count) {
        activeFocusSessions = count || 0;
        prodScoreCounter.innerText = activeFocusSessions;
        statFocusSessions.innerText = activeFocusSessions;
    }

    function openDailyModal(dateStr, dayIndex, monthName) {
        activeDateStr = dateStr;
        modalDateTitle.innerText = `${monthName} ${dayIndex}, ${currentYear}`;
        dailyModal.classList.add('active');
        
        renderModalContent(dateStr);
    }
    
    function renderModalContent(dateStr) {
        const data = getStoredData();
        const dayRecord = data[dateStr] || { todos: [], focusSessions: 0 };
        
        const todos = dayRecord.todos || [];
        refreshFocusSessionsDisplay(dayRecord.focusSessions);
        
        const totalTasks = todos.length;
        const completedTasks = todos.filter(t => t.done).length;
        const pendingTasks = totalTasks - completedTasks;
        
        statTasksDone.innerText = completedTasks;
        statTasksTodo.innerText = pendingTasks;
        
        todoList.innerHTML = '';
        
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.classList.add('todo-item');
            if (todo.done) li.classList.add('completed');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('todo-checkbox');
            checkbox.checked = todo.done;
            checkbox.addEventListener('change', () => {
                todo.done = checkbox.checked;
                saveDayTodos(dateStr, todos);
                renderModalContent(dateStr);
            });
            
            const span = document.createElement('span');
            span.classList.add('todo-text');
            span.innerText = todo.text;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('btn-delete-todo');
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = 'Delete task';
            deleteBtn.addEventListener('click', () => {
                const updatedTodos = todos.filter(t => t.id !== todo.id);
                saveDayTodos(dateStr, updatedTodos);
                renderModalContent(dateStr);
            });
            
            li.appendChild(checkbox);
            li.appendChild(span);
            li.appendChild(deleteBtn);
            todoList.appendChild(li);
        });
    }

    function handleAddTodo() {
        if (!activeDateStr) return;
        const text = todoInput.value.trim();
        if (text === '') return;
        
        const data = getStoredData();
        const dayRecord = data[activeDateStr] || { todos: [], focusSessions: 0 };
        const todos = dayRecord.todos || [];
        
        todos.push({
            id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            text: text,
            done: false
        });
        
        saveDayTodos(activeDateStr, todos);
        todoInput.value = '';
        renderModalContent(activeDateStr);
    }

    btnAddTodo.addEventListener('click', handleAddTodo);
    todoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddTodo();
    });
    
    closeModalBtn.addEventListener('click', () => {
        dailyModal.classList.remove('active');
        activeDateStr = null; 
    });

    dailyModal.addEventListener('click', (e) => {
        if (e.target === dailyModal) {
            dailyModal.classList.remove('active');
            activeDateStr = null;
        }
    });

    document.getElementById('prod-minus').addEventListener('click', () => {
        if (activeDateStr && activeFocusSessions > 0) {
            let newCount = activeFocusSessions - 1;
            refreshFocusSessionsDisplay(newCount);
            saveDayFocusSessions(activeDateStr, newCount);
        }
    });

    document.getElementById('prod-plus').addEventListener('click', () => {
        if (activeDateStr) {
            let newCount = activeFocusSessions + 1;
            refreshFocusSessionsDisplay(newCount);
            saveDayFocusSessions(activeDateStr, newCount);
        }
    });

    // ---- Pomodoro Timer ----
    let timerInterval = null;
    let timeRemaining = 25 * 60; 
    let isFocusMode = true; 
    let isRunning = false;
    
    const displayElement = document.getElementById('timer-display');
    const statusElement = document.getElementById('timer-status');
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnReset = document.getElementById('btn-reset');
    
    const focusInput = document.getElementById('focus-time');
    const breakInput = document.getElementById('break-time');
    
    function updateDisplay(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        displayElement.innerText = `${m}:${s}`;
        document.title = `${m}:${s} - HTML CSS and JS`; 
    }
    
    function setTimerMode() {
        const val = isFocusMode ? parseInt(focusInput.value) : parseInt(breakInput.value);
        timeRemaining = (isNaN(val) || val <= 0 ? (isFocusMode ? 25 : 5) : val) * 60;
        updateDisplay(timeRemaining);
        statusElement.innerText = isFocusMode ? "Focus Time" : "Break Time";
        statusElement.style.color = isFocusMode ? "var(--primary-light)" : "var(--secondary)";
    }
    
    async function timerTick() {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateDisplay(timeRemaining);
        } else {
            if (isFocusMode) {
                const todayStr = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
                
                const data = getStoredData();
                if (!data[todayStr]) data[todayStr] = { todos: [], focusSessions: 0 };
                data[todayStr].focusSessions = (data[todayStr].focusSessions || 0) + 1;
                
                saveStoredData(data);
                
                const updatedCount = data[todayStr].focusSessions;
                if (activeDateStr === todayStr) {
                    refreshFocusSessionsDisplay(updatedCount); 
                }
                renderCalendar();
            }
            
            isFocusMode = !isFocusMode;
            setTimerMode();
            
            alert(`Time's up! Starting ${isFocusMode ? 'Focus' : 'Break'} time.`);
        }
    }
    
    btnStart.addEventListener('click', () => {
        if (!isRunning) {
            timerInterval = setInterval(timerTick, 1000);
            isRunning = true;
            btnStart.disabled = true;
            btnPause.disabled = false;
        }
    });
    
    btnPause.addEventListener('click', () => {
        if (isRunning) {
            clearInterval(timerInterval);
            isRunning = false;
            btnStart.disabled = false;
            btnPause.disabled = true;
        }
    });
    
    btnReset.addEventListener('click', () => {
        clearInterval(timerInterval);
        isRunning = false;
        btnStart.disabled = false;
        btnPause.disabled = true;
        isFocusMode = true; 
        setTimerMode();
    });
    
    focusInput.addEventListener('change', () => { 
        if (!isRunning && isFocusMode) setTimerMode(); 
    });
    breakInput.addEventListener('change', () => { 
        if (!isRunning && !isFocusMode) setTimerMode(); 
    });
    
    // ---- Data Backup and Restore ----
    const btnExport = document.getElementById('btn-export');
    const btnImportTrigger = document.getElementById('btn-import-trigger');
    const importFile = document.getElementById('import-file');

    btnExport.addEventListener('click', () => {
        const data = getStoredData();
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `html_css_js_data_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    btnImportTrigger.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                if (typeof importedData !== 'object' || importedData === null) {
                    alert('Invalid backup file structure.');
                    return;
                }

                if (confirm('Are you sure you want to restore this backup? This will merge/overwrite your existing productivity data.')) {
                    const currentData = getStoredData();
                    const mergedData = { ...currentData, ...importedData };
                    saveStoredData(mergedData);
                    
                    renderCalendar();
                    alert('Data restored successfully!');
                }
            } catch (err) {
                alert('Failed to parse the backup file. Please make sure it is a valid JSON file.');
                console.error(err);
            }
            importFile.value = '';
        };
        reader.readAsText(file);
    });
    
    // ---- Initialization ----
    updateDisplay(timeRemaining);
    renderCalendar();
});

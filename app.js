document.addEventListener('DOMContentLoaded', () => {
    // ---- Calendar ----
    const currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    const calendarDays = document.getElementById('calendar-days');
    const currentMonthYear = document.getElementById('current-month-year');
    
    // ---- Global State (Local Storage) ----
    
    function getStoredData() {
        return JSON.parse(localStorage.getItem('hourself_native_data')) || {};
    }

    function saveStoredData(data) {
        localStorage.setItem('hourself_native_data', JSON.stringify(data));
    }

    // ---- Data Helpers ----
    function saveDayHours(dateStr, hours) {
        const data = getStoredData();
        if (!data[dateStr]) data[dateStr] = { hours: {}, prodScore: 0 };
        data[dateStr].hours = hours;
        saveStoredData(data);
        renderCalendar(true); 
    }

    function saveDayProdScore(dateStr, prodScore) {
        const data = getStoredData();
        if (!data[dateStr]) data[dateStr] = { hours: {}, prodScore: 0 };
        data[dateStr].prodScore = prodScore;
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

            const dayInfo = allData[dateStr] || { hours: {}, prodScore: 0 };
            
            let filledCount = 0;
            if (dayInfo.hours) {
                Object.values(dayInfo.hours).forEach(val => { 
                    if(val && val.trim() !== '') filledCount++; 
                });
            }
            
            const prodScore = dayInfo.prodScore || 0;
            
            if (filledCount > 0 || prodScore > 0) {
                const statsContainer = document.createElement('div');
                statsContainer.classList.add('day-stats');
                
                if (filledCount > 0) {
                    const preview = document.createElement('div');
                    preview.classList.add('day-badge');
                    preview.innerText = `${filledCount} hr${filledCount > 1 ? 's' : ''}`;
                    statsContainer.appendChild(preview);
                }
                
                if (prodScore > 0) {
                    const fire = document.createElement('div');
                    fire.classList.add('day-badge', 'fire');
                    fire.innerHTML = `${prodScore} <i class="fa-solid fa-fire"></i>`;
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

    // ---- Daily Hourly Tracker Modal ----
    const dailyModal = document.getElementById('daily-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const modalDateTitle = document.getElementById('modal-date-title');
    const hourlyList = document.getElementById('hourly-list');
    const prodScoreCounter = document.getElementById('prod-score');
    
    let activeDateStr = null;
    let activeScore = 0;

    function refreshProdScoreDisplay(score) {
        activeScore = score || 0;
        prodScoreCounter.innerText = activeScore;
    }

    function openDailyModal(dateStr, dayIndex, monthName) {
        activeDateStr = dateStr;
        modalDateTitle.innerText = `${monthName} ${dayIndex}, ${currentYear}`;
        dailyModal.classList.add('active');
        
        renderModalContent(dateStr);
    }
    
    function renderModalContent(dateStr) {
        const data = getStoredData();
        const dayRecord = data[dateStr] || { hours: {}, prodScore: 0 };
        refreshProdScoreDisplay(dayRecord.prodScore);
        
        hourlyList.innerHTML = '';
        const dayHours = dayRecord.hours || {};
        
        for (let i = 0; i < 24; i++) {
            const displayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
            const ampm = i < 12 ? 'AM' : 'PM';
            const hourLabel = `${displayHour} ${ampm}`;
            
            const row = document.createElement('div');
            row.classList.add('hour-row');
            
            const label = document.createElement('div');
            label.classList.add('hour-label');
            label.innerText = hourLabel;
            
            const textarea = document.createElement('textarea');
            textarea.id = `hour-input-${i}`; 
            textarea.classList.add('hour-input');
            textarea.placeholder = `What did you do at ${hourLabel}?`;
            textarea.value = dayHours[i] || ''; 
            
            let timeoutId;
            textarea.addEventListener('input', (e) => {
                const updatedVal = e.target.value;
                dayHours[i] = updatedVal;
                
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    saveDayHours(dateStr, dayHours);
                }, 800);
            });
            
            row.appendChild(label);
            row.appendChild(textarea);
            hourlyList.appendChild(row);
        }
        
        const todayStr = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
        if (activeDateStr === todayStr) {
            const currentHour = new Date().getHours();
            setTimeout(() => {
                const targetRow = hourlyList.children[currentHour];
                if (targetRow) {
                    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50); 
        }
    }
    
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
        if (activeDateStr && activeScore > 0) {
            let newScore = activeScore - 1;
            refreshProdScoreDisplay(newScore);
            saveDayProdScore(activeDateStr, newScore);
        }
    });

    document.getElementById('prod-plus').addEventListener('click', () => {
        if (activeDateStr) {
            let newScore = activeScore + 1;
            refreshProdScoreDisplay(newScore);
            saveDayProdScore(activeDateStr, newScore);
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
                if (!data[todayStr]) data[todayStr] = { hours: {}, prodScore: 0 };
                data[todayStr].prodScore += 1;
                
                saveStoredData(data);
                
                const updatedScore = data[todayStr].prodScore;
                if (activeDateStr === todayStr) {
                    refreshProdScoreDisplay(updatedScore); 
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

document.addEventListener('DOMContentLoaded', () => {
    // ---- Calendar ----
    const currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    const calendarDays = document.getElementById('calendar-days');
    const currentMonthYear = document.getElementById('current-month-year');
    
    // ---- API Helpers ----
    async function fetchMonthData(year, month) {
        try {
            const yearMonth = `${year}-${(month+1).toString().padStart(2, '0')}`;
            const res = await fetch(`/api/month/${yearMonth}`);
            if (!res.ok) throw new Error('Network error');
            return await res.json();
        } catch (err) {
            console.error(err);
            return {};
        }
    }

    async function fetchDayData(dateStr) {
        try {
            const res = await fetch(`/api/day/${dateStr}`);
            if (!res.ok) throw new Error('Network error');
            return await res.json();
        } catch (err) {
            console.error(err);
            return { hours: {}, prodScore: 0 };
        }
    }

    async function saveDayHours(dateStr, hours) {
        try {
            await fetch(`/api/dayData/${dateStr}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hours })
            });
            renderCalendar(); 
        } catch (err) { console.error(err); }
    }

    async function saveDayProdScore(dateStr, prodScore) {
        try {
            await fetch(`/api/dayScore/${dateStr}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prodScore })
            });
            renderCalendar();
        } catch (err) { console.error(err); }
    }

    // ---- Render Calendar Grid ----
    function renderCalendar() {
        currentMonthYear.innerText = `${monthNames[currentMonth]} ${currentYear}`;
        calendarDays.innerHTML = ''; 

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // Render empty slots 
        for (let i = 0; i < firstDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('calendar-day', 'empty');
            calendarDays.appendChild(emptyDiv);
        }
        
        const dayDivMap = {};

        // Render month days instantly
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
            
            // Add subtle loading spinner inside the day
            const loader = document.createElement('div');
            loader.classList.add('day-stats-loader');
            loader.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.5;"></i>';
            dayDiv.appendChild(loader);

            dayDiv.addEventListener('click', () => {
                openDailyModal(dateStr, i, monthNames[currentMonth]);
            });
            
            calendarDays.appendChild(dayDiv);
            
            dayDivMap[dateStr] = { div: dayDiv, loader };
        }
        
        // Fetch background data from our MongoDB Express API WITHOUT blocking UI
        fetchMonthData(currentYear, currentMonth).then(monthData => {
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${currentYear}-${(currentMonth+1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
                const cell = dayDivMap[dateStr];
                if (!cell) continue;

                if (cell.loader) cell.loader.remove(); // clear loading spinner

                const dayInfo = monthData[dateStr] || { hours: {}, prodScore: 0 };
                
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
        });
    }
    
    // Navigation
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
    
    async function openDailyModal(dateStr, dayIndex, monthName) {
        activeDateStr = dateStr;
        modalDateTitle.innerText = `${monthName} ${dayIndex}, ${currentYear}`;
        
        // Show loading state first
        hourlyList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 1.1rem;">Loading your tasks from MongoDB...<br><i class="fa-solid fa-circle-notch fa-spin" style="margin-top: 15px; font-size: 2rem;"></i></div>';
        dailyModal.classList.add('active');
        
        // Fetch from Express Server
        const dayRecord = await fetchDayData(dateStr);
        refreshProdScoreDisplay(dayRecord.prodScore);
        
        hourlyList.innerHTML = '';
        const dayHours = dayRecord.hours || {};
        
        // Generate 24 hours (12 AM to 11 PM)
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
            textarea.classList.add('hour-input');
            textarea.placeholder = `What did you do at ${hourLabel}?`;
            textarea.value = dayHours[i] || ''; 
            
            // Debounce the save trigger instead of making an HTTP post request on every keystroke
            let timeoutId;
            textarea.addEventListener('input', (e) => {
                dayHours[i] = e.target.value;
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
                    // Automatically focus textarea if needed: targetRow.querySelector('textarea').focus();
                }
            }, 100); 
        }
    }
    
    closeModalBtn.addEventListener('click', () => {
        dailyModal.classList.remove('active');
    });

    dailyModal.addEventListener('click', (e) => {
        if (e.target === dailyModal) {
            dailyModal.classList.remove('active');
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
        document.title = `${m}:${s} - HourSelf`; 
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
            // Auto increment Pomodoro to DB if we were focusing
            if (isFocusMode) {
                const todayStr = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
                // Fetch the current score first, then increment
                const dayData = await fetchDayData(todayStr);
                const updatedScore = (dayData.prodScore || 0) + 1;
                
                await saveDayProdScore(todayStr, updatedScore);
                
                if (activeDateStr === todayStr) {
                    refreshProdScoreDisplay(updatedScore); 
                }
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
    
    // ---- Initialization ----
    updateDisplay(timeRemaining);
    renderCalendar();
});

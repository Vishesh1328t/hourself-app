document.addEventListener('DOMContentLoaded', () => {

    // ---- Auth State & UI Elements ----
    let cachedToken = localStorage.getItem('hourself_token') || null;
    let isRegisterMode = false;

    const authOverlay = document.getElementById('auth-overlay');
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authSwitchBtn = document.getElementById('auth-switch-btn');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authErrorMsg = document.getElementById('auth-error-msg');
    
    function requireAuth() {
        authOverlay.classList.add('active');
        cachedToken = null;
        localStorage.removeItem('hourself_token');
        monthDataCache = {};
        calendarDays.innerHTML = '';
        currentMonthYear.innerText = 'Sign in required';
        if (timerInterval) {
            clearInterval(timerInterval);
            isRunning = false;
            btnStart.disabled = false;
            btnPause.disabled = true;
        }
    }

    authSwitchBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        authSubmitBtn.innerText = isRegisterMode ? "Create Account" : "Login";
        authSwitchText.innerText = isRegisterMode ? "Already have an account?" : "New to HourSelf?";
        authSwitchBtn.innerText = isRegisterMode ? "Sign in" : "Create Account";
        authErrorMsg.classList.add('hidden');
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
        
        authSubmitBtn.innerText = "Please wait...";
        authSubmitBtn.disabled = true;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail.value, password: authPassword.value })
            });
            const data = await res.json();

            if (!res.ok) {
                authErrorMsg.innerText = data.error || 'Authentication failed';
                authErrorMsg.classList.remove('hidden');
            } else {
                cachedToken = data.token;
                localStorage.setItem('hourself_token', data.token);
                authOverlay.classList.remove('active');
                authErrorMsg.classList.add('hidden');
                
                authEmail.value = '';
                authPassword.value = '';

                // Load user data seamlessly
                renderCalendar();
            }
        } catch (err) {
            authErrorMsg.innerText = 'Network error occurred.';
            authErrorMsg.classList.remove('hidden');
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = isRegisterMode ? "Create Account" : "Login";
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        requireAuth();
    });

    // ---- Calendar ----
    const currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    const calendarDays = document.getElementById('calendar-days');
    const currentMonthYear = document.getElementById('current-month-year');
    
    // ---- Global State ----
    let monthDataCache = {};
    let isMonthDataLoaded = false;

    // ---- API Helpers ----
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cachedToken}`
        };
    }

    async function handleApiRes(res) {
        if (res.status === 401 || res.status === 403) {
            requireAuth();
            throw new Error('Unauthorized');
        }
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    }

    async function fetchMonthData(year, month) {
        try {
            if (!cachedToken) return {};
            const yearMonth = `${year}-${(month+1).toString().padStart(2, '0')}`;
            const res = await fetch(`/api/month/${yearMonth}`, { headers: getAuthHeaders() });
            return await handleApiRes(res);
        } catch (err) {
            console.error(err);
            return {};
        }
    }

    async function fetchDayData(dateStr) {
        try {
            if (!cachedToken) return { hours: {}, prodScore: 0 };
            const res = await fetch(`/api/day/${dateStr}`, { headers: getAuthHeaders() });
            return await handleApiRes(res);
        } catch (err) {
            console.error(err);
            return { hours: {}, prodScore: 0 };
        }
    }

    async function saveDayHours(dateStr, hours) {
        try {
            if (!cachedToken) return;
            const res = await fetch(`/api/dayData/${dateStr}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ hours })
            });
            await handleApiRes(res);
            renderCalendar(true); 
        } catch (err) { console.error(err); }
    }

    async function saveDayProdScore(dateStr, prodScore) {
        try {
            if (!cachedToken) return;
            const res = await fetch(`/api/dayScore/${dateStr}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ prodScore })
            });
            await handleApiRes(res);
            renderCalendar(true);
        } catch (err) { console.error(err); }
    }

    let _dayDivMap = {};

    // ---- Render Calendar Grid ----
    function renderCalendar(onlyUpdateBadges = false) {
        if (!cachedToken) return;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

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
                
                const loader = document.createElement('div');
                loader.classList.add('day-stats-loader');
                loader.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.5;"></i>';
                dayDiv.appendChild(loader);

                dayDiv.addEventListener('click', () => {
                    openDailyModal(dateStr, i, monthNames[currentMonth]);
                });
                
                calendarDays.appendChild(dayDiv);
                _dayDivMap[dateStr] = { div: dayDiv, loader };
            }
            
            isMonthDataLoaded = false;
            fetchMonthData(currentYear, currentMonth).then(monthData => {
                for (const [dateKey, payload] of Object.entries(monthData)) {
                    if (!monthDataCache[dateKey]) {
                        monthDataCache[dateKey] = payload;
                    }
                }
                isMonthDataLoaded = true;

                if (activeDateStr && activeDateStr.startsWith(`${currentYear}-${(currentMonth+1).toString().padStart(2, '0')}`)) {
                    populateActiveModal(monthDataCache[activeDateStr]);
                }

                updateCalendarBadges(daysInMonth);
            });
        } else {
            updateCalendarBadges(daysInMonth);
        }
    }

    function updateCalendarBadges(daysInMonth) {
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${(currentMonth+1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            const cell = _dayDivMap[dateStr];
            if (!cell) continue;

            if (cell.loader) cell.loader.remove();

            const existingStats = cell.div.querySelector('.day-stats');
            if (existingStats) existingStats.remove();

            const dayInfo = monthDataCache[dateStr] || { hours: {}, prodScore: 0 };
            
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
        if (!cachedToken) return;
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        if (!cachedToken) return;
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
    
    function populateActiveModal(dayRecord) {
        if (!dayRecord) return;
        refreshProdScoreDisplay(dayRecord.prodScore || activeScore);
        
        const dayHours = dayRecord.hours || {};
        for (let i = 0; i < 24; i++) {
            const textarea = document.getElementById(`hour-input-${i}`);
            if (textarea && textarea.value.trim() === '' && dayHours[i]) {
                textarea.value = dayHours[i];
            }
        }
    }

    function openDailyModal(dateStr, dayIndex, monthName) {
        activeDateStr = dateStr;
        modalDateTitle.innerText = `${monthName} ${dayIndex}, ${currentYear}`;
        dailyModal.classList.add('active');
        
        renderModalContent(dateStr);

        if (!isMonthDataLoaded && !monthDataCache[dateStr]) {
            fetchDayData(dateStr).then(dayRecord => {
                if (activeDateStr === dateStr) {
                    monthDataCache[dateStr] = dayRecord;
                    populateActiveModal(dayRecord);
                }
            });
        }
    }
    
    function renderModalContent(dateStr) {
        const dayRecord = monthDataCache[dateStr] || { hours: {}, prodScore: 0 };
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
                if (!monthDataCache[dateStr]) monthDataCache[dateStr] = { hours: {}, prodScore: activeScore };
                monthDataCache[dateStr].hours[i] = updatedVal;
                
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    saveDayHours(dateStr, monthDataCache[dateStr].hours);
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
            // Auto increment Pomodoro to DB if focusing and logged in
            if (isFocusMode && cachedToken) {
                const todayStr = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
                
                if (!monthDataCache[todayStr]) monthDataCache[todayStr] = { hours: {}, prodScore: 0 };
                monthDataCache[todayStr].prodScore += 1;
                
                const updatedScore = monthDataCache[todayStr].prodScore;
                saveDayProdScore(todayStr, updatedScore);
                
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
    if (!cachedToken) {
        authOverlay.classList.add('active');
    } else {
        renderCalendar();
    }
});

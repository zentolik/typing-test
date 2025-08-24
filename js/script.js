async function loadConfig() {
    // fetch config.json
    const response = await fetch('/css/scss/config.json');
    if (!response.ok) {
        throw new Error(`Config konnte nicht geladen werden: ${response.statusText}`);
    }
    let config = await response.json();

    // replace "\\" in all strings
    function deepUnescape(obj) {
        if (typeof obj === 'string') {
            return obj.replace(/\\\\/g, '\\'); // "\\xxxx" → "\xxxx"
        } else if (Array.isArray(obj)) {
            return obj.map(deepUnescape);
        } else if (obj && typeof obj === 'object') {
            let newObj = {};
            for (let key in obj) {
                newObj[key] = deepUnescape(obj[key]);
            }
            return newObj;
        }
        return obj;
    }

    config = deepUnescape(config);

    // generate all maps from the config.json as global vars
    for (let key in config) {
        if (typeof config[key] === 'object') {
            window[key] = config[key];
        } else {
            window[key] = config[key];
        }
    }

    // convert unicode to character
    function unicodeToChar(text) {
        return text.replace(/\\[\dA-F]{4}/gi, 
            function (match) {
                return String.fromCharCode(parseInt(match.replace(/\\/g, ''), 16));
            });
    }

    // element selectors
    const els = {
        appStatus: document.querySelector('body[data-status]'),
        durationSelect: document.getElementById('durationSelect'),
        customWrap: document.getElementById('customMinutesWrapper'),
        customMinutes: document.getElementById('customMinutes'),
        startBtn: document.getElementById('startBtn'),
        restartBtn: document.getElementById('restartBtn'),
        timeLeft: document.getElementById('timeLeft'),
        wordsArea: document.getElementById('wordsArea'),
        wordsContainer: document.getElementById('wordsContainer'),
        typingInput: document.getElementById('typingInput'),
        summary: document.getElementById('summary'),
        wpm: document.getElementById('wpm'),
        keystrokes: document.getElementById('keystrokes'),
        accuracy: document.getElementById('accuracy'),
        correctKeys: document.getElementById('correctKeys'),
        wrongKeys: document.getElementById('wrongKeys'),
        correctWords: document.getElementById('correctWords'),
        wrongWords: document.getElementById('wrongWords'),
        autoAdvance: document.getElementById('autoAdvance'),
        cursorTooltip: document.getElementById('cursorTooltip'),
        cursorTooltipTime: document.getElementById('cursorTooltipTime'),
        cursorTooltipWords: document.getElementById('cursorTooltipWords'),
        showTimeCursor: document.getElementById('showTimeCursor'),
        showWordsCursor: document.getElementById('showWordsCursor'),
        graph: document.getElementById('graph'),
        graphToggler: document.getElementById('graphToggler'),
        graphWrapper: document.getElementById('graphWrapper'),
    };

    let state = {
        words: [],
        currentIndex: 0,
        timerId: null,
        secondsLeft: 0,
        totalSeconds: 0,
        started: false,
        
        // metrics
        keystrokes: 0,
        correctKeystrokes: 0,
        wrongKeystrokes: 0,
        correctWords: 0,
        wrongWords: 0,
        
        // input counter
        prevInputLen: 0,
        hadMismatch: false, // was there already a typo in the current word?
    };
    
    // load all the words from the "js/words.json" into the wordPool
    async function loadWords() {
        const res = await fetch('js/words.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('Konnte words.json nicht laden.');
        const data = await res.json();
        if (!Array.isArray(data.words)) throw new Error('words.json: Feld "words" fehlt oder ist kein Array.');
        state.wordPool = [...data.words];
    }
    
    // get random words from the wordPool
    function getRandomWord() {
        const pool = state.wordPool;
        const idx = Math.floor(Math.random() * pool.length);
        return pool[idx];
    }
    
    // number of words displayed / generated
    function fillWordBuffer(count = 53) {
        state.words = [];
        for (let i = 0; i < count; i++) {
            state.words.push(getRandomWord());
        }
    }
    
    // convert total seconds in to a "mm:ss" format
    function formatMMSS(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }
    
    // get duration from custom-controls/-settings
    function getDurationMinutes() {
        const sel = els.durationSelect.value;
        if (sel === 'custom') {
            let raw = els.customMinutes.value.trim();
            raw = raw.replace(',', '.');
            
            const v = parseFloat(raw);
            // min. 0.1 minutes, max. 120 minutes
            return Number.isFinite(v) && v > 0 ? Math.min(v, 120) : 1; // fallback 1 min
        }
        return parseInt(sel, 10);
    }
    
    function renderWords() {
        const frag = document.createDocumentFragment();
        state.words.forEach((word, i) => {
            const span = document.createElement('span');
            span.className = 'word' + (i === 0 ? ' current' : '');
            span.dataset.index = i.toString();
    
            if (i === 0) {
                // mark current word with per-char
                span.append(...renderCurrentWord(word, els.typingInput.value));
            } else {
                span.textContent = word;
            }
            frag.appendChild(span);
        });
    
        els.wordsContainer.innerHTML = '';
        els.wordsContainer.appendChild(frag);
    }
    
    function renderCurrentWord(word, typed) {
        // color correctly typed letters green ("ok"); at the first error, everything up to
        // the error position is displayed in red ("err"). The rest remains normal ("pending")
        const nodes = [];
        const wChars = Array.from(word);
        const tChars = Array.from(typed);
        let mismatchAt = -1;
    
        for (let i = 0; i < tChars.length; i++) {
            if (i >= wChars.length) { mismatchAt = i; break; }
            if (wChars[i] !== tChars[i]) { mismatchAt = i; break; }
        }
    
        for (let i = 0; i < wChars.length; i++) {
            const ch = document.createElement('span');
            ch.className = 'char';
    
            if (mismatchAt === -1 && i < tChars.length) {
                ch.classList.add('ok');
            } else if (mismatchAt !== -1 && i < mismatchAt) {
                ch.classList.add('err');
            } else if (mismatchAt !== -1 && i === mismatchAt) {
                ch.classList.add('err');
            } else {
                ch.classList.add('pending');
            }
    
            ch.textContent = wChars[i];
            nodes.push(ch);
        }
        return nodes;
    }

    function updateCurrentWordHighlight() {
        const current = els.wordsContainer.querySelector('.word.current');
        if (!current) return;
        const word = state.words[0] || '';
        current.innerHTML = '';
        current.append(...renderCurrentWord(word, els.typingInput.value));
    }
    
    function startTimer() {
        const minutes = getDurationMinutes();
        state.secondsLeft = Math.round(minutes * 60);
        state.totalSeconds = state.secondsLeft;
    
        els.timeLeft.textContent = formatMMSS(state.secondsLeft);
        clearInterval(state.timerId);
        state.timerId = setInterval(() => {
            state.secondsLeft--;
            els.timeLeft.textContent = formatMMSS(Math.max(0, state.secondsLeft));
            if (state.secondsLeft <= 0) {
                clearInterval(state.timerId);
                finishTest();
            }
        }, 1000);
    }
    
    function resetState() {
        els.appStatus.setAttribute('data-status', '');

        state.history = [];
        clearInterval(state.timerId);
        state.currentIndex = 0;
        state.timerId = null;
        state.secondsLeft = 0;
        state.started = false;
        state.keystrokes = 0;
        state.correctKeystrokes = 0;
        state.wrongKeystrokes = 0;
        state.correctWords = 0;
        state.wrongWords = 0;
        state.prevInputLen = 0;
        state.hadMismatch = false;
    
        els.typingInput.value = '';
        els.typingInput.disabled = false;
        els.typingInput.placeholder = 'Hier eingeben...';
        els.summary.classList.add('hidden');
    
        fillWordBuffer();
        renderWords();
    
        // reset duration display
        const mm = getDurationMinutes();
        els.timeLeft.textContent = formatMMSS(Math.round(mm * 60));
    }
    
    function submitCurrentWord(forceWrong = false) {
        const target = state.words[0] || '';
        const typed = els.typingInput.value;
    
        if (!forceWrong && typed === target) state.correctWords++;
        else state.wrongWords++;
    
        const elapsed = Math.max(0, state.totalSeconds - state.secondsLeft);
        const minutesSinceStart = Math.max(elapsed / 60, 1/60);
        const totalChars = state.correctKeystrokes;
        const wpmNow = Math.round((totalChars / 5) / minutesSinceStart);
    
        // save history
        state.history.push({
            time: elapsed,
            wpm: wpmNow,
            word: target,
            correct: !forceWrong && typed === target
        });
    
        // prepare next word
        state.words.shift(); // remove current word …
        state.words.push(getRandomWord()); // … add a new random word from the wordPool

        // reset input
        els.typingInput.value = '';
        state.prevInputLen = 0;
        state.hadMismatch = false;
    
        renderWords();
    }
    
    // automatically advances when word is complete (no "space" or "enter" required)
    function handleAutoAdvanceIfComplete() {
        if (!els.autoAdvance.checked) return; // only if auto-advance ("Autojump") is active
        const word = state.words[0] || '';
        const typed = els.typingInput.value;
        if (typed.length > 0 && typed === word) {
            submitCurrentWord(false);
        }
    }
    
    function finishTest() {
        els.appStatus.setAttribute('data-status', 'app-finished');
        els.typingInput.disabled = true;
    
        const minutes = Math.max(1/60, getDurationMinutes()); // protection against 0
        const totalChars = state.correctKeystrokes; // WPM by default: correct characters / 5 / min
        const wpm = Math.round((totalChars / 5) / minutes);
    
        const totalKeystrokes = state.correctKeystrokes + state.wrongKeystrokes;
        const acc = totalKeystrokes > 0
            ? (state.correctKeystrokes / totalKeystrokes) * 100
            : 0;
    
        els.wpm.textContent = String(wpm);
        els.keystrokes.textContent = String(totalKeystrokes);
        els.correctKeys.textContent = String(state.correctKeystrokes);
        els.wrongKeys.textContent = String(state.wrongKeystrokes);
        els.accuracy.textContent = acc.toFixed(2);
        els.correctWords.textContent = String(state.correctWords);
        els.wrongWords.textContent = String(state.wrongWords);
    
        els.graph.innerHTML = `
            <canvas id="wpmChart" width="600" height="300"></canvas>
        `;
    
        if (!state.history || state.history.length === 0) {
            els.summary.classList.remove('hidden');
            return;
        }
    
        const series = state.history.map(h => ({ x: h.time, y: h.wpm }));
    
        let chartInstance = null;
    
        if(els.graphToggler.checked) {
            els.graphToggler.checked = false;
        }
    
        function transparentize(color, opacity) {
            return color.replace('hsl', 'hsla').replace(')', `, ${opacity})`);
        }
    
        els.graphToggler.addEventListener('change', () => {
            if (els.graphToggler.checked) {
                const ctx = document.getElementById('wpmChart').getContext('2d');
    
                if (chartInstance) {
                    chartInstance.destroy();
                    chartInstance = null;
                }
    
                chartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: state.history.map(h => h.time),
                        datasets: [
                            {
                                label: 'WPM',
                                data: state.history.map(h => h.wpm),
                                borderColor: colorMap.accent,
                                backgroundColor: transparentize(colorMap.accent, .1),
                                pointBorderColor: colorMap.accent,
                                pointBackgroundColor: transparentize(colorMap.accent, .55),
                                tension: 0.2,
                                pointStyle: 'circle',
                                pointRadius: 3,
                                pointHoverRadius: 6,
                                yAxisID: 'y',
                                fill: true
                            },
                            {
                                label: 'Richtige Wörter',
                                data: state.history.map((h, i) =>
                                    state.history.slice(0, i + 1).filter(x => x.correct).length
                                    ),
                                borderColor: colorMap.ok,
                                backgroundColor: transparentize(colorMap.ok, .1),
                                pointBorderColor: colorMap.ok,
                                pointBackgroundColor: transparentize(colorMap.ok, .55),
                                borderDash: [15, 15],
                                tension: 0.2,
                                pointStyle: 'rect',
                                pointRadius: 3,
                                pointHoverRadius: 6,
                                yAxisID: 'y1',
                                fill: false
                            },
                            {
                                label: 'Falsche Wörter',
                                data: state.history.map((h, i) =>
                                    state.history.slice(0, i + 1).filter(x => !x.correct).length
                                    ),
                                borderColor: colorMap.err,
                                backgroundColor: transparentize(colorMap.err, .1),
                                pointBorderColor: colorMap.err,
                                pointBackgroundColor: transparentize(colorMap.err, .55),
                                borderDash: [10, 10],
                                tension: 0.2,
                                pointStyle: 'triangle',
                                pointRadius: 3,
                                pointHoverRadius: 6,
                                yAxisID: 'y1',
                                fill: false
                            }
                        ]
                    },
                    options: {
                        animation: {
                            duration: 2000,
                            easing: 'easeOutQuart'
                        },
                        responsive: true,
                        plugins: {
                            tooltip: {
                                usePointStyle: true,
                                displayColors: true,
                                callbacks: {
                                    label: (context) => {
                                        const i = context.dataIndex;
                                        const h = state.history[i];
                                        let icon = h.correct ? unicodeToChar(iconMap.checkmark) : unicodeToChar(iconMap.cross);
                                        let text = ` ${icon} "${h.word}" ━ WPM: ${h.wpm}`;
                                        return text;
                                    },
                                    labelTextColor: (context) => {
                                        const h = state.history[context.dataIndex];
                                        return h.correct ? 'hsl(142,71%,45%)' : 'hsl(0,84%,60%)';
                                    }
                                },
                                bodyFont: {
                                    family: 'icomoon, sans-serif',
                                    size: 12
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Zeit (Sekunden)'
                                },
                                ticks: {
                                    maxTicksLimit: 10
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'WPM'
                                },
                                position: 'left'
                            },
                            y1: {
                                title: {
                                    display: true,
                                    text: 'Wörter gesamt'
                                },
                                position: 'right',
                                grid: {
                                    drawOnChartArea: false
                                }
                            }
                        }
                    }
                });
            } else {
                els.graphWrapper.addEventListener(
                    'transitionend',
                    () => {
                        if (!els.graphToggler.checked && chartInstance) {
                        chartInstance.destroy();
                        chartInstance = null;
                        }
                    },
                    { once: true }
                );
            }
        });
    
        els.summary.classList.remove('hidden');
    }
    
    
    function onInput(e) {
        // start at first character
        if (!state.started && e.target.value.length > 0) {
            els.appStatus.setAttribute('data-status', 'app-running');
            state.started = true;
            console.log('START');
            startTimer();
        }
    
        // only count for adding characters (no backspaces)
        const curr = e.target.value;
        const word = state.words[0] || '';
        const prevLen = state.prevInputLen;
        const currLen = curr.length;
    
        if (currLen > prevLen) {
            // new characters (no pasting allowed → see onPaste)
            for (let i = prevLen; i < currLen; i++) {
                const pos = i;
                const ch = curr[i];
                state.keystrokes++;
    
                // already made mistakes in the word or outside the target word?
                if (state.hadMismatch || pos >= word.length) {
                    state.wrongKeystrokes++;
                    state.hadMismatch = true;
                    continue;
                }
    
                if (word[pos] === ch) {
                    state.correctKeystrokes++;
                } else {
                    state.wrongKeystrokes++;
                    state.hadMismatch = true;
                }
            }
        }
        state.prevInputLen = currLen;
    
        updateCurrentWordHighlight();
        handleAutoAdvanceIfComplete();
    }
    
    // press "enter" or "space" to complete word
    function onKeyDown(e) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            const target = state.words[0] || '';
            const typed = els.typingInput.value;
    
            if (typed.length === 0) return;
            if (typed === target) submitCurrentWord(false);
            else submitCurrentWord(true);
        }
        // prevent tab (loss of focus during test)
        if (e.key === 'Tab') e.preventDefault();
    }
    
    function onPaste(e) {
        // disable pasting to keep metrics fair
        e.preventDefault();
    }
    
    function toggleCustom() {
        const isCustom = els.durationSelect.value === 'custom';
        els.customWrap.classList.toggle('hidden', !isCustom);
        if (isCustom) els.customMinutes.focus();
        const mm = getDurationMinutes();
        els.timeLeft.textContent = formatMMSS(mm * 60);
    }
    
    async function init() {
        await loadWords();
        renderWords();
        resetState(true);
    
        els.durationSelect.addEventListener('change', toggleCustom);
        els.customMinutes.addEventListener('input', () => {
            const mm = getDurationMinutes();
            els.timeLeft.textContent = formatMMSS(mm * 60);
        });
    
        els.startBtn.addEventListener('click', () => {
            resetState(true);
            els.typingInput.focus();
        });
    
        els.restartBtn.addEventListener('click', () => {
            resetState(true);
            els.typingInput.focus();
        });
    
        els.wordsArea.addEventListener('click', () => {
            els.typingInput.focus();
        });
    
        els.typingInput.addEventListener('input', onInput);
        els.typingInput.addEventListener('keydown', onKeyDown);
        els.typingInput.addEventListener('paste', onPaste);
    
        // cursor tooltip (show stats)
        setInterval(() => {
            if (!els.cursorTooltip) return;
    
            if (!els.showTimeCursor.checked && !els.showWordsCursor.checked) {
                els.cursorTooltip.classList.add('hidden');
            } else {
                els.cursorTooltip.classList.remove('hidden');
                const time = formatMMSS(state.secondsLeft);
                if (els.showTimeCursor.checked && els.showWordsCursor.checked) {
                    els.cursorTooltipTime.innerHTML = `${time} ━ `;
                } else if (els.showTimeCursor.checked && !els.showWordsCursor.checked) {
                    els.cursorTooltipTime.innerHTML = time;
                } else {
                    els.cursorTooltipTime.innerHTML = '';
                }
                if (els.showWordsCursor.checked) {
                    els.cursorTooltipWords.innerHTML = `<span class="correct">${state.correctWords}</span> | <span  class="wrong">${state.wrongWords}</span>`;
                } else {
                    els.cursorTooltipWords.innerHTML = '';
                }
            }
        }, 75);
        let lastMouseX = 0;
        let lastMouseY = 0;
        document.addEventListener('mousemove', (e) => {
            if (els.showTimeCursor.checked || els.showWordsCursor.checked) {
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
    
                if (!els.cursorTooltip) return;
    
                els.cursorTooltip.style.left = `${lastMouseX}px`;
                els.cursorTooltip.style.top = `${lastMouseY}px`;
            }
        });
    }
    
    init().catch(err => {
        console.error(err);
        els.wordsContainer.textContent = 'Fehler beim Laden der Wörter: ' + err.message;
    });
}

loadConfig().catch(console.error);
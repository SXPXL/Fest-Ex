// ==========================================
// CONFIGURATION
// ==========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz0SBabKwcnixEgEO93MnxA9zw6oRf6ckcBWJfTJ13Ha1JnyX_OIpUpDoXpPQO1Nq_yDA/exec";


// ==========================================
// STATE MANAGEMENT
// ==========================================
let appState = {
    currentFest: null,
    editingTxnId: null,
    fests: [], 
    transactions: [], 
    users: [],
    calCursorDate: new Date(),
    adminPassword: localStorage.getItem('fest_admin_pass') || null 
};

// HELPER: Fixes the "Day Back" bug by forcing Local Time conversion
function getLocalISODate(dateObj) {
    // Takes a date object and returns "YYYY-MM-DD" in local timezone
    const offset = dateObj.getTimezoneOffset() * 60000; // Offset in milliseconds
    const localDate = new Date(dateObj.getTime() - offset);
    return localDate.toISOString().split('T')[0];
}

// ==========================================
// INITIALIZATION
// ==========================================
async function init() {
    const list = document.getElementById('active-fests-list');
    if(list) list.innerHTML = "Loading from cloud...";
    
    updateAdminUI();

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        
        // FIX 1: Use getLocalISODate instead of pure toISOString
        appState.fests = data.fests.map(f => ({
            ...f,
            startDate: getLocalISODate(new Date(f.startDate)),
            endDate: getLocalISODate(new Date(f.endDate))
        }));
        
        appState.transactions = data.transactions.map(t => ({
             ...t,
             id: String(t.id),
             date: getLocalISODate(new Date(t.date))
        }));

        appState.users = data.users || [];
        console.log("Data Synced!", appState);
        showPage('home');

    } catch (error) {
        alert("Failed to load data. Check internet.");
        console.error(error);
    }
}

// ==========================================
// ADMIN / AUTHENTICATION LOGIC
// ==========================================
function toggleAdminLogin() {
    if (appState.adminPassword) {
        if(confirm("Logout of Admin Mode?")) {
            appState.adminPassword = null;
            localStorage.removeItem('fest_admin_pass');
            location.reload(); 
        }
    } else {
        const pass = prompt("Enter Admin Password to Edit:");
        if (pass) {
            appState.adminPassword = pass;
            localStorage.setItem('fest_admin_pass', pass);
            updateAdminUI();
            if (appState.currentFest) {
                renderExpenseList(document.querySelector('.date-tab.active')?.dataset.date || appState.currentFest.startDate);
                const btn = document.getElementById('add-expense-btn'); // Safe check
                if(btn) btn.classList.remove('hidden');
            }
            if(!document.getElementById('page-home').classList.contains('hidden')) renderHome();
        }
    }
}

function updateAdminUI() {
    const btn = document.getElementById('admin-btn');
    if(!btn) return;
    if (appState.adminPassword) {
        btn.innerHTML = '<i class="fas fa-unlock"></i> Admin';
        btn.style.color = "#03dac6";
    } else {
        btn.innerHTML = '<i class="fas fa-lock"></i> Login';
        btn.style.color = "#aaa";
    }
}

// ==========================================
// NAVIGATION
// ==========================================
function toggleMenu() {
    document.getElementById('drawer').classList.toggle('open');
    const overlay = document.querySelector('.nav-overlay');
    overlay.style.display = document.getElementById('drawer').classList.contains('open') ? 'block' : 'none';
}

function showPage(pageId) {
    ['page-home', 'page-create-event', 'page-fest-details', 'page-analytics'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.getElementById('drawer').classList.remove('open');
    document.querySelector('.nav-overlay').style.display = 'none';

    if (pageId === 'home') renderHome();
    if (pageId === 'create-event') renderCreateFestPage(); 
    if (pageId === 'analytics') renderAnalytics();
}

// ==========================================
// HOME PAGE
// ==========================================
function renderHome() {
    const list = document.getElementById('active-fests-list');
    list.innerHTML = ""; 

    const addCard = document.getElementById('add-fest-card');
    if(appState.adminPassword) addCard.classList.remove('hidden');
    else addCard.classList.add('hidden');

    if (appState.fests.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:40px; color:#666; border: 2px dashed #333; border-radius: 12px; margin-top:20px;">No fests found.</div>`;
        return;
    }

    appState.fests.forEach(fest => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<div class="flex justify-between"><h3 style="margin:0; color:#bb86fc;">${fest.name}</h3><span style="font-size:0.8rem; background:#333; padding:2px 6px; border-radius:4px;">${fest.startDate}</span></div><div style="margin-top:5px; color:#aaa; font-size:0.9rem;">${fest.participants.length} Participants</div>`;
        card.onclick = () => openFestDetails(fest);
        list.appendChild(card);
    });
}

// ==========================================
// CREATE FEST & USERS
// ==========================================
function renderCreateFestPage() {
    const container = document.getElementById('user-selection-list');
    if(!container) return; 
    container.innerHTML = "";
    if (appState.users.length === 0) {
        container.innerHTML = "<div style='color:#666; font-size:0.9rem; padding:10px;'>No friends added yet.</div>";
        return;
    }
    appState.users.forEach(u => {
        container.innerHTML += `<label class="flex" style="padding: 8px; border-bottom: 1px solid #333; cursor:pointer;"><input type="checkbox" class="fest-user-check" value="${u.name}" style="width:20px; margin:0; margin-right:10px;">${u.name}</label>`;
    });
}

function addNewGlobalUser() {
    if(!appState.adminPassword) return alert("Admin access required.");
    const nameInput = document.getElementById('newFriendName');
    const name = nameInput.value.trim();
    if (!name) return alert("Enter a name");

    const newUser = { id: Date.now().toString(), name: name };
    appState.users.push(newUser);
    nameInput.value = "";
    renderCreateFestPage();

    fetch(GOOGLE_SCRIPT_URL, { 
        method: "POST", mode: "no-cors", 
        body: JSON.stringify({ action: "createUser", id: newUser.id, name: newUser.name, password: appState.adminPassword }) 
    });
}

function saveFestSetup() {
    if(!appState.adminPassword) return alert("Admin access required.");
    const name = document.getElementById('festName').value;
    const start = document.getElementById('festStartDate').value;
    const end = document.getElementById('festEndDate').value;
    const participants = Array.from(document.querySelectorAll('.fest-user-check:checked')).map(cb => cb.value);

    if(!name || !start || participants.length === 0) return alert("Fill details & select friends");

    const fest = { id: Date.now().toString(), name, startDate: start, endDate: end || start, participants };
    appState.fests.push(fest);
    
    fetch(GOOGLE_SCRIPT_URL, { 
        method: "POST", mode: "no-cors", 
        body: JSON.stringify({ action: "createFest", ...fest, password: appState.adminPassword }) 
    });
    
    document.getElementById('festName').value = "";
    openFestDetails(fest);
}

// ==========================================
// FEST DETAILS & TRANSACTION LIST
// ==========================================
function openFestDetails(fest) {
    appState.currentFest = fest;
    showPage('fest-details'); 
    document.getElementById('fest-details-title').innerText = fest.name;
    document.getElementById('view-fest-list').classList.remove('hidden');
    document.getElementById('view-add-expense').classList.add('hidden');

    const addBtn = document.getElementById('add-expense-btn');
    if(appState.adminPassword) addBtn.classList.remove('hidden');
    else addBtn.classList.add('hidden');

    const tabsContainer = document.getElementById('fest-date-tabs');
    tabsContainer.innerHTML = "";
    
    // FIX 2: Create dates using YYYY-MM-DD components to avoid UTC shift
    const startParts = fest.startDate.split('-');
    const endParts = fest.endDate.split('-');
    
    // Note: Month is 0-indexed in JS Date
    let curr = new Date(startParts[0], startParts[1]-1, startParts[2]);
    let last = new Date(endParts[0], endParts[1]-1, endParts[2]);
    let firstDateStr = fest.startDate;

    while (curr <= last) {
        // Use local components for formatting
        let dateStr = getLocalISODate(curr);
        
        let tab = document.createElement('div');
        tab.className = `date-tab ${dateStr === firstDateStr ? 'active' : ''}`;
        tab.innerText = dateStr.slice(5); 
        tab.dataset.date = dateStr;
        tab.onclick = (e) => {
            document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            renderExpenseList(dateStr);
        };
        tabsContainer.appendChild(tab);
        curr.setDate(curr.getDate() + 1);
    }
    renderExpenseList(firstDateStr);
}

function renderExpenseList(dateStr) {
    const listContainer = document.getElementById('expense-list-container');
    listContainer.innerHTML = "";

    const dailyTxns = appState.transactions.filter(t => t.eventId === appState.currentFest.id && t.date === dateStr);

    if (dailyTxns.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#666;">No expenses for this date.</div>`;
        return;
    }

    dailyTxns.forEach(t => {
        let payerText = Object.keys(t.payers).join(", ");
        if (Object.keys(t.payers).length > 2) payerText = "Multiple";

        const item = document.createElement('div');
        item.className = 'card';
        item.style.margin = "10px 15px"; 
        item.style.position = "relative";
        
        let actionsHtml = "";
        if (appState.adminPassword) {
            actionsHtml = `
            <div style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); display:flex; gap:15px;">
                <div onclick="editTransaction('${t.id}')" style="cursor: pointer; color: var(--primary);">
                    <i class="fas fa-edit"></i>
                </div>
                <div onclick="deleteTransaction('${t.id}')" style="cursor: pointer; color: var(--error);">
                    <i class="fas fa-trash"></i>
                </div>
            </div>`;
        }

        item.innerHTML = `
            <div class="flex justify-between" style="padding-right: ${appState.adminPassword ? '60px' : '0'};">
                <span style="font-weight:bold; font-size:1.1rem;">${t.title}</span>
                <span style="color:var(--secondary); font-weight:bold;">₹${t.amount}</span>
            </div>
            <div style="font-size:0.85rem; color:#aaa; margin-top:5px;">Paid by: ${payerText}</div>
            ${actionsHtml}
        `;
        listContainer.appendChild(item);
    });
}

// ==========================================
// ADD / EDIT / DELETE LOGIC
// ==========================================

function deleteTransaction(txnId) {
    if(!appState.adminPassword) return;
    if(!confirm("Delete expense?")) return;

    appState.transactions = appState.transactions.filter(t => t.id !== txnId);
    
    const activeTab = document.querySelector('.date-tab.active');
    renderExpenseList(activeTab ? activeTab.dataset.date : appState.currentFest.startDate);

    fetch(GOOGLE_SCRIPT_URL, { 
        method: "POST", mode: "no-cors", 
        body: JSON.stringify({ action: "deleteExpense", id: txnId, password: appState.adminPassword }) 
    });
}

function showAddExpenseForm() {
    if(!appState.adminPassword) return;
    document.getElementById('view-fest-list').classList.add('hidden');
    document.getElementById('view-add-expense').classList.remove('hidden');
    document.getElementById('expense-form-title').innerText = "New Expense";
    appState.editingTxnId = null;
    document.getElementById('expTitle').value = "";
    document.getElementById('expAmount').value = "";
    renderPayerUI(); 
}

function hideAddExpenseForm() {
    document.getElementById('view-add-expense').classList.add('hidden');
    document.getElementById('view-fest-list').classList.remove('hidden');
}

function editTransaction(txnId) {
    if(!appState.adminPassword) return;
    const txn = appState.transactions.find(t => t.id === txnId);
    if (!txn) return;

    appState.editingTxnId = txnId;
    showAddExpenseForm();
    document.getElementById('expense-form-title').innerText = "Edit Expense";

    document.getElementById('expTitle').value = txn.title;
    document.getElementById('expAmount').value = txn.amount;

    document.querySelectorAll('.payer-check').forEach(cb => cb.checked = false);
    document.querySelectorAll('.payer-input').forEach(inp => { inp.value = ""; inp.classList.add('hidden'); });

    for (const [person, amount] of Object.entries(txn.payers)) {
        const checkbox = document.querySelector(`.payer-check[value="${person}"]`);
        if (checkbox) {
            checkbox.checked = true;
            if (Object.keys(txn.payers).length > 1) {
                const input = document.getElementById(`pay-amt-${person}`);
                input.classList.remove('hidden');
                input.value = amount;
            }
        }
    }

    const isEquallySplit = Object.values(txn.split).every(val => Math.abs(val - (txn.amount / Object.keys(txn.split).length)) < 0.1);
    document.getElementById('splitEquallyCheck').checked = isEquallySplit;
    toggleSplitMode();

    if (!isEquallySplit) {
        for (const [person, amount] of Object.entries(txn.split)) {
            const input = document.getElementById(`split-amt-${person}`);
            if (input) input.value = amount;
        }
    }
}

function renderPayerUI() {
    const participants = appState.currentFest.participants;
    const pContainer = document.getElementById('payer-selection-area');
    const sContainer = document.getElementById('split-selection-area');
    pContainer.innerHTML = ""; sContainer.innerHTML = "";

    participants.forEach(p => {
        pContainer.innerHTML += `<div class="user-select-row"><div class="flex"><input type="checkbox" class="payer-check" value="${p}" onchange="handlePayerChange()" style="width:20px; margin-right:10px;">${p}</div><input type="number" class="amount-manual payer-input hidden" id="pay-amt-${p}" placeholder="0"></div>`;
        sContainer.innerHTML += `<div class="user-select-row"><span>${p}</span><input type="number" class="amount-manual split-input" id="split-amt-${p}" placeholder="0"></div>`;
    });
}

function handlePayerChange() {
    const checked = document.querySelectorAll('.payer-check:checked');
    document.querySelectorAll('.payer-input').forEach(i => i.classList.add('hidden'));
    if (checked.length > 1) checked.forEach(chk => document.getElementById(`pay-amt-${chk.value}`).classList.remove('hidden'));
}

function toggleSplitMode() {
    const isEqual = document.getElementById('splitEquallyCheck').checked;
    const area = document.getElementById('split-selection-area');
    if (isEqual) area.classList.add('hidden');
    else area.classList.remove('hidden');
}

function submitTransaction() {
    if(!appState.adminPassword) return alert("Admin access required.");
    const fest = appState.currentFest;
    const title = document.getElementById('expTitle').value;
    const total = parseFloat(document.getElementById('expAmount').value);
    const date = document.querySelector('.date-tab.active').dataset.date;

    if (!title || !total) return alert("Enter details");

    let payers = {};
    const checkedPayers = document.querySelectorAll('.payer-check:checked');
    if (checkedPayers.length === 0) return alert("Who paid?");
    
    let paidSum = 0;
    checkedPayers.forEach(chk => {
        let val = checkedPayers.length === 1 ? total : (parseFloat(document.getElementById(`pay-amt-${chk.value}`).value) || 0);
        payers[chk.value] = val;
        paidSum += val;
    });

    if (Math.abs(paidSum - total) > 1) return alert("Paid amount mismatch");

    let split = {};
    if (document.getElementById('splitEquallyCheck').checked) {
        fest.participants.forEach(p => split[p] = total / fest.participants.length);
    } else {
        let splitSum = 0;
        document.querySelectorAll('.split-input').forEach(inp => {
            let val = parseFloat(inp.value) || 0;
            split[inp.id.replace('split-amt-', '')] = val;
            splitSum += val;
        });
        if (Math.abs(splitSum - total) > 1) return alert("Split amount mismatch");
    }

    if (appState.editingTxnId) {
        const index = appState.transactions.findIndex(t => t.id === appState.editingTxnId);
        if (index !== -1) {
            appState.transactions[index] = { ...appState.transactions[index], title, amount: total, payers, split };
            
            const payload = { action: "editExpense", id: appState.editingTxnId, festId: fest.id, date: appState.transactions[index].date, title, amount: total, payers, split, password: appState.adminPassword };
            fetch(GOOGLE_SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
        }
    } else {
        const id = Date.now().toString();
        const txn = { id, eventId: fest.id, date, title, amount: total, payers, split };
        appState.transactions.push(txn);
        
        const payload = { action: "addExpense", id, festId: txn.eventId, date, title, amount: total, payers, split, password: appState.adminPassword };
        fetch(GOOGLE_SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
    }

    hideAddExpenseForm();
    renderExpenseList(date);
}

// ==========================================
// ANALYTICS & SETTLEMENT
// ==========================================

function renderAnalytics() {
    const txns = appState.transactions;
    const total = txns.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    document.getElementById('stat-total').innerText = `₹${total}`;

    let payerStats = {};
    txns.forEach(t => {
        for(let [p, amt] of Object.entries(t.payers)) {
            payerStats[p] = (payerStats[p] || 0) + parseFloat(amt);
        }
    });
    
    let whale = "-";
    if (Object.keys(payerStats).length > 0) {
         whale = Object.keys(payerStats).reduce((a, b) => payerStats[a] > payerStats[b] ? a : b);
    }
    document.getElementById('stat-whale').innerText = whale;

    renderCalendar(); 
    renderChart(txns);
}

function renderChart(txns) {
    const ctx = document.getElementById('spendChart').getContext('2d');
    let daily = {};
    txns.forEach(t => { daily[t.date] = (daily[t.date] || 0) + parseFloat(t.amount); });

    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(daily), datasets: [{ label: 'Spending', data: Object.values(daily), backgroundColor: '#bb86fc', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#333' }, beginAtZero: true }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

function renderCalendar() {
    const container = document.getElementById('calendar-months-container');
    container.innerHTML = "";
    
    let dailyTotals = {};
    appState.transactions.forEach(t => { dailyTotals[t.date] = (dailyTotals[t.date] || 0) + parseFloat(t.amount); });

    const today = new Date();
    // FIX 3: Start loop in local time
    let loopDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    for (let i = 0; i < 12; i++) {
        const monthIndex = loopDate.getMonth();
        const year = loopDate.getFullYear();
        const monthName = loopDate.toLocaleString('default', { month: 'short' });

        const monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';
        monthBlock.innerHTML = `<div class="month-label">${monthName}</div>`;
        const grid = document.createElement('div');
        grid.className = 'month-grid';

        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
        
        for(let j=0; j<firstDayOfWeek; j++) grid.innerHTML += `<div class="heatmap-box empty"></div>`;

        for(let day=1; day<=daysInMonth; day++) {
            // FIX 4: Build date string manually for lookup
            const dateStr = `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const amount = dailyTotals[dateStr] || 0;
            
            let level = 'level-0';
            if (amount > 0) level = 'level-1';
            if (amount > 500) level = 'level-2';
            if (amount > 1500) level = 'level-3';
            if (amount > 3000) level = 'level-4';

            const box = document.createElement('div');
            box.className = `heatmap-box ${level}`;
            box.addEventListener('mouseenter', (e) => showTooltip(e, dateStr, amount));
            box.addEventListener('mousemove', (e) => moveTooltip(e));
            box.addEventListener('mouseleave', hideTooltip);
            grid.appendChild(box);
        }
        monthBlock.appendChild(grid);
        container.appendChild(monthBlock);
        loopDate.setMonth(loopDate.getMonth() + 1);
    }
    setTimeout(() => { document.querySelector('.heatmap-scroll-wrapper').scrollLeft = 9999; }, 150);
}

const tooltipEl = document.getElementById('heatmap-tooltip');
function showTooltip(e, date, amount) {
    if(!tooltipEl) return;
    // FIX 5: Tooltip also needs to parse date string as local parts
    const parts = date.split('-');
    const dateObj = new Date(parts[0], parts[1]-1, parts[2]);
    const dateText = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    tooltipEl.innerHTML = `<strong>${dateText}</strong><br>₹${amount}`;
    tooltipEl.style.display = 'block';
    moveTooltip(e);
}
function moveTooltip(e) {
    if(!tooltipEl) return;
    const x = e.clientX + 10;
    const y = e.clientY - 40;
    tooltipEl.style.left = (x + 100 > window.innerWidth ? e.clientX - 110 : x) + 'px';
    tooltipEl.style.top = y + 'px';
}
function hideTooltip() { if(tooltipEl) tooltipEl.style.display = 'none'; }

// --- SETTLEMENT LOGIC ---
function showSettlementModal() {
    const modal = document.getElementById('settlement-modal');
    modal.classList.remove('hidden');
    calculateSettlement(appState.currentFest.id, 'fest-settlement-plan');
}
function closeSettlementModal() { document.getElementById('settlement-modal').classList.add('hidden'); }

function calculateSettlement(festId, outputElementId) {
    if (!festId) return;
    const festTxns = appState.transactions.filter(t => t.eventId === festId);
    const container = document.getElementById(outputElementId);

    if (festTxns.length === 0) {
        container.innerHTML = "<div style='text-align:center; color:#888; padding:20px;'>No expenses recorded yet.</div>";
        return;
    }

    let bal = {}, spent = {}, consumed = {};
    appState.currentFest.participants.forEach(m => { bal[m] = 0; spent[m]=0; consumed[m]=0; });

    festTxns.forEach(tx => {
        for (const [person, amount] of Object.entries(tx.payers)) {
            let val = parseFloat(amount);
            bal[person] += val; spent[person] += val;
        }
        for (const [person, amount] of Object.entries(tx.split)) {
            let val = parseFloat(amount);
            bal[person] -= val; consumed[person] += val;
        }
    });

    let html = `<h4 style="color:#a0a0a0; margin-bottom:10px; font-size:0.9rem; text-transform:uppercase;">Net Balance</h4>
    <table style="width:100%; font-size:0.85rem; color:#ccc; margin-bottom:20px; border-collapse: collapse;">
    <tr style="border-bottom:1px solid #444; text-align:left;"><th style="padding:5px;">Name</th><th style="padding:5px;">Paid</th><th style="padding:5px;">Ate</th><th style="padding:5px;">Net</th></tr>`;

    for (let p in bal) {
        bal[p] = Math.round(bal[p] * 100) / 100;
        let color = bal[p] >= 0 ? "#03dac6" : "#cf6679";
        html += `<tr style="border-bottom:1px solid #333;"><td style="padding:5px;">${p}</td><td style="padding:5px; color:#aaa;">${Math.round(spent[p])}</td><td style="padding:5px; color:#aaa;">${Math.round(consumed[p])}</td><td style="padding:5px; color:${color}; font-weight:bold;">${bal[p]>0?'+':''}${bal[p]}</td></tr>`;
    }
    html += `</table>`;

    let debtors = [], creditors = [];
    for (let p in bal) {
        if (bal[p] < -0.01) debtors.push({ p, amt: -bal[p] });
        if (bal[p] > 0.01) creditors.push({ p, amt: bal[p] });
    }

    debtors.sort((a, b) => b.amt - a.amt);
    creditors.sort((a, b) => b.amt - a.amt);

    let paymentHtml = `<h4 style="color:#a0a0a0; margin-bottom:10px; font-size:0.9rem; text-transform:uppercase;">Payments</h4>`;
    let i = 0, j = 0;
    
    while (i < debtors.length && j < creditors.length) {
        let x = Math.min(debtors[i].amt, creditors[j].amt);
        x = Math.round(x * 100) / 100;

        if (x > 0) {
            paymentHtml += `<div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;"><span><b style="color:#cf6679">${debtors[i].p}</b> pays <b style="color:#03dac6">${creditors[j].p}</b></span><span style="color:#fff; font-weight:bold;">₹${x}</span></div>`;
        }
        debtors[i].amt -= x; creditors[j].amt -= x;
        if (debtors[i].amt < 0.01) i++;
        if (creditors[j].amt < 0.01) j++;
    }

    container.innerHTML = html + paymentHtml;
}

// START
init();
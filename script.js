// CONFIGURATION
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz0SBabKwcnixEgEO93MnxA9zw6oRf6ckcBWJfTJ13Ha1JnyX_OIpUpDoXpPQO1Nq_yDA/exec"; 

/// ==========================================
// CONFIGURATION
// ==========================================
// PASTE YOUR DEPLOYED GOOGLE SCRIPT URL HERE


// ==========================================
// STATE MANAGEMENT
// ==========================================
let appState = {
    currentFest: null,
    fests: [], 
    transactions: [], 
    users: [], // Global Friend List
    calCursorDate: new Date()
};

// ==========================================
// INITIALIZATION
// ==========================================
async function init() {
    const list = document.getElementById('active-fests-list');
    if(list) list.innerHTML = "Loading from cloud...";
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        
        // Update State
        appState.fests = data.fests.map(f => ({
            ...f,
            startDate: new Date(f.startDate).toISOString().split('T')[0],
            endDate: new Date(f.endDate).toISOString().split('T')[0]
        }));
        
        appState.transactions = data.transactions.map(t => ({
             ...t,
             date: new Date(t.date).toISOString().split('T')[0]
        }));

        // Load Global Users
        appState.users = data.users || [];

        console.log("Data Synced!", appState);
        showPage('home');

    } catch (error) {
        alert("Failed to load data. Check internet.");
        console.error(error);
    }
}

// ==========================================
// NAVIGATION
// ==========================================
function toggleMenu() {
    const drawer = document.getElementById('drawer');
    const overlay = document.querySelector('.nav-overlay');
    drawer.classList.toggle('open');
    overlay.style.display = drawer.classList.contains('open') ? 'block' : 'none';
}

function showPage(pageId) {
    // Hide all pages
    ['page-home', 'page-create-event', 'page-fest-details', 'page-analytics'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    // Show target page
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    
    // Close Drawer
    document.getElementById('drawer').classList.remove('open');
    const overlay = document.querySelector('.nav-overlay');
    if(overlay) overlay.style.display = 'none';

    // Trigger specific renders
    if (pageId === 'home') renderHome();
    if (pageId === 'create-event') renderCreateFestPage(); 
    if (pageId === 'analytics') renderAnalytics();
}

// ==========================================
// HOME PAGE (FEST LIST)
// ==========================================
function renderHome() {
    const list = document.getElementById('active-fests-list');
    list.innerHTML = ""; 

    if (appState.fests.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:40px; color:#666; border: 2px dashed #333; border-radius: 12px; margin-top:20px;">
            <i class="fas fa-ghost" style="font-size: 2rem; margin-bottom: 10px;"></i><br>
            No fests found.<br>Click <b>+ Add New Fest</b> to start.
        </div>`;
        return;
    }

    appState.fests.forEach(fest => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="flex justify-between">
                <h3 style="margin:0; color:#bb86fc;">${fest.name}</h3>
                <span style="font-size:0.8rem; background:#333; padding:2px 6px; border-radius:4px;">${fest.startDate}</span>
            </div>
            <div style="margin-top:5px; color:#aaa; font-size:0.9rem;">
                ${fest.participants.length} Participants
            </div>
        `;
        card.onclick = () => openFestDetails(fest);
        list.appendChild(card);
    });
}

// ==========================================
// CREATE FEST & USER MANAGEMENT
// ==========================================

// 1. Render User Selection List
function renderCreateFestPage() {
    const container = document.getElementById('user-selection-list');
    // Ensure the container exists in HTML (check previous step HTML update)
    if(!container) return; 

    container.innerHTML = "";

    if (appState.users.length === 0) {
        container.innerHTML = "<div style='color:#666; font-size:0.9rem; padding:10px;'>No friends added yet. Add one above!</div>";
        return;
    }

    appState.users.forEach(u => {
        container.innerHTML += `
            <label class="flex" style="padding: 8px; border-bottom: 1px solid #333; cursor:pointer;">
                <input type="checkbox" class="fest-user-check" value="${u.name}" style="width:20px; margin:0; margin-right:10px;">
                ${u.name}
            </label>
        `;
    });
}

// 2. Add New Global User
function addNewGlobalUser() {
    const nameInput = document.getElementById('newFriendName');
    const name = nameInput.value.trim();
    if (!name) return alert("Enter a name");

    // Optimistic Update
    const newUser = { id: Date.now().toString(), name: name };
    appState.users.push(newUser);
    
    // Clear Input and Re-render list
    nameInput.value = "";
    renderCreateFestPage();

    // Send to Backend
    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "createUser", id: newUser.id, name: newUser.name })
    });
}

// 3. Save Fest Setup
function saveFestSetup() {
    const name = document.getElementById('festName').value;
    const start = document.getElementById('festStartDate').value;
    const end = document.getElementById('festEndDate').value;

    // Get selected users
    const selectedCheckboxes = document.querySelectorAll('.fest-user-check:checked');
    const participants = Array.from(selectedCheckboxes).map(cb => cb.value);

    if(!name || !start || participants.length === 0) return alert("Fill details & select friends");

    const fest = {
        id: Date.now().toString(),
        name: name,
        startDate: start,
        endDate: end || start,
        participants: participants
    };

    appState.fests.push(fest);
    // Save to LocalStorage as backup
    localStorage.setItem('festData_fests', JSON.stringify(appState.fests));

    // Send to Google Sheets
    const payload = {
        action: "createFest",
        id: fest.id,
        name: fest.name,
        startDate: fest.startDate,
        endDate: fest.endDate,
        participants: fest.participants
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(() => {
        console.log("Sent successfully!");
        alert("Fest Created!");
    })
    .catch(err => {
        console.error("Failed to send:", err);
        alert("Error saving to cloud.");
    });
    
    // Clear Form & Open Fest
    document.getElementById('festName').value = "";
    openFestDetails(fest);
}

// ==========================================
// FEST DETAILS (LIST & ADD)
// ==========================================

function openFestDetails(fest) {
    appState.currentFest = fest;
    showPage('fest-details'); 
    
    const titleEl = document.getElementById('fest-details-title');
    if(titleEl) titleEl.innerText = fest.name;

    // Reset Views (Show List, Hide Form)
    document.getElementById('view-fest-list').classList.remove('hidden');
    document.getElementById('view-add-expense').classList.add('hidden');

    // Generate Date Tabs
    const tabsContainer = document.getElementById('fest-date-tabs');
    tabsContainer.innerHTML = "";
    
    let curr = new Date(fest.startDate);
    let last = new Date(fest.endDate);
    let firstDateStr = fest.startDate;

    while (curr <= last) {
        let dateStr = curr.toISOString().split('T')[0];
        let tab = document.createElement('div');
        tab.className = `date-tab ${dateStr === firstDateStr ? 'active' : ''}`;
        tab.innerText = dateStr.slice(5); // Show MM-DD
        tab.dataset.date = dateStr;
        
        tab.onclick = (e) => {
            document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            renderExpenseList(dateStr);
        };
        tabsContainer.appendChild(tab);
        curr.setDate(curr.getDate() + 1);
    }

    // Render list for the first date
    renderExpenseList(firstDateStr);
}

function renderExpenseList(dateStr) {
    const listContainer = document.getElementById('expense-list-container');
    listContainer.innerHTML = "";

    // Filter: Current Fest AND Selected Date
    const dailyTxns = appState.transactions.filter(t => 
        t.eventId === appState.currentFest.id && t.date === dateStr
    );

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
        item.innerHTML = `
            <div class="flex justify-between">
                <span style="font-weight:bold; font-size:1.1rem;">${t.title}</span>
                <span style="color:var(--secondary); font-weight:bold;">₹${t.amount}</span>
            </div>
            <div style="font-size:0.85rem; color:#aaa; margin-top:5px;">
                Paid by: ${payerText}
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// --- ADD EXPENSE FORM LOGIC ---

function showAddExpenseForm() {
    document.getElementById('view-fest-list').classList.add('hidden');
    document.getElementById('view-add-expense').classList.remove('hidden');
    renderPayerUI(); 
}

function hideAddExpenseForm() {
    document.getElementById('view-add-expense').classList.add('hidden');
    document.getElementById('view-fest-list').classList.remove('hidden');
}

function renderPayerUI() {
    const participants = appState.currentFest.participants;
    const payerContainer = document.getElementById('payer-selection-area');
    const splitContainer = document.getElementById('split-selection-area');
    
    payerContainer.innerHTML = "";
    splitContainer.innerHTML = "";

    participants.forEach(p => {
        // Payer UI
        payerContainer.innerHTML += `
            <div class="user-select-row">
                <div class="flex">
                    <input type="checkbox" class="payer-check" value="${p}" onchange="handlePayerChange()" style="width:20px; margin:0;">
                    <span style="margin-left:10px;">${p}</span>
                </div>
                <input type="number" class="amount-manual payer-input hidden" id="pay-amt-${p}" placeholder="0">
            </div>`;
        
        // Split UI
        splitContainer.innerHTML += `
            <div class="user-select-row">
                <span>${p}</span>
                <input type="number" class="amount-manual split-input" id="split-amt-${p}" placeholder="0">
            </div>`;
    });
}

function handlePayerChange() {
    const checked = document.querySelectorAll('.payer-check:checked');
    const inputs = document.querySelectorAll('.payer-input');
    
    inputs.forEach(i => i.classList.add('hidden'));

    if (checked.length > 1) {
        checked.forEach(chk => {
            document.getElementById(`pay-amt-${chk.value}`).classList.remove('hidden');
        });
    }
}

function toggleSplitMode() {
    const isEqual = document.getElementById('splitEquallyCheck').checked;
    const area = document.getElementById('split-selection-area');
    if (isEqual) area.classList.add('hidden');
    else area.classList.remove('hidden');
}

function submitTransaction() {
    const fest = appState.currentFest;
    const title = document.getElementById('expTitle').value;
    const total = parseFloat(document.getElementById('expAmount').value);
    
    const activeTab = document.querySelector('.date-tab.active');
    const date = activeTab ? activeTab.dataset.date : fest.startDate;

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

    if (Math.abs(paidSum - total) > 1) return alert(`Paid amount (${paidSum}) != Total (${total})`);

    let split = {};
    if (document.getElementById('splitEquallyCheck').checked) {
        let share = total / fest.participants.length;
        fest.participants.forEach(p => split[p] = share);
    } else {
        let splitSum = 0;
        document.querySelectorAll('.split-input').forEach(inp => {
            let val = parseFloat(inp.value) || 0;
            split[inp.id.replace('split-amt-', '')] = val;
            splitSum += val;
        });
        if (Math.abs(splitSum - total) > 1) return alert("Split amount mismatch");
    }

    const txn = { 
        eventId: fest.id, 
        date: date, 
        title: title, 
        amount: total, 
        payers: payers, 
        split: split 
    };

    appState.transactions.push(txn);
    localStorage.setItem('festData_txns', JSON.stringify(appState.transactions));

    const payload = {
        action: "addExpense",
        festId: txn.eventId,
        date: txn.date,
        title: txn.title,
        amount: txn.amount,
        payers: txn.payers,
        split: txn.split
    };

    fetch(GOOGLE_SCRIPT_URL, { 
        method: "POST", 
        mode: "no-cors", 
        body: JSON.stringify(payload) 
    });

    document.getElementById('expTitle').value = "";
    document.getElementById('expAmount').value = "";
    hideAddExpenseForm(); 
    renderExpenseList(date); 
}

// ==========================================
// ANALYTICS
// ==========================================

function renderAnalytics() {
    const txns = appState.transactions;
    const total = txns.reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('stat-total').innerText = `₹${total}`;

    let payerStats = {};
    txns.forEach(t => {
        for(let [p, amt] of Object.entries(t.payers)) {
            payerStats[p] = (payerStats[p] || 0) + amt;
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
    txns.forEach(t => {
        daily[t.date] = (daily[t.date] || 0) + t.amount;
    });

    if(window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(daily),
            datasets: [{
                label: 'Spending',
                data: Object.values(daily),
                backgroundColor: '#bb86fc',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    grid: { color: '#333' },
                    beginAtZero: true
                },
                x: { 
                    grid: { display: false } 
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// --- HEATMAP LOGIC ---
function renderCalendar() {
    const container = document.getElementById('calendar-months-container');
    container.innerHTML = "";
    
    let dailyTotals = {};
    appState.transactions.forEach(t => {
        dailyTotals[t.date] = (dailyTotals[t.date] || 0) + t.amount;
    });

    const today = new Date();
    // Start of the month 11 months ago
    let loopDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    for (let i = 0; i < 12; i++) {
        const monthIndex = loopDate.getMonth();
        const year = loopDate.getFullYear();
        const monthName = loopDate.toLocaleString('default', { month: 'short' });

        const monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';
        
        const label = document.createElement('div');
        label.className = 'month-label';
        label.innerText = monthName;
        monthBlock.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'month-grid';

        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0 (Sun) to 6 (Sat)
        
        // Add Empty Placeholders
        for(let j=0; j<firstDayOfWeek; j++) {
            const emptyBox = document.createElement('div');
            emptyBox.className = 'heatmap-box empty';
            grid.appendChild(emptyBox);
        }

        // Add Days
        for(let day=1; day<=daysInMonth; day++) {
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

    const wrapper = document.querySelector('.heatmap-scroll-wrapper');
    if(wrapper) {
        setTimeout(() => { wrapper.scrollLeft = wrapper.scrollWidth; }, 100);
    }
}

// --- TOOLTIP LOGIC ---
const tooltipEl = document.getElementById('heatmap-tooltip');

function showTooltip(e, date, amount) {
    if(!tooltipEl) return;
    const dateObj = new Date(date);
    const dateText = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    tooltipEl.innerHTML = `<strong>${dateText}</strong><br>₹${amount}`;
    tooltipEl.style.display = 'block';
    moveTooltip(e);
}

function moveTooltip(e) {
    if(!tooltipEl) return;
    const x = e.clientX + 10;
    const y = e.clientY - 40;
    
    if (x + 100 > window.innerWidth) {
        tooltipEl.style.left = (e.clientX - 110) + 'px';
    } else {
        tooltipEl.style.left = x + 'px';
    }
    tooltipEl.style.top = y + 'px';
}

function hideTooltip() {
    if(tooltipEl) tooltipEl.style.display = 'none';
}

// ==========================================
// SETTLEMENT LOGIC (THE MISSING FUNCTIONS)
// ==========================================

function showSettlementModal() {
    const modal = document.getElementById('settlement-modal');
    if(modal) {
        modal.classList.remove('hidden');
        calculateSettlement(appState.currentFest.id, 'fest-settlement-plan');
    }
}

function closeSettlementModal() {
    const modal = document.getElementById('settlement-modal');
    if(modal) modal.classList.add('hidden');
}

function calculateSettlement(festId, outputElementId) {
    if (!festId) return;

    const festTxns = appState.transactions.filter(t => t.eventId === festId);
    const container = document.getElementById(outputElementId);

    if (festTxns.length === 0) {
        container.innerHTML = "<div style='text-align:center; color:#888; padding:20px;'>No expenses recorded yet.</div>";
        return;
    }

    // 1. Calculate Net Balances
    let balances = {};
    appState.currentFest.participants.forEach(p => balances[p] = 0);

    festTxns.forEach(t => {
        // Add Payers (+)
        for (const [person, amount] of Object.entries(t.payers)) {
            balances[person] = (balances[person] || 0) + parseFloat(amount);
        }
        // Subtract Consumers (-)
        for (const [person, amount] of Object.entries(t.split)) {
            balances[person] = (balances[person] || 0) - parseFloat(amount);
        }
    });

    // 2. Separate into Debtors and Creditors
    let debtors = [];
    let creditors = [];

    // Helper to round to 2 decimals to avoid floating point bugs (0.0000001)
    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    for (const [person, amount] of Object.entries(balances)) {
        const val = round2(amount);
        if (val < -0.01) debtors.push({ name: person, amount: val });
        if (val > 0.01) creditors.push({ name: person, amount: val });
    }

    let html = "";

    // 3. Greedy Matching Loop
    // We process until one of the lists is empty
    while (debtors.length > 0 && creditors.length > 0) {
        // Sort to match Highest Debt with Highest Credit (Minimizes transactions)
        debtors.sort((a, b) => a.amount - b.amount); // Ascending (e.g. -500, -100) -500 is "bigger" debt
        creditors.sort((a, b) => b.amount - a.amount); // Descending (e.g. 500, 100)

        let debtor = debtors[0];
        let creditor = creditors[0];

        // The amount to settle is the minimum of what Debtor owes vs what Creditor is owed
        let amount = Math.min(Math.abs(debtor.amount), creditor.amount);
        amount = round2(amount);

        if (amount > 0) {
            html += `<div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.95rem;">
                    <b style="color:#cf6679;">${debtor.name}</b> pays <b style="color:#03dac6;">${creditor.name}</b>
                </span>
                <span style="color:#fff; font-weight:bold;">₹${amount}</span>
            </div>`;
        }

        // Adjust balances
        debtor.amount = round2(debtor.amount + amount);
        creditor.amount = round2(creditor.amount - amount);

        // Remove from list if settled (close to 0)
        if (Math.abs(debtor.amount) < 0.01) {
            debtors.shift(); // Remove first element
        }
        if (creditor.amount < 0.01) {
            creditors.shift(); // Remove first element
        }
    }

    if (html === "") {
        html = "<div style='text-align:center; padding:20px; color:#03dac6;'>All settled up! 🎉</div>";
    }

    container.innerHTML = html;
}

// ==========================================
// START APP
// ==========================================
init();
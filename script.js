// ===== Utilities
const $ = (s, d = document) => d.querySelector(s);
const $$ = (s, d = document) => Array.from(d.querySelectorAll(s));
const fmt = (n, c) => (c || state.currency) + (Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const uid = () => Math.random().toString(36).slice(2, 9);

const STORAGE_KEY = 'subs-analyzer-v1';
const DEFAULTS = [
    { id: uid(), name: 'Spotify', cost: 9.99, cycle: 'Monthly', category: 'Entertainment', start: '', notes: '' },
    { id: uid(), name: 'Adobe Creative Cloud', cost: 54.99, cycle: 'Monthly', category: 'Work', start: '', notes: '' },
    { id: uid(), name: 'Prime', cost: 139, cycle: 'Annual', category: 'Shopping', start: '', notes: '' }
];

const state = {
    currency: localStorage.getItem('subs-currency') || '$',
    items: [],
    whatIf: 0
}

// ===== Persistence
function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    localStorage.setItem('subs-currency', state.currency);
    $('#saveState').textContent = 'Saved';
    setTimeout(() => $('#saveState').textContent = 'Idle', 700);
    render();
}

function load() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        state.items = Array.isArray(data) ? data : DEFAULTS;
    } catch (e) { state.items = DEFAULTS }
    state.currency = localStorage.getItem('subs-currency') || '$';
    $('#currency').value = state.currency;
    renderTable();
    render();
}

// ===== Table rendering
function renderTable() {
    const tbody = $('#tbody');
    tbody.innerHTML = '';
    state.items.forEach((row) => tbody.appendChild(rowEl(row)));
    if (state.items.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7; td.className = 'muted'; td.style.textAlign = 'center';
        td.textContent = 'No subscriptions yet. Add one!';
        tr.appendChild(td); tbody.appendChild(tr);
    }
}

function rowEl(row) {
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;
    tr.innerHTML = `
        <td><input class="table-input" value="${row.name || ''}" data-k="name" placeholder="Netflix"/></td>
        <td><input type="number" step="0.01" class="table-input" value="${row.cost}" data-k="cost"/></td>
        <td>
          <select class="table-input" data-k="cycle">
            ${['Weekly', 'Monthly', 'Quarterly', 'Annual'].map(c => `<option ${row.cycle === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="table-input" data-k="category">
            ${['Entertainment', 'Work', 'Productivity', 'Utilities', 'Education', 'Shopping', 'Other'].map(c => `<option ${row.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </td>
        <td><input type="date" class="table-input" value="${row.start || ''}" data-k="start"/></td>
        <td><input class="table-input" value="${row.notes || ''}" data-k="notes" placeholder="family plan, student, etc"/></td>
        <td class="row-actions">
          <button title="Duplicate" data-act="dup">⎘</button>
          <button class="danger" title="Delete" data-act="del">✕</button>
        </td>`;

    tr.addEventListener('input', (e) => {
        const k = e.target.dataset.k; if (!k) return;
        const id = tr.dataset.id; const i = state.items.findIndex(x => x.id === id);
        let v = e.target.value;
        if (k === 'cost') v = parseFloat(v || 0);
        state.items[i][k] = v;
        save();
    });

    tr.addEventListener('click', (e) => {
        const act = e.target?.dataset?.act; if (!act) return;
        const id = tr.dataset.id; const i = state.items.findIndex(x => x.id === id);
        if (act === 'del') { state.items.splice(i, 1); save(); renderTable(); }
        if (act === 'dup') { const copy = { ...state.items[i], id: uid(), name: state.items[i].name + ' (copy)' }; state.items.splice(i + 1, 0, copy); save(); renderTable(); }
    });

    return tr;
}

// ===== Calculations
function toMonthly(cost, cycle) {
    switch (cycle) {
        case 'Weekly': return cost * 52 / 12;
        case 'Monthly': return cost;
        case 'Quarterly': return cost / 3;
        case 'Annual': return cost / 12;
        default: return cost;
    }
}

function summarize() {
    const what = Number(state.whatIf) || 0;
    const rows = state.items;
    const monthly = rows.reduce((sum, r) => sum + toMonthly(r.cost * (1 + what / 100), r.cycle), 0);
    const yearly = monthly * 12;
    const byCat = {};
    rows.forEach(r => {
        const m = toMonthly(r.cost * (1 + what / 100), r.cycle);
        byCat[r.category] = (byCat[r.category] || 0) + m;
    });
    return { monthly, yearly, byCat, count: rows.length };
}

// ===== UI updates
let chart;
function render() {
    const { monthly, yearly, byCat, count } = summarize();
    $('#monthlyTotal').textContent = fmt(monthly);
    $('#annualTotal').textContent = fmt(yearly);
    $('#activeCount').textContent = count;

    // Chart
    const labels = Object.keys(byCat);
    const data = Object.values(byCat);
    const ctx = $('#catChart');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data }] },
        options: {
            plugins: { legend: { labels: { color: '#cbd5e1' } } },
            layout: { padding: 10 },
            cutout: '60%',
            animation: { duration: 400 }
        }
    });

    // Suggestions
    $('#suggestions').innerHTML = suggestionHTML();
}

function suggestionHTML() {
    const rows = [...state.items].sort((a, b) => (toMonthly(b.cost, b.cycle)) - (toMonthly(a.cost, a.cycle)));
    const top3 = rows.slice(0, 3);
    if (top3.length === 0) return '';
    const li = top3.map(r => {
        const m = toMonthly(r.cost, r.cycle);
        const y = m * 12;
        const tips = (
            r.name.toLowerCase().includes('adobe') ? 'Check student/photography plan.' :
                r.name.toLowerCase().includes('spotify') ? 'Consider family/duo plan.' :
                    r.cycle === 'Monthly' ? 'See if annual pricing is cheaper.' : 'Set reminder before renewal.'
        );
        return `<li><strong>${r.name}</strong> — ${fmt(m)} /mo (${fmt(y)} /yr). Tip: ${tips}</li>`;
    }).join('');
    return `<div class="total-card"><h3 style="margin:0 0 8px 0">Quick savings ideas</h3><ol style="margin:0 0 0 18px;line-height:1.8">${li}</ol></div>`;
}

// ===== Events
$('#addRowBtn').addEventListener('click', () => {
    state.items.push({ id: uid(), name: '', cost: 0, cycle: 'Monthly', category: 'Other', start: '', notes: '' });
    renderTable(); save();
    // focus last name input
    setTimeout(() => $('#tbody tr:last-child input[data-k="name"]').focus(), 0);
});

$('#currency').addEventListener('change', (e) => { state.currency = e.target.value; save(); });

$('#whatIf').addEventListener('input', (e) => { state.whatIf = Number(e.target.value) || 0; render(); });

// Export JSON
$('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ currency: state.currency, items: state.items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'subscriptions.json'; a.click();
    URL.revokeObjectURL(url);
});

// Import JSON
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (Array.isArray(data)) state.items = data; else if (data.items) { state.items = data.items; state.currency = data.currency || state.currency; $('#currency').value = state.currency; }
            save(); renderTable();
        } catch (err) { alert('Invalid JSON file'); }
    }
    reader.readAsText(file);
    e.target.value = '';
});

// CSV Export
$('#downloadCSV').addEventListener('click', (e) => {
    e.preventDefault();
    const headers = ['Name', 'Cost', 'Cycle', 'Category', 'Started', 'Notes'];
    const rows = state.items.map(r => [r.name, r.cost, r.cycle, r.category, r.start, r.notes]);
    const csv = [headers, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'subscriptions.csv'; a.click(); URL.revokeObjectURL(url);
});

// Reset
$('#resetBtn').addEventListener('click', () => {
    if (confirm('Clear all data?')) { state.items = []; save(); renderTable(); }
});

// Keyboard save shortcut
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
});

// Init
load();
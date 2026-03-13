let currentData = null;
let topCompletionChart = null;
let bottomCompletionChart = null;
let topAreaChart = null;
let bottomAreaChart = null;
let areaRevenueChart = null;
let allData = null;
let employeeMap = new Map();
let groupMap = new Map();
let hasDataLabelsPlugin = false;
let currentTopKVFilter = 'all';
let currentBottomKVFilter = 'all';
let currentKVFilter = 'all';

// Đăng ký plugin datalabels
try {
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        hasDataLabelsPlugin = true;
        console.log('✅ Đã đăng ký ChartDataLabels plugin');
    } else {
        console.warn('⚠️ Không tìm thấy ChartDataLabels plugin');
    }
} catch (e) {
    console.warn('⚠️ Lỗi khi đăng ký ChartDataLabels plugin:', e);
}

// ========== HÀM HỖ TRỢ ==========

function getAllParentGroups(maDonVi) {
    if (!maDonVi) return [];
    const groups = [];
    let currentMa = maDonVi;
    let visited = new Set();
    
    while (currentMa && !visited.has(currentMa)) {
        visited.add(currentMa);
        const group = groupMap.get(currentMa);
        if (!group) break;
        if (group.ten && group.ten !== currentMa) {
            groups.unshift(group.ten);
        }
        currentMa = group.ma_nhom_cha;
    }
    return groups;
}

function getEmployeeDisplayInfo(maNV) {
    if (!maNV) return { ten: 'N/A', display: 'N/A', groupPath: '', maDonVi: '' };
    let employeeName = maNV;
    let maDonVi = null;
    
    if (employeeMap.has(maNV)) {
        const emp = employeeMap.get(maNV);
        employeeName = emp.ten || maNV;
        maDonVi = emp.ma_don_vi;
    } else {
        const baseCode = maNV.split('.')[0];
        if (employeeMap.has(baseCode)) {
            const emp = employeeMap.get(baseCode);
            employeeName = emp.ten || maNV;
            maDonVi = emp.ma_don_vi;
        }
    }
    
    const parentGroups = getAllParentGroups(maDonVi);
    const groupPath = parentGroups.length > 0 ? parentGroups.join(' › ') : '';
    let display = employeeName;
    if (maDonVi) {
        display = `${employeeName} (${maDonVi})`;
    }
    return { ten: employeeName, maDonVi: maDonVi || '', display: display, groupPath: groupPath };
}

function getEmployeeName(maNV) {
    if (!maNV) return 'N/A';
    if (employeeMap.has(maNV)) return employeeMap.get(maNV).ten;
    const baseCode = maNV.split('.')[0];
    if (employeeMap.has(baseCode)) return employeeMap.get(baseCode).ten;
    return maNV;
}

function getGroupName(maNhom) {
    if (!maNhom) return 'N/A';
    const group = groupMap.get(maNhom);
    return group ? group.ten : maNhom;
}

function findKVFromGroup(maNhom) {
    if (!maNhom) return 'Khác';
    if (maNhom.startsWith('KV') && maNhom.length <= 3) return maNhom;
    let currentMa = maNhom;
    let visited = new Set();
    
    while (currentMa && !visited.has(currentMa)) {
        visited.add(currentMa);
        const group = groupMap.get(currentMa);
        if (!group) break;
        if (group.ma_nhom_cha && group.ma_nhom_cha.startsWith('KV') && group.ma_nhom_cha.length <= 3) {
            return group.ma_nhom_cha;
        }
        if (currentMa.startsWith('KV') && currentMa.length <= 3) return currentMa;
        currentMa = group.ma_nhom_cha;
    }
    return 'Khác';
}

// ========== HÀM HIỂN THỊ LOADING ==========

function showChartLoading(chartCard) {
    if (!chartCard) return;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chart-loading';
    loadingDiv.innerHTML = '<div class="spinner-small"></div><p>Đang lọc dữ liệu...</p>';
    loadingDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255,255,255,0.95);
        padding: 20px;
        border-radius: 10px;
        z-index: 10;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        text-align: center;
    `;
    chartCard.style.position = 'relative';
    chartCard.appendChild(loadingDiv);
}

function hideChartLoading(chartCard) {
    if (!chartCard) return;
    const loadingDiv = chartCard.querySelector('.chart-loading');
    if (loadingDiv) loadingDiv.remove();
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
}

// ========== HÀM TẢI DỮ LIỆU ==========

async function fetchEmployees() {
    const loadingEmployees = document.getElementById('loadingEmployees');
    loadingEmployees.style.display = 'block';
    try {
        const auth = document.getElementById('auth').value;
        const response = await fetch('https://openapi.mobiwork.vn/OpenAPI/V1/Sale?status=1', {
            method: 'GET',
            headers: { 'accept': 'application/json', 'Authorization': auth }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(emp => {
                if (emp.ma && emp.ten) {
                    employeeMap.set(emp.ma, { ten: emp.ten, ma_don_vi: emp.ma_don_vi || null });
                }
            });
        }
        console.log(`✅ Đã tải ${employeeMap.size} nhân viên`);
    } catch (error) {
        console.error('❌ Lỗi khi tải danh sách nhân viên:', error);
        showError(`Lỗi khi tải danh sách nhân viên: ${error.message}`);
    } finally {
        loadingEmployees.style.display = 'none';
    }
}

async function fetchGroups() {
    const loadingGroups = document.getElementById('loadingGroups');
    loadingGroups.style.display = 'block';
    try {
        const auth = document.getElementById('auth').value;
        const response = await fetch('https://openapi.mobiwork.vn/OpenAPI/V1/SaleGroup', {
            method: 'GET',
            headers: { 'accept': 'application/json', 'Authorization': auth }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(group => {
                if (group.ma_nhom && group.ten_nhom) {
                    groupMap.set(group.ma_nhom, {
                        ten: group.ten_nhom,
                        ma_nhom_cha: group.ma_nhom_cha || null,
                        loai_nhom: group.loai_nhom || ''
                    });
                }
            });
        }
        console.log(`✅ Đã tải ${groupMap.size} nhóm`);
    } catch (error) {
        console.error('❌ Lỗi khi tải danh sách nhóm:', error);
        showError(`Lỗi khi tải danh sách nhóm: ${error.message}`);
    } finally {
        loadingGroups.style.display = 'none';
    }
}

async function searchKPI() {
    const month = document.getElementById('month').value;
    const year = document.getElementById('year').value;
    const auth = document.getElementById('auth').value;
    const searchBtn = document.getElementById('searchBtn');
    const loading = document.getElementById('loading');
    const reportSection = document.getElementById('reportSection');
    const errorMessage = document.getElementById('errorMessage');
    const dataInfo = document.getElementById('dataInfo');

    if (!month || !year || !auth) {
        showError('Vui lòng nhập đầy đủ thông tin: Tháng, Năm và Authorization');
        return;
    }

    searchBtn.disabled = true;
    loading.classList.add('active');
    reportSection.classList.remove('active');
    errorMessage.style.display = 'none';
    dataInfo.style.display = 'none';

    try {
        console.log('🔄 Đang tải dữ liệu nhân viên và nhóm...');
        await Promise.all([fetchEmployees(), fetchGroups()]);
        console.log('⏳ Đợi 2 giây trước khi gọi API KPI...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('🔄 Đang tải dữ liệu KPI...');
        
        const url = `https://openapi.mobiwork.vn/OpenAPI/V1/KPI?thang=${month}&nam=${year}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'Authorization': auth }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        currentData = data.result || [];
        allData = JSON.parse(JSON.stringify(currentData));
        document.getElementById('reportTitle').textContent = `Báo cáo KPI tháng ${month}/${year}`;
        displayDataInfo(currentData);
        setTimeout(() => createCharts(currentData), 100);
        displaySummaryStats(currentData);
        reportSection.classList.add('active');
        console.log(`✅ Đã tải xong dữ liệu KPI: ${currentData.length} nhân viên`);
    } catch (error) {
        console.error('❌ Lỗi chi tiết:', error);
        showError(`Lỗi khi tải dữ liệu: ${error.message}`);
    } finally {
        searchBtn.disabled = false;
        loading.classList.remove('active');
    }
}

function displayDataInfo(data) {
    const dataInfo = document.getElementById('dataInfo');
    if (data && data.length > 0) {
        dataInfo.innerHTML = `📊 Đã tìm thấy ${data.length} nhân viên có dữ liệu KPI`;
        dataInfo.style.display = 'block';
    }
}

function filterTopEmployees(kv, event) {
    // Reset tất cả nút trong cùng group
    const parentDiv = event.target.closest('.kv-filter-employee');
    parentDiv.querySelectorAll('.kv-btn-employee').forEach(btn => {
        btn.classList.remove('top-active');
    });
    event.target.classList.add('top-active');
    
    currentTopKVFilter = kv;
    if (!currentData) return;
    
    const chartCard = event.target.closest('.chart-card');
    showChartLoading(chartCard);
    
    setTimeout(() => {
        let filteredData = currentData;
        if (kv !== 'all') {
            filteredData = currentData.filter(item => {
                const itemKV = findKVFromGroup(item.ma_kv || 'Khác');
                return itemKV === kv;
            });
        }
        
        if (filteredData.length === 0) {
            showToast(`Không có dữ liệu nhân viên cho ${kv}`);
            parentDiv.querySelectorAll('.kv-btn-employee').forEach(btn => {
                btn.classList.remove('top-active');
            });
            parentDiv.querySelector('[data-kv="all"]').classList.add('top-active');
            currentTopKVFilter = 'all';
            createTopCompletionChart(currentData);
        } else {
            createTopCompletionChart(filteredData, kv);
        }
        hideChartLoading(chartCard);
    }, 300);
}

function filterBottomEmployees(kv, event) {
    // Reset tất cả nút trong cùng group
    const parentDiv = event.target.closest('.kv-filter-employee');
    parentDiv.querySelectorAll('.kv-btn-employee').forEach(btn => {
        btn.classList.remove('bottom-active');
    });
    event.target.classList.add('bottom-active');
    
    currentBottomKVFilter = kv;
    if (!currentData) return;
    
    const chartCard = event.target.closest('.chart-card');
    showChartLoading(chartCard);
    
    setTimeout(() => {
        let filteredData = currentData;
        if (kv !== 'all') {
            filteredData = currentData.filter(item => {
                const itemKV = findKVFromGroup(item.ma_kv || 'Khác');
                return itemKV === kv;
            });
        }
        
        if (filteredData.length === 0) {
            showToast(`Không có dữ liệu nhân viên cho ${kv}`);
            parentDiv.querySelectorAll('.kv-btn-employee').forEach(btn => {
                btn.classList.remove('bottom-active');
            });
            parentDiv.querySelector('[data-kv="all"]').classList.add('bottom-active');
            currentBottomKVFilter = 'all';
            createBottomCompletionChart(currentData);
        } else {
            createBottomCompletionChart(filteredData, kv);
        }
        hideChartLoading(chartCard);
    }, 300);
}

function filterAreaRevenue(kv, event) {
    // Reset tất cả nút trong cùng group
    const parentDiv = event.target.closest('.kv-filter');
    parentDiv.querySelectorAll('.kv-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    currentKVFilter = kv;
    if (!currentData) return;
    
    updateTotalRevenue(currentData, kv);
    const chartCard = event.target.closest('.chart-card');
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'kv-loading';
    loadingDiv.innerHTML = '<div class="spinner-small"></div><p>Đang lọc dữ liệu...</p>';
    loadingDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.9); padding: 20px; border-radius: 10px; z-index: 10;';
    chartCard.style.position = 'relative';
    chartCard.appendChild(loadingDiv);
    
    setTimeout(() => {
        if (kv === 'all') {
            createAreaRevenueChart(currentData);
        } else {
            const filteredData = currentData.filter(item => {
                const itemKV = findKVFromGroup(item.ma_kv || 'Khác');
                return itemKV === kv;
            });
            
            if (filteredData.length === 0) {
                showToast(`Không có dữ liệu cho ${kv}`);
                createAreaRevenueChart(currentData);
                parentDiv.querySelectorAll('.kv-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                parentDiv.querySelector('[data-kv="all"]').classList.add('active');
                currentKVFilter = 'all';
                updateTotalRevenue(currentData, 'all');
            } else {
                createNPPChartByKV(filteredData, kv);
            }
        }
        
        const loadingDiv = chartCard.querySelector('.kv-loading');
        if (loadingDiv) loadingDiv.remove();
    }, 300);
}

function updateTotalRevenue(data, kv = 'all') {
    if (!data) return;
    let totalRevenue = 0;
    
    if (kv === 'all') {
        totalRevenue = data.reduce((sum, item) => sum + (item.doanh_so?.th || 0), 0);
    } else {
        totalRevenue = data
            .filter(item => {
                const itemKV = findKVFromGroup(item.ma_kv || 'Khác');
                return itemKV === kv;
            })
            .reduce((sum, item) => sum + (item.doanh_so?.th || 0), 0);
    }
    
    const totalRevenueElement = document.getElementById('totalRevenueAll');
    if (totalRevenueElement) totalRevenueElement.textContent = formatNumber(totalRevenue);
}

// ========== HÀM TẠO BIỂU ĐỒ ==========

function createCharts(data) {
    console.log('🔄 Đang vẽ biểu đồ...');
    
    // Reset filters
    currentTopKVFilter = 'all';
    currentBottomKVFilter = 'all';
    currentKVFilter = 'all';
    
    // Reset active states - Top chart
    const topFilter = document.querySelector('.kv-filter-employee:first-child');
    if (topFilter) {
        topFilter.querySelectorAll('.kv-btn-employee').forEach(btn => {
            btn.classList.remove('top-active');
        });
        topFilter.querySelector('[data-kv="all"]').classList.add('top-active');
    }
    
    // Reset active states - Bottom chart
    const bottomFilter = document.querySelector('.kv-filter-employee:last-child');
    if (bottomFilter) {
        bottomFilter.querySelectorAll('.kv-btn-employee').forEach(btn => {
            btn.classList.remove('bottom-active');
        });
        bottomFilter.querySelector('[data-kv="all"]').classList.add('bottom-active');
    }
    
    // Reset active states - Area chart
    const areaFilter = document.querySelector('.kv-filter');
    if (areaFilter) {
        areaFilter.querySelectorAll('.kv-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        areaFilter.querySelector('[data-kv="all"]').classList.add('active');
    }
    
    // Destroy old charts
    if (topCompletionChart) topCompletionChart.destroy();
    if (bottomCompletionChart) bottomCompletionChart.destroy();
    if (topAreaChart) topAreaChart.destroy();
    if (bottomAreaChart) bottomAreaChart.destroy();
    if (areaRevenueChart) areaRevenueChart.destroy();
    
    if (!data || data.length === 0) {
        console.warn('⚠️ Không có dữ liệu để vẽ biểu đồ');
        return;
    }
    
    createTopCompletionChart(data);
    createBottomCompletionChart(data);
    createTopAreaChart(data);
    createBottomAreaChart(data);
    createAreaRevenueChart(data);
    console.log('✅ Đã vẽ xong biểu đồ');
}
function createTopCompletionChart(data, kv = 'all') {
    if (!data || data.length === 0) return;
    
    const chartCard = document.getElementById('topCompletionChart')?.closest('.chart-card');
    if (chartCard) {
        const titleElement = chartCard.querySelector('h3');
        if (titleElement) {
            if (kv === 'all') {
                titleElement.innerHTML = '🏆 20 Nhân viên doanh số cao nhất (Tất cả KV)';
            } else {
                const kvName = getGroupName(kv) || kv;
                titleElement.innerHTML = `🏆 20 Nhân viên doanh số cao nhất - ${kvName}`;
            }
        }
    }
    
    const topData = [...data]
        .filter(item => (item.doanh_so?.th || 0) > 0)
        .sort((a, b) => (b.doanh_so?.th || 0) - (a.doanh_so?.th || 0))
        .slice(0, 15);
    
    if (topData.length === 0) {
        const ctx = document.getElementById('topCompletionChart').getContext('2d');
        if (topCompletionChart) topCompletionChart.destroy();
        topCompletionChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['Không có dữ liệu'], datasets: [{ label: 'Doanh số (VNĐ)', data: [0], backgroundColor: 'rgba(200,200,200,0.5)' }] },
            options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        });
        return;
    }
    
    const labels = topData.map(item => {
        const { ten, maDonVi, groupPath } = getEmployeeDisplayInfo(item.ma_nv);
        if (groupPath && maDonVi) return `${ten} (${maDonVi})\n${groupPath}`;
        if (maDonVi) return `${ten} (${maDonVi})`;
        if (groupPath) return `${ten}\n(${groupPath})`;
        return ten;
    });
    
    const revenues = topData.map(item => item.doanh_so?.th || 0);
    
    try {
        const ctx = document.getElementById('topCompletionChart').getContext('2d');
        if (topCompletionChart) topCompletionChart.destroy();
        
        topCompletionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh số (VNĐ)',
                    data: revenues,
                    backgroundColor: revenues.map(revenue => {
                        if (revenue >= 100000000) return 'rgba(76, 175, 80, 0.7)';
                        if (revenue >= 50000000) return 'rgba(33, 150, 243, 0.7)';
                        if (revenue >= 10000000) return 'rgba(255, 193, 7, 0.7)';
                        return 'rgba(244, 67, 54, 0.7)';
                    }),
                    borderColor: revenues.map(revenue => {
                        if (revenue >= 100000000) return 'rgba(76, 175, 80, 1)';
                        if (revenue >= 50000000) return 'rgba(33, 150, 243, 1)';
                        if (revenue >= 10000000) return 'rgba(255, 193, 7, 1)';
                        return 'rgba(244, 67, 54, 1)';
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = topData[context.dataIndex];
                                const revenue = context.raw;
                                const target = item.doanh_so?.kh || 0;
                                const completionRate = target > 0 ? ((revenue / target) * 100).toFixed(1) : 0;
                                return [
                                    `💰 Doanh số: ${formatNumber(revenue)}`,
                                    `🎯 Kế hoạch: ${formatNumber(target)}`,
                                    `📊 Tỷ lệ HT: ${completionRate}%`
                                ];
                            }
                        }
                    },
                    datalabels: hasDataLabelsPlugin ? {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        offset: 5,
                        color: '#333',
                        font: { weight: 'bold', size: 11 },
                        formatter: value => formatNumber(value)
                    } : {}
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => formatNumber(value) },
                        title: { display: true, text: 'Doanh số (VNĐ)', font: { weight: 'bold' } }
                    },
                    y: {
                        ticks: {
                            font: { size: 10 },
                            callback: function(value, index, values) {
                                const label = this.getLabelForValue(value);
                                return label && label.length > 50 ? label.substring(0, 47) + '...' : label;
                            }
                        }
                    }
                },
                layout: { padding: { left: 10, right: 10, top: 20, bottom: 20 } }
            }
        });
    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ top doanh số:', error);
    }
}

function createBottomCompletionChart(data, kv = 'all') {
    if (!data || data.length === 0) return;
    
    const chartCard = document.getElementById('bottomCompletionChart')?.closest('.chart-card');
    if (chartCard) {
        const titleElement = chartCard.querySelector('h3');
        if (titleElement) {
            if (kv === 'all') {
                titleElement.innerHTML = '⚠️ 30 Nhân viên doanh số thấp nhất (Tất cả KV)';
            } else {
                const kvName = getGroupName(kv) || kv;
                titleElement.innerHTML = `⚠️ 30 Nhân viên doanh số thấp nhất - ${kvName}`;
            }
        }
    }
    
    const bottomData = [...data]
        .filter(item => (item.doanh_so?.th || 0) > 0)
        .sort((a, b) => (a.doanh_so?.th || 0) - (b.doanh_so?.th || 0))
        .slice(0, 15);
    
    if (bottomData.length === 0) {
        const ctx = document.getElementById('bottomCompletionChart').getContext('2d');
        if (bottomCompletionChart) bottomCompletionChart.destroy();
        bottomCompletionChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['Không có dữ liệu'], datasets: [{ label: 'Doanh số (VNĐ)', data: [0], backgroundColor: 'rgba(200,200,200,0.5)' }] },
            options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        });
        return;
    }
    
    const labels = bottomData.map(item => {
        const { ten, maDonVi, groupPath } = getEmployeeDisplayInfo(item.ma_nv);
        if (groupPath && maDonVi) return `${ten} (${maDonVi})\n${groupPath}`;
        if (maDonVi) return `${ten} (${maDonVi})`;
        if (groupPath) return `${ten}\n(${groupPath})`;
        return ten;
    });
    
    const revenues = bottomData.map(item => item.doanh_so?.th || 0);
    
    try {
        const ctx = document.getElementById('bottomCompletionChart').getContext('2d');
        if (bottomCompletionChart) bottomCompletionChart.destroy();
        
        bottomCompletionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh số (VNĐ)',
                    data: revenues,
                    backgroundColor: revenues.map(revenue => {
                        if (revenue >= 100000000) return 'rgba(76, 175, 80, 0.7)';
                        if (revenue >= 50000000) return 'rgba(33, 150, 243, 0.7)';
                        if (revenue >= 10000000) return 'rgba(255, 193, 7, 0.7)';
                        return 'rgba(244, 67, 54, 0.7)';
                    }),
                    borderColor: revenues.map(revenue => {
                        if (revenue >= 100000000) return 'rgba(76, 175, 80, 1)';
                        if (revenue >= 50000000) return 'rgba(33, 150, 243, 1)';
                        if (revenue >= 10000000) return 'rgba(255, 193, 7, 1)';
                        return 'rgba(244, 67, 54, 1)';
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = bottomData[context.dataIndex];
                                const revenue = context.raw;
                                const target = item.doanh_so?.kh || 0;
                                const completionRate = target > 0 ? ((revenue / target) * 100).toFixed(1) : 0;
                                return [
                                    `💰 Doanh số: ${formatNumber(revenue)}`,
                                    `🎯 Kế hoạch: ${formatNumber(target)}`,
                                    `📊 Tỷ lệ HT: ${completionRate}%`
                                ];
                            }
                        }
                    },
                    datalabels: hasDataLabelsPlugin ? {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        offset: 5,
                        color: '#333',
                        font: { weight: 'bold', size: 11 },
                        formatter: value => formatNumber(value)
                    } : {}
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => formatNumber(value) },
                        title: { display: true, text: 'Doanh số (VNĐ)', font: { weight: 'bold' } }
                    },
                    y: {
                        ticks: {
                            font: { size: 10 },
                            callback: function(value, index, values) {
                                const label = this.getLabelForValue(value);
                                return label && label.length > 50 ? label.substring(0, 47) + '...' : label;
                            }
                        }
                    }
                },
                layout: { padding: { left: 10, right: 10, top: 20, bottom: 20 } }
            }
        });
    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ bottom doanh số:', error);
    }
}

function createAreaRevenueChart(data) {
    updateTotalRevenue(data, 'all');
    
    const chartCard = document.getElementById('areaRevenueChart')?.closest('.chart-card');
    if (chartCard) {
        const titleElement = chartCard.querySelector('h3');
        if (titleElement) titleElement.innerHTML = '🥧 Doanh số thực theo Khu vực';
    }
    
    if (!data || data.length === 0) return;
    
    const kvRevenue = {};
    data.forEach(item => {
        const maKV = item.ma_kv || 'Khác';
        const kv = findKVFromGroup(maKV);
        const revenue = item.doanh_so?.th || 0;
        if (!kvRevenue[kv]) kvRevenue[kv] = 0;
        kvRevenue[kv] += revenue;
    });
    
    const sortedKVs = Object.entries(kvRevenue).sort((a, b) => b[1] - a[1]);
    let processedData = sortedKVs;
    if (sortedKVs.length > 10) {
        const topKVs = sortedKVs.slice(0, 9);
        const otherRevenue = sortedKVs.slice(9).reduce((sum, [, revenue]) => sum + revenue, 0);
        processedData = [...topKVs, ['Khác', otherRevenue]];
    }
    
    const totalRevenue = processedData.reduce((sum, [, revenue]) => sum + revenue, 0);
    const legendLabels = processedData.map(([kv]) => {
        if (kv === 'Khác') return 'Khu vực khác';
        const group = groupMap.get(kv);
        return group ? group.ten : kv;
    });
    const revenues = processedData.map(([, revenue]) => revenue);
    
    try {
        const ctx = document.getElementById('areaRevenueChart').getContext('2d');
        if (areaRevenueChart) areaRevenueChart.destroy();
        
        const config = {
            type: 'pie',
            data: {
                labels: legendLabels,
                datasets: [{
                    data: revenues,
                    backgroundColor: revenues.map((_, index) => {
                        const colors = [
                            'rgba(102, 126, 234, 0.9)', 'rgba(76, 175, 80, 0.9)', 'rgba(255, 152, 0, 0.9)',
                            'rgba(244, 67, 54, 0.9)', 'rgba(33, 150, 243, 0.9)', 'rgba(156, 39, 176, 0.9)',
                            'rgba(255, 193, 7, 0.9)', 'rgba(0, 150, 136, 0.9)', 'rgba(233, 30, 99, 0.9)',
                            'rgba(103, 58, 183, 0.9)', 'rgba(255, 87, 34, 0.9)'
                        ];
                        return colors[index % colors.length];
                    }),
                    borderColor: 'white',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: { size: 14 },
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = ((value / totalRevenue) * 100).toFixed(1);
                                        return {
                                            text: `${label}: ${formatNumber(value)} (${percentage}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            hidden: !chart.getDataVisibility(i),
                                            index: i,
                                            fontColor: '#333',
                                            font: { size: 13, weight: 'bold' }
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const percentage = ((value / totalRevenue) * 100).toFixed(1);
                                return `${context.label}: ${formatNumber(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };
        
        if (hasDataLabelsPlugin) {
            config.options.plugins.datalabels = {
                display: true,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 6,
                color: '#333',
                font: { weight: 'bold', size: 13 },
                padding: { top: 6, bottom: 6, left: 12, right: 12 },
                borderColor: '#666',
                borderWidth: 1.5,
                formatter: function(value, context) {
                    const percentage = ((value / totalRevenue) * 100).toFixed(1);
                    if (percentage < 3) return '';
                    const label = context.chart.data.labels[context.dataIndex];
                    const shortLabel = label.length > 20 ? label.substring(0, 18) + '...' : label;
                    return [`${shortLabel}`, `${formatNumber(value)}`, `(${percentage}%)`];
                },
                textAlign: 'center',
                align: 'center',
                offset: 20,
                anchor: 'center',
                clamp: true
            };
        }
        
        areaRevenueChart = new Chart(ctx, config);
    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ tròn doanh số khu vực:', error);
    }
}

function createNPPChartByKV(data, kv) {
    if (!data || data.length === 0) return;
    
    const nppRevenue = {};
    data.forEach(item => {
        const maNPP = item.ma_kv || 'Khác';
        const revenue = item.doanh_so?.th || 0;
        if (!nppRevenue[maNPP]) {
            nppRevenue[maNPP] = { revenue: 0, count: 0, target: 0 };
        }
        nppRevenue[maNPP].revenue += revenue;
        nppRevenue[maNPP].count++;
        nppRevenue[maNPP].target += item.doanh_so?.kh || 0;
    });
    
    const sortedNPPs = Object.entries(nppRevenue).sort((a, b) => b[1].revenue - a[1].revenue);
    const labels = sortedNPPs.map(([maNPP]) => {
        const groupName = getGroupName(maNPP);
        return groupName !== maNPP ? groupName : maNPP;
    });
    
    const revenues = sortedNPPs.map(([, value]) => value.revenue);
    const targets = sortedNPPs.map(([, value]) => value.target);
    const counts = sortedNPPs.map(([, value]) => value.count);
    
    try {
        const ctx = document.getElementById('areaRevenueChart').getContext('2d');
        if (areaRevenueChart) areaRevenueChart.destroy();
        
        const kvName = getGroupName(kv) || kv;
        const chartCard = ctx.canvas.closest('.chart-card');
        const titleElement = chartCard.querySelector('h3');
        if (titleElement) titleElement.innerHTML = `🏢 Doanh số NPP - ${kvName}`;
        
        const config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh số thực (VNĐ)',
                    data: revenues,
                    backgroundColor: revenues.map((_, index) => {
                        const colors = [
                            'rgba(102, 126, 234, 0.8)', 'rgba(76, 175, 80, 0.8)', 'rgba(255, 152, 0, 0.8)',
                            'rgba(244, 67, 54, 0.8)', 'rgba(33, 150, 243, 0.8)', 'rgba(156, 39, 176, 0.8)',
                            'rgba(255, 193, 7, 0.8)', 'rgba(0, 150, 136, 0.8)', 'rgba(233, 30, 99, 0.8)',
                            'rgba(103, 58, 183, 0.8)'
                        ];
                        return colors[index % colors.length];
                    }),
                    borderColor: 'white',
                    borderWidth: 2,
                    borderRadius: 5
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                const value = context.raw;
                                const target = targets[index];
                                const count = counts[index];
                                const percentage = target > 0 ? ((value / target) * 100).toFixed(1) : 0;
                                return [
                                    `💰 Doanh số: ${formatNumber(value)}`,
                                    `🎯 Kế hoạch: ${formatNumber(target)}`,
                                    `📊 Tỷ lệ: ${percentage}%`,
                                    `👥 Số NV: ${count}`
                                ];
                            }
                        }
                    },
                    datalabels: hasDataLabelsPlugin ? {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        offset: 5,
                        color: '#333',
                        font: { weight: 'bold', size: 11 },
                        formatter: value => formatNumber(value)
                    } : {}
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => formatNumber(value) },
                        title: { display: true, text: 'Doanh số (VNĐ)', font: { weight: 'bold' } }
                    },
                    y: { ticks: { font: { size: 12 } } }
                }
            }
        };
        
        areaRevenueChart = new Chart(ctx, config);
    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ NPP theo KV:', error);
    }
}

function createTopAreaChart(data) {
    if (!data || data.length === 0) return;
    
    const areaMap = {};
    data.forEach(item => {
        const area = item.ma_kv || 'N/A';
        if (!areaMap[area]) areaMap[area] = { tongDoanhSo: 0, count: 0 };
        areaMap[area].tongDoanhSo += item.doanh_so?.th || 0;
        areaMap[area].count += 1;
    });
    
    const areaData = Object.entries(areaMap)
        .map(([area, values]) => ({ area, tongDoanhSo: values.tongDoanhSo, soNhanVien: values.count }))
        .sort((a, b) => b.tongDoanhSo - a.tongDoanhSo)
        .slice(0, 10);
    
    if (areaData.length === 0) return;
    
    const labels = areaData.map(item => getGroupName(item.area));
    const doanhSoData = areaData.map(item => item.tongDoanhSo);
    
    try {
        const ctx = document.getElementById('topAreaChart').getContext('2d');
        if (topAreaChart) topAreaChart.destroy();
        
        topAreaChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tổng doanh số',
                    data: doanhSoData,
                    backgroundColor: doanhSoData.map((_, index) => getChartColor(index, 0.7)),
                    borderColor: doanhSoData.map((_, index) => getChartColor(index, 1)),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = areaData[context.dataIndex];
                                return [`💰 Tổng doanh số: ${formatNumber(context.raw)}`, `👥 Số nhân viên: ${item.soNhanVien}`];
                            }
                        }
                    },
                    datalabels: hasDataLabelsPlugin ? {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        offset: 5,
                        color: '#333',
                        font: { weight: 'bold', size: 11 },
                        formatter: value => formatNumber(value)
                    } : {}
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => formatNumber(value) }
                    },
                    y: { ticks: { font: { size: 12 } } }
                }
            }
        });
    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ top area doanh số:', error);
    }
}

function createBottomAreaChart(data) {
    if (!data || data.length === 0) return;
    
    const areaMap = {};
    data.forEach(item => {
        const area = item.ma_kv || 'N/A';
        if (!areaMap[area]) areaMap[area] = { tongDoanhSo: 0, count: 0 };
        areaMap[area].tongDoanhSo += item.doanh_so?.th || 0;
        areaMap[area].count += 1;
    });
    
    const areaData = Object.entries(areaMap)
        .filter(([_, values]) => values.tongDoanhSo > 0)
        .map(([area, values]) => ({ area, tongDoanhSo: values.tongDoanhSo, soNhanVien: values.count }))
        .sort((a, b) => a.tongDoanhSo - b.tongDoanhSo)
        .slice(0, 10);
    
    if (areaData.length === 0) return;
    
    const labels = areaData.map(item => getGroupName(item.area));
    const doanhSoData = areaData.map(item => item.tongDoanhSo);
    
    try {
        const ctx = document.getElementById('bottomAreaChart').getContext('2d');
        if (bottomAreaChart) bottomAreaChart.destroy();
        
        bottomAreaChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tổng doanh số',
                    data: doanhSoData,
                    backgroundColor: doanhSoData.map((_, index) => getChartColor(index, 0.7)),
                    borderColor: doanhSoData.map((_, index) => getChartColor(index, 1)),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = areaData[context.dataIndex];
                                return [`💰 Tổng doanh số: ${formatNumber(context.raw)}`, `👥 Số nhân viên: ${item.soNhanVien}`];
                            }
                        }
                    },
                    datalabels: hasDataLabelsPlugin ? {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        offset: 5,
                        color: '#333',
                        font: { weight: 'bold', size: 11 },
                        formatter: value => formatNumber(value)
                    } : {}
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => formatNumber(value) }
                    },
                    y: { ticks: { font: { size: 12 } } }
                }
            }
        });
    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ bottom area doanh số:', error);
    }
}

// ========== HÀM HIỂN THỊ THỐNG KÊ ==========

function displaySummaryStats(data) {
    const summaryStats = document.getElementById('summaryStats');
    summaryStats.innerHTML = '';
    if (!data || data.length === 0) return;
    
    const tongDoanhSoKH = data.reduce((sum, item) => sum + (item.doanh_so?.kh || 0), 0);
    const tongDoanhSoTH = data.reduce((sum, item) => sum + (item.doanh_so?.th || 0), 0);
    const tlTrungBinh = data.reduce((sum, item) => sum + (item.doanh_so?.tl || 0), 0) / data.length;
    
    const nvCaoNhat = data.reduce((max, item) => (item.doanh_so?.th || 0) > (max.doanh_so?.th || 0) ? item : max, data[0]);
    
    const areaStats = {};
    data.forEach(item => {
        const area = item.ma_kv || 'N/A';
        if (!areaStats[area]) areaStats[area] = { tongTH: 0, tongKH: 0, count: 0 };
        areaStats[area].tongTH += item.doanh_so?.th || 0;
        areaStats[area].tongKH += item.doanh_so?.kh || 0;
        areaStats[area].count++;
    });
    
    let nppCaoNhat = null;
    let maxDoanhSoTH = 0;
    Object.entries(areaStats).forEach(([area, stats]) => {
        if (stats.tongTH > maxDoanhSoTH) {
            maxDoanhSoTH = stats.tongTH;
            nppCaoNhat = { ten: area, doanhSoTH: stats.tongTH, doanhSoKH: stats.tongKH, tl: stats.tongKH > 0 ? (stats.tongTH / stats.tongKH * 100) : 0 };
        }
    });
    
    const kvRevenue = {};
    data.forEach(item => {
        const maKV = item.ma_kv || 'Khác';
        const kv = findKVFromGroup(maKV);
        const revenue = item.doanh_so?.th || 0;
        if (!kvRevenue[kv]) kvRevenue[kv] = 0;
        kvRevenue[kv] += revenue;
    });
    
    let kvCaoNhat = null;
    let maxRevenue = 0;
    Object.entries(kvRevenue).forEach(([kv, revenue]) => {
        if (revenue > maxRevenue && kv !== 'Khác') {
            maxRevenue = revenue;
            kvCaoNhat = { ma: kv, doanhThu: revenue };
        }
    });
    
    if (kvCaoNhat) {
        const tongKHV = data
            .filter(item => findKVFromGroup(item.ma_kv || 'Khác') === kvCaoNhat.ma)
            .reduce((sum, item) => sum + (item.doanh_so?.kh || 0), 0);
        kvCaoNhat.doanhThuKH = tongKHV;
        kvCaoNhat.tl = tongKHV > 0 ? (kvCaoNhat.doanhThu / tongKHV * 100) : 0;
    }
    
    const stats = [
        { label: '📊 Tổng DS KH', value: tongDoanhSoKH },
        { label: '💰 Tổng DS TH', value: tongDoanhSoTH },
        { label: '📈 Tỷ lệ TB', value: tlTrungBinh, unit: '%' },
        { label: '🏆 NV cao nhất', value: getEmployeeName(nvCaoNhat.ma_nv), subValue: formatNumber(nvCaoNhat.doanh_so?.th || 0), subLabel: 'Doanh số' },
        { label: '🏢 NPP cao nhất', value: getGroupName(nppCaoNhat ? nppCaoNhat.ten : 'N/A'), subValue: nppCaoNhat ? formatNumber(nppCaoNhat.doanhSoTH) : '0', subLabel: 'Doanh số', tlValue: nppCaoNhat ? nppCaoNhat.tl.toFixed(1) + '%' : '0%' },
        { label: '📍 KV doanh thu cao nhất', value: kvCaoNhat ? getGroupName(kvCaoNhat.ma) : 'N/A', subValue: kvCaoNhat ? formatNumber(kvCaoNhat.doanhThu) : '0', subLabel: 'Doanh số TH', tlValue: kvCaoNhat ? `Tỷ lệ: ${kvCaoNhat.tl.toFixed(1)}%` : '' }
    ];
    
    stats.forEach(stat => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        
        if (stat.unit === '%') {
            statCard.innerHTML = `<div class="stat-label">${stat.label}</div><div class="stat-value">${stat.value.toFixed(1)}%</div>`;
        } else if (stat.subValue) {
            statCard.innerHTML = `
                <div class="stat-label">${stat.label}</div>
                <div class="stat-value">${stat.value}</div>
                <div style="font-size: 12px; opacity: 0.9; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                    <span>${stat.subLabel}: ${stat.subValue}</span>
                    ${stat.tlValue ? `<span>${stat.tlValue}</span>` : ''}
                </div>
            `;
        } else {
            statCard.innerHTML = `<div class="stat-label">${stat.label}</div><div class="stat-value">${formatNumber(stat.value)}</div>`;
        }
        
        summaryStats.appendChild(statCard);
    });
}

// ========== HÀM TIỆN ÍCH ==========

function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function getChartColor(index, alpha = 1) {
    const colors = [
        `rgba(102, 126, 234, ${alpha})`, `rgba(76, 175, 80, ${alpha})`, `rgba(255, 152, 0, ${alpha})`,
        `rgba(244, 67, 54, ${alpha})`, `rgba(33, 150, 243, ${alpha})`, `rgba(156, 39, 176, ${alpha})`,
        `rgba(255, 193, 7, ${alpha})`, `rgba(0, 150, 136, ${alpha})`
    ];
    return colors[index % colors.length];
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// ========== KHỞI TẠO ==========

document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    document.getElementById('month').value = today.getMonth() + 1;
    document.getElementById('year').value = today.getFullYear();
    console.log('🚀 Ứng dụng đã sẵn sàng!');
});
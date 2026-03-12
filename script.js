let currentData = null;
let topCompletionChart = null;
let bottomCompletionChart = null;
let topAreaChart = null;
let bottomAreaChart = null;
let areaRevenueChart = null;
let allData = null;
let employeeMap = new Map(); // Lưu {ma: {ten: '...', ma_don_vi: '...'}}
let groupMap = new Map();
let areaKPIChart = null;

// ========== HÀM HỖ TRỢ XỬ LÝ NHÓM ==========

// Hàm lấy tất cả nhóm cha từ một mã đơn vị
function getAllParentGroups(maDonVi) {
    if (!maDonVi) return [];
    
    const groups = [];
    let currentMa = maDonVi;
    let visited = new Set();
    
    // Thu thập tất cả nhóm cha
    while (currentMa && !visited.has(currentMa)) {
        visited.add(currentMa);
        const group = groupMap.get(currentMa);
        
        if (!group) break;
        
        if (group.ten && group.ten !== currentMa) {
            groups.unshift(group.ten); // Thêm vào đầu mảng
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
    
    // Tạo display với mã đơn vị
    let display = employeeName;
    if (maDonVi) {
        display = `${employeeName} (${maDonVi})`;
    }
    
    return { 
        ten: employeeName, 
        maDonVi: maDonVi || '',
        display: display,
        groupPath: groupPath 
    };
}

// ========== HÀM TẢI DỮ LIỆU ==========

async function fetchEmployees() {
    const loadingEmployees = document.getElementById('loadingEmployees');
    loadingEmployees.style.display = 'block';
    
    try {
        const auth = document.getElementById('auth').value;
        const response = await fetch('https://openapi.mobiwork.vn/OpenAPI/V1/Sale?status=1', {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'Authorization': auth
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(emp => {
                if (emp.ma && emp.ten) {
                    // Lưu cả tên và mã đơn vị (ma_don_vi) của nhân viên
                    employeeMap.set(emp.ma, {
                        ten: emp.ten,
                        ma_don_vi: emp.ma_don_vi || null
                    });
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
            headers: {
                'accept': 'application/json',
                'Authorization': auth
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

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

// ========== HÀM LẤY THÔNG TIN CƠ BẢN ==========

function getEmployeeName(maNV) {
    if (!maNV) return 'N/A';
    
    if (employeeMap.has(maNV)) {
        return employeeMap.get(maNV).ten;
    }
    
    const baseCode = maNV.split('.')[0];
    if (employeeMap.has(baseCode)) {
        return employeeMap.get(baseCode).ten;
    }
    
    return maNV;
}

function getGroupName(maNhom) {
    if (!maNhom) return 'N/A';
    const group = groupMap.get(maNhom);
    return group ? group.ten : maNhom;
}

function findKVFromGroup(maNhom) {
    if (!maNhom) return 'Khác';
    
    if (maNhom.startsWith('KV') && maNhom.length <= 3) {
        return maNhom;
    }
    
    let currentMa = maNhom;
    let visited = new Set();
    
    while (currentMa && !visited.has(currentMa)) {
        visited.add(currentMa);
        const group = groupMap.get(currentMa);
        
        if (!group) break;
        
        if (group.ma_nhom_cha && group.ma_nhom_cha.startsWith('KV') && group.ma_nhom_cha.length <= 3) {
            return group.ma_nhom_cha;
        }
        
        if (currentMa.startsWith('KV') && currentMa.length <= 3) {
            return currentMa;
        }
        
        currentMa = group.ma_nhom_cha;
    }
    
    return 'Khác';
}

// ========== HÀM TÌM KIẾM CHÍNH ==========

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
        // Bước 1: Tải dữ liệu nhân viên và nhóm
        console.log('🔄 Đang tải dữ liệu nhân viên và nhóm...');
        await Promise.all([
            fetchEmployees(),
            fetchGroups()
        ]);
        
        // Bước 2: Đợi 2 giây trước khi gọi API KPI
        console.log('⏳ Đợi 2 giây trước khi gọi API KPI...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Bước 3: Tải dữ liệu KPI
        console.log('🔄 Đang tải dữ liệu KPI...');
        const url = `https://openapi.mobiwork.vn/OpenAPI/V1/KPI?thang=${month}&nam=${year}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'Authorization': auth
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        currentData = data.result || [];
        allData = JSON.parse(JSON.stringify(currentData));
        
        // Bước 4: Cập nhật giao diện
        document.getElementById('reportTitle').textContent = 
            `Báo cáo KPI tháng ${month}/${year}`;
        
        displayDataInfo(currentData);
        
        // Bước 5: Vẽ biểu đồ và hiển thị thống kê
        setTimeout(() => {
            createCharts(currentData);
        }, 100);
        
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

// ========== HÀM TẠO BIỂU ĐỒ ==========

function createCharts(data) {
    console.log('🔄 Đang vẽ biểu đồ...');
    
    // Xóa các biểu đồ cũ
    if (topCompletionChart) topCompletionChart.destroy();
    if (bottomCompletionChart) bottomCompletionChart.destroy();
    if (topAreaChart) topAreaChart.destroy();
    if (bottomAreaChart) bottomAreaChart.destroy();
    if (areaRevenueChart) areaRevenueChart.destroy();
    if (areaKPIChart) areaKPIChart.destroy();

    if (!data || data.length === 0) {
        console.warn('⚠️ Không có dữ liệu để vẽ biểu đồ');
        return;
    }

    createTopCompletionChart(data);
    createBottomCompletionChart(data);
    createTopAreaChart(data);
    createBottomAreaChart(data);
    createAreaRevenueChart(data);
    createAreaKPIChart(data);
    
    console.log('✅ Đã vẽ xong biểu đồ');
}

function createTopCompletionChart(data) {
    if (!data || data.length === 0) return;

    const topData = [...data]
        .filter(item => (item.doanh_so?.kh || 0) > 0)
        .sort((a, b) => (b.doanh_so?.tl || 0) - (a.doanh_so?.tl || 0))
        .slice(0, 10);

    // Tạo labels với thông tin nhân viên, mã đơn vị và đường dẫn nhóm
    const labels = topData.map(item => {
        const { ten, maDonVi, groupPath } = getEmployeeDisplayInfo(item.ma_nv);
        if (groupPath && maDonVi) {
            return `${ten} (${maDonVi})\n${groupPath}`;
        } else if (maDonVi) {
            return `${ten} (${maDonVi})`;
        } else if (groupPath) {
            return `${ten}\n(${groupPath})`;
        }
        return ten;
    });
    
    const completionRates = topData.map(item => item.doanh_so?.tl || 0);

    try {
        const ctx = document.getElementById('topCompletionChart').getContext('2d');
        
        topCompletionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tỷ lệ hoàn thành (%)',
                    data: completionRates,
                    backgroundColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 0.7)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 0.7)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 0.7)';
                        return 'rgba(244, 67, 54, 0.7)';
                    }),
                    borderColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 1)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 1)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 1)';
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
                    legend: { 
                        position: 'top',
                        labels: { font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = topData[context.dataIndex];
                                const { ten, maDonVi, groupPath } = getEmployeeDisplayInfo(item.ma_nv);
                                
                                let tooltipText = `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                               
                                
                                if (item.doanh_so) {
                                    tooltipText += `\n📊 DS KH: ${formatNumber(item.doanh_so.kh || 0)}`;
                                    tooltipText += `\n💰 DS TH: ${formatNumber(item.doanh_so.th || 0)}`;
                                }
                                
                                return tooltipText;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value, index, values) {
                                const label = this.getLabelForValue(value);
                                if (label && label.length > 50) {
                                    return label.substring(0, 47) + '...';
                                }
                                return label;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 20,
                        bottom: 20
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ top completion:', error);
    }
}

function createBottomCompletionChart(data) {
    if (!data || data.length === 0) return;

    const bottomData = [...data]
        .filter(item => (item.doanh_so?.kh || 0) > 0)
        .sort((a, b) => (a.doanh_so?.tl || 0) - (b.doanh_so?.tl || 0))
        .slice(0, 10);

    // Tạo labels với thông tin nhân viên, mã đơn vị và đường dẫn nhóm
    const labels = bottomData.map(item => {
        const { ten, maDonVi, groupPath } = getEmployeeDisplayInfo(item.ma_nv);
        if (groupPath && maDonVi) {
            return `${ten} (${maDonVi})\n${groupPath}`;
        } else if (maDonVi) {
            return `${ten} (${maDonVi})`;
        } else if (groupPath) {
            return `${ten}\n(${groupPath})`;
        }
        return ten;
    });
    
    const completionRates = bottomData.map(item => item.doanh_so?.tl || 0);

    try {
        const ctx = document.getElementById('bottomCompletionChart').getContext('2d');
        
        bottomCompletionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tỷ lệ hoàn thành (%)',
                    data: completionRates,
                    backgroundColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 0.7)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 0.7)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 0.7)';
                        return 'rgba(244, 67, 54, 0.7)';
                    }),
                    borderColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 1)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 1)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 1)';
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
                    legend: { 
                        position: 'top',
                        labels: { font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = bottomData[context.dataIndex];
                                const { ten, maDonVi, groupPath } = getEmployeeDisplayInfo(item.ma_nv);
                                
                                let tooltipText = `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                               
                                if (item.doanh_so) {
                                    tooltipText += `\n📊 DS KH: ${formatNumber(item.doanh_so.kh || 0)}`;
                                    tooltipText += `\n💰 DS TH: ${formatNumber(item.doanh_so.th || 0)}`;
                                }
                                
                                return tooltipText;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value, index, values) {
                                const label = this.getLabelForValue(value);
                                if (label && label.length > 50) {
                                    return label.substring(0, 47) + '...';
                                }
                                return label;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 20,
                        bottom: 20
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ bottom completion:', error);
    }
}

function createAreaRevenueChart(data) {
    if (!data || data.length === 0) return;

    const kvRevenue = {};
    
    data.forEach(item => {
        const maKV = item.ma_kv || 'Khác';
        const kv = findKVFromGroup(maKV);
        const revenue = item.doanh_so?.th || 0;
        
        if (!kvRevenue[kv]) {
            kvRevenue[kv] = 0;
        }
        kvRevenue[kv] += revenue;
    });

    const sortedKVs = Object.entries(kvRevenue)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedKVs.map(([kv]) => {
        const group = groupMap.get(kv);
        return group ? group.ten : kv;
    });
    
    const revenues = sortedKVs.map(([, revenue]) => revenue);

    try {
        const ctx = document.getElementById('areaRevenueChart').getContext('2d');
        
        if (areaRevenueChart) {
            areaRevenueChart.destroy();
        }
        
        areaRevenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh số thực hiện',
                    data: revenues,
                    backgroundColor: revenues.map((_, index) => getChartColor(index, 0.7)),
                    borderColor: revenues.map((_, index) => getChartColor(index, 1)),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '💰 Doanh số: ' + formatNumber(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatNumber(value);
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ doanh số khu vực:', error);
    }
}

function createAreaKPIChart(data) {
    if (!data || data.length === 0) return;

    // Tính tỷ lệ hoàn thành trung bình theo KV
    const kvStats = {};
    
    data.forEach(item => {
        const maKV = item.ma_kv || 'Khác';
        const kv = findKVFromGroup(maKV);
        const tl = item.doanh_so?.tl || 0;
        const kh = item.doanh_so?.kh || 0;
        
        if (!kvStats[kv]) {
            kvStats[kv] = { sumTL: 0, count: 0, sumKH: 0, sumTH: 0 };
        }
        
        if (kh > 0) { // Chỉ tính những nhân viên có chỉ tiêu
            kvStats[kv].sumTL += tl;
            kvStats[kv].count++;
        }
        kvStats[kv].sumKH += kh;
        kvStats[kv].sumTH += item.doanh_so?.th || 0;
    });

    // Tính tỷ lệ hoàn thành trung bình cho từng KV
    const kvData = Object.entries(kvStats)
        .map(([kv, stats]) => ({
            kv: kv,
            avgTL: stats.count > 0 ? stats.sumTL / stats.count : 0,
            totalTL: stats.sumKH > 0 ? (stats.sumTH / stats.sumKH * 100) : 0,
            employeeCount: stats.count
        }))
        .filter(item => item.employeeCount > 0) // Chỉ hiển thị KV có nhân viên
        .sort((a, b) => b.avgTL - a.avgTL);

    if (kvData.length === 0) return;

    const labels = kvData.map(item => {
        const group = groupMap.get(item.kv);
        return group ? group.ten : item.kv;
    });
    
    const avgTLData = kvData.map(item => item.avgTL);
    const totalTLData = kvData.map(item => item.totalTL);

    try {
        const ctx = document.getElementById('areaKPIChart').getContext('2d');
        
        if (areaKPIChart) {
            areaKPIChart.destroy();
        }
        
        areaKPIChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '📊 Tỷ lệ hoàn thành TB (%)',
                        data: avgTLData,
                        backgroundColor: avgTLData.map(rate => {
                            if (rate >= 100) return 'rgba(76, 175, 80, 0.7)';
                            if (rate >= 80) return 'rgba(33, 150, 243, 0.7)';
                            if (rate >= 50) return 'rgba(255, 193, 7, 0.7)';
                            return 'rgba(244, 67, 54, 0.7)';
                        }),
                        borderColor: avgTLData.map(rate => {
                            if (rate >= 100) return 'rgba(76, 175, 80, 1)';
                            if (rate >= 80) return 'rgba(33, 150, 243, 1)';
                            if (rate >= 50) return 'rgba(255, 193, 7, 1)';
                            return 'rgba(244, 67, 54, 1)';
                        }),
                        borderWidth: 1
                    },
                    {
                        label: '📈 Tỷ lệ hoàn thành tổng (%)',
                        data: totalTLData,
                        type: 'line',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        yAxisID: 'y',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 12 },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== undefined) {
                                    label += context.parsed.y.toFixed(1) + '%';
                                }
                                return label;
                            },
                            afterBody: function(context) {
                                const index = context[0].dataIndex;
                                const item = kvData[index];
                                return [
                                    `👥 Số nhân viên: ${item.employeeCount}`,
                                    `📊 DS KH: ${formatNumber(item.sumKH)}`,
                                    `💰 DS TH: ${formatNumber(item.sumTH)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: Math.max(100, ...avgTLData, ...totalTLData) * 1.1,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Tỷ lệ hoàn thành (%)'
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ KPI theo KV:', error);
    }
}

function createTopAreaChart(data) {
    if (!data || data.length === 0) return;

    const areaMap = {};
    data.filter(item => (item.doanh_so?.kh || 0) > 0).forEach(item => {
        const area = item.ma_kv || 'N/A';
        if (!areaMap[area]) {
            areaMap[area] = { sum: 0, count: 0 };
        }
        areaMap[area].sum += item.doanh_so?.tl || 0;
        areaMap[area].count += 1;
    });

    const areaData = Object.entries(areaMap)
        .map(([area, values]) => ({
            area: area,
            avgTL: values.count > 0 ? values.sum / values.count : 0
        }))
        .sort((a, b) => b.avgTL - a.avgTL)
        .slice(0, 10);

    if (areaData.length === 0) return;

    const labels = areaData.map(item => getGroupName(item.area));
    const completionRates = areaData.map(item => item.avgTL);

    try {
        const ctx = document.getElementById('topAreaChart').getContext('2d');
        
        topAreaChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tỷ lệ hoàn thành trung bình (%)',
                    data: completionRates,
                    backgroundColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 0.7)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 0.7)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 0.7)';
                        return 'rgba(244, 67, 54, 0.7)';
                    }),
                    borderColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 1)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 1)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 1)';
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
                    legend: { 
                        position: 'top',
                        labels: { font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.raw.toFixed(1) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ top area:', error);
    }
}

function createBottomAreaChart(data) {
    if (!data || data.length === 0) return;

    const areaMap = {};
    data.filter(item => (item.doanh_so?.kh || 0) > 0).forEach(item => {
        const area = item.ma_kv || 'N/A';
        if (!areaMap[area]) {
            areaMap[area] = { sum: 0, count: 0 };
        }
        areaMap[area].sum += item.doanh_so?.tl || 0;
        areaMap[area].count += 1;
    });

    const areaData = Object.entries(areaMap)
        .map(([area, values]) => ({
            area: area,
            avgTL: values.count > 0 ? values.sum / values.count : 0
        }))
        .sort((a, b) => a.avgTL - b.avgTL)
        .slice(0, 10);

    if (areaData.length === 0) return;

    const labels = areaData.map(item => getGroupName(item.area));
    const completionRates = areaData.map(item => item.avgTL);

    try {
        const ctx = document.getElementById('bottomAreaChart').getContext('2d');
        
        bottomAreaChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tỷ lệ hoàn thành trung bình (%)',
                    data: completionRates,
                    backgroundColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 0.7)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 0.7)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 0.7)';
                        return 'rgba(244, 67, 54, 0.7)';
                    }),
                    borderColor: completionRates.map(rate => {
                        if (rate >= 100) return 'rgba(76, 175, 80, 1)';
                        if (rate >= 80) return 'rgba(33, 150, 243, 1)';
                        if (rate >= 50) return 'rgba(255, 193, 7, 1)';
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
                    legend: { 
                        position: 'top',
                        labels: { font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.raw.toFixed(1) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Lỗi vẽ biểu đồ bottom area:', error);
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
    
    const nvCaoNhat = data.reduce((max, item) => 
        (item.doanh_so?.th || 0) > (max.doanh_so?.th || 0) ? item : max, data[0]);
    
    const areaStats = {};
    data.forEach(item => {
        const area = item.ma_kv || 'N/A';
        if (!areaStats[area]) {
            areaStats[area] = {
                tongTH: 0,
                tongKH: 0,
                count: 0
            };
        }
        areaStats[area].tongTH += item.doanh_so?.th || 0;
        areaStats[area].tongKH += item.doanh_so?.kh || 0;
        areaStats[area].count++;
    });

    let nppCaoNhat = null;
    let maxDoanhSoTH = 0;
    
    Object.entries(areaStats).forEach(([area, stats]) => {
        if (stats.tongTH > maxDoanhSoTH) {
            maxDoanhSoTH = stats.tongTH;
            nppCaoNhat = {
                ten: area,
                doanhSoTH: stats.tongTH,
                doanhSoKH: stats.tongKH,
                tl: stats.tongKH > 0 ? (stats.tongTH / stats.tongKH * 100) : 0
            };
        }
    });

    // Tính doanh thu theo khu vực (KV)
    const kvRevenue = {};
    
    data.forEach(item => {
        const maKV = item.ma_kv || 'Khác';
        const kv = findKVFromGroup(maKV);
        const revenue = item.doanh_so?.th || 0;
        
        if (!kvRevenue[kv]) {
            kvRevenue[kv] = 0;
        }
        kvRevenue[kv] += revenue;
    });

    // Tìm khu vực có doanh thu cao nhất
    let kvCaoNhat = null;
    let maxRevenue = 0;
    
    Object.entries(kvRevenue).forEach(([kv, revenue]) => {
        if (revenue > maxRevenue && kv !== 'Khác') {
            maxRevenue = revenue;
            kvCaoNhat = {
                ma: kv,
                doanhThu: revenue
            };
        }
    });

    // Tính tổng doanh thu KH cho khu vực cao nhất (nếu cần)
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
        { 
            label: '🏆 NV cao nhất', 
            value: getEmployeeName(nvCaoNhat.ma_nv), 
            subValue: formatNumber(nvCaoNhat.doanh_so?.th || 0),
            subLabel: 'Doanh số'
        },
        { 
            label: '🏢 NPP cao nhất', 
            value: getGroupName(nppCaoNhat ? nppCaoNhat.ten : 'N/A'), 
            subValue: nppCaoNhat ? formatNumber(nppCaoNhat.doanhSoTH) : '0',
            subLabel: 'Doanh số',
            tlValue: nppCaoNhat ? nppCaoNhat.tl.toFixed(1) + '%' : '0%'
        },
        { 
            label: '📍 KV doanh thu cao nhất', 
            value: kvCaoNhat ? getGroupName(kvCaoNhat.ma) : 'N/A', 
            subValue: kvCaoNhat ? formatNumber(kvCaoNhat.doanhThu) : '0',
            subLabel: 'Doanh số TH',
            tlValue: kvCaoNhat ? `Tỷ lệ: ${kvCaoNhat.tl.toFixed(1)}%` : ''
        }
    ];

    stats.forEach(stat => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        
        if (stat.unit === '%') {
            statCard.innerHTML = `
                <div class="stat-label">${stat.label}</div>
                <div class="stat-value">${stat.value.toFixed(1)}%</div>
            `;
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
            statCard.innerHTML = `
                <div class="stat-label">${stat.label}</div>
                <div class="stat-value">${formatNumber(stat.value)}</div>
            `;
        }
        
        summaryStats.appendChild(statCard);
    });
}

// ========== HÀM TIỆN ÍCH ==========

function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return new Intl.NumberFormat('vi-VN').format(num);
}

function getChartColor(index, alpha = 1) {
    const colors = [
        `rgba(102, 126, 234, ${alpha})`,
        `rgba(76, 175, 80, ${alpha})`,
        `rgba(255, 152, 0, ${alpha})`,
        `rgba(244, 67, 54, ${alpha})`,
        `rgba(33, 150, 243, ${alpha})`,
        `rgba(156, 39, 176, ${alpha})`,
        `rgba(255, 193, 7, ${alpha})`,
        `rgba(0, 150, 136, ${alpha})`
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
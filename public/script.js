// 全局状态
let appState = {
    services: [],
    historyData: {},
    timeRange: 1, // 1=24小时, 7=7天, 30=30天
    monitoringFrequency: 5, // 分钟
    lastUpdated: null
};

// 图表实例
let responseTimeChart = null;
let availabilityChart = null;

// DOM元素
const serviceListEl = document.getElementById('service-list');
const lastUpdatedEl = document.getElementById('last-updated');
const timeFilterEl = document.getElementById('time-filter');
const servicesConfigEl = document.getElementById('services-config');
const addServiceBtn = document.getElementById('add-service');
const frequencySelect = document.getElementById('monitoring-frequency');
const saveSettingsBtn = document.getElementById('save-settings');

// API基础URL（部署后更新）
const API_BASE_URL = '/api';

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    // 设置事件监听
    setupEventListeners();
    
    // 从API加载配置
    await loadSettings();
    
    // 从API加载历史数据
    await loadHistoryData();
    
    // 初始化图表
    initCharts();
    
    // 渲染服务列表
    renderServiceList();
    
    // 开始自动刷新
    startAutoRefresh();
});

// 设置事件监听
function setupEventListeners() {
    // 时间筛选器
    timeFilterEl.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            timeFilterEl.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appState.timeRange = parseInt(btn.dataset.days);
            updateCharts();
        });
    });
    
    // 添加服务按钮
    addServiceBtn.addEventListener('click', addServiceConfig);
    
    // 保存设置按钮
    saveSettingsBtn.addEventListener('click', saveSettings);
}

// 加载设置
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings`);
        const data = await response.json();
        
        appState.services = data.services || [];
        appState.monitoringFrequency = data.monitoringFrequency || 5;
        
        // 更新UI
        frequencySelect.value = appState.monitoringFrequency;
        renderServicesConfig();
    } catch (error) {
        console.error('加载设置失败:', error);
        // 默认配置
        appState.services = [
            { id: 'google', name: "Google", url: "https://www.google.com", method: "HEAD" },
            { id: 'github', name: "GitHub API", url: "https://api.github.com", method: "GET" }
        ];
        renderServicesConfig();
    }
}

// 加载历史数据
async function loadHistoryData() {
    try {
        const response = await fetch(`${API_BASE_URL}/history`);
        const data = await response.json();
        appState.historyData = data;
        appState.lastUpdated = new Date();
        updateLastUpdated();
    } catch (error) {
        console.error('加载历史数据失败:', error);
    }
}

// 渲染服务列表
function renderServiceList() {
    serviceListEl.innerHTML = '';
    
    if (appState.services.length === 0) {
        serviceListEl.innerHTML = '<div class="no-data"><i class="fas fa-cloud"></i><p>暂无监控服务</p></div>';
        return;
    }
    
    appState.services.forEach(service => {
        const history = appState.historyData[service.id] || [];
        const lastEntry = history.length > 0 ? history[history.length - 1] : null;
        
        const card = document.createElement('div');
        card.className = 'service-card';
        
        if (lastEntry && !lastEntry.status) {
            card.classList.add('down');
        }
        
        card.innerHTML = `
            <div class="status-indicator ${lastEntry && lastEntry.status ? 'status-up' : 'status-down'}"></div>
            <div class="service-info">
                <div class="service-name">${service.name}</div>
                <div class="service-details">
                    <div class="service-url">${service.url}</div>
                    <div class="service-response">${lastEntry ? `${lastEntry.responseTime}ms` : '检查中...'}</div>
                </div>
            </div>
        `;
        
        serviceListEl.appendChild(card);
    });
}

// 渲染服务配置
function renderServicesConfig() {
    servicesConfigEl.innerHTML = '';
    
    appState.services.forEach((service, index) => {
        const configEl = document.createElement('div');
        configEl.className = 'service-config';
        configEl.innerHTML = `
            <input type="text" class="service-name" placeholder="服务名称" value="${service.name}" data-index="${index}">
            <input type="text" class="service-url" placeholder="服务URL" value="${service.url}" data-index="${index}">
            <select class="service-method" data-index="${index}">
                <option value="HEAD" ${service.method === 'HEAD' ? 'selected' : ''}>HEAD</option>
                <option value="GET" ${service.method === 'GET' ? 'selected' : ''}>GET</option>
            </select>
            <button class="remove-service" data-index="${index}"><i class="fas fa-trash"></i></button>
        `;
        
        servicesConfigEl.appendChild(configEl);
    });
    
    // 添加删除按钮事件
    document.querySelectorAll('.remove-service').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('.remove-service').dataset.index);
            appState.services.splice(index, 1);
            renderServicesConfig();
        });
    });
    
    // 添加输入变化事件
    document.querySelectorAll('.service-name, .service-url, .service-method').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const field = e.target.classList.contains('service-name') ? 'name' : 
                          e.target.classList.contains('service-url') ? 'url' : 'method';
            appState.services[index][field] = e.target.value;
        });
    });
}

// 添加服务配置
function addServiceConfig() {
    appState.services.push({
        id: `service-${Date.now()}`,
        name: "新服务",
        url: "https://example.com",
        method: "HEAD"
    });
    renderServicesConfig();
}

// 保存设置
async function saveSettings() {
    appState.monitoringFrequency = parseInt(frequencySelect.value);
    
    try {
        const response = await fetch(`${API_BASE_URL}/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                services: appState.services,
                monitoringFrequency: appState.monitoringFrequency
            })
        });
        
        if (response.ok) {
            alert('设置保存成功！');
            await loadHistoryData();
            renderServiceList();
            updateCharts();
        } else {
            alert('保存设置失败，请重试');
        }
    } catch (error) {
        console.error('保存设置失败:', error);
        alert('保存设置失败，请检查网络连接');
    }
}

// 初始化图表
function initCharts() {
    const ctx1 = document.getElementById('response-time-chart').getContext('2d');
    const ctx2 = document.getElementById('availability-chart').getContext('2d');
    
    // 响应时间图表
    responseTimeChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '服务响应时间趋势 (ms)',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '响应时间 (ms)'
                    }
                }
            }
        }
    });
    
    // 可用性图表
    availabilityChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '服务可用性 (%)',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '历史可用性统计',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: '可用性 (%)'
                    }
                }
            }
        }
    });
    
    // 初始更新图表
    updateCharts();
}

// 更新图表
function updateCharts() {
    updateResponseTimeChart();
    updateAvailabilityChart();
}

// 更新响应时间图表
function updateResponseTimeChart() {
    if (!responseTimeChart) return;
    
    const datasets = [];
    const colors = [
        'rgb(255, 99, 132)',
        'rgb(54, 162, 235)',
        'rgb(255, 159, 64)',
        'rgb(75, 192, 192)',
        'rgb(153, 102, 255)',
        'rgb(255, 205, 86)'
    ];
    
    // 生成时间标签
    const now = new Date();
    const startTime = new Date(now);
    startTime.setDate(startTime.getDate() - appState.timeRange);
    
    const labels = [];
    const hours = appState.timeRange * 24;
    const step = Math.max(1, Math.floor(hours / 12));
    
    for (let i = 0; i <= hours; i += step) {
        const time = new Date(startTime);
        time.setHours(time.getHours() + i);
        labels.push(time.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
    }
    
    // 为每个服务创建数据集
    appState.services.forEach((service, index) => {
        const serviceData = [];
        const history = appState.historyData[service.id] || [];
        
        // 为每个时间点填充数据
        for (let i = 0; i <= hours; i += step) {
            const targetTime = new Date(startTime);
            targetTime.setHours(targetTime.getHours() + i);
            
            // 查找最接近的数据点
            let closestEntry = null;
            let minDiff = Infinity;
            
            history.forEach(entry => {
                const entryTime = new Date(entry.timestamp);
                const diff = Math.abs(entryTime - targetTime);
                
                if (diff < minDiff) {
                    minDiff = diff;
                    closestEntry = entry;
                }
            });
            
            serviceData.push(closestEntry ? closestEntry.responseTime : null);
        }
        
        datasets.push({
            label: service.name,
            data: serviceData,
            borderColor: colors[index % colors.length],
            backgroundColor: `rgba(${colors[index % colors.length].slice(4, -1)}, 0.1)`,
            tension: 0.3,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 6
        });
    });
    
    // 更新图表
    responseTimeChart.data.labels = labels;
    responseTimeChart.data.datasets = datasets;
    responseTimeChart.update();
}

// 更新可用性图表
function updateAvailabilityChart() {
    if (!availabilityChart) return;
    
    const now = new Date();
    const dailyAvailability = [];
    const labels = [];
    
    // 计算过去30天的可用性
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString([], {month: 'short', day: 'numeric'}));
        
        let dayOnline = 0;
        let dayTotal = 0;
        
        appState.services.forEach(service => {
            const history = appState.historyData[service.id] || [];
            const dayData = history.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entryDate.toDateString() === date.toDateString();
            });
            
            if (dayData.length > 0) {
                const onlineCount = dayData.filter(entry => entry.status).length;
                dayOnline += onlineCount;
                dayTotal += dayData.length;
            }
        });
        
        const availability = dayTotal > 0 ? Math.round((dayOnline / dayTotal) * 100) : 0;
        dailyAvailability.push(availability);
    }
    
    // 更新图表
    availabilityChart.data.labels = labels;
    availabilityChart.data.datasets[0].data = dailyAvailability;
    
    // 设置颜色
    availabilityChart.data.datasets[0].backgroundColor = dailyAvailability.map(avail => {
        if (avail >= 99.9) return 'rgba(46, 204, 113, 0.7)';
        if (avail >= 99) return 'rgba(52, 152, 219, 0.7)';
        if (avail >= 95) return 'rgba(241, 196, 15, 0.7)';
        return 'rgba(231, 76, 60, 0.7)';
    });
    
    availabilityChart.update();
}

// 更新最后更新时间
function updateLastUpdated() {
    if (appState.lastUpdated) {
        lastUpdatedEl.textContent = `最后更新: ${appState.lastUpdated.toLocaleString()}`;
    }
}

// 开始自动刷新
function startAutoRefresh() {
    setInterval(async () => {
        await loadHistoryData();
        renderServiceList();
        updateCharts();
    }, appState.monitoringFrequency * 60 * 1000);
}

// worker/index.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // API路由
    if (path.startsWith('/api')) {
      return handleApiRequest(request, env);
    }
    
    // 静态文件服务
    return serveStaticFile(request, env);
  },
  
  // 定时任务处理
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledTask(env));
  }
}

// 处理API请求
async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    // 获取设置
    if (path === '/api/settings') {
      if (request.method === 'GET') {
        return getSettings(env);
      } else if (request.method === 'POST') {
        return saveSettings(request, env);
      }
    }
    
    // 获取历史数据
    if (path === '/api/history') {
      return getHistoryData(env);
    }
    
    return new Response('Not found', { status: 404 });
  } catch (err) {
    return new Response(err.stack, { status: 500 });
  }
}

// 获取设置
async function getSettings(env) {
  const settings = await env.STATUS_MONITOR.get('settings', 'json') || {
    services: [
      { id: 'google', name: "Google", url: "https://www.google.com", method: "HEAD" },
      { id: 'github', name: "GitHub API", url: "https://api.github.com", method: "GET" }
    ],
    monitoringFrequency: 5
  };
  
  return new Response(JSON.stringify(settings), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 保存设置
async function saveSettings(request, env) {
  const data = await request.json();
  await env.STATUS_MONITOR.put('settings', JSON.stringify(data));
  
  // 立即执行监控任务
  await performMonitoring(env);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 获取历史数据
async function getHistoryData(env) {
  const services = await env.STATUS_MONITOR.get('services', 'json') || [];
  const historyData = {};
  
  // 获取每个服务的历史数据
  for (const service of services) {
    const serviceHistory = await env.STATUS_MONITOR.get(`history_${service.id}`, 'json') || [];
    historyData[service.id] = serviceHistory;
  }
  
  return new Response(JSON.stringify(historyData), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 处理定时任务
async function handleScheduledTask(env) {
  await performMonitoring(env);
}

// 执行监控任务
async function performMonitoring(env) {
  const settings = await env.STATUS_MONITOR.get('settings', 'json') || {
    services: [
      { id: 'google', name: "Google", url: "https://www.google.com", method: "HEAD" },
      { id: 'github', name: "GitHub API", url: "https://api.github.com", method: "GET" }
    ]
  };
  
  // 检查每个服务
  for (const service of settings.services) {
    try {
      const startTime = Date.now();
      const response = await fetch(service.url, { method: service.method });
      const responseTime = Date.now() - startTime;
      const status = response.ok;
      
      // 保存历史数据
      await saveServiceHistory(env, service.id, status, responseTime);
    } catch (error) {
      // 保存错误状态
      await saveServiceHistory(env, service.id, false, 0);
    }
  }
}

// 保存服务历史数据
async function saveServiceHistory(env, serviceId, status, responseTime) {
  const historyKey = `history_${serviceId}`;
  let history = await env.STATUS_MONITOR.get(historyKey, 'json') || [];
  
  // 添加新记录
  history.push({
    timestamp: Date.now(),
    status,
    responseTime
  });
  
  // 只保留最近1000条记录
  if (history.length > 1000) {
    history = history.slice(-1000);
  }
  
  await env.STATUS_MONITOR.put(historyKey, JSON.stringify(history));
}

// 提供静态文件
async function serveStaticFile(request, env) {
  const url = new URL(request.url);
  let path = url.pathname;
  
  // 默认返回index.html
  if (path === '/') {
    path = '/index.html';
  }
  
  // 从KV获取文件
  const file = await env.STATUS_MONITOR.get(`static${path}`);
  
  if (file) {
    const contentType = getContentType(path);
    return new Response(file, {
      headers: { 'Content-Type': contentType }
    });
  }
  
  // 文件未找到
  return new Response('File not found', { status: 404 });
}

// 获取内容类型
function getContentType(path) {
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'text/html';
}

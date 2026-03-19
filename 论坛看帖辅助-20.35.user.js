// ==UserScript==
// @name         论坛看帖辅助
// @namespace    http://tampermonkey.net/
// @version      20.35
// @description  批量打开帖子、多维度屏蔽、115推送、一键提取资源、标题翻译等
// @author       鲜切红薯片
// @match        *://*.sehuatang.net/*
// @match        *://*.sehuatang.org/*
// @match        *://*.dmn12.vip/*
// @noframes
// @connect      115.com
// @connect      translate.googleapis.com
// @connect      api.deepseek.com
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @downloadURL https://update.sleazyfork.org/scripts/569794/%E8%AE%BA%E5%9D%9B%E7%9C%8B%E5%B8%96%E8%BE%85%E5%8A%A9.user.js
// @updateURL https://update.sleazyfork.org/scripts/569794/%E8%AE%BA%E5%9D%9B%E7%9C%8B%E5%B8%96%E8%BE%85%E5%8A%A9.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // 顶级窗口防御：如果在 iframe 中运行则直接退出，极大地节约其他网站的性能
    if (window.top !== window.self) return;

    if (!document.body) return;

    // ================= 特征嗅探 =================
    const isTargetForum = document.querySelector('.hdc.cl img[src*="logo.png"]') || document.querySelector('.hdc.cl img[alt*="98堂"]') || document.querySelector('.hdc.cl img[alt*="色花堂"]');
    if (!isTargetForum) return;

    // ================= 双轨制分区识别逻辑 =================
    const ptNode = document.querySelector('#pt');
    const ptString = ptNode ? ptNode.innerText.replace(/\s+/g, '') : '';

    let configType = 'default';
    if (ptString.includes('原创BT电影')) configType = 'bt_movie';
    else if (ptString.includes('综合讨论区>综合讨论区')) configType = 'general';
    else if (ptString.includes('转帖交流区')) configType = 'repost';
    else if (ptString.includes('AI专区') || ptString.includes('资源出售区')) configType = 'ai_sale';
    else if (ptString.includes('网友原创区')) configType = 'netizen_original';

    let exactZoneName = '未知版块';
    const ptLinks = document.querySelectorAll('#pt .z a, #pt a');
    if (ptLinks.length > 0) { exactZoneName = ptLinks[ptLinks.length - 1].innerText.trim(); }

    const ZONE_CONFIG = {
        'bt_movie': { maxImg: 2, res: ['magnet', 'torrent'], autoPreview: true },
        'general': { maxImg: 2, res: ['magnet', 'ed2k', 'quark', 'baidu', 'thunder', '115', 'torrent', 'password'], autoPreview: true },
        'repost': { maxImg: 2, res: ['baidu', 'magnet', 'thunder', '115', 'torrent', 'password'], autoPreview: true },
        'ai_sale': { maxImg: 2, res: ['password'], hideHoverWarn: true, forceImgOnLock: true, autoPreview: true },
        'netizen_original': { maxImg: 2, res: ['magnet', 'ed2k', 'torrent', 'password', 'baidu', 'quark', 'thunder', '115'], hideHoverWarn: true, forceImgOnLock: true, autoPreview: true },
        'default': { maxImg: 2, res: ['magnet', 'ed2k', 'torrent', 'password', '115'], autoPreview: true }
    };
    const CONF = ZONE_CONFIG[configType] || ZONE_CONFIG['default'];

    // ================= 115 接口与交互优化 =================
    window.check115Auth = () => {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({ method: "GET", url: "https://115.com/?ct=offline&ac=space", responseType: "json",
                onload: (res) => { try { const data = res.response || JSON.parse(res.responseText); if (data && data.state) { STATE.auth115 = { loggedIn: true, sign: data.sign, time: data.time }; resolve(STATE.auth115); } else { STATE.auth115 = { loggedIn: false }; resolve(STATE.auth115); } } catch(e) { STATE.auth115 = { loggedIn: false }; resolve(STATE.auth115); } },
                onerror: () => { STATE.auth115 = { loggedIn: false }; resolve(STATE.auth115); }
            });
        });
    };

    window.pushSingleTo115 = async (btn, link) => {
        if (!STATE.auth115 || !STATE.auth115.loggedIn || !STATE.auth115.sign) {
            btn.innerText = '检测中..'; await window.check115Auth();
            if (!STATE.auth115.loggedIn) {
                btn.innerText = '☁️ 推送115';
                if(confirm('🔴 未检测到 115 登录状态！\n\n点击【确定】立即前往 115.com 登录。\n（提示：登录成功后，请返回本页面刷新一下再试）')) {
                    GM_openInTab('https://115.com/?ct=offline&ac=space', {active: true});
                }
                return;
            }
        }
        btn.innerText = '推送中..'; btn.disabled = true; btn.style.opacity = '0.6';
        GM_xmlhttpRequest({
            method: 'POST', url: 'https://115.com/web/lixian/?ct=lixian&ac=add_task_url', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, data: `url=${encodeURIComponent(link)}&sign=${STATE.auth115.sign}&time=${STATE.auth115.time}`,
            onload: (res) => {
                try {
                    const d = JSON.parse(res.responseText);
                    if (d.state) { btn.innerText = '✅ 已推送'; btn.style.backgroundColor = '#28a745'; }
                    else { btn.innerText = '❌ ' + (d.error_msg || '失败'); btn.style.backgroundColor = '#dc3545'; }
                } catch(e) { btn.innerText = '❌ 解析错误'; btn.style.backgroundColor = '#dc3545'; }
                setTimeout(() => { btn.innerText = '☁️ 推送115'; btn.style.backgroundColor = ''; btn.disabled = false; btn.style.opacity = '1'; }, 3000);
            },
            onerror: () => { btn.innerText = '❌ 网络异常'; btn.style.backgroundColor = '#dc3545'; setTimeout(() => { btn.innerText = '☁️ 推送115'; btn.style.backgroundColor = ''; btn.disabled = false; btn.style.opacity = '1'; }, 3000); }
        });
    };

    // ================= 全局事件委托 =================
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('custom-inline-push')) {
            e.preventDefault();
            e.stopPropagation();
            const link = e.target.dataset.link;
            if (link) {
                window.pushSingleTo115(e.target, link);
            } else {
                e.target.innerText = '❌ 链接丢失';
            }
        }
    });

    // ================= 数据库 & 智能垃圾回收 =================
    try { indexedDB.deleteDatabase('SHT_Super_Cache'); indexedDB.deleteDatabase('SHT_Super_Cache_V2'); indexedDB.deleteDatabase('SHT_Super_Cache_V3'); } catch(e) {}
    const DB_NAME = 'SHT_Super_Cache_V4'; const STORE_NAME = 'threads'; const TTL = 2 * 24 * 60 * 60 * 1000;
    const CacheDB = {
        db: null,
        init() { return new Promise((resolve) => { const req = indexedDB.open(DB_NAME, 1); const fallbackTimer = setTimeout(() => { resolve(); }, 1500); req.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'url' }); }; req.onsuccess = (e) => { clearTimeout(fallbackTimer); this.db = e.target.result; this.clean(); resolve(); }; req.onerror = () => { clearTimeout(fallbackTimer); resolve(); }; req.onblocked = () => { clearTimeout(fallbackTimer); resolve(); }; }); },
        async get(url) { if (!this.db) return null; return new Promise(resolve => { const tx = this.db.transaction(STORE_NAME, 'readonly'); const req = tx.objectStore(STORE_NAME).get(url); req.onsuccess = () => { if (req.result && (Date.now() - req.result.ts < TTL)) resolve(req.result.data); else { if (req.result) this.delete(url); resolve(null); } }; req.onerror = () => resolve(null); }); },
        async set(url, data) { if (!this.db) return; return new Promise(resolve => { const tx = this.db.transaction(STORE_NAME, 'readwrite'); tx.objectStore(STORE_NAME).put({ url, data, ts: Date.now() }); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }); },
        delete(url) { if (this.db) this.db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(url); },
        clean() { if (!this.db) return; const tx = this.db.transaction(STORE_NAME, 'readwrite'); const req = tx.objectStore(STORE_NAME).openCursor(); const now = Date.now(); req.onsuccess = (e) => { const cursor = e.target.result; if (cursor) { if (now - cursor.value.ts >= TTL) cursor.delete(); cursor.continue(); } }; }
    };

    setInterval(() => {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => CacheDB.clean(), { timeout: 5000 });
        } else {
            CacheDB.clean();
        }
    }, 10 * 60 * 1000);

    class TaskQueue {
        constructor(concurrency = 1, delayMs = 1000) { this.concurrency = concurrency; this.delayMs = delayMs; this.tasks = []; this.active = 0; this.stopped = false; this.stats = { total: 0, success: 0, fail: 0, pending: 0 }; this.onProgress = null; this.onComplete = null; }
        addTasks(tasks) { this.tasks.push(...tasks); this.stats.total += tasks.length; this.stats.pending += tasks.length; this._next(); }
        stop() { this.stopped = true; this.tasks = []; }
        async run() { this.stopped = false; return new Promise(resolve => { this.onComplete = resolve; for (let i = 0; i < this.concurrency; i++) this._next(); }); }
        async _next() { if (this.stopped || (this.tasks.length === 0 && this.active === 0)) { if (this.active === 0 && this.onComplete) this.onComplete(); return; } if (this.tasks.length === 0 || this.active >= this.concurrency) return; this.active++; const task = this.tasks.shift(); try { await task(); this.stats.success++; } catch (e) { this.stats.fail++; } finally { this.stats.pending--; this.active--; if (this.onProgress) this.onProgress(this.stats); await new Promise(r => setTimeout(r, this.delayMs)); this._next(); } }
    }
    const GlobalInlineQueue = new TaskQueue(1, 1000);

    const getTid = (url) => { let m = url.match(/tid=(\d+)/); if (m) return m[1]; m = url.match(/thread-(\d+)/); if (m) return m[1]; return url; };
    const migrateRules = (arr) => { if (!Array.isArray(arr)) return []; return arr.map(item => { if (typeof item === 'string') return { val: item, zone: 'all' }; return item; }); };

    let currentPageInterceptCount = 0;
    const STATE = {
        blocked: migrateRules(GM_getValue('custom_blocked_keywords', [])),
        blockedUsers: migrateRules(GM_getValue('custom_blocked_users', [])),
        blockedTags: migrateRules(GM_getValue('custom_blocked_tags', [])),
        highlighted: migrateRules(GM_getValue('custom_highlight_keywords', [])),
        readLinks: GM_getValue('custom_read_links', []) || [],
        interceptionLog: [],
        autoLoadNextPage: GM_getValue('custom_auto_load', false),
        themeMode: GM_getValue('custom_theme_mode', 'auto'),
        hideReadPosts: GM_getValue('custom_hide_read', false),
        deepseekKey: GM_getValue('custom_deepseek_key', ''),
        threadCache: {}, isExtracting: false, taskQueue: null,
        nextPageUrl: document.querySelector('a.nxt') ? document.querySelector('a.nxt').href : null, poolLinks: [], poolTorrents: [], auth115: { loggedIn: false, sign: '', time: '' }
    };

    GM_setValue('custom_blocked_keywords', STATE.blocked); GM_setValue('custom_blocked_users', STATE.blockedUsers);
    GM_setValue('custom_blocked_tags', STATE.blockedTags); GM_setValue('custom_highlight_keywords', STATE.highlighted);

    if (Array.isArray(STATE.readLinks)) STATE.readLinks = [...new Set(STATE.readLinks.map(getTid))]; else STATE.readLinks = [];
    const saveState = (key, value) => { GM_setValue(key, value); }; document.documentElement.setAttribute('data-custom-theme', STATE.themeMode);
    setTimeout(() => { window.check115Auth(); }, 2000);

    const markAsRead = (url, tbody) => {
        const tid = getTid(url);
        if (!STATE.readLinks.includes(tid)) { STATE.readLinks.push(tid); if (STATE.readLinks.length > 5000) STATE.readLinks.shift(); saveState('custom_read_links', STATE.readLinks); }
        if (tbody) tbody.setAttribute('data-custom-read', 'true');
    };

    const addLog = (title, url, reason) => {
        STATE.interceptionLog = STATE.interceptionLog.filter(log => log && log.url !== url);
        STATE.interceptionLog.unshift({ title: title, url: url, reason: reason, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
        if (STATE.interceptionLog.length > 100) STATE.interceptionLog.length = 100;
        if (typeof window.updateLogPanel === 'function') window.updateLogPanel();
    };

    // ================= CSS 样式注入 =================
    GM_addStyle(`
        :root { --f-bg: #ffffff; --f-text: #333333; --f-border: #cccccc; --f-panel-bg: #f8f9fa; --f-hover: #e9ecef; --f-btn-text: #ffffff; --f-link: #007bff; --f-tag-bg: #e9ecef; --f-tag-text: #495057; --f-log-time: #888888; --f-hl-bg: #fffacd; }
        :root[data-custom-theme="dark"] { --f-bg: #1e1e1e; --f-text: #dddddd; --f-border: #444444; --f-panel-bg: #2a2a2a; --f-hover: #333333; --f-btn-text: #eeeeee; --f-link: #4da3ff; --f-tag-bg: #333333; --f-tag-text: #cccccc; --f-log-time: #aaaaaa; --f-hl-bg: #4d4d00; }
        @media (prefers-color-scheme: dark) { :root:not([data-custom-theme="light"]) { --f-bg: #1e1e1e; --f-text: #dddddd; --f-border: #444444; --f-panel-bg: #2a2a2a; --f-hover: #333333; --f-btn-text: #eeeeee; --f-link: #4da3ff; --f-tag-bg: #333333; --f-tag-text: #cccccc; --f-log-time: #aaaaaa; --f-hl-bg: #4d4d00; } }
        #custom-main-window { position: fixed; z-index: 999998; width: 350px; background: var(--f-bg); border: 1px solid var(--f-border); box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-radius: 8px; display: none; flex-direction: column; overflow: hidden; color: var(--f-text); transition: height 0.3s ease; }

        #custom-float-btn { position: fixed; bottom: 30px; right: 30px; z-index: 999997; width: 50px; height: 50px; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; cursor: pointer; transition: transform 0.2s;
            background-image: linear-gradient(142deg, #FFF600 0%, #FFA873 37%, #FF316B 94%) !important;
            border: 2px solid white; user-select: none; }
        #custom-float-btn:hover { transform: scale(1.1); }
        #custom-intercept-count { color: #fff; font-size: 18px; font-weight: 900; text-shadow: 0px 0px 4px rgba(0,0,0,0.9), 0px 0px 2px rgba(0,0,0,1); pointer-events: none; }

        #custom-header { background: #6c757d; color: #fff; padding: 8px 15px; font-weight: bold; font-size: 14px; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none; } #custom-min-btn { cursor: pointer; padding: 0 5px; font-size: 16px; font-weight: bold; }
        .custom-tab-bar { display: flex; border-bottom: 1px solid var(--f-border); background: var(--f-panel-bg); } .custom-tab-btn { flex: 1; border: none; background: transparent; padding: 8px 0; font-size: 13px; cursor: pointer; color: var(--f-text); outline: none; transition: background 0.2s; } .custom-tab-btn:hover { background: var(--f-hover); } .custom-tab-btn.active { border-bottom: 2px solid #007bff; font-weight: bold; color: #007bff; } .custom-tab-content { display: none; padding: 12px; max-height: 400px; overflow-y: auto; flex-direction: column; gap: 10px; } .custom-tab-content.active { display: flex; }
        #custom-selection-box { position: fixed; z-index: 999999; border: 1px solid #007bff; background-color: rgba(0, 123, 255, 0.15); pointer-events: none; display: none; }

        /* 现代化画廊样式 */
        #custom-lightbox { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.92); z-index: 9999999; display: none; justify-content: center; align-items: center; overflow: hidden; user-select: none; }
        #lb-img { max-width: 90vw; max-height: 90vh; object-fit: contain; cursor: grab; transform-origin: center center; }
        #lb-img:active { cursor: grabbing; }
        .lb-nav { position: absolute; top: 50%; transform: translateY(-50%); font-size: 40px; color: white; cursor: pointer; padding: 20px; background: rgba(0,0,0,0.4); border-radius: 5px; transition: background 0.3s; z-index: 2; } .lb-nav:hover { background: rgba(0,0,0,0.8); } .lb-prev { left: 20px; } .lb-next { right: 20px; }
        .lb-close { position: absolute; top: 20px; right: 30px; font-size: 40px; color: white; cursor: pointer; z-index: 2; transition: color 0.2s; } .lb-close:hover { color: #dc3545; }
        .lb-counter { position: absolute; bottom: 20px; color: white; font-size: 16px; background: rgba(0,0,0,0.6); padding: 5px 15px; border-radius: 20px; z-index: 2; pointer-events: none; }
        .lb-tips { position: absolute; top: 20px; left: 20px; color: #aaa; font-size: 12px; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; pointer-events: none; }

        /* 高亮文字样式 */
        .custom-keyword-hl { background-color: var(--f-hl-bg); color: #ff0000 !important; font-weight: bold; padding: 0 4px; border-radius: 3px; }
        .custom-hidden { display: none !important; }
        body.custom-hide-read-mode tbody[data-custom-read="true"] { display: none !important; }
        .custom-viewed-tag { background: #409EFF; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-left: 8px; font-weight: normal; vertical-align: middle; }

        .custom-inline-preview { margin-top: 5px; display: flex; gap: 5px; flex-wrap: wrap; }
        .custom-inline-preview img { max-height: 250px !important; max-width: 375px !important; object-fit: cover !important; border-radius: 4px !important; border: 1px solid var(--f-border) !important; cursor: pointer !important; transition: opacity 0.2s; }
        .custom-inline-preview img:hover { opacity: 0.8; }

        .btn-115-inline { font-size:12px; cursor:pointer; padding:4px 8px; background-color: #6f42c1; color: white; border: none; border-radius: 3px; font-weight:bold; transition: background-color 0.2s, opacity 0.2s; white-space: nowrap; vertical-align: middle; }
        .btn-115-inline:hover { opacity: 0.8; }
        .btn-115-inline:disabled { opacity: 0.5; cursor: not-allowed; }

        .custom-keyword-tag { background: var(--f-tag-bg); color: var(--f-tag-text); padding: 2px 6px; border-radius: 3px; font-size: 12px; display: inline-flex; align-items: center; gap: 5px; margin: 2px; border: 1px solid var(--f-border); } .custom-del-btn { color: #dc3545; cursor: pointer; font-weight: bold; }
        .custom-log-item { border-bottom: 1px dashed var(--f-border); padding: 6px 0; font-size: 12px; line-height: 1.4; } .custom-log-item:last-child { border-bottom: none; } .custom-log-reason { color: #dc3545; font-weight: bold; margin-right: 5px; } .custom-log-title { color: var(--f-link); text-decoration: none; word-break: break-all; } .custom-log-title:hover { text-decoration: underline; }
        .custom-form-input { flex:1; padding:4px 6px; font-size:12px; border: 1px solid var(--f-border); background: var(--f-bg); color: var(--f-text); border-radius: 3px; }
        .custom-base-btn { padding: 8px 15px; color: var(--f-btn-text); border: none; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: bold; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: opacity 0.2s; margin-top:5px; } .custom-base-btn:hover { opacity: 0.8; } .custom-base-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    `);
    if (STATE.hideReadPosts) document.body.classList.add('custom-hide-read-mode');

    // ================= 现代化画廊 2.0 =================
    document.body.insertAdjacentHTML('beforeend', `
        <div id="custom-lightbox">
            <span class="lb-close" id="lb-close">×</span>
            <div class="lb-tips">滚轮缩放 | 拖拽平移 | W A S D 键盘漫游</div>
            <div class="lb-nav lb-prev" id="lb-prev">❮</div>
            <img id="lb-img" src="" draggable="false" />
            <div class="lb-nav lb-next" id="lb-next">❯</div>
            <div class="lb-counter" id="lb-counter"></div>
        </div>
    `);

    let currentLbIndex = 0; let currentLocalGallery = [];
    let lbScale = 1, lbX = 0, lbY = 0;
    let isLbDragging = false, startLbX = 0, startLbY = 0;

    const lbContainer = document.getElementById('custom-lightbox');
    const lbImg = document.getElementById('lb-img');
    const lbCounter = document.getElementById('lb-counter');

    const applyLbTransform = (transition = true) => {
        lbImg.style.transition = transition ? 'transform 0.1s ease-out' : 'none';
        lbImg.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
    };
    const resetLbTransform = () => { lbScale = 1; lbX = 0; lbY = 0; applyLbTransform(); };

    const updateLightbox = () => {
        if (!currentLocalGallery || currentLocalGallery.length === 0) return;
        lbImg.src = currentLocalGallery[currentLbIndex];
        lbCounter.innerText = `${currentLbIndex + 1} / ${currentLocalGallery.length}`;
        resetLbTransform();
        if (currentLocalGallery[currentLbIndex + 1]) { new Image().src = currentLocalGallery[currentLbIndex + 1]; }
    };

    window.openLightbox = (src, postImages) => {
        currentLocalGallery = (Array.isArray(postImages) && postImages.length > 0) ? postImages : [src];
        currentLbIndex = currentLocalGallery.indexOf(src);
        if (currentLbIndex === -1) currentLbIndex = 0;
        updateLightbox();
        lbContainer.style.display = 'flex';
    };

    document.getElementById('lb-close').onclick = () => lbContainer.style.display = 'none';
    document.getElementById('lb-prev').onclick = (e) => { e.stopPropagation(); currentLbIndex = (currentLbIndex > 0) ? currentLbIndex - 1 : currentLocalGallery.length - 1; updateLightbox(); };
    document.getElementById('lb-next').onclick = (e) => { e.stopPropagation(); currentLbIndex = (currentLbIndex < currentLocalGallery.length - 1) ? currentLbIndex + 1 : 0; updateLightbox(); };
    lbContainer.onclick = (e) => { if (e.target.id === 'custom-lightbox') lbContainer.style.display = 'none'; };

    lbContainer.addEventListener('wheel', (e) => {
        if(lbContainer.style.display !== 'flex') return;
        e.preventDefault();
        lbScale += e.deltaY > 0 ? -0.15 : 0.15;
        lbScale = Math.max(0.5, Math.min(lbScale, 5));
        applyLbTransform();
    });

    lbImg.addEventListener('mousedown', (e) => {
        if(e.button !== 0) return;
        e.preventDefault();
        isLbDragging = true;
        startLbX = e.clientX - lbX;
        startLbY = e.clientY - lbY;
    });
    document.addEventListener('mousemove', (e) => {
        if(!isLbDragging) return;
        lbX = e.clientX - startLbX;
        lbY = e.clientY - startLbY;
        applyLbTransform(false);
    });
    document.addEventListener('mouseup', () => isLbDragging = false);
    document.addEventListener('mouseleave', () => isLbDragging = false);

    document.addEventListener('keydown', (e) => {
        if (lbContainer.style.display === 'flex') {
            const k = e.key.toLowerCase();
            if (k === 'escape') document.getElementById('lb-close').click();
            if (k === 'arrowleft' || k === 'a') document.getElementById('lb-prev').click();
            if (k === 'arrowright' || k === 'd') document.getElementById('lb-next').click();
            if (k === 'w') { lbY += 40; applyLbTransform(); }
            if (k === 's') { lbY -= 40; applyLbTransform(); }
        }
    });

    // ================= 拖拽框选 =================
    const selectionBox = document.createElement('div'); selectionBox.id = 'custom-selection-box'; document.body.appendChild(selectionBox);
    let isSelecting = false, startX = 0, startY = 0, initialCheckboxStates = new Map();
    document.addEventListener('mousedown', (e) => { if (e.button !== 0 || !e.altKey) return; const targetTag = e.target.tagName.toLowerCase(); if (['a', 'input', 'button', 'img', 'textarea', 'select'].includes(targetTag)) return; if (e.clientX > document.documentElement.clientWidth - 20) return; isSelecting = true; startX = e.clientX; startY = e.clientY; selectionBox.style.left = startX + 'px'; selectionBox.style.top = startY + 'px'; selectionBox.style.width = '0px'; selectionBox.style.height = '0px'; selectionBox.style.display = 'block'; document.querySelectorAll('tbody[id^="normalthread_"]:not(.custom-hidden) .custom-thread-checkbox').forEach(cb => initialCheckboxStates.set(cb, cb.checked)); window.getSelection().removeAllRanges(); });
    document.addEventListener('mousemove', (e) => { if (!isSelecting) return; const currentX = e.clientX, currentY = e.clientY; const left = Math.min(startX, currentX), top = Math.min(startY, currentY); selectionBox.style.left = left + 'px'; selectionBox.style.top = top + 'px'; selectionBox.style.width = Math.abs(currentX - startX) + 'px'; selectionBox.style.height = Math.abs(currentY - startY) + 'px'; const boxRect = selectionBox.getBoundingClientRect(); document.querySelectorAll('tbody[id^="normalthread_"]:not(.custom-hidden) .custom-thread-checkbox').forEach(cb => { const cbRect = cb.getBoundingClientRect(); const isIntersecting = !(cbRect.right < boxRect.left || cbRect.left > boxRect.right || cbRect.bottom < boxRect.top || cbRect.top > boxRect.bottom); cb.checked = isIntersecting ? true : (initialCheckboxStates.get(cb) || false); }); });
    document.addEventListener('mouseup', () => { if (isSelecting) { isSelecting = false; selectionBox.style.display = 'none'; } });

    // ================= 核心请求与解析引擎 =================
    const addViewedTag = (linkNode) => { if (linkNode && !linkNode.parentNode.querySelector('.custom-viewed-tag')) { const tag = document.createElement('span'); tag.className = 'custom-viewed-tag'; tag.innerText = '已浏览'; linkNode.parentNode.appendChild(tag); } };

    const Parser = {
        decodeCF: (doc) => {
            doc.querySelectorAll('.__cf_email__').forEach(el => {
                let cfe = el.getAttribute('data-cfemail');
                if(cfe){
                    let em = '', r = parseInt(cfe.substr(0, 2), 16);
                    for (let j = 2; cfe.length - j; j += 2) {
                        let n = parseInt(cfe.substr(j, 2), 16) ^ r;
                        em += String.fromCharCode(n);
                    }
                    el.replaceWith(document.createTextNode(em));
                }
            });
        },
        extractLinks: (text, data) => {
            if (CONF.res.includes('magnet')) {
                data.links.push(...(text.match(/magnet:\?xt=urn:btih:[0-9a-zA-Z]{32,40}/gi) || []));
                let match; const hashRegex = /(?:特征码|磁力|hash|提取码|代码|链接)[:：\s]*([0-9a-fA-F]{40})\b/gi;
                while ((match = hashRegex.exec(text)) !== null) { data.links.push('magnet:?xt=urn:btih:' + match[1].toUpperCase()); }
            }
            if (CONF.res.includes('ed2k')) data.links.push(...(text.match(/ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|.*?\//gi) || []));
            if (CONF.res.includes('baidu')) data.baiduLinks.push(...(text.match(/(?:https?:\/\/)?pan\.baidu\.com\/s\/[A-Za-z0-9_-]+/gi) || []));
            if (CONF.res.includes('quark')) data.quarkLinks.push(...(text.match(/(?:https?:\/\/)?pan\.quark\.cn\/s\/[A-Za-z0-9_-]+/gi) || []));
            if (CONF.res.includes('thunder')) data.thunderLinks.push(...(text.match(/thunder:\/\/[a-zA-Z0-9=]+/gi) || []));
            if (CONF.res.includes('115')) {
                data.links115.push(...(text.match(/(?:https?:\/\/)?115\.com\/s\/[a-zA-Z0-9_]+/gi) || []));
            }

            if (CONF.res.includes('password') || CONF.res.includes('115')) {
                const pwdRegex = /(提取码|访问码|资源密码|压缩包密码|解压密码|解压码|密码|pwd|code)\s*[:：=为]?\s*([a-zA-Z0-9@!#$%^&*.+-]{3,20})/gi;
                let m;
                while ((m = pwdRegex.exec(text)) !== null) {
                    let rawLabel = m[1].toLowerCase();
                    let t = "🔑 密码";

                    if (rawLabel.includes("提取")) {
                        t = "☁️ 提取码";
                    } else if (rawLabel.includes("访问")) {
                        t = "☁️ 访问码";
                    } else if (rawLabel.includes("解压") || rawLabel.includes("资源") || rawLabel.includes("压缩包")) {
                        t = "📦 解压密码";
                    }
                    data.passwords.push({ type: t, code: m[2] });
                }
            }
        },
        extractAttachments: (postDom, data) => {
            if (!CONF.res.includes('torrent')) return;
            postDom.querySelectorAll('a[href*="mod=attachment"]').forEach(a => {
                const href = a.href;
                const text = (a.innerText || a.title || "未知附件").trim();
                const isImage = a.querySelector('img') || /\.(jpg|jpeg|png|gif|webp)$/i.test(text);
                if (!isImage) {
                    if (!data.torrents.find(item => item.href === href)) {
                        data.torrents.push({ name: text || '💾 下载附件', href: href });
                    }
                }
            });
        }
    };

    const fetchWithRetry = async (url, tbody, retries = 1, timeoutMs = 10000) => {
        const tid = getTid(url);
        if (STATE.threadCache[tid]) return STATE.threadCache[tid];
        const dbData = await CacheDB.get(tid);
        if (dbData) {
            if (!dbData.allImages) dbData.allImages = dbData.images || [];
            STATE.threadCache[tid] = dbData;
            return dbData;
        }

        for (let i = 0; i <= retries; i++) {
            try {
                const html = await new Promise((resolve, reject) => { GM_xmlhttpRequest({ method: "GET", url: url, headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }, timeout: timeoutMs, onload: (res) => { if (res.status >= 200 && res.status < 400) resolve(res.responseText); else reject(new Error('HTTP ' + res.status)); }, ontimeout: () => reject(new Error('Timeout')), onerror: () => reject(new Error('Network Error')) }); });
                const doc = new DOMParser().parseFromString(html, 'text/html');

                Parser.decodeCF(doc);

                let data = { allImages: [], images: [], links: [], baiduLinks: [], quarkLinks: [], thunderLinks: [], links115: [], torrents: [], passwords: [], error: null, isLocked: null };
                const alertMsg = doc.querySelector('.alert_error, .alert_info'); if (alertMsg) { data.error = alertMsg.innerText.replace(/[\r\n]/g, '').trim(); return data; }

                const allPosts = doc.querySelectorAll('#postlist > div[id^="post_"]');
                if (!allPosts || allPosts.length === 0) { data.error = "未找到帖子内容"; return data; }

                const firstPost = allPosts[0];
                let lockedStr = null;

                if (firstPost.querySelector('.locked') || firstPost.innerHTML.includes('隐藏的内容需要回复') || firstPost.innerHTML.includes('回复可见') || firstPost.innerHTML.includes('如果您要查看本帖隐藏内容请')) {
                    lockedStr = '本帖资源还处于隐藏状态，需手动回帖获取';
                } else if (firstPost.innerHTML.includes('购买主题') || firstPost.innerHTML.includes('售价:')) {
                    lockedStr = '主题需购买';
                }
                data.isLocked = lockedStr;

                const allImgElements = firstPost.querySelectorAll('.t_f img, .pcb img');
                data.allImages = Array.from(allImgElements).map(img => img.getAttribute('file') || img.getAttribute('zoomfile') || img.src).filter(src => {
                    if (!src) return false; const s = src.toLowerCase();
                    return !s.includes('smilie') && !s.includes('smiley') && !s.includes('avatar') && !s.includes('torrent.gif') && !s.includes('hrline') && !s.includes('common/') && !s.includes('filetype/') && !s.includes('static/image/');
                });
                data.images = data.allImages.slice(0, CONF.maxImg);

                allPosts.forEach(postDom => {
                    const cleanText = (postDom.innerText || postDom.textContent).replace(/[\u200B-\u200D\uFEFF]/g, '');
                    Parser.extractLinks(cleanText, data);
                    Parser.extractAttachments(postDom, data);
                });

                data.links = [...new Set(data.links)]; data.baiduLinks = [...new Set(data.baiduLinks)]; data.quarkLinks = [...new Set(data.quarkLinks)]; data.thunderLinks = [...new Set(data.thunderLinks)]; data.links115 = [...new Set(data.links115)];

                const seenPwds = new Set();
                data.passwords = data.passwords.filter(p => {
                    const key = p.type + '|' + p.code;
                    if(seenPwds.has(key)) return false;
                    seenPwds.add(key);
                    return true;
                });

                if (!data.error) {
                    STATE.threadCache[tid] = data;
                    await CacheDB.set(tid, data);
                }
                return data;
            } catch (err) { if (i === retries) throw err; await new Promise(r => setTimeout(r, 1500)); }
        }
        return null;
    };

    const loadInlinePreview = (tbody, previewBox, url) => {
        if (previewBox.dataset.loaded) return; previewBox.dataset.loaded = "loading";
        const manualBtn = previewBox.querySelector('.custom-manual-btn');
        if (manualBtn) { manualBtn.innerText = '⏳ 加载中...'; manualBtn.style.cursor = 'wait'; }

        GlobalInlineQueue.addTasks([async () => {
            try {
                const data = await fetchWithRetry(url, tbody, 0);
                if (data && data.images && data.images.length > 0) {
                    previewBox.innerHTML = '';
                    const safeAllImages = data.allImages || data.images || [];
                    data.images.forEach(src => {
                        const img = document.createElement('img'); img.src = src; img.onclick = () => window.openLightbox(src, safeAllImages); previewBox.appendChild(img);
                    });
                } else {
                    previewBox.innerHTML = '<span style="font-size:12px; color:var(--f-log-time); padding:2px 0; display:inline-block; margin-top:5px; user-select:none;">⭕ 本帖无图片</span>';
                }
            } catch(e) {
                if (manualBtn) {
                    manualBtn.innerText = '❌ 加载失败';
                    manualBtn.style.cursor = 'pointer';
                    previewBox.dataset.loaded = "";
                } else {
                    previewBox.style.display = 'none';
                }
            }
        }]);
    };

    const inlinePreviewObserver = new IntersectionObserver((entries, observer) => { entries.forEach(entry => { if (entry.isIntersecting) { const tbody = entry.target; const url = tbody.dataset.url; const previewBox = tbody.querySelector('.custom-inline-preview'); if (url && previewBox) loadInlinePreview(tbody, previewBox, url); observer.unobserve(tbody); } }); }, { rootMargin: '100px' });

    // ================= 规则引擎 (重构精准文字高亮逻辑) =================
    const evaluateThreadRules = (tbody, link, title, url, authorName, authorUID, typeName, cb) => {
        tbody.classList.remove('custom-hidden');
        const isRuleActive = (rule) => rule.zone === 'all' || rule.zone === exactZoneName || rule.zone === configType;

        let originalTitle = link.getAttribute('data-original-title');
        if (!originalTitle) {
            originalTitle = title;
            link.setAttribute('data-original-title', originalTitle);
        }

        const matchedKeywordObj = STATE.blocked.find(r => isRuleActive(r) && originalTitle.includes(r.val));
        const matchedTagObj = STATE.blockedTags.find(r => isRuleActive(r) && (typeName.includes(r.val) || r.val === typeName));
        const matchedUserObj = STATE.blockedUsers.find(r => isRuleActive(r) && (authorName === r.val || authorUID === r.val));

        if (matchedKeywordObj || matchedUserObj || matchedTagObj) {
            tbody.classList.add('custom-hidden'); if (cb) cb.checked = false;
            let reason = ''; if (matchedTagObj) reason = `标签 [${matchedTagObj.val}]`; else if (matchedKeywordObj) reason = `标题 [${matchedKeywordObj.val}]`; else if (matchedUserObj) reason = `用户 [${matchedUserObj.val}]`;
            currentPageInterceptCount++; window.updateFloatCount(); addLog(originalTitle, url, reason);
        } else {
            const activeHighlights = STATE.highlighted.filter(r => isRuleActive(r) && originalTitle.includes(r.val)).sort((a,b) => b.val.length - a.val.length);
            if (activeHighlights.length > 0) {
                let newHtml = originalTitle;
                activeHighlights.forEach(r => {
                    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`(${escapeRegExp(r.val)})`, 'gi');
                    newHtml = newHtml.replace(regex, `<span class="custom-keyword-hl">$1</span>`);
                });
                link.innerHTML = newHtml;
            } else {
                link.innerText = originalTitle;
            }
        }
    };

    let lastCheckedBox = null;
    const processThreadNode = (tbody) => {
        if (tbody.hasAttribute('data-custom-processed')) return; tbody.setAttribute('data-custom-processed', 'true');
        let link = tbody.querySelector('a.xst') || tbody.querySelector('th a[href*="thread-"]'); if (!link) return;
        const title = link.innerText; const url = link.href; tbody.dataset.url = url;
        const authorNode = tbody.querySelector('td.by cite a'); const authorName = authorNode ? authorNode.innerText.trim() : ''; let authorUID = ''; if (authorNode && authorNode.href) { try { authorUID = new URL(authorNode.href, location.href).searchParams.get('uid'); } catch(e) {} }
        const typeNode = tbody.querySelector('th em a'); const typeName = typeNode ? typeNode.innerText.replace(/[\[\]]/g, '').trim() : '';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'custom-thread-checkbox'; cb.value = url; cb.style.cssText = 'width: 16px; height: 16px; margin-right: 8px; vertical-align: middle; cursor: pointer;';
        cb.addEventListener('click', (e) => {
            if (e.shiftKey && lastCheckedBox) { const allCbs = Array.from(document.querySelectorAll('tbody[id^="normalthread_"]:not(.custom-hidden) .custom-thread-checkbox')); const startIdx = allCbs.indexOf(lastCheckedBox), endIdx = allCbs.indexOf(cb); if (startIdx !== -1 && endIdx !== -1) { const min = Math.min(startIdx, endIdx), max = Math.max(startIdx, endIdx); for (let i = min; i <= max; i++) allCbs[i].checked = cb.checked; } }
            lastCheckedBox = cb;
        });
        link.parentNode.insertBefore(cb, link);
        evaluateThreadRules(tbody, link, title, url, authorName, authorUID, typeName, cb);

        const previewBox = document.createElement('div'); previewBox.className = 'custom-inline-preview'; link.parentNode.appendChild(previewBox);

        // 异步缓存前置嗅探
        (async () => {
            const tid = getTid(url);
            const cached = STATE.threadCache[tid] || await CacheDB.get(tid);
            let knownNoImages = false;

            if (cached && !cached.error && !cached.isLocked) {
                if (!cached.allImages || cached.allImages.length === 0) {
                    knownNoImages = true;
                }
            }

            if (knownNoImages) {
                previewBox.innerHTML = '<span style="font-size:12px; color:var(--f-log-time); padding:2px 0; display:inline-block; margin-top:5px; user-select:none;">⭕ 本帖无图片</span>';
            } else {
                if (CONF.autoPreview !== false) {
                    inlinePreviewObserver.observe(tbody);
                } else {
                    const manualBtn = document.createElement('span'); manualBtn.className = 'custom-manual-btn'; manualBtn.innerText = '🖼️ 展开预览图';
                    manualBtn.style.cssText = 'font-size:12px; color:var(--f-link); cursor:pointer; background:var(--f-panel-bg); border:1px solid var(--f-border); padding:2px 6px; border-radius:3px; margin-top:5px; display:inline-block; user-select:none; transition: background 0.2s;';
                    manualBtn.onmouseover = () => { manualBtn.style.background = 'var(--f-hover)'; }; manualBtn.onmouseout = () => { manualBtn.style.background = 'var(--f-panel-bg)'; };
                    manualBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); loadInlinePreview(tbody, previewBox, url); };
                    previewBox.appendChild(manualBtn);
                }
            }
        })();

        if (STATE.readLinks.includes(getTid(url))) { markAsRead(url, tbody); addViewedTag(link); } link.addEventListener('click', () => { markAsRead(url, tbody); addViewedTag(link); });
    };

    const reapplyFilters = () => {
        document.querySelectorAll('tbody[id^="normalthread_"]').forEach(tbody => {
            let link = tbody.querySelector('a.xst') || tbody.querySelector('th a[href*="thread-"]');
            if (!link) return;
            const title = link.innerText, url = link.href;
            const authorNode = tbody.querySelector('td.by cite a');
            const authorName = authorNode ? authorNode.innerText.trim() : '';
            let authorUID = '';
            if (authorNode && authorNode.href) { try { authorUID = new URL(authorNode.href, location.href).searchParams.get('uid'); } catch(e) {} }
            const typeNode = tbody.querySelector('th em a');
            const typeName = typeNode ? typeNode.innerText.replace(/[\[\]]/g, '').trim() : '';
            let cb = tbody.querySelector('.custom-thread-checkbox');
            evaluateThreadRules(tbody, link, title, url, authorName, authorUID, typeName, cb);
        });
    };

    // ================= 帖子正文直推引擎 =================
    const processInlineLinks = () => {
        const rawContainers = document.querySelectorAll('td.t_f, .pcb');
        const postContents = Array.from(rawContainers).filter(c => {
            return !Array.from(rawContainers).some(parent => parent !== c && parent.contains(c));
        });

        postContents.forEach(container => {
            if (container.dataset.pushInjected) return;
            container.dataset.pushInjected = 'true';

            container.querySelectorAll('a').forEach(a => {
                const href = a.href || '';
                if ((href.startsWith('magnet:') || href.startsWith('ed2k:')) && !a.nextElementSibling?.classList.contains('custom-inline-push')) {
                    const btn = document.createElement('button');
                    btn.className = 'btn-115-inline custom-inline-push';
                    btn.innerText = '☁️ 推送115';
                    btn.style.marginLeft = '8px';
                    btn.dataset.link = href;
                    a.parentNode.insertBefore(btn, a.nextSibling);
                }
            });

            const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            let node;
            while (node = walk.nextNode()) {
                if (node.parentNode) {
                    const tag = node.parentNode.tagName;
                    if (['STYLE', 'SCRIPT', 'TEXTAREA', 'A'].includes(tag)) continue;
                    if (node.parentNode.classList && (node.parentNode.classList.contains('custom-magnet-wrap') || node.parentNode.classList.contains('custom-inline-push'))) continue;
                }
                if (node.nodeValue.match(/(magnet:\?xt=urn:btih:[0-9a-zA-Z]{32,40}|ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|.*?\/)/i)) {
                    textNodes.push(node);
                }
            }

            textNodes.forEach(n => {
                const regex = /(magnet:\?xt=urn:btih:[0-9a-zA-Z]{32,40}|ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|.*?\/)/gi;
                const parent = n.parentNode;
                const frag = document.createDocumentFragment();
                let lastIdx = 0;
                let match;
                while ((match = regex.exec(n.nodeValue)) !== null) {
                    frag.appendChild(document.createTextNode(n.nodeValue.substring(lastIdx, match.index)));

                    const linkText = document.createElement('span');
                    linkText.className = 'custom-magnet-wrap';
                    linkText.innerText = match[0];
                    frag.appendChild(linkText);

                    const btn = document.createElement('button');
                    btn.className = 'btn-115-inline custom-inline-push';
                    btn.innerText = '☁️ 推送115';
                    btn.style.marginLeft = '8px';
                    btn.dataset.link = match[0];
                    frag.appendChild(btn);

                    lastIdx = regex.lastIndex;
                }
                frag.appendChild(document.createTextNode(n.nodeValue.substring(lastIdx)));
                parent.replaceChild(frag, n);
            });
        });
    };

    // ================= 详情页全局缓存与【标题翻译】 =================
    const initTranslator = () => {
        const titleEl = document.getElementById('thread_subject');
        const postlist = document.getElementById('postlist');
        // 确保是在帖子详情页，且获取到了标题元素
        if (!titleEl || !postlist) return;

        // 仅在指定板块内生效
        const targetTranslationZones = ['亚洲有码原创', '亚洲无码原创', '素人有码系列', '欧美无码', 'VR视频区', '4K原版'];
        const isTranslationZone = targetTranslationZones.some(zone => ptString.includes(zone));
        if (!isTranslationZone) return;

        // 防止重复注入
        if (document.getElementById('custom-translate-wrap')) return;

        const wrap = document.createElement('span');
        wrap.id = 'custom-translate-wrap';
        wrap.style.cssText = 'margin-left: 10px; font-size: 13px; font-weight: normal; user-select:none; vertical-align: middle; display: inline-flex; gap: 5px;';

        const createTBtn = (text, bg) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.style.cssText = `cursor:pointer; padding:3px 8px; font-size:12px; font-weight:bold; border:none; border-radius:3px; color:#fff; background:${bg}; transition:opacity 0.2s;`;
            btn.onmouseover = () => btn.style.opacity = '0.8';
            btn.onmouseout = () => btn.style.opacity = '1';
            return btn;
        };

        const btnG = createTBtn('🌐 Google 机翻', '#4285F4');
        const btnD = createTBtn('🧠 DeepSeek 翻译', '#6f42c1');

        wrap.append(btnG, btnD);
        // 将翻译按钮群插入到标题文本节点的后面
        titleEl.parentNode.insertBefore(wrap, titleEl.nextSibling);

        const originalText = titleEl.innerText;

        const handleTranslate = (btn, type) => {
            if (btn.disabled) return;
            const oldText = btn.innerText;
            btn.innerText = '翻译中...';
            btn.disabled = true;
            btn.style.opacity = '0.6';

            const onSuccess = (res) => {
                titleEl.innerText = res;
                btn.innerText = '✅ 已翻译';
                btn.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    btn.innerText = oldText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.backgroundColor = type === 'google' ? '#4285F4' : '#6f42c1';
                }, 2000);
            };

            const onError = (msg) => {
                btn.innerText = '❌ ' + msg;
                btn.style.backgroundColor = '#dc3545';
                setTimeout(() => {
                    btn.innerText = oldText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.backgroundColor = type === 'google' ? '#4285F4' : '#6f42c1';
                }, 3000);
            };

            if (type === 'google') {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(originalText)}`,
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            const result = data[0].map(item => item[0]).join("");
                            onSuccess(result);
                        } catch(e) { onError("解析失败"); }
                    },
                    onerror: () => onError("网络故障")
                });
            } else {
                const key = STATE.deepseekKey;
                if (!key) {
                    onError('未配置密钥');
                    alert('🔴 未配置 DeepSeek 密钥！\n\n请点击右下角悬浮球，在【🚀 操作】面板中填写您的 sk-... 密钥。');
                    return;
                }
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://api.deepseek.com/chat/completions",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
                    data: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [
                            {role: "system", content: "你是一个专业的翻译助理。请将下面的成人影视标题翻译成流畅自然的中文标题。保留女优名字（如果有），保留原始番号，去掉多余的特殊符号，只返回翻译后的纯标题文本，不要包含任何解释、注音或其他内容。"},
                            {role: "user", content: originalText}
                        ]
                    }),
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (data.choices && data.choices.length > 0) {
                                onSuccess(data.choices[0].message.content.trim());
                            } else {
                                onError("API异常");
                            }
                        } catch(e) { onError("解析失败"); }
                    },
                    onerror: () => onError("网络故障")
                });
            }
        };

        btnG.onclick = () => handleTranslate(btnG, 'google');
        btnD.onclick = () => handleTranslate(btnD, 'deepseek');
    };

    const autoCacheCurrentPage = async () => {
        const postList = document.querySelector('#postlist');
        if (!postList) return;

        let currentUrl = location.href;
        const tidNode = document.querySelector('link[rel="canonical"]');
        if (tidNode && tidNode.href) currentUrl = tidNode.href;
        const tid = getTid(currentUrl);
        if (!tid) return;

        setTimeout(async () => {
            let data = { allImages: [], images: [], links: [], baiduLinks: [], quarkLinks: [], thunderLinks: [], links115: [], torrents: [], passwords: [], error: null, isLocked: null };
            const allPosts = document.querySelectorAll('#postlist > div[id^="post_"]');
            if (allPosts.length === 0) return;

            const firstPost = allPosts[0];
            let lockedStr = null;
            if (firstPost.querySelector('.locked') || firstPost.innerHTML.includes('隐藏的内容需要回复') || firstPost.innerHTML.includes('回复可见') || firstPost.innerHTML.includes('如果您要查看本帖隐藏内容请')) {
                lockedStr = '本帖资源还处于隐藏状态，需手动回帖获取';
            } else if (firstPost.innerHTML.includes('购买主题') || firstPost.innerHTML.includes('售价:')) {
                lockedStr = '主题需购买';
            }
            data.isLocked = lockedStr;

            const allImgElements = firstPost.querySelectorAll('.t_f img, .pcb img');
            data.allImages = Array.from(allImgElements).map(img => img.getAttribute('file') || img.getAttribute('zoomfile') || img.src).filter(src => {
                if (!src) return false; const s = src.toLowerCase();
                return !s.includes('smilie') && !s.includes('smiley') && !s.includes('avatar') && !s.includes('torrent.gif') && !s.includes('hrline') && !s.includes('common/') && !s.includes('filetype/') && !s.includes('static/image/');
            });
            data.images = data.allImages.slice(0, CONF.maxImg);

            allPosts.forEach(postDom => {
                const cleanText = (postDom.innerText || postDom.textContent).replace(/[\u200B-\u200D\uFEFF]/g, '');
                Parser.extractLinks(cleanText, data);
                Parser.extractAttachments(postDom, data);
            });

            data.links = [...new Set(data.links)]; data.baiduLinks = [...new Set(data.baiduLinks)]; data.quarkLinks = [...new Set(data.quarkLinks)]; data.thunderLinks = [...new Set(data.thunderLinks)]; data.links115 = [...new Set(data.links115)];

            const seenPwds = new Set();
            data.passwords = data.passwords.filter(p => { const key = p.type + '|' + p.code; if(seenPwds.has(key)) return false; seenPwds.add(key); return true; });

            STATE.threadCache[tid] = data;
            await CacheDB.set(tid, data);
        }, 1500);
    };

    // ================= 全局 DOM 观察与初始化 =================
    CacheDB.init().then(() => {
        document.querySelectorAll('tbody[id^="normalthread_"]').forEach(processThreadNode);
        autoCacheCurrentPage();
        initTranslator(); // 激活标题翻译
    });

    const observer = new MutationObserver((mutationsList) => {
        let shouldProcessInline = false;
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'TBODY' && node.id && node.id.startsWith('normalthread_')) {
                            processThreadNode(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('tbody[id^="normalthread_"]').forEach(processThreadNode);
                            if (node.querySelector('td.t_f, .pcb') || node.classList.contains('t_f') || node.classList.contains('pcb')) {
                                shouldProcessInline = true;
                            }
                        }
                    }
                });
            }
        }
        if (shouldProcessInline) processInlineLinks();
    });

    // 适配列表页
    const threadListContainer = document.querySelector('#threadlisttableid');
    if (threadListContainer) observer.observe(threadListContainer, { childList: true, subtree: true });

    // 适配详情页与无缝翻页
    const postListContainer = document.querySelector('#postlist');
    if (postListContainer) observer.observe(postListContainer, { childList: true, subtree: true });
    processInlineLinks();

    const autoLoadNextPage = async () => { if (!STATE.autoLoadNextPage || STATE.isLoadingNextPage || !STATE.nextPageUrl || !threadListContainer) return; STATE.isLoadingNextPage = true; try { const res = await fetch(STATE.nextPageUrl); const text = await res.text(); const doc = new DOMParser().parseFromString(text, 'text/html'); const newThreads = doc.querySelectorAll('tbody[id^="normalthread_"]'); newThreads.forEach(tbody => threadListContainer.appendChild(tbody)); const nextBtn = doc.querySelector('a.nxt'); STATE.nextPageUrl = nextBtn ? nextBtn.href : null; } catch (e) { console.error('加载失败', e); } finally { STATE.isLoadingNextPage = false; } };
    window.addEventListener('scroll', () => { if (STATE.autoLoadNextPage && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 800) autoLoadNextPage(); });

    // ================= GUI 构建 =================
    // 初始化时默认为齿轮图标
    const floatBtn = document.createElement('div'); floatBtn.id = 'custom-float-btn'; floatBtn.innerHTML = `<span id="custom-intercept-count">⚙️</span>`;
    const savedFloatPos = GM_getValue('custom_float_pos', null); if (savedFloatPos) { floatBtn.style.left = savedFloatPos.left + 'px'; floatBtn.style.top = savedFloatPos.top + 'px'; floatBtn.style.right = 'auto'; floatBtn.style.bottom = 'auto'; }
    document.body.appendChild(floatBtn);

    window.updateFloatCount = () => {
        const el = document.getElementById('custom-intercept-count');
        if(el) el.innerText = currentPageInterceptCount === 0 ? '⚙️' : currentPageInterceptCount;
    };

    let isFloatDragging = false, floatStartX, floatStartY, floatInitLeft, floatInitTop;
    floatBtn.addEventListener('mousedown', (e) => { if (e.button !== 0) return; isFloatDragging = false; floatStartX = e.clientX; floatStartY = e.clientY; const rect = floatBtn.getBoundingClientRect(); floatInitLeft = rect.left; floatInitTop = rect.top; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (floatStartX !== undefined && floatStartX !== null) { const moveX = Math.abs(e.clientX - floatStartX); const moveY = Math.abs(e.clientY - floatStartY); if (moveX > 3 || moveY > 3) { isFloatDragging = true; let newL = floatInitLeft + (e.clientX - floatStartX); let newT = floatInitTop + (e.clientY - floatStartY); newL = Math.max(0, Math.min(newL, window.innerWidth - 50)); newT = Math.max(0, Math.min(newT, window.innerHeight - 50)); floatBtn.style.left = newL + 'px'; floatBtn.style.top = newT + 'px'; floatBtn.style.right = 'auto'; floatBtn.style.bottom = 'auto'; } } });
    document.addEventListener('mouseup', () => { if (floatStartX !== null && isFloatDragging) { saveState('custom_float_pos', { left: floatBtn.offsetLeft, top: floatBtn.offsetTop }); } floatStartX = null; });
    floatBtn.addEventListener('click', (e) => { if (isFloatDragging) { e.stopPropagation(); return; } mainWindow.style.display = 'flex'; const w = mainWindow.offsetWidth; const h = mainWindow.offsetHeight; let newLeft = Math.max(0, (window.innerWidth - w) / 2); let newTop = Math.max(0, (window.innerHeight - h) / 2); mainWindow.style.left = newLeft + 'px'; mainWindow.style.top = newTop + 'px'; floatBtn.style.display = 'none'; });

    const mainWindow = document.createElement('div'); mainWindow.id = 'custom-main-window'; mainWindow.style.left = '-9999px'; mainWindow.style.top = '-9999px';

    const header = document.createElement('div'); header.id = 'custom-header'; header.innerHTML = `<span>⚙️ 论坛辅助 (${exactZoneName})</span><span id="custom-min-btn">×</span>`;
    let isDragging = false, dragStartX, dragStartY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => { if (e.target.id === 'custom-min-btn') return; isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY; initialLeft = mainWindow.offsetLeft; initialTop = mainWindow.offsetTop; });
    document.addEventListener('mousemove', (e) => { if (!isDragging) return; let newLeft = initialLeft + (e.clientX - dragStartX), newTop = initialTop + (e.clientY - dragStartY); newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - mainWindow.offsetWidth)); newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40)); mainWindow.style.left = newLeft + 'px'; mainWindow.style.top = newTop + 'px'; });
    document.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; } });
    header.querySelector('#custom-min-btn').onclick = () => { mainWindow.style.display = 'none'; floatBtn.style.display = 'flex'; };

    const tabBar = document.createElement('div'); tabBar.className = 'custom-tab-bar';
    const tabs = [{ id: 'tab-actions', name: '🚀 操作' }, { id: 'tab-pool', name: '📦 收纳' }, { id: 'tab-rules', name: '🛡️ 规则' }, { id: 'tab-logs', name: '📋 日志' }, { id: 'tab-data', name: '💾 数据' }];
    let currentTab = 'tab-actions';
    const switchTab = (targetId) => { currentTab = targetId; mainWindow.querySelectorAll('.custom-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === targetId)); mainWindow.querySelectorAll('.custom-tab-content').forEach(c => c.classList.toggle('active', c.id === targetId)); if (targetId === 'tab-pool') { window.updatePoolUI(); } };
    tabs.forEach((tab, index) => { const btn = document.createElement('button'); btn.className = `custom-tab-btn ${index === 0 ? 'active' : ''}`; btn.dataset.target = tab.id; btn.innerText = tab.name; btn.onclick = () => switchTab(tab.id); tabBar.appendChild(btn); });

    const contentArea = document.createElement('div');
    const createBtn = (text, bgColor) => { const b = document.createElement('button'); b.innerText = text; b.className = 'custom-base-btn'; b.style.backgroundColor = bgColor; b.style.color = '#fff'; return b; };

    // --- Tab 1: 操作 ---
    const tabActions = document.createElement('div'); tabActions.id = 'tab-actions'; tabActions.className = 'custom-tab-content active';
    const uiOptionsRow = document.createElement('div'); uiOptionsRow.style.cssText = 'display: flex; flex-direction:column; gap:5px; margin-bottom: 5px; border-bottom: 1px dashed var(--f-border); padding-bottom: 8px; font-size:13px; font-weight:bold;';

    // API 密钥配置框 (明文 + 显式保存按钮)
    const apiRow = document.createElement('div'); apiRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;';
    apiRow.innerHTML = `<span>DeepSeek API Key：</span>`;
    const apiInputWrap = document.createElement('div'); apiInputWrap.style.cssText = 'display:flex; gap:5px; align-items:center;';
    const apiInput = document.createElement('input'); apiInput.className = 'custom-form-input'; apiInput.type = 'password'; apiInput.placeholder = '输入 sk-...'; apiInput.style.cssText = 'width:115px; font-size:12px;'; apiInput.value = STATE.deepseekKey;
    const apiSaveBtn = document.createElement('button'); apiSaveBtn.innerText = '保存'; apiSaveBtn.style.cssText = 'padding: 2px 8px; font-size:12px; cursor:pointer; background:#28a745; color:white; border:none; border-radius:3px;';
    apiSaveBtn.onclick = () => {
        STATE.deepseekKey = apiInput.value.trim();
        saveState('custom_deepseek_key', STATE.deepseekKey);
        apiSaveBtn.innerText = '已保存';
        setTimeout(() => apiSaveBtn.innerText = '保存', 2000);
    };
    apiInputWrap.append(apiInput, apiSaveBtn);
    apiRow.appendChild(apiInputWrap);

    const themeRow = document.createElement('div'); themeRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center;'; themeRow.innerHTML = `<span>🎨 界面主题外观</span>`; const themeSelect = document.createElement('select'); themeSelect.style.cssText = 'padding: 2px 5px; font-size: 12px; border-radius: 3px; border: 1px solid var(--f-border); background: var(--f-bg); color: var(--f-text); cursor: pointer; outline: none;'; themeSelect.innerHTML = `<option value="auto">🌗 跟随系统</option><option value="dark">🌙 强制深色</option><option value="light">☀️ 强制浅色</option>`; themeSelect.value = STATE.themeMode; themeSelect.onchange = (e) => { STATE.themeMode = e.target.value; saveState('custom_theme_mode', STATE.themeMode); document.documentElement.setAttribute('data-custom-theme', STATE.themeMode); }; themeRow.appendChild(themeSelect);
    const hideReadRow = document.createElement('div'); hideReadRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center;'; hideReadRow.innerHTML = `<span>👁️ 隐藏已浏览帖子</span>`; const hideReadSwitch = document.createElement('input'); hideReadSwitch.type = 'checkbox'; hideReadSwitch.checked = STATE.hideReadPosts; hideReadSwitch.style.cssText = 'cursor:pointer; width:16px; height:16px;'; hideReadSwitch.onchange = (e) => { STATE.hideReadPosts = e.target.checked; saveState('custom_hide_read', STATE.hideReadPosts); if(STATE.hideReadPosts) document.body.classList.add('custom-hide-read-mode'); else document.body.classList.remove('custom-hide-read-mode'); }; hideReadRow.appendChild(hideReadSwitch);
    uiOptionsRow.append(apiRow, themeRow, hideReadRow); tabActions.appendChild(uiOptionsRow);

    const toggleRow = document.createElement('div'); toggleRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;'; toggleRow.innerHTML = `<span style="font-size:13px; font-weight:bold;">🔄 无缝翻页 (滑到底部)</span>`; const toggleSwitch = document.createElement('input'); toggleSwitch.type = 'checkbox'; toggleSwitch.checked = STATE.autoLoadNextPage; toggleSwitch.style.cssText = 'cursor: pointer; width: 16px; height: 16px;'; toggleSwitch.onchange = (e) => { STATE.autoLoadNextPage = e.target.checked; saveState('custom_auto_load', STATE.autoLoadNextPage); }; toggleRow.appendChild(toggleSwitch); tabActions.append(toggleRow, document.createElement('hr'));

    const actionBtnRow = document.createElement('div'); actionBtnRow.style.cssText = 'display:flex; gap:5px;';
    const btnSelectAll = createBtn('全选 / 取消', '#28a745'); btnSelectAll.style.flex = '1';
    btnSelectAll.onclick = () => { let isAllSelected = document.querySelectorAll('.custom-thread-checkbox:checked').length === 0; document.querySelectorAll('tbody[id^="normalthread_"]:not(.custom-hidden) .custom-thread-checkbox').forEach(cb => cb.checked = isAllSelected); };
    const btnOpenSelected = createBtn('🌐 批量打开', '#17a2b8'); btnOpenSelected.style.flex = '1';
    btnOpenSelected.onclick = () => {
        const cbs = Array.from(document.querySelectorAll('.custom-thread-checkbox:checked'));
        if (cbs.length === 0) return alert('请先勾选需要打开的帖子。');
        if (cbs.length > 10) { if(!confirm(`您已勾选 ${cbs.length} 个帖子，同时打开可能会导致浏览器卡顿，确定继续吗？`)) return; }
        cbs.forEach(cb => { GM_openInTab(cb.value, { active: false, insert: true, setParent: true }); const tbody = cb.closest('tbody'); markAsRead(cb.value, tbody); addViewedTag(tbody.querySelector('a.xst') || tbody.querySelector('th a[href*="thread-"]')); });
    };
    actionBtnRow.append(btnSelectAll, btnOpenSelected);

    const btnExtract = createBtn('提取本区资源 (进入收纳池)', '#ffc107'); btnExtract.style.color = '#333';
    btnExtract.onclick = async () => {
        if (STATE.isExtracting) { if (STATE.taskQueue) STATE.taskQueue.stop(); STATE.isExtracting = false; btnExtract.style.backgroundColor = '#ffc107'; btnExtract.style.color = '#333'; btnExtract.innerText = '提取本区资源 (进入收纳池)'; return; }
        const cbs = Array.from(document.querySelectorAll('.custom-thread-checkbox:checked')); if (cbs.length === 0) return alert('请先勾选帖子。');
        STATE.isExtracting = true; btnExtract.style.backgroundColor = '#dc3545'; btnExtract.style.color = '#fff'; STATE.taskQueue = new TaskQueue(1);
        const tasks = cbs.map(cb => async () => {
            const tbody = cb.closest('tbody'); if (tbody.querySelector('.custom-extracted')) return;
            markAsRead(cb.value, tbody); addViewedTag(tbody.querySelector('a.xst') || tbody.querySelector('th a[href*="thread-"]'));
            const box = document.createElement('div'); box.className = 'custom-extracted'; box.style.cssText = 'margin-top:10px; padding-left:25px; display:flex; flex-direction:column; gap:8px;';
            try {
                const data = await fetchWithRetry(cb.value, tbody, 1); if (!data) throw new Error('请求失败');
                const safeLinks = data.links || []; const safeTorrents = data.torrents || [];
                let errorHtml = '';

                if (data.error) { errorHtml = `<div style="color:#dc3545; font-size:12px; font-weight:bold; border-left:3px solid #dc3545; padding-left:8px;">❌ 拦截提示: ${data.error}</div>`; }
                else if (data.isLocked) { errorHtml = `<div style="color:#856404; background-color:#fff3cd; font-size:12px; font-weight:bold; border:1px solid #ffeeba; border-radius:4px; padding:6px 10px;">🔒 ${data.isLocked}</div>`; }

                let resHtml = '';
                if (!data.error && !data.isLocked) {
                    STATE.poolLinks.push(...safeLinks); STATE.poolTorrents.push(...safeTorrents);
                    const resWrap = document.createElement('div'); resWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
                    data.baiduLinks.forEach(m => { resWrap.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; color:var(--f-log-time); font-weight:bold; width:45px;">百度云</span><input class="custom-form-input" type="text" value="${m}" readonly style="width:145px; border-color: #007bff;"><button type="button" class="custom-open-btn" data-link="${m}" style="font-size:12px; cursor:pointer; padding:4px 8px; background-color: #007bff; color: white; border: none; border-radius: 3px;">打开</button></div>`; });
                    data.quarkLinks.forEach(m => { resWrap.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; color:var(--f-log-time); font-weight:bold; width:45px;">夸克盘</span><input class="custom-form-input" type="text" value="${m}" readonly style="width:145px; border-color: #fd7e14;"><button type="button" class="custom-open-btn" data-link="${m}" style="font-size:12px; cursor:pointer; padding:4px 8px; background-color: #fd7e14; color: white; border: none; border-radius: 3px;">打开</button></div>`; });
                    data.thunderLinks.forEach(m => { resWrap.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; color:var(--f-log-time); font-weight:bold; width:45px;">迅雷</span><input class="custom-form-input" type="text" value="${m}" readonly style="width:145px; border-color: #0d6efd;"><button type="button" class="custom-copy-btn" data-link="${m}" style="font-size:12px; cursor:pointer; padding:4px 8px; background-color: #6c757d; color: white; border: none; border-radius: 3px;">复制</button></div>`; });
                    data.links115.forEach(m => { resWrap.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; color:var(--f-log-time); font-weight:bold; width:45px;">115网盘</span><input class="custom-form-input" type="text" value="${m}" readonly style="width:145px; border-color: #6f42c1;"><button type="button" class="custom-open-btn" data-link="${m}" style="font-size:12px; cursor:pointer; padding:4px 8px; background-color: #6f42c1; color: white; border: none; border-radius: 3px;">打开</button></div>`; });

                    safeLinks.forEach(m => { const isEd2k = m.startsWith('ed2k'); const label = isEd2k ? '电驴' : '磁力'; resWrap.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; color:var(--f-log-time); font-weight:bold; width:35px;">${label}</span><input class="custom-form-input" type="text" value="${m}" readonly style="width:105px; border-color: ${isEd2k ? '#17a2b8' : '#28a745'};"><button type="button" class="custom-copy-btn" data-link="${m}" style="font-size:12px; cursor:pointer; padding:4px 8px; background-color: #6c757d; color: white; border: none; border-radius: 3px;">复制</button><button type="button" class="btn-115-inline custom-push115-btn" data-link="${m}">☁️ 推送115</button></div>`; });

                    data.passwords.forEach(p => {
                        let color = p.type.includes("解压") ? "#28a745" : (p.type.includes("提取") ? "#007bff" : (p.type.includes("访问") ? "#6f42c1" : "#e83e8c"));
                        resWrap.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; color:${color}; font-weight:bold;">${p.type}:</span><span style="font-size:12px; font-weight:bold; background:#e9ecef; padding:2px 6px; border-radius:3px; color:#333; user-select:all;" title="点击即可全选复制">${p.code}</span></div>`;
                    });

                    safeTorrents.forEach(t => {
                        const isTorrent = t.name.toLowerCase().includes('.torrent') || t.name.includes('种子');
                        const bgColor = isTorrent ? '#007bff' : '#28a745';
                        const icon = isTorrent ? '💾 下载种子:' : '📥 下载附件:';
                        resWrap.innerHTML += `<div><a href="${t.href}" class="custom-torrent-dl" style="background:${bgColor}; color:#fff; padding:3px 8px; border-radius:3px; font-size:12px; text-decoration:none;">${icon} ${t.name}</a></div>`;
                    });
                    resHtml = resWrap.outerHTML;
                }
                if (!errorHtml && !resHtml) { box.innerHTML = `<div style="color:var(--f-log-time); font-size:12px;">⚠️ 未提取到直链或附件资源 (可能已失效)</div>`; } else { box.innerHTML = errorHtml + resHtml; }
            } catch(e) { box.innerHTML = `<div style="color:#dc3545; font-size:12px; font-weight:bold;">❌ 网络异常: ${e.message}</div>`; throw e; }
            if (box.innerHTML) tbody.querySelector('th').appendChild(box);
            box.querySelectorAll('.custom-open-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.open(btn.dataset.link, '_blank'); }); });
            box.querySelectorAll('.custom-copy-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(btn.dataset.link); btn.innerText = '已复制'; setTimeout(() => btn.innerText = '复制', 2000); }); });
            box.querySelectorAll('.custom-push115-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.pushSingleTo115(btn, btn.dataset.link); }); });
            box.querySelectorAll('.custom-torrent-dl').forEach(a => { a.addEventListener('click', (e) => { e.stopPropagation(); }); });
            if (currentTab === 'tab-pool' && typeof window.updatePoolUI === 'function') window.updatePoolUI();
        });
        STATE.taskQueue.onProgress = (stats) => { btnExtract.innerText = `🛑 停止 (成:${stats.success} 败:${stats.fail} 剩:${stats.pending})`; };
        STATE.taskQueue.addTasks(tasks); await STATE.taskQueue.run();
        STATE.isExtracting = false; btnExtract.style.backgroundColor = '#ffc107'; btnExtract.style.color = '#333'; btnExtract.innerText = '提取本区资源 (进入收纳池)';
    };
    tabActions.append(actionBtnRow, btnExtract);

    // --- Tab 2: 📦 收纳池 ---
    const tabPool = document.createElement('div'); tabPool.id = 'tab-pool'; tabPool.className = 'custom-tab-content';
    const poolStats = document.createElement('div'); poolStats.style.cssText = 'font-size:13px; font-weight:bold; margin-bottom:5px;';
    const status115Row = document.createElement('div'); status115Row.style.cssText = 'font-size:12px; font-weight:bold; padding:6px; background:var(--f-tag-bg); border-radius:4px; display:flex; justify-content:space-between; align-items:center;'; status115Row.innerHTML = `<span>☁️ 115云端状态:</span><span id="status-115-text">🔄 检测中...</span>`;
    const btnPush115 = createBtn('🚀 批量推送全部链接至 115', '#6f42c1'); btnPush115.disabled = true;
    btnPush115.onclick = async () => {
        if (!STATE.auth115 || !STATE.auth115.loggedIn || !STATE.auth115.sign) return alert('缺少115安全签名，请刷新页面重试');
        btnPush115.disabled = true; let success = 0, fail = 0;
        for (let i = 0; i < STATE.poolLinks.length; i++) { btnPush115.innerText = `🔄 批量推送中 (${i+1}/${STATE.poolLinks.length})...`; await new Promise(r => { GM_xmlhttpRequest({ method: 'POST', url: 'https://115.com/web/lixian/?ct=lixian&ac=add_task_url', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, data: `url=${encodeURIComponent(STATE.poolLinks[i])}&sign=${STATE.auth115.sign}&time=${STATE.auth115.time}`, onload: (res) => { try { const d = JSON.parse(res.responseText); if (d.state) success++; else fail++; } catch(e) { fail++; } r(); }, onerror: () => { fail++; r(); } }); }); await new Promise(r => setTimeout(r, 400)); }
        btnPush115.innerText = `✅ 批量推送完成 (成:${success} 败:${fail})`; setTimeout(() => { btnPush115.innerText = '🚀 批量推送全部链接至 115'; btnPush115.disabled = STATE.poolLinks.length === 0; }, 3000);
    };
    const btnCopyAllMag = createBtn('📋 一键复制全部链接 (磁力/电驴)', '#28a745'); btnCopyAllMag.onclick = () => { if(STATE.poolLinks.length === 0) return alert('没有提取到链接。'); navigator.clipboard.writeText(STATE.poolLinks.join('\n')); btnCopyAllMag.innerText = '✅ 复制成功!'; setTimeout(() => btnCopyAllMag.innerText = '📋 一键复制全部链接 (磁力/电驴)', 2000); };
    const btnClearPool = createBtn('🗑️ 清空收纳池', '#dc3545'); btnClearPool.onclick = () => { STATE.poolLinks = []; STATE.poolTorrents = []; window.updatePoolUI(); };
    tabPool.append(poolStats, status115Row, btnPush115, btnCopyAllMag, document.createElement('hr'), btnClearPool);

    window.updatePoolUI = async () => {
        poolStats.innerHTML = `已收集: <span style="color:#28a745">${STATE.poolLinks.length} 个链接</span> | <span style="color:#007bff">${STATE.poolTorrents.length} 个资源</span>`; btnCopyAllMag.disabled = STATE.poolLinks.length === 0;
        const txt115 = document.getElementById('status-115-text'); txt115.innerHTML = '🔄 检测中...'; const auth = await window.check115Auth();
        if (auth.loggedIn) {
            txt115.innerHTML = '<span style="color:#28a745">🟢 已登录</span>';
            btnPush115.disabled = STATE.poolLinks.length === 0;
        } else {
            txt115.innerHTML = '<span style="color:#dc3545; margin-right:6px;">🔴 未登录</span><button id="go-login-115" style="padding:2px 8px; font-size:12px; cursor:pointer; background-color:#007bff; color:#fff; border:none; border-radius:3px; box-shadow:0 1px 2px rgba(0,0,0,0.2);">点我去登录</button>';
            document.getElementById('go-login-115').onclick = () => GM_openInTab('https://115.com/?ct=offline&ac=space', {active:true});
            btnPush115.disabled = true;
        }
    };
    window.updatePoolUI();

    // --- Tab 3: 规则 ---
    const tabRules = document.createElement('div'); tabRules.id = 'tab-rules'; tabRules.className = 'custom-tab-content';
    const createKeywordManager = (titleText, stateArray, stateKey, placeholderText) => {
        const wrap = document.createElement('div'); wrap.innerHTML = `<div style="font-weight:bold; font-size:13px; margin-bottom:5px;">${titleText}</div>`;
        const inputRow = document.createElement('div'); inputRow.style.cssText = 'display: flex; gap: 5px;';
        const input = document.createElement('input'); input.className = 'custom-form-input'; input.placeholder = placeholderText;

        const scopeSelect = document.createElement('select'); scopeSelect.className = 'custom-form-input'; scopeSelect.style.cssText = 'flex: 0 0 85px; padding: 2px 0px; cursor: pointer;';
        scopeSelect.innerHTML = `<option value="all">🌐 全局</option><option value="${exactZoneName}">📍 ${exactZoneName}</option>`;

        const btn = document.createElement('button'); btn.innerText = '添加'; btn.style.cssText = 'padding: 2px 10px; font-size:12px; cursor:pointer; background:#6c757d; color:#fff; border:none; border-radius:3px;';
        inputRow.append(input, scopeSelect, btn);
        const listDiv = document.createElement('div'); listDiv.style.cssText = 'display: flex; flex-wrap: wrap; margin-top: 5px; max-height: 80px; overflow-y: auto;';

        const LEGACY_ZONES = { 'bt_movie': '电影区', 'general': '综合区', 'repost': '转帖区', 'ai_sale': 'AI/出售', 'netizen_original': '原创区', 'default': '其他区' };

        const render = () => {
            listDiv.innerHTML = '';
            stateArray.forEach(rule => {
                const tag = document.createElement('span'); tag.className = 'custom-keyword-tag';
                const zoneDisplay = rule.zone === 'all' ? '全局' : (LEGACY_ZONES[rule.zone] || rule.zone);
                const badgeColor = rule.zone === 'all' ? '#28a745' : '#007bff';

                tag.innerHTML = `<span style="background:${badgeColor}; color:white; padding:1px 3px; border-radius:2px; font-size:10px;">${zoneDisplay}</span> ${rule.val} <span class="custom-del-btn">×</span>`;
                tag.querySelector('.custom-del-btn').onclick = () => { stateArray.splice(stateArray.indexOf(rule), 1); saveState(stateKey, stateArray); render(); reapplyFilters(); };
                listDiv.appendChild(tag);
            });
        };
        render();
        btn.onclick = () => { const val = input.value.trim(); const scope = scopeSelect.value; if (val && !stateArray.find(r => r.val === val && r.zone === scope)) { stateArray.push({ val: val, zone: scope }); saveState(stateKey, stateArray); input.value = ''; render(); reapplyFilters(); } };
        wrap.append(inputRow, listDiv); return wrap;
    };
    tabRules.appendChild(createKeywordManager('🏷️ 屏蔽指定分类/标签', STATE.blockedTags, 'custom_blocked_tags', '完整标签名(如: 求助)'));
    tabRules.appendChild(createKeywordManager('🚫 屏蔽标题关键词', STATE.blocked, 'custom_blocked_keywords', '输入屏蔽词'));
    tabRules.appendChild(createKeywordManager('👤 屏蔽指定用户', STATE.blockedUsers, 'custom_blocked_users', '账号或UID'));
    tabRules.appendChild(createKeywordManager('⭐ 高亮标题关键词', STATE.highlighted, 'custom_highlight_keywords', '输入高亮词'));

    // --- Tab 4: 日志 ---
    const tabLogs = document.createElement('div'); tabLogs.id = 'tab-logs'; tabLogs.className = 'custom-tab-content'; const logHeader = document.createElement('div'); logHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--f-border); padding-bottom: 5px; margin-bottom: 5px;'; logHeader.innerHTML = '<span style="font-weight:bold; font-size:13px;">当次拦截记录 (刷新清空)</span>'; const clearLogBtn = document.createElement('button'); clearLogBtn.innerText = '清空'; clearLogBtn.style.cssText = 'padding: 2px 8px; background-color: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;'; clearLogBtn.onclick = () => { STATE.interceptionLog = []; window.updateLogPanel(); }; logHeader.appendChild(clearLogBtn); const logListContainer = document.createElement('div'); logListContainer.style.cssText = 'overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 4px;'; tabLogs.append(logHeader, logListContainer);
    window.updateLogPanel = () => { logListContainer.innerHTML = ''; if (STATE.interceptionLog.length === 0) { logListContainer.innerHTML = '<div style="color:var(--f-log-time); font-size:12px; text-align:center; margin-top:10px;">暂无拦截记录</div>'; return; } STATE.interceptionLog.forEach(log => { const item = document.createElement('div'); item.className = 'custom-log-item'; item.innerHTML = `<div><span class="custom-log-time">[${log.time}]</span><span class="custom-log-reason">${log.reason}</span></div><a href="${log.url}" target="_blank" class="custom-log-title">${log.title}</a>`; logListContainer.appendChild(item); }); }; window.updateLogPanel();

    // --- Tab 5: 数据 ---
    const tabData = document.createElement('div'); tabData.id = 'tab-data'; tabData.className = 'custom-tab-content'; tabData.innerHTML = `<div style="font-size:12px; color:var(--f-log-time); margin-bottom:10px;">您可以将当前所有的屏蔽规则、已读记录备份为本地文件，防止清理缓存后丢失。</div>`;
    const btnExport = createBtn('📤 导出配置备份 (.json)', '#17a2b8'); btnExport.onclick = () => { const dataStr = JSON.stringify({ blocked: STATE.blocked, blockedUsers: STATE.blockedUsers, blockedTags: STATE.blockedTags, highlighted: STATE.highlighted, readLinks: STATE.readLinks, autoLoadNextPage: STATE.autoLoadNextPage, themeMode: STATE.themeMode, hideReadPosts: STATE.hideReadPosts, deepseekKey: STATE.deepseekKey }, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SHT_Script_Backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); };
    const importInput = document.createElement('input'); importInput.type = 'file'; importInput.accept = '.json'; importInput.style.display = 'none';
    importInput.onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const parsed = JSON.parse(ev.target.result); if (parsed.blocked) saveState('custom_blocked_keywords', migrateRules(parsed.blocked)); if (parsed.blockedUsers) saveState('custom_blocked_users', migrateRules(parsed.blockedUsers)); if (parsed.blockedTags) saveState('custom_blocked_tags', migrateRules(parsed.blockedTags)); if (parsed.highlighted) saveState('custom_highlight_keywords', migrateRules(parsed.highlighted)); if (parsed.readLinks) saveState('custom_read_links', parsed.readLinks); if (parsed.autoLoadNextPage !== undefined) saveState('custom_auto_load', parsed.autoLoadNextPage); if (parsed.themeMode !== undefined) saveState('custom_theme_mode', parsed.themeMode); if (parsed.hideReadPosts !== undefined) saveState('custom_hide_read', parsed.hideReadPosts); if (parsed.deepseekKey !== undefined) saveState('custom_deepseek_key', parsed.deepseekKey); alert('数据恢复成功！网页即将刷新...'); location.reload(); } catch(err) { alert('文件格式读取失败'); } }; reader.readAsText(file); };
    const btnImport = createBtn('📥 导入配置恢复', '#6c757d'); btnImport.onclick = () => importInput.click();
    const btnReset = createBtn('💥 彻底重置脚本 (清除所有缓存与配置)', '#dc3545'); btnReset.style.marginTop = '15px';
    btnReset.onclick = () => { if (confirm('警告：此操作将清空所有屏蔽规则、已读记录、悬浮球位置以及文章缓存！\n强烈建议先点击上方的“导出配置”进行备份。\n\n确定要彻底重置并炸毁所有数据吗？')) { try { const keys = typeof GM_listValues === 'function' ? GM_listValues() : ['custom_blocked_keywords', 'custom_blocked_users', 'custom_blocked_tags', 'custom_highlight_keywords', 'custom_read_links', 'custom_auto_load', 'custom_theme_mode', 'custom_panel_pos', 'custom_float_pos', 'custom_hide_read', 'custom_deepseek_key']; keys.forEach(k => { try { GM_deleteValue(k); } catch(e) { GM_setValue(k, ''); } }); } catch(e) {} try { indexedDB.deleteDatabase('SHT_Super_Cache'); indexedDB.deleteDatabase('SHT_Super_Cache_V2'); indexedDB.deleteDatabase('SHT_Super_Cache_V3'); indexedDB.deleteDatabase('SHT_Super_Cache_V4'); } catch(e) {} alert('💥 核心缓存与本地配置已全部炸毁！\n网页即将自动刷新，迎接纯净版...'); location.reload(); } };
    tabData.append(btnExport, btnImport, importInput, btnReset);

    contentArea.append(tabActions, tabPool, tabRules, tabLogs, tabData); mainWindow.append(header, tabBar, contentArea); document.body.appendChild(mainWindow);

})();

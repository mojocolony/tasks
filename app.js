(() => {
  const STORAGE_KEY = 'tasks-v2';
  const LEGACY_STORAGE_KEYS = ['things-to-do-v2', 'things-to-do-v1'];
  const DBX_KEY = 'tasks-dropbox-key';
  const DBX_TOKEN = 'tasks-dropbox-token';
  const DBX_REFRESH = 'tasks-dropbox-refresh';
  const DBX_VERIFIER = 'tasks-dropbox-verifier';
  const DBX_STATE = 'tasks-dropbox-state';
  const DROPBOX_FILE = '/tasks.json';
  const LEGACY_DROPBOX_FILE = '/things-to-do.json';
  const COLLAPSED_FOLDERS_KEY = 'tasks-collapsed-folders';
  const LEGACY_COLLAPSED_FOLDERS_KEY = 'things-to-do-collapsed-folders';
  const FONT_KEY = 'tasks-font-family';
  const TEXT_SIZE_KEY = 'tasks-text-size';
  const TASK_SORT_KEY = 'tasks-task-sort';
  const SIDEBAR_SORT_KEY = 'tasks-sidebar-sort';
  const SYNC_DEBOUNCE = 1000;

  const now = () => Date.now();
  const uuid = () => crypto.randomUUID();
  const defaultState = () => ({
    version: 2,
    tasks: [],
    lists: [],
    folders: [],
    deletedTasks: {},
    deletedLists: {},
    deletedFolders: {},
    updatedAt: now()
  });

  migrateRenamedLocalKeys();

  let state = loadState();
  let currentView = {type: 'inbox', id: null};
  let editingTaskId = null;
  let editingListId = null;
  let editingFolderId = null;
  let draggedId = null;
  let dropTarget = null;
  let sidebarDrag = null;
  let sidebarDropTarget = null;
  let syncTimer = null;
  let toastTimer = null;
  let collapsedFolders = loadCollapsedFolders();

  const $ = id => document.getElementById(id);
  const els = {
    listTree: $('listTree'), noListsHint: $('noListsHint'), taskList: $('taskList'), emptyState: $('emptyState'),
    viewTitle: $('viewTitle'), viewSubtitle: $('viewSubtitle'), editCurrentListBtn: $('editCurrentListBtn'),
    search: $('searchInput'), tagFilter: $('tagFilter'), taskDialog: $('taskDialog'), listDialog: $('listDialog'),
    folderDialog: $('folderDialog'), settingsDialog: $('settingsDialog'), quickAddDialog: $('quickAddDialog'), quickAddTitle: $('quickAddTitle'), taskTitle: $('taskTitle'),
    taskListSelect: $('taskListSelect'), taskPriority: $('taskPriority'), taskToday: $('taskToday'), taskDue: $('taskDue'),
    taskTags: $('taskTags'), taskNotes: $('taskNotes'), taskError: $('taskError'), deleteTaskBtn: $('deleteTaskBtn'),
    listName: $('listName'), listFolderSelect: $('listFolderSelect'), listError: $('listError'), deleteListBtn: $('deleteListBtn'),
    folderName: $('folderName'), folderError: $('folderError'), deleteFolderBtn: $('deleteFolderBtn'),
    syncStatus: $('syncStatus'), dropboxKey: $('dropboxKey'), dropboxStatus: $('dropboxStatus'),
    connectDropboxBtn: $('connectDropboxBtn'), disconnectDropboxBtn: $('disconnectDropboxBtn'), toast: $('toast'),
    appFont: $('appFont'), taskTextSize: $('taskTextSize'), appearancePreviewText: $('appearancePreviewText'),
    taskSortSelect: $('taskSortSelect'), sidebarSortSelect: $('sidebarSortSelect'),
    sidebar: $('sidebar'), sidebarBackdrop: $('sidebarBackdrop')
  };

  const FONT_STACKS = {
    system: 'Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    avenir: 'Avenir,"Avenir Next",Helvetica,Arial,sans-serif',
    georgia: 'Georgia,"Times New Roman",serif',
    charter: 'Charter,"Bitstream Charter",Georgia,serif',
    times: '"Times New Roman",Times,serif',
    mono: 'Menlo,Monaco,"Courier New",monospace'
  };

  function loadAppearance(){
    const font = localStorage.getItem(FONT_KEY) || 'system';
    const size = localStorage.getItem(TEXT_SIZE_KEY) || '15';
    applyAppearance(font, size, false);
  }

  function applyAppearance(font, size, persist=true){
    if(!FONT_STACKS[font]) font = 'system';
    if(!['13','14','15','16','17','18','20'].includes(String(size))) size = '15';
    document.documentElement.style.setProperty('--app-font', FONT_STACKS[font]);
    document.documentElement.style.setProperty('--task-text-size', `${size}px`);
    if(els.appFont) els.appFont.value = font;
    if(els.taskTextSize) els.taskTextSize.value = String(size);
    if(persist){
      localStorage.setItem(FONT_KEY, font);
      localStorage.setItem(TEXT_SIZE_KEY, String(size));
    }
  }

  function resetAppearance(){
    localStorage.removeItem(FONT_KEY);
    localStorage.removeItem(TEXT_SIZE_KEY);
    applyAppearance('system','15',false);
  }


  function migrateRenamedLocalKeys(){
    const keyPairs = [
      [DBX_KEY, 'things-to-do-dropbox-key'],
      [DBX_TOKEN, 'things-to-do-dropbox-token'],
      [DBX_REFRESH, 'things-to-do-dropbox-refresh'],
      [COLLAPSED_FOLDERS_KEY, LEGACY_COLLAPSED_FOLDERS_KEY]
    ];
    keyPairs.forEach(([nextKey, oldKey]) => {
      if(localStorage.getItem(nextKey) == null && localStorage.getItem(oldKey) != null){
        localStorage.setItem(nextKey, localStorage.getItem(oldKey));
      }
    });
  }

  function loadCollapsedFolders(){
    try {
      const raw = JSON.parse(localStorage.getItem(COLLAPSED_FOLDERS_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }

  function saveCollapsedFolders(){
    localStorage.setItem(COLLAPSED_FOLDERS_KEY, JSON.stringify([...collapsedFolders]));
  }

  function localTodayISO(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function isTodayTask(t){
    return !!t.today || (!!t.due && t.due === localTodayISO());
  }

  function loadState(){
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if(saved) return normalize(JSON.parse(saved));
      for(const legacyKey of LEGACY_STORAGE_KEYS){
        const legacy = localStorage.getItem(legacyKey);
        if(!legacy) continue;
        const migrated = normalize(JSON.parse(legacy));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch {}
    return defaultState();
  }

  function migrateLegacy(raw){
    const out = defaultState();
    const sourceTasks = Array.isArray(raw?.tasks) ? raw.tasks : [];
    const needsUpcoming = sourceTasks.some(t => t.list === 'upcoming');
    const needsSomeday = sourceTasks.some(t => t.list === 'someday');
    const legacyLists = {};
    if(needsUpcoming){
      const id = 'legacy-upcoming'; legacyLists.upcoming = id;
      out.lists.push({id, name:'Upcoming', folderId:null, order:0, createdAt:raw.updatedAt||now(), updatedAt:raw.updatedAt||now()});
    }
    if(needsSomeday){
      const id = 'legacy-someday'; legacyLists.someday = id;
      out.lists.push({id, name:'Someday', folderId:null, order:1, createdAt:raw.updatedAt||now(), updatedAt:raw.updatedAt||now()});
    }
    out.tasks = sourceTasks.map((t,i) => {
      const wasToday = t.list === 'today';
      const listId = legacyLists[t.list] || null;
      return {
        id:t.id||uuid(), title:t.title||'Untitled task', listId,
        today:wasToday, priority:t.priority||'', due:t.due||'', tags:Array.isArray(t.tags)?t.tags:[], notes:t.notes||'',
        completed:!!t.completed, order:Number.isFinite(t.order)?t.order:i, todayOrder:Number.isFinite(t.order)?t.order:i,
        createdAt:t.createdAt||now(), updatedAt:t.updatedAt||now(), completedAt:t.completedAt||null
      };
    });
    out.updatedAt = raw?.updatedAt || now();
    return out;
  }

  function normalize(raw){
    if(!raw || raw.version !== 2 || (Array.isArray(raw.tasks) && raw.tasks.some(t => Object.prototype.hasOwnProperty.call(t,'list')))){
      raw = migrateLegacy(raw || {});
    }
    const out = {...defaultState(), ...raw, version:2};
    out.deletedTasks = validTombstones(out.deletedTasks);
    out.deletedLists = validTombstones(out.deletedLists);
    out.deletedFolders = validTombstones(out.deletedFolders);
    out.folders = Array.isArray(out.folders) ? out.folders.map((f,i)=>({
      id:f.id||uuid(), name:f.name||'Untitled Folder', order:Number.isFinite(f.order)?f.order:i,
      sidebarOrder:Number.isFinite(f.sidebarOrder)?f.sidebarOrder:null,
      createdAt:f.createdAt||now(), updatedAt:f.updatedAt||now()
    })) : [];
    const folderIds = new Set(out.folders.map(f=>f.id));
    out.lists = Array.isArray(out.lists) ? out.lists.map((l,i)=>({
      id:l.id||uuid(), name:l.name||'Untitled List', folderId:folderIds.has(l.folderId)?l.folderId:null,
      order:Number.isFinite(l.order)?l.order:i, sidebarOrder:Number.isFinite(l.sidebarOrder)?l.sidebarOrder:null,
      createdAt:l.createdAt||now(), updatedAt:l.updatedAt||now()
    })) : [];
    const listIds = new Set(out.lists.map(l=>l.id));
    out.tasks = Array.isArray(out.tasks) ? out.tasks.map((t,i)=>({
      id:t.id||uuid(), title:t.title||'Untitled task', listId:listIds.has(t.listId)?t.listId:null,
      today:!!t.today, priority:t.priority||'', due:t.due||'', tags:Array.isArray(t.tags)?t.tags:[], notes:t.notes||'',
      completed:!!t.completed, order:Number.isFinite(t.order)?t.order:i,
      todayOrder:Number.isFinite(t.todayOrder)?t.todayOrder:(Number.isFinite(t.order)?t.order:i),
      createdAt:t.createdAt||now(), updatedAt:t.updatedAt||now(), completedAt:t.completedAt||null
    })) : [];
    applyTombstones(out);
    repairReferences(out);
    ensureSidebarOrder(out);
    return out;
  }

  function validTombstones(obj){
    if(!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const clean = {};
    Object.entries(obj).forEach(([id,ts]) => { if(Number.isFinite(Number(ts))) clean[id] = Number(ts); });
    return clean;
  }

  function applyTombstones(s){
    s.tasks = s.tasks.filter(x => Number(s.deletedTasks[x.id]||0) < Number(x.updatedAt||0));
    s.lists = s.lists.filter(x => Number(s.deletedLists[x.id]||0) < Number(x.updatedAt||0));
    s.folders = s.folders.filter(x => Number(s.deletedFolders[x.id]||0) < Number(x.updatedAt||0));
  }

  function repairReferences(s){
    const folderIds = new Set(s.folders.map(f=>f.id));
    s.lists.forEach(l => { if(l.folderId && !folderIds.has(l.folderId)) l.folderId = null; });
    const listIds = new Set(s.lists.map(l=>l.id));
    s.tasks.forEach(t => { if(t.listId && !listIds.has(t.listId)) t.listId = null; });
  }

  function ensureSidebarOrder(s){
    const topLists = s.lists.filter(l=>!l.folderId).sort(byOrderName);
    const folders = [...s.folders].sort(byOrderName);
    const existing = [...topLists,...folders].filter(x=>Number.isFinite(x.sidebarOrder));
    let next = existing.length ? Math.max(...existing.map(x=>Number(x.sidebarOrder))) + 1 : 0;
    if(existing.length===0){
      [...topLists,...folders].forEach((x,i)=>x.sidebarOrder=i);
      return;
    }
    [...topLists,...folders].forEach(x=>{ if(!Number.isFinite(x.sidebarOrder)) x.sidebarOrder=next++; });
  }

  function taskSortMode(){
    const mode = localStorage.getItem(TASK_SORT_KEY) || 'manual';
    return ['manual','due','priority','title','newest','oldest'].includes(mode) ? mode : 'manual';
  }

  function sidebarSortMode(){
    return localStorage.getItem(SIDEBAR_SORT_KEY)==='alpha' ? 'alpha' : 'manual';
  }

  function nextTopLevelOrder(){
    const vals = [...state.folders, ...state.lists.filter(l=>!l.folderId)].map(x=>Number(x.sidebarOrder)).filter(Number.isFinite);
    return vals.length ? Math.max(...vals)+1 : 0;
  }

  function saveState({sync=true}={}){
    state.updatedAt = now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    if(sync) scheduleSync();
  }

  function scheduleSync(){
    if(!localStorage.getItem(DBX_TOKEN)) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(()=>syncDropbox().catch(()=>{}), SYNC_DEBOUNCE);
  }

  function render(){
    renderSidebar();
    renderTags();
    renderTaskLocationOptions();
    renderTasks();
    renderSyncStatus();
  }

  function renderSidebar(){
    const activeTasks = state.tasks.filter(t=>!t.completed);
    $('countInbox').textContent = activeTasks.filter(t=>!t.listId).length;
    $('countToday').textContent = activeTasks.filter(isTodayTask).length;
    $('countCompleted').textContent = state.tasks.filter(t=>t.completed).length;

    document.querySelectorAll('.nav-row[data-view]').forEach(btn => {
      btn.classList.toggle('active', currentView.type === btn.dataset.view);
    });

    const mode = sidebarSortMode();
    if(els.sidebarSortSelect) els.sidebarSortSelect.value = mode;
    const byAlpha = (a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'});
    const bySidebarOrder = (a,b)=>(Number(a.sidebarOrder)||0)-(Number(b.sidebarOrder)||0) || byAlpha(a,b);
    const childSort = mode==='alpha' ? byAlpha : byOrderName;
    const topItems = [
      ...state.lists.filter(l=>!l.folderId).map(item=>({type:'list',item})),
      ...state.folders.map(item=>({type:'folder',item}))
    ].sort((a,b)=>mode==='alpha' ? byAlpha(a.item,b.item) : bySidebarOrder(a.item,b.item));
    const parts = [];

    topItems.forEach(entry => {
      if(entry.type==='list'){
        parts.push(listButtonHtml(entry.item,{topLevel:true,manual:mode==='manual'}));
        return;
      }
      const folder=entry.item;
      const children = state.lists.filter(l=>l.folderId===folder.id).sort(childSort);
      const collapsed = collapsedFolders.has(folder.id);
      parts.push(`
        <div class="folder-group sidebar-entity" data-sidebar-type="folder" data-sidebar-id="${escAttr(folder.id)}">
          <div class="folder-head">
            <button class="sidebar-grab" type="button" draggable="${mode==='manual'?'true':'false'}" ${mode==='manual'?'':'hidden'} data-drag-type="folder" data-drag-id="${escAttr(folder.id)}" aria-label="Drag folder" title="Drag folder">⠿</button>
            <button class="folder-row folder-toggle" type="button" data-folder-id="${escAttr(folder.id)}" aria-expanded="${collapsed?'false':'true'}" aria-label="${collapsed?'Expand':'Collapse'} ${escAttr(folder.name)}" title="${collapsed?'Expand':'Collapse'} folder">
              <span class="folder-label"><span class="folder-chevron" aria-hidden="true">${collapsed?'▸':'▾'}</span>${esc(folder.name)}</span>
              <span class="count-pill">${children.length}</span>
            </button>
            <button class="row-more folder-edit" type="button" data-folder-id="${escAttr(folder.id)}" aria-label="Edit ${escAttr(folder.name)}">•••</button>
          </div>
          <div class="folder-lists${collapsed?' is-collapsed':''}" aria-hidden="${collapsed?'true':'false'}">${children.map(l=>listButtonHtml(l,{topLevel:false,manual:mode==='manual'})).join('')}</div>
        </div>`);
    });

    els.listTree.innerHTML = parts.join('');
    els.noListsHint.hidden = state.lists.length > 0 || state.folders.length > 0;

    els.listTree.querySelectorAll('.list-row').forEach(btn => {
      btn.addEventListener('click',()=>{
        currentView = {type:'list', id:btn.dataset.listId};
        els.search.value=''; els.tagFilter.value=''; render(); closeMobileSidebar();
      });
      bindSidebarDropTarget(btn,{type:'list',listId:btn.dataset.listId});
    });
    els.listTree.querySelectorAll('.folder-toggle').forEach(btn => {
      btn.addEventListener('click',()=>{
        const id=btn.dataset.folderId;
        if(collapsedFolders.has(id)) collapsedFolders.delete(id); else collapsedFolders.add(id);
        saveCollapsedFolders(); renderSidebar();
      });
      bindFolderListDropTarget(btn,btn.dataset.folderId);
    });
    els.listTree.querySelectorAll('.folder-edit').forEach(btn => btn.addEventListener('click',()=>openFolder(btn.dataset.folderId)));
    els.listTree.querySelectorAll('.sidebar-grab').forEach(handle=>bindSidebarDragHandle(handle));
    els.listTree.querySelectorAll('.sidebar-entity').forEach(item=>bindSidebarEntityDrop(item));
  }

  function listButtonHtml(list,{topLevel=false,manual=true}={}){
    const count = state.tasks.filter(t=>!t.completed && t.listId===list.id).length;
    const active = currentView.type==='list' && currentView.id===list.id;
    return `<div class="sidebar-list-item sidebar-entity${topLevel?' top-level-list':''}" data-sidebar-type="list" data-sidebar-id="${escAttr(list.id)}">
      <button class="sidebar-grab" type="button" draggable="${manual?'true':'false'}" ${manual?'':'hidden'} data-drag-type="list" data-drag-id="${escAttr(list.id)}" aria-label="Drag list" title="Drag list">⠿</button>
      <button class="list-row${active?' active':''}" type="button" data-list-id="${escAttr(list.id)}">
        <span class="list-label">${esc(list.name)}</span><span class="count-pill">${count}</span>
      </button>
    </div>`;
  }

  function clearSidebarEntityIndicators(){
    document.querySelectorAll('.sidebar-entity').forEach(el=>el.classList.remove('sidebar-drop-before','sidebar-drop-after'));
    document.querySelectorAll('.folder-row').forEach(el=>el.classList.remove('folder-receive-list'));
    els.listTree?.classList.remove('sidebar-root-drop');
  }

  function bindSidebarDragHandle(handle){
    handle.addEventListener('click',e=>e.stopPropagation());
    handle.addEventListener('dragstart',e=>{
      if(sidebarSortMode()!=='manual') { e.preventDefault(); return; }
      sidebarDrag={type:handle.dataset.dragType,id:handle.dataset.dragId};
      handle.closest('.sidebar-entity')?.classList.add('sidebar-dragging');
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',`sidebar:${sidebarDrag.type}:${sidebarDrag.id}`);
    });
    handle.addEventListener('dragend',endSidebarDrag);
  }

  function endSidebarDrag(){
    document.querySelectorAll('.sidebar-entity').forEach(el=>el.classList.remove('sidebar-dragging'));
    clearSidebarEntityIndicators();
    sidebarDrag=null; sidebarDropTarget=null;
  }

  function sidebarEntityRef(el){
    return {type:el.dataset.sidebarType,id:el.dataset.sidebarId};
  }

  function isTopLevelEntity(ref){
    if(ref.type==='folder') return true;
    const list=state.lists.find(l=>l.id===ref.id);
    return !!list && !list.folderId;
  }

  function bindSidebarEntityDrop(el){
    el.addEventListener('dragover',e=>{
      if(!sidebarDrag || sidebarSortMode()!=='manual') return;
      const target=sidebarEntityRef(el);
      if(sidebarDrag.type===target.type && sidebarDrag.id===target.id) return;
      if(sidebarDrag.type==='folder' && !isTopLevelEntity(target)) return;
      if(target.type==='folder' && sidebarDrag.type==='list' && e.target.closest('.folder-row')) return;
      e.preventDefault(); e.stopPropagation();
      clearSidebarEntityIndicators();
      const r=el.getBoundingClientRect();
      const before=e.clientY<r.top+r.height/2;
      el.classList.add(before?'sidebar-drop-before':'sidebar-drop-after');
      sidebarDropTarget={target,before};
      e.dataTransfer.dropEffect='move';
    });
    el.addEventListener('drop',e=>{
      if(!sidebarDrag || !sidebarDropTarget) return;
      e.preventDefault(); e.stopPropagation();
      const {target,before}=sidebarDropTarget;
      moveSidebarEntity(sidebarDrag,target,before);
      endSidebarDrag();
    });
  }

  function bindFolderListDropTarget(el,folderId){
    el.addEventListener('dragover',e=>{
      if(!sidebarDrag || sidebarDrag.type!=='list' || sidebarSortMode()!=='manual') return;
      const list=state.lists.find(l=>l.id===sidebarDrag.id);
      if(!list || list.folderId===folderId) return;
      e.preventDefault(); e.stopPropagation(); clearSidebarEntityIndicators();
      el.classList.add('folder-receive-list'); e.dataTransfer.dropEffect='move';
    });
    el.addEventListener('dragleave',e=>{ if(!el.contains(e.relatedTarget)) el.classList.remove('folder-receive-list'); });
    el.addEventListener('drop',e=>{
      if(!sidebarDrag || sidebarDrag.type!=='list') return;
      e.preventDefault(); e.stopPropagation();
      moveListIntoFolder(sidebarDrag.id,folderId);
      endSidebarDrag();
    });
  }

  function moveSidebarEntity(drag,target,before){
    const targetList = target.type==='list' ? state.lists.find(l=>l.id===target.id) : null;
    const targetIsTop = target.type==='folder' || (targetList && !targetList.folderId);
    if(drag.type==='folder' || targetIsTop){
      reorderTopLevel(drag,target,before); return;
    }
    if(drag.type==='list' && targetList){
      reorderListWithinFolder(drag.id,targetList.id,before);
    }
  }

  function reorderTopLevel(drag,target,before){
    if(drag.type==='list'){
      const moving=state.lists.find(l=>l.id===drag.id); if(!moving) return;
      moving.folderId=null;
    }
    let items=[
      ...state.lists.filter(l=>!l.folderId).map(item=>({type:'list',id:item.id,item})),
      ...state.folders.map(item=>({type:'folder',id:item.id,item}))
    ].sort((a,b)=>(Number(a.item.sidebarOrder)||0)-(Number(b.item.sidebarOrder)||0));
    const movingIndex=items.findIndex(x=>x.type===drag.type&&x.id===drag.id);
    if(movingIndex<0) return;
    const [moving]=items.splice(movingIndex,1);
    const targetIndex=items.findIndex(x=>x.type===target.type&&x.id===target.id);
    if(targetIndex<0) return;
    items.splice(targetIndex+(before?0:1),0,moving);
    const ts=now();
    items.forEach((x,i)=>{x.item.sidebarOrder=i;x.item.updatedAt=ts;});
    saveState();
  }

  function reorderListWithinFolder(listId,targetId,before){
    const moving=state.lists.find(l=>l.id===listId), target=state.lists.find(l=>l.id===targetId);
    if(!moving||!target||!target.folderId) return;
    moving.folderId=target.folderId;
    const siblings=state.lists.filter(l=>l.folderId===target.folderId&&l.id!==listId).sort(byOrderName);
    const idx=siblings.findIndex(l=>l.id===targetId);
    siblings.splice(Math.max(0,idx+(before?0:1)),0,moving);
    const ts=now(); siblings.forEach((l,i)=>{l.order=i;l.updatedAt=ts;});
    saveState();
  }

  function moveListIntoFolder(listId,folderId){
    const list=state.lists.find(l=>l.id===listId); if(!list) return;
    list.folderId=folderId; list.order=nextListOrder(folderId); list.updatedAt=now();
    collapsedFolders.delete(folderId); saveCollapsedFolders(); saveState();
  }

  function moveListToTopLevelEnd(listId){
    const list=state.lists.find(l=>l.id===listId); if(!list) return;
    list.folderId=null; list.sidebarOrder=nextTopLevelOrder(); list.updatedAt=now(); saveState();
  }

  function renderTags(){
    const current = els.tagFilter.value;
    const tags = [...new Set(state.tasks.flatMap(t=>t.tags))].sort((a,b)=>a.localeCompare(b));
    els.tagFilter.innerHTML = '<option value="">All tags</option>' + tags.map(t=>`<option value="${escAttr(t)}">${esc(t)}</option>`).join('');
    if(tags.includes(current)) els.tagFilter.value = current;
  }

  function renderTaskLocationOptions(){
    const currentValue = els.taskListSelect.value;
    const folders = [...state.folders].sort(byOrderName);
    const lists = [...state.lists].sort(byOrderName);
    let html = '<option value="inbox">Inbox</option>';
    lists.filter(l=>!l.folderId).forEach(l => html += `<option value="${escAttr(l.id)}">${esc(l.name)}</option>`);
    folders.forEach(f => {
      const children = lists.filter(l=>l.folderId===f.id);
      if(children.length){
        html += `<optgroup label="${escAttr(f.name)}">${children.map(l=>`<option value="${escAttr(l.id)}">${esc(l.name)}</option>`).join('')}</optgroup>`;
      }
    });
    els.taskListSelect.innerHTML = html;
    if([...els.taskListSelect.options].some(o=>o.value===currentValue)) els.taskListSelect.value=currentValue;
  }

  function renderListFolderOptions(){
    const current = els.listFolderSelect.value;
    const folders = [...state.folders].sort(byOrderName);
    els.listFolderSelect.innerHTML = '<option value="">No folder</option>' + folders.map(f=>`<option value="${escAttr(f.id)}">${esc(f.name)}</option>`).join('');
    if(folders.some(f=>f.id===current)) els.listFolderSelect.value=current;
  }

  function visibleTasks(){
    const q = els.search.value.trim().toLowerCase();
    const tag = els.tagFilter.value;
    let tasks;
    if(q){
      tasks = [...state.tasks];
    } else {
      tasks = state.tasks.filter(t => {
        if(currentView.type==='completed') return t.completed;
        if(t.completed) return false;
        if(currentView.type==='inbox') return !t.listId;
        if(currentView.type==='today') return isTodayTask(t);
        if(currentView.type==='list') return t.listId===currentView.id;
        return false;
      });
    }
    if(tag) tasks = tasks.filter(t=>t.tags.includes(tag));
    if(q) tasks = tasks.filter(t=>[t.title,t.notes,t.due,t.priority,locationName(t),t.completed?'completed':'',...t.tags].join(' ').toLowerCase().includes(q));

    const mode=taskSortMode();
    if(mode!=='manual') return tasks.sort(taskComparator(mode));
    if(q) return tasks.sort((a,b)=>Number(a.completed)-Number(b.completed) || (b.updatedAt||0)-(a.updatedAt||0));
    if(currentView.type==='completed') return tasks.sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
    if(currentView.type==='today') return tasks.sort((a,b)=>{
      const ae=a.today?0:1, be=b.today?0:1;
      return ae-be || (a.todayOrder||0)-(b.todayOrder||0) || a.createdAt-b.createdAt;
    });
    return tasks.sort((a,b)=>a.order-b.order || a.createdAt-b.createdAt);
  }

  function taskComparator(mode){
    const priorityRank={high:0,medium:1,low:2,'':3};
    return (a,b)=>{
      const completedGroup=Number(a.completed)-Number(b.completed);
      if(completedGroup) return completedGroup;
      if(mode==='title') return a.title.localeCompare(b.title,undefined,{sensitivity:'base'});
      if(mode==='newest') return (b.createdAt||0)-(a.createdAt||0);
      if(mode==='oldest') return (a.createdAt||0)-(b.createdAt||0);
      if(mode==='priority'){
        const pr=(priorityRank[a.priority]??3)-(priorityRank[b.priority]??3);
        if(pr) return pr;
        return dueValue(a)-dueValue(b) || a.title.localeCompare(b.title);
      }
      if(mode==='due') return dueValue(a)-dueValue(b) || (priorityRank[a.priority]??3)-(priorityRank[b.priority]??3) || a.title.localeCompare(b.title);
      return 0;
    };
  }

  function dueValue(t){
    return t.due ? new Date(t.due+'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
  }

  function renderTasks(){
    const q = els.search.value.trim();
    const info = q ? {title:'Search results',subtitle:'Across all tasks, lists, Inbox, Today, and Completed.'} : currentViewInfo();
    els.viewTitle.textContent = info.title;
    els.viewSubtitle.textContent = info.subtitle;
    els.editCurrentListBtn.hidden = currentView.type!=='list' || !!q;
    if(els.taskSortSelect) els.taskSortSelect.value=taskSortMode();
    const tasks = visibleTasks();
    els.taskList.innerHTML = '';
    const filtered = !!(els.search.value.trim() || els.tagFilter.value);
    tasks.forEach(t=>els.taskList.appendChild(taskNode(t,filtered)));
    els.emptyState.hidden = tasks.length>0;
    if(currentView.type==='completed'){
      $('emptyTitle').textContent='Nothing completed yet.';
      $('emptyText').textContent='Completed tasks will collect here.';
    } else if(currentView.type==='today'){
      $('emptyTitle').textContent='Nothing in Today.';
      $('emptyText').textContent='Tasks marked for Today, or due today, will appear here.';
    } else {
      $('emptyTitle').textContent='Nothing here.';
      $('emptyText').textContent='Add a task when something comes to mind.';
    }
  }

  function currentViewInfo(){
    if(currentView.type==='inbox') return {title:'Inbox',subtitle:'Things you’ve captured but haven’t filed yet.'};
    if(currentView.type==='today') return {title:'Today',subtitle:'Your focus view, including anything due today. Tasks remain in their normal lists too.'};
    if(currentView.type==='completed') return {title:'Completed',subtitle:'Finished tasks stay here until you delete them.'};
    if(currentView.type==='list'){
      const list=state.lists.find(l=>l.id===currentView.id);
      if(!list){ currentView={type:'inbox',id:null}; return currentViewInfo(); }
      const folder=list.folderId?state.folders.find(f=>f.id===list.folderId):null;
      return {title:list.name,subtitle:folder?folder.name:'Custom list'};
    }
    return {title:'Inbox',subtitle:''};
  }

  function taskNode(t, filtered){
    const manualSort = taskSortMode()==='manual';
    const el = document.createElement('article');
    el.className = 'task-card'+(t.completed?' completed':'');
    el.dataset.id = t.id;
    const dueLabel = t.due ? formatDate(t.due) : '';
    const showLocation = !!els.search.value.trim() || currentView.type==='today' || currentView.type==='completed';
    const loc = locationName(t);
    const showTodayBadge = t.today && currentView.type!=='today' && !t.completed;
    el.innerHTML = `
      <button class="grab" type="button" aria-label="Drag task" title="Drag task" ${filtered||currentView.type==='completed'||!manualSort?'disabled':''}>⠿</button>
      <button class="check" type="button" aria-label="${t.completed?'Mark incomplete':'Complete task'}">${t.completed?'✓':''}</button>
      <div class="task-main">
        <div class="task-title-row">
          ${t.priority?`<span class="priority-dot ${escAttr(t.priority)}" title="${escAttr(t.priority)} priority"></span>`:''}
          <span class="task-title">${esc(t.title)}</span>
          ${showTodayBadge?'<span class="today-badge">Today</span>':''}
        </div>
        <div class="meta">
          ${showLocation?`<span class="location-meta">${esc(loc)}</span>`:''}
          ${dueLabel?`<span>${esc(dueLabel)}</span>`:''}
          ${t.notes?'<span>Notes</span>':''}
        </div>
        ${t.tags.length?`<div class="tags">${t.tags.map(tag=>`<button type="button" class="tag" data-tag="${escAttr(tag)}">${esc(tag)}</button>`).join('')}</div>`:''}
      </div>
      <button class="more-btn" type="button" aria-label="Edit task">•••</button>`;

    const grab = el.querySelector('.grab');
    if(!filtered && currentView.type!=='completed' && manualSort){
      grab.draggable = true;
      grab.addEventListener('dragstart',e=>startDrag(e,t.id,el));
      grab.addEventListener('dragend',endDrag);
    }
    el.addEventListener('dragover',e=>dragOverCard(e,el,t.id));
    el.addEventListener('dragleave',()=>clearCardIndicator(el));
    el.addEventListener('drop',e=>dropOnCard(e,t.id));
    el.querySelector('.check').addEventListener('click',()=>toggleComplete(t.id));
    el.querySelector('.task-main').addEventListener('click',()=>openTask(t.id));
    el.querySelector('.more-btn').addEventListener('click',()=>openTask(t.id));
    el.querySelectorAll('.tag').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();els.tagFilter.value=b.dataset.tag;renderTasks();}));
    return el;
  }

  function clearSidebarDropTargets(){
    document.querySelectorAll('.sidebar-drop-target').forEach(el=>el.classList.remove('sidebar-drop-target'));
  }

  function bindSidebarDropTarget(el,destination){
    el.addEventListener('dragover',e=>{
      if(!dragAllowed()) return;
      e.preventDefault();
      clearSidebarDropTargets();
      el.classList.add('sidebar-drop-target');
      e.dataTransfer.dropEffect='move';
    });
    el.addEventListener('dragleave',()=>el.classList.remove('sidebar-drop-target'));
    el.addEventListener('drop',e=>{
      if(!dragAllowed()) return;
      e.preventDefault();
      clearSidebarDropTargets();
      moveTaskToSidebarDestination(draggedId,destination);
    });
  }

  function moveTaskToSidebarDestination(id,destination){
    const t=state.tasks.find(x=>x.id===id); if(!t) return;
    const ts=now();
    if(destination.type==='today'){
      t.today=true;
      t.todayOrder=nextTodayOrder();
      t.updatedAt=ts;
    } else {
      const listId=destination.type==='list'?destination.listId:null;
      t.listId=listId;
      t.order=nextBaseOrder(listId);
      t.updatedAt=ts;
    }
    endDrag(); saveState();
  }

  function startDrag(e,id,card){
    draggedId=id; card.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',id);
  }
  function endDrag(){
    document.querySelectorAll('.task-card').forEach(c=>c.classList.remove('dragging','drop-line-before','drop-line-after'));
    removeEndLine(); clearSidebarDropTargets(); draggedId=null; dropTarget=null;
  }
  function dragAllowed(){ return draggedId && taskSortMode()==='manual' && currentView.type!=='completed' && !els.search.value.trim() && !els.tagFilter.value; }
  function dragOverCard(e,card,targetId){
    if(!dragAllowed() || draggedId===targetId) return;
    e.preventDefault();
    const r=card.getBoundingClientRect(); const before=e.clientY<r.top+r.height/2;
    document.querySelectorAll('.task-card').forEach(c=>c.classList.remove('drop-line-before','drop-line-after')); removeEndLine();
    card.classList.add(before?'drop-line-before':'drop-line-after'); dropTarget={targetId,before};
  }
  function clearCardIndicator(card){card.classList.remove('drop-line-before','drop-line-after')}
  function dropOnCard(e,targetId){
    if(!dragAllowed() || draggedId===targetId) return;
    e.preventDefault(); const info=dropTarget||{targetId,before:true}; reorderTask(draggedId,info.targetId,info.before); endDrag();
  }
  els.taskList.addEventListener('dragover',e=>{
    if(!dragAllowed()) return;
    if(e.target===els.taskList){e.preventDefault();showEndLine();dropTarget={atEnd:true};}
  });
  els.taskList.addEventListener('drop',e=>{
    if(!dragAllowed() || !dropTarget?.atEnd) return;
    e.preventDefault();moveToEnd(draggedId);endDrag();
  });
  function showEndLine(){removeEndLine();const d=document.createElement('div');d.className='drop-end';d.id='dropEndLine';els.taskList.appendChild(d)}
  function removeEndLine(){$('dropEndLine')?.remove()}
  function reorderTask(id,targetId,before){
    const moving=state.tasks.find(t=>t.id===id); if(!moving)return;
    const nowTs=now();
    if(currentView.type==='today'){
      moving.today=true;
      const ordered=state.tasks.filter(t=>!t.completed&&t.today&&t.id!==id).sort((a,b)=>a.todayOrder-b.todayOrder);
      const idx=ordered.findIndex(t=>t.id===targetId); ordered.splice(Math.max(0,idx+(before?0:1)),0,moving);
      ordered.forEach((t,i)=>{t.todayOrder=i;t.updatedAt=nowTs});
    } else {
      const listId=currentView.type==='list'?currentView.id:null;
      moving.listId=listId;
      const ordered=state.tasks.filter(t=>!t.completed&&t.listId===listId&&t.id!==id).sort((a,b)=>a.order-b.order);
      const idx=ordered.findIndex(t=>t.id===targetId); ordered.splice(Math.max(0,idx+(before?0:1)),0,moving);
      ordered.forEach((t,i)=>{t.order=i;t.updatedAt=nowTs});
    }
    saveState();
  }
  function moveToEnd(id){
    const moving=state.tasks.find(t=>t.id===id); if(!moving)return;
    const nowTs=now();
    if(currentView.type==='today'){
      moving.today=true;
      const siblings=state.tasks.filter(t=>!t.completed&&t.today&&t.id!==id).sort((a,b)=>a.todayOrder-b.todayOrder);siblings.push(moving);
      siblings.forEach((t,i)=>{t.todayOrder=i;t.updatedAt=nowTs});
    } else {
      const listId=currentView.type==='list'?currentView.id:null;
      moving.listId=listId;
      const siblings=state.tasks.filter(t=>!t.completed&&t.listId===listId&&t.id!==id).sort((a,b)=>a.order-b.order);siblings.push(moving);
      siblings.forEach((t,i)=>{t.order=i;t.updatedAt=nowTs});
    }
    saveState();
  }

  function toggleComplete(id){
    const t=state.tasks.find(t=>t.id===id);if(!t)return;
    t.completed=!t.completed;t.completedAt=t.completed?now():null;t.updatedAt=now();saveState();
  }

  function openTask(id=null, options={}){
    editingTaskId=id;els.taskError.hidden=true;renderTaskLocationOptions();
    const t=id?state.tasks.find(x=>x.id===id):null;
    $('taskDialogTitle').textContent=t?'Edit Task':'Add Task';els.deleteTaskBtn.hidden=!t;
    els.taskTitle.value=t?.title||options.prefillTitle||'';
    if(t) els.taskListSelect.value=t.listId||'inbox';
    else if(options.forceInbox) els.taskListSelect.value='inbox';
    else if(currentView.type==='list') els.taskListSelect.value=currentView.id;
    else els.taskListSelect.value='inbox';
    els.taskToday.checked=t?.today ?? (options.forceInbox?false:(currentView.type==='today'));
    els.taskPriority.value=t?.priority||'';els.taskDue.value=t?.due||'';els.taskTags.value=t?.tags?.join(', ')||'';els.taskNotes.value=t?.notes||'';
    els.taskDialog.showModal();setTimeout(()=>els.taskTitle.focus(),50);
  }

  function openQuickAdd(){
    if(els.quickAddDialog.open) return;
    els.quickAddTitle.value='';
    els.quickAddDialog.showModal();
    setTimeout(()=>els.quickAddTitle.focus(),40);
  }
  function closeQuickAdd(){
    if(els.quickAddDialog.open) els.quickAddDialog.close();
    els.quickAddTitle.value='';
  }
  function saveQuickAdd(){
    const title=els.quickAddTitle.value.trim();
    if(!title){els.quickAddTitle.focus();return;}
    const ts=now();
    state.tasks.push({id:uuid(),title,listId:null,today:false,priority:'',due:'',tags:[],notes:'',completed:false,order:nextBaseOrder(null),todayOrder:0,createdAt:ts,updatedAt:ts,completedAt:null});
    closeQuickAdd();saveState();toast('Added to Inbox');
  }
  function quickAddMore(){
    const title=els.quickAddTitle.value.trim();
    closeQuickAdd();
    openTask(null,{forceInbox:true,prefillTitle:title});
  }
  function isTypingTarget(target){
    return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
  }
  function closeTask(){els.taskDialog.close();editingTaskId=null}
  function saveTask(){
    const title=els.taskTitle.value.trim();if(!title){els.taskError.textContent='Enter a task title.';els.taskError.hidden=false;els.taskTitle.focus();return;}
    const tags=[...new Set(els.taskTags.value.split(',').map(s=>s.trim()).filter(Boolean))];
    const listId=els.taskListSelect.value==='inbox'?null:els.taskListSelect.value;
    const ts=now();
    if(editingTaskId){
      const t=state.tasks.find(x=>x.id===editingTaskId); if(!t)return;
      const locationChanged=t.listId!==listId; const todayAdded=!t.today&&els.taskToday.checked;
      Object.assign(t,{title,listId,today:els.taskToday.checked,priority:els.taskPriority.value,due:els.taskDue.value,tags,notes:els.taskNotes.value.trim(),updatedAt:ts});
      if(locationChanged) t.order=nextBaseOrder(listId);
      if(todayAdded) t.todayOrder=nextTodayOrder();
    } else {
      state.tasks.push({id:uuid(),title,listId,today:els.taskToday.checked,priority:els.taskPriority.value,due:els.taskDue.value,tags,notes:els.taskNotes.value.trim(),completed:false,order:nextBaseOrder(listId),todayOrder:els.taskToday.checked?nextTodayOrder():0,createdAt:ts,updatedAt:ts,completedAt:null});
    }
    closeTask();saveState();toast('Task saved');
  }
  function deleteTask(){
    if(!editingTaskId)return;
    if(confirm('Delete this task?')){
      const ts=now();state.tasks=state.tasks.filter(t=>t.id!==editingTaskId);state.deletedTasks[editingTaskId]=ts;closeTask();saveState();toast('Task deleted');
    }
  }
  function nextBaseOrder(listId){return Math.max(-1,...state.tasks.filter(t=>!t.completed&&t.listId===listId).map(t=>Number(t.order)||0))+1}
  function nextTodayOrder(){return Math.max(-1,...state.tasks.filter(t=>!t.completed&&t.today).map(t=>Number(t.todayOrder)||0))+1}

  function openList(id=null){
    editingListId=id;els.listError.hidden=true;renderListFolderOptions();
    const list=id?state.lists.find(l=>l.id===id):null;
    $('listDialogTitle').textContent=list?'Edit List':'New List';els.deleteListBtn.hidden=!list;
    els.listName.value=list?.name||'';els.listFolderSelect.value=list?.folderId||'';
    els.listDialog.showModal();setTimeout(()=>els.listName.focus(),50);
  }
  function closeList(){els.listDialog.close();editingListId=null}
  function saveList(){
    const name=els.listName.value.trim();if(!name){els.listError.textContent='Enter a list name.';els.listError.hidden=false;els.listName.focus();return;}
    const folderId=els.listFolderSelect.value||null;const ts=now();
    if(editingListId){
      const l=state.lists.find(x=>x.id===editingListId);if(!l)return;
      const moved=l.folderId!==folderId;
      Object.assign(l,{name,folderId,updatedAt:ts});
      if(moved){
        if(folderId) l.order=nextListOrder(folderId);
        else l.sidebarOrder=nextTopLevelOrder();
      }
    }
    else {state.lists.push({id:uuid(),name,folderId,order:nextListOrder(folderId),sidebarOrder:folderId?null:nextTopLevelOrder(),createdAt:ts,updatedAt:ts});}
    closeList();saveState();toast('List saved');
  }
  function deleteList(){
    if(!editingListId)return;
    const list=state.lists.find(l=>l.id===editingListId);if(!list)return;
    const affected=state.tasks.filter(t=>t.listId===editingListId).length;
    const message=affected?`Delete “${list.name}”? Its ${affected} task${affected===1?'':'s'} will be moved to Inbox.`:`Delete “${list.name}”?`;
    if(confirm(message)){
      const ts=now();state.tasks.forEach(t=>{if(t.listId===editingListId){t.listId=null;t.order=nextBaseOrder(null);t.updatedAt=ts;}});
      state.lists=state.lists.filter(l=>l.id!==editingListId);state.deletedLists[editingListId]=ts;
      if(currentView.type==='list'&&currentView.id===editingListId)currentView={type:'inbox',id:null};
      closeList();saveState();toast('List deleted');
    }
  }
  function nextListOrder(folderId){return Math.max(-1,...state.lists.filter(l=>l.folderId===folderId).map(l=>Number(l.order)||0))+1}

  function openFolder(id=null){
    editingFolderId=id;els.folderError.hidden=true;const folder=id?state.folders.find(f=>f.id===id):null;
    $('folderDialogTitle').textContent=folder?'Edit Folder':'New Folder';els.deleteFolderBtn.hidden=!folder;els.folderName.value=folder?.name||'';
    els.folderDialog.showModal();setTimeout(()=>els.folderName.focus(),50);
  }
  function closeFolder(){els.folderDialog.close();editingFolderId=null}
  function saveFolder(){
    const name=els.folderName.value.trim();if(!name){els.folderError.textContent='Enter a folder name.';els.folderError.hidden=false;els.folderName.focus();return;}
    const ts=now();
    if(editingFolderId){const f=state.folders.find(x=>x.id===editingFolderId);if(!f)return;Object.assign(f,{name,updatedAt:ts});}
    else state.folders.push({id:uuid(),name,order:Math.max(-1,...state.folders.map(f=>Number(f.order)||0))+1,sidebarOrder:nextTopLevelOrder(),createdAt:ts,updatedAt:ts});
    closeFolder();saveState();toast('Folder saved');
  }
  function deleteFolder(){
    if(!editingFolderId)return;const folder=state.folders.find(f=>f.id===editingFolderId);if(!folder)return;
    const children=state.lists.filter(l=>l.folderId===editingFolderId).length;
    const message=children?`Delete “${folder.name}”? Its ${children} list${children===1?'':'s'} will stay, but move out of the folder.`:`Delete “${folder.name}”?`;
    if(confirm(message)){
      const ts=now();let topOrder=nextTopLevelOrder();state.lists.forEach(l=>{if(l.folderId===editingFolderId){l.folderId=null;l.sidebarOrder=topOrder++;l.updatedAt=ts;}});
      state.folders=state.folders.filter(f=>f.id!==editingFolderId);state.deletedFolders[editingFolderId]=ts;closeFolder();saveState();toast('Folder deleted');
    }
  }

  function locationName(t){
    if(!t.listId)return 'Inbox';
    const list=state.lists.find(l=>l.id===t.listId);if(!list)return 'Inbox';
    const folder=list.folderId?state.folders.find(f=>f.id===list.folderId):null;
    return folder?`${folder.name} / ${list.name}`:list.name;
  }
  function byOrderName(a,b){return (a.order-b.order)||a.name.localeCompare(b.name)}

  function renderSyncStatus(){
    const connected=!!localStorage.getItem(DBX_TOKEN);els.syncStatus.textContent=connected?'Dropbox sync connected':'Saved on this device';
    els.disconnectDropboxBtn.hidden=!connected;els.connectDropboxBtn.textContent=connected?'Sync now':'Connect Dropbox';
  }

  async function connectDropbox(){
    if(localStorage.getItem(DBX_TOKEN)){await syncDropbox();toast('Synced');return;}
    const key=els.dropboxKey.value.trim();if(!key){els.dropboxStatus.textContent='Enter your Dropbox App key.';return;}
    localStorage.setItem(DBX_KEY,key);
    const verifier=randomString(64),challenge=await sha256base64url(verifier),stateToken=randomString(24);
    sessionStorage.setItem(DBX_VERIFIER,verifier);sessionStorage.setItem(DBX_STATE,stateToken);
    const url=new URL('https://www.dropbox.com/oauth2/authorize');
    url.searchParams.set('client_id',key);url.searchParams.set('response_type','code');url.searchParams.set('redirect_uri',currentRedirect());
    url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');url.searchParams.set('token_access_type','offline');url.searchParams.set('state',stateToken);
    location.href=url.toString();
  }

  async function handleOAuth(){
    const p=new URLSearchParams(location.search),code=p.get('code');if(!code)return;
    const returnedState=p.get('state'),expected=sessionStorage.getItem(DBX_STATE);if(!expected||returnedState!==expected){toast('Dropbox authorization could not be verified');return;}
    const key=localStorage.getItem(DBX_KEY),verifier=sessionStorage.getItem(DBX_VERIFIER);if(!key||!verifier)return;
    try{
      const body=new URLSearchParams({code,grant_type:'authorization_code',client_id:key,redirect_uri:currentRedirect(),code_verifier:verifier});
      const r=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const data=await r.json();if(!r.ok)throw new Error(data.error_description||'Dropbox connection failed');
      localStorage.setItem(DBX_TOKEN,data.access_token);if(data.refresh_token)localStorage.setItem(DBX_REFRESH,data.refresh_token);
      history.replaceState({},'',location.pathname+location.hash);await syncDropbox();toast('Dropbox connected');
    }catch(e){toast(e.message||'Dropbox connection failed');}
  }

  async function validToken(){return localStorage.getItem(DBX_TOKEN)||null}
  async function apiFetch(url,opts={}){
    let token=await validToken();if(!token)throw new Error('Dropbox not connected');
    let r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${token}`}});if(r.status!==401)return r;
    const refresh=localStorage.getItem(DBX_REFRESH),key=localStorage.getItem(DBX_KEY);if(!refresh||!key)return r;
    const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:refresh,client_id:key});
    const rr=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const d=await rr.json();if(!rr.ok)return r;
    localStorage.setItem(DBX_TOKEN,d.access_token);return fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${d.access_token}`}});
  }
  async function readDropboxFile(path){
    const r=await apiFetch('https://content.dropboxapi.com/2/files/download',{headers:{'Dropbox-API-Arg':JSON.stringify({path})}});
    if(r.status===409)return null;if(!r.ok)throw new Error('Could not read Dropbox data');return normalize(await r.json());
  }
  async function readDropbox(){
    const current=await readDropboxFile(DROPBOX_FILE);
    if(current)return {data:current, usedLegacy:false};
    const legacy=await readDropboxFile(LEGACY_DROPBOX_FILE);
    return {data:legacy, usedLegacy:!!legacy};
  }
  async function writeDropbox(data){
    const r=await apiFetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path:DROPBOX_FILE,mode:'overwrite',autorename:false,mute:true})},body:JSON.stringify(data)});
    if(!r.ok)throw new Error('Could not save to Dropbox');
  }
  async function deleteLegacyDropboxFile(){
    const r=await apiFetch('https://api.dropboxapi.com/2/files/delete_v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:LEGACY_DROPBOX_FILE})});
    if(r.status!==409 && !r.ok)throw new Error('Tasks synced, but the old Dropbox data file could not be removed');
  }

  function mergeStates(local,remote){
    const l=normalize(local),r=normalize(remote||defaultState());
    const merged={...defaultState()};
    merged.deletedTasks=mergeTombstones(l.deletedTasks,r.deletedTasks);
    merged.deletedLists=mergeTombstones(l.deletedLists,r.deletedLists);
    merged.deletedFolders=mergeTombstones(l.deletedFolders,r.deletedFolders);
    merged.tasks=mergeEntities(l.tasks,r.tasks,merged.deletedTasks);
    merged.lists=mergeEntities(l.lists,r.lists,merged.deletedLists);
    merged.folders=mergeEntities(l.folders,r.folders,merged.deletedFolders);
    merged.updatedAt=Math.max(l.updatedAt||0,r.updatedAt||0);
    repairReferences(merged);return normalize(merged);
  }
  function mergeTombstones(a,b){const out={...a};Object.entries(b||{}).forEach(([id,ts])=>out[id]=Math.max(Number(out[id]||0),Number(ts||0)));return out}
  function mergeEntities(a,b,tombs){
    const map=new Map();[...(a||[]),...(b||[])].forEach(x=>{const prev=map.get(x.id);if(!prev||Number(x.updatedAt||0)>Number(prev.updatedAt||0))map.set(x.id,x)});
    return [...map.values()].filter(x=>Number(tombs[x.id]||0)<Number(x.updatedAt||0));
  }
  async function syncDropbox(){
    if(!localStorage.getItem(DBX_TOKEN))return;els.syncStatus.textContent='Syncing…';
    try{
      const remoteResult=await readDropbox();
      const remote=remoteResult.data;
      state=remote?mergeStates(state,remote):normalize(state);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      await writeDropbox(state);
      if(remoteResult.usedLegacy) await deleteLegacyDropboxFile();
      render();
      els.dropboxStatus.textContent='Dropbox is connected and synced.';
    }
    catch(e){els.syncStatus.textContent='Dropbox sync error';els.dropboxStatus.textContent=e.message||'Dropbox sync failed.';throw e;}
  }
  function disconnectDropbox(){[DBX_TOKEN,DBX_REFRESH].forEach(k=>localStorage.removeItem(k));render();els.dropboxStatus.textContent='Dropbox disconnected from this browser.'}

  function exportBackup(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tasks-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
  }
  async function importBackup(file){try{const obj=normalize(JSON.parse(await file.text()));state=mergeStates(state,obj);saveState();toast('Backup imported')}catch{toast('That backup could not be read')}}

  function openMobileSidebar(){
    if(!els.sidebar) return;
    els.sidebar.classList.add('is-open');
    if(els.sidebarBackdrop) els.sidebarBackdrop.hidden=false;
    document.body.classList.add('menu-open');
  }
  function closeMobileSidebar(){
    if(!els.sidebar) return;
    els.sidebar.classList.remove('is-open');
    if(els.sidebarBackdrop) els.sidebarBackdrop.hidden=true;
    document.body.classList.remove('menu-open');
  }

  function currentRedirect(){return location.origin+location.pathname}
  function randomString(len){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';const arr=new Uint8Array(len);crypto.getRandomValues(arr);return[...arr].map(x=>chars[x%chars.length]).join('')}
  async function sha256base64url(str){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function formatDate(s){const d=new Date(s+'T12:00:00'),today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);const cmp=new Date(s+'T00:00:00');if(+cmp===+today)return'Due today';if(+cmp===+tomorrow)return'Due tomorrow';if(cmp<today)return'Overdue · '+d.toLocaleDateString(undefined,{month:'short',day:'numeric'});return'Due '+d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function escAttr(s=''){return esc(s)}
  function toast(msg){clearTimeout(toastTimer);els.toast.textContent=msg;els.toast.hidden=false;toastTimer=setTimeout(()=>els.toast.hidden=true,2200)}

  document.querySelectorAll('.nav-row[data-view]').forEach(b=>b.addEventListener('click',()=>{currentView={type:b.dataset.view,id:null};els.search.value='';els.tagFilter.value='';render();closeMobileSidebar()}));
  const inboxNav=document.querySelector('.nav-row[data-view="inbox"]');
  const todayNav=document.querySelector('.nav-row[data-view="today"]');
  if(inboxNav) bindSidebarDropTarget(inboxNav,{type:'inbox'});
  if(todayNav) bindSidebarDropTarget(todayNav,{type:'today'});
  els.listTree.addEventListener('dragover',e=>{
    if(!sidebarDrag || sidebarDrag.type!=='list' || sidebarSortMode()!=='manual' || e.target!==els.listTree) return;
    e.preventDefault(); clearSidebarEntityIndicators(); els.listTree.classList.add('sidebar-root-drop'); e.dataTransfer.dropEffect='move';
  });
  els.listTree.addEventListener('drop',e=>{
    if(!sidebarDrag || sidebarDrag.type!=='list' || e.target!==els.listTree) return;
    e.preventDefault(); moveListToTopLevelEnd(sidebarDrag.id); endSidebarDrag();
  });
  $('addTaskBtn').addEventListener('click',()=>openTask());
  $('inlineAddTaskBtn').addEventListener('click',()=>openTask());
  $('mobileAddBtn').addEventListener('click',()=>openTask());
  $('mobileMenuBtn').addEventListener('click',openMobileSidebar);
  $('mobileSidebarCloseBtn').addEventListener('click',closeMobileSidebar);
  els.sidebarBackdrop?.addEventListener('click',closeMobileSidebar);
  els.quickAddTitle.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveQuickAdd();}});
  $('quickAddMoreBtn').addEventListener('click',quickAddMore);
  els.quickAddDialog.addEventListener('click',e=>{if(e.target===els.quickAddDialog)closeQuickAdd()});
  els.quickAddDialog.addEventListener('cancel',e=>{e.preventDefault();closeQuickAdd()});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && els.sidebar?.classList.contains('is-open')){closeMobileSidebar();return;}
    if(e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if(e.key.toLowerCase()!=='q' || isTypingTarget(e.target)) return;
    if(document.querySelector('dialog[open]')) return;
    e.preventDefault();openQuickAdd();
  });
  els.taskTitle.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveTask();}});
  els.listName.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveList();}});
  els.folderName.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveFolder();}});
  $('addListBtn').addEventListener('click',()=>openList());
  $('addFolderBtn').addEventListener('click',()=>openFolder());
  els.editCurrentListBtn.addEventListener('click',()=>{if(currentView.type==='list')openList(currentView.id)});

  $('taskCloseBtn').addEventListener('click',closeTask);$('taskCancelBtn').addEventListener('click',closeTask);$('taskSaveBtn').addEventListener('click',saveTask);els.deleteTaskBtn.addEventListener('click',deleteTask);
  els.taskDialog.addEventListener('click',e=>{if(e.target===els.taskDialog)closeTask()});els.taskDialog.addEventListener('cancel',e=>{e.preventDefault();closeTask()});

  $('listCloseBtn').addEventListener('click',closeList);$('listCancelBtn').addEventListener('click',closeList);$('listSaveBtn').addEventListener('click',saveList);els.deleteListBtn.addEventListener('click',deleteList);
  els.listDialog.addEventListener('click',e=>{if(e.target===els.listDialog)closeList()});els.listDialog.addEventListener('cancel',e=>{e.preventDefault();closeList()});

  $('folderCloseBtn').addEventListener('click',closeFolder);$('folderCancelBtn').addEventListener('click',closeFolder);$('folderSaveBtn').addEventListener('click',saveFolder);els.deleteFolderBtn.addEventListener('click',deleteFolder);
  els.folderDialog.addEventListener('click',e=>{if(e.target===els.folderDialog)closeFolder()});els.folderDialog.addEventListener('cancel',e=>{e.preventDefault();closeFolder()});

  els.search.addEventListener('input',renderTasks);els.tagFilter.addEventListener('change',renderTasks);
  els.taskSortSelect?.addEventListener('change',()=>{localStorage.setItem(TASK_SORT_KEY,els.taskSortSelect.value);renderTasks();});
  els.sidebarSortSelect?.addEventListener('change',()=>{localStorage.setItem(SIDEBAR_SORT_KEY,els.sidebarSortSelect.value);renderSidebar();});
  els.appFont.addEventListener('change',()=>applyAppearance(els.appFont.value,els.taskTextSize.value));
  els.taskTextSize.addEventListener('change',()=>applyAppearance(els.appFont.value,els.taskTextSize.value));
  $('resetAppearanceBtn').addEventListener('click',resetAppearance);
  $('settingsBtn').addEventListener('click',()=>{els.dropboxKey.value=localStorage.getItem(DBX_KEY)||'';els.dropboxStatus.textContent=localStorage.getItem(DBX_TOKEN)?'Dropbox is connected in this browser.':'';applyAppearance(localStorage.getItem(FONT_KEY)||'system',localStorage.getItem(TEXT_SIZE_KEY)||'15',false);els.settingsDialog.showModal()});
  $('settingsCloseBtn').addEventListener('click',()=>els.settingsDialog.close());els.settingsDialog.addEventListener('click',e=>{if(e.target===els.settingsDialog)els.settingsDialog.close()});els.settingsDialog.addEventListener('cancel',e=>{e.preventDefault();els.settingsDialog.close()});
  els.connectDropboxBtn.addEventListener('click',connectDropbox);els.disconnectDropboxBtn.addEventListener('click',disconnectDropbox);$('exportBtn').addEventListener('click',exportBackup);$('importInput').addEventListener('change',e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value=''})

  loadAppearance();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  handleOAuth().finally(render);
})();

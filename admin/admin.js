let data = {};
let password = localStorage.getItem('fiaz_admin_password') || '';
let selected = null;
let history = [];
let redoStack = [];
let draftTimer = null;

const $ = id => document.getElementById(id);
const defaultOrder = ['about','services','results','pricing','testimonial','faq','contact'];
const sectionLabels = {about:'About',services:'Services',results:'Transformations',pricing:'Packages',testimonial:'Testimonial',faq:'FAQ',contact:'Contact'};

function clone(x){return JSON.parse(JSON.stringify(x))}
function pushHistory(){history.push(clone(data)); if(history.length>80) history.shift(); redoStack=[];}
function status(msg){$('status').textContent=msg}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2400)}
function get(path){return path.split('.').reduce((o,k)=>o?o[k]:undefined,data)}
function set(path,val){const parts=path.split('.');let obj=data;while(parts.length>1){let k=parts.shift();obj[k]=obj[k]||{};obj=obj[k]}obj[parts[0]]=val;autosave();}
function autosave(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{localStorage.setItem('jackal_freeform_draft',JSON.stringify(data));status('Draft saved locally. Publish when ready.')},250)}
function api(path, opts={}){return fetch(path,{...opts,headers:{'Content-Type':'application/json','X-Admin-Password':password,...(opts.headers||{})}}).then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()})}
function nice(s){return String(s).replace(/([A-Z])/g,' $1').replace(/[._-]/g,' ').replace(/^./,x=>x.toUpperCase())}

async function login(){
  try{
    password = $('password').value.trim();
    const r = await api('/api/content');
    data = r.data || r;
    const draft = localStorage.getItem('jackal_freeform_draft');
    if(draft && confirm('Load your local draft?')) data = JSON.parse(draft);
    initData();
    localStorage.setItem('fiaz_admin_password',password);
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    renderSections();
    bindFrame();
    status('Loaded. Tap anything.');
  }catch(e){$('loginMsg').textContent='Login failed. Check password.'}
}
async function autoLogin(){
  if(!password)return;
  try{
    const r=await api('/api/content'); data=r.data||r;
    const draft=localStorage.getItem('jackal_freeform_draft');
    if(draft && confirm('Load your local draft?')) data=JSON.parse(draft);
    initData(); $('login').classList.add('hidden'); $('app').classList.remove('hidden'); renderSections(); bindFrame();
  }catch(e){localStorage.removeItem('fiaz_admin_password')}
}
function initData(){
  data._builder=data._builder||{};
  data._builder.sectionOrder=data._builder.sectionOrder||defaultOrder.slice();
  data._builder.hiddenSections=data._builder.hiddenSections||[];
  data.imageControls=data.imageControls||{};
  data.imageControls.heroImage=data.imageControls.heroImage||{x:72,y:50,zoom:100};
  data.imageControls.aboutImage=data.imageControls.aboutImage||{x:50,y:50,zoom:100};
  data.imageControls.results=data.imageControls.results||{};
  if(Array.isArray(data.results))data.results.forEach((_,i)=>data.imageControls.results[String(i)]=data.imageControls.results[String(i)]||{x:50,y:50,zoom:100});
  data.textStyles=data.textStyles||{};
  data.elementStyles=data.elementStyles||{};
  data.deletedElements=data.deletedElements||[];
}

function frameDoc(){return $('siteFrame').contentDocument}
function reloadFrame(){ $('siteFrame').src='/?freeform=1&cache='+Date.now(); setTimeout(bindFrame,900); }
function bindFrame(){ const f=$('siteFrame'); f.onload=()=>setTimeout(injectFreeform,350); setTimeout(injectFreeform,850); }

function getTargetId(el){
  return el.dataset.builderField || el.dataset.builderId || el.dataset.imageField || null;
}
function elementStyle(id){
  data.elementStyles[id]=data.elementStyles[id]||{};
  return data.elementStyles[id];
}
function transformFor(style){
  const x = Number(style.moveX || 0), y = Number(style.moveY || 0);
  return `translate(${x}px, ${y}px)`;
}

function injectFreeform(){
  const doc=frameDoc(); if(!doc)return;
  if(!doc.getElementById('jackal-freeform-style')){
    const st=doc.createElement('style'); st.id='jackal-freeform-style';
    st.textContent=`
      [data-builder-field],[data-builder-id],.hero,.photo,.result{outline:2px solid transparent;outline-offset:4px;transition:outline .12s;box-sizing:border-box;touch-action:none}
      [data-builder-field]:hover,[data-builder-id]:hover,.hero:hover,.photo:hover,.result:hover{outline-color:#4aa3ff!important;cursor:grab}
      .jackal-selected{outline:3px solid #f4d77e!important;outline-offset:5px!important;position:relative!important}
      .jackal-handle{position:absolute;width:18px;height:18px;background:#f4d77e;border:2px solid #050505;border-radius:50%;z-index:999999;touch-action:none}
      .jackal-handle.br{right:-13px;bottom:-13px;cursor:nwse-resize}
      .jackal-handle.r{right:-13px;top:50%;transform:translateY(-50%);cursor:ew-resize}
      .jackal-handle.b{left:50%;bottom:-13px;transform:translateX(-50%);cursor:ns-resize}
      body.jackal-grabbing *{cursor:grabbing!important;user-select:none!important}
    `;
    doc.head.appendChild(st);
  }

  const all = [
    ...doc.querySelectorAll('[data-builder-field]'),
    ...doc.querySelectorAll('[data-builder-id]'),
    ...doc.querySelectorAll('.hero,.photo,.result')
  ];

  all.forEach((el, i)=>{
    if(!getTargetId(el)){
      if(el.classList.contains('hero')) el.dataset.imageField='heroImage';
      else if(el.classList.contains('photo')) el.dataset.imageField='aboutImage';
      else if(el.classList.contains('result')) {
        const idx=[...doc.querySelectorAll('.result')].indexOf(el);
        el.dataset.imageField=`results.${idx}.image`;
      }
    }
    const id = getTargetId(el);
    if(!id) return;
    el.onclick=e=>{e.preventDefault();e.stopPropagation();selectAny(el,id)};
    bindMove(el,id);
    if(el.classList.contains('hero') || el.classList.contains('photo') || el.classList.contains('result')) bindImageMove(el,id);
  });
}

function clearSelected(){
  const doc=frameDoc(); if(!doc)return;
  doc.querySelectorAll('.jackal-selected').forEach(el=>el.classList.remove('jackal-selected'));
  doc.querySelectorAll('.jackal-handle').forEach(el=>el.remove());
}
function typeFor(el,id){
  if(el.dataset.builderField) return 'text';
  if(id.includes('Image') || id.includes('.image') || el.classList.contains('hero') || el.classList.contains('photo') || el.classList.contains('result')) return 'image';
  return 'element';
}
function selectAny(el,id){
  clearSelected(); el.classList.add('jackal-selected');
  selected={el,id,field:id,type:typeFor(el,id)};
  addHandles(el,id);
  showToolbar();
}
function showToolbar(){
  $('canvasToolbar').classList.remove('hidden');
  const isText=selected?.type==='text';
  const isImage=selected?.type==='image';
  $('editTextBtn').style.display=isText?'inline-flex':'none';
  $('biggerTextBtn').style.display=isText?'inline-flex':'none';
  $('smallerTextBtn').style.display=isText?'inline-flex':'none';
  $('imageUpBtn').style.display=isImage?'inline-flex':'none';
  $('imageDownBtn').style.display=isImage?'inline-flex':'none';
  $('replaceImageBtn').style.display=isImage?'inline-flex':'none';
}
function addHandles(el,id){
  ['br','r','b'].forEach(cls=>{
    const h=frameDoc().createElement('div');
    h.className='jackal-handle '+cls;
    h.onmousedown=e=>startResize(e,el,id,cls);
    h.ontouchstart=e=>startResizeTouch(e,el,id,cls);
    el.appendChild(h);
  });
}

function bindMove(el,id){
  el.onmousedown=e=>{
    if(e.target.classList.contains('jackal-handle') || e.target.closest('a,button')) return;
    e.preventDefault();e.stopPropagation();selectAny(el,id);pushHistory();
    const st=elementStyle(id), start={x:e.clientX,y:e.clientY,mx:Number(st.moveX||0),my:Number(st.moveY||0)};
    frameDoc().body.classList.add('jackal-grabbing');
    const move=ev=>{
      st.position = st.position || 'relative';
      st.zIndex = st.zIndex || '2';
      st.moveX = Math.round(start.mx + ev.clientX - start.x);
      st.moveY = Math.round(start.my + ev.clientY - start.y);
      st.transform = transformFor(st);
      el.style.position=st.position; el.style.zIndex=st.zIndex; el.style.transform=st.transform;
      autosave(); status('Moved live. Publish when ready.');
    };
    const up=()=>{frameDoc().removeEventListener('mousemove',move);frameDoc().removeEventListener('mouseup',up);frameDoc().body.classList.remove('jackal-grabbing')};
    frameDoc().addEventListener('mousemove',move); frameDoc().addEventListener('mouseup',up);
  };
  el.ontouchstart=e=>{
    if(e.target.classList.contains('jackal-handle')) return;
    const t=e.touches[0]; selectAny(el,id); pushHistory();
    const st=elementStyle(id), start={x:t.clientX,y:t.clientY,mx:Number(st.moveX||0),my:Number(st.moveY||0)};
    const move=ev=>{
      const tt=ev.touches[0];
      st.position=st.position||'relative'; st.zIndex=st.zIndex||'2';
      st.moveX=Math.round(start.mx+tt.clientX-start.x); st.moveY=Math.round(start.my+tt.clientY-start.y);
      st.transform=transformFor(st);
      el.style.position=st.position; el.style.zIndex=st.zIndex; el.style.transform=st.transform;
      autosave();
    };
    const up=()=>{frameDoc().removeEventListener('touchmove',move);frameDoc().removeEventListener('touchend',up)};
    frameDoc().addEventListener('touchmove',move,{passive:false}); frameDoc().addEventListener('touchend',up);
  };
}
function startResizeTouch(e,el,id,handle){
  const t=e.touches[0]; startResizeBase(t.clientX,t.clientY,el,id,handle,'touch');
}
function startResize(e,el,id,handle){
  e.preventDefault();e.stopPropagation(); startResizeBase(e.clientX,e.clientY,el,id,handle,'mouse');
}
function startResizeBase(x,y,el,id,handle,inputType){
  pushHistory();
  const rect=el.getBoundingClientRect();
  const st=elementStyle(id);
  const start={x,y,w:rect.width,h:rect.height};
  const move=(ev)=>{
    const pt=inputType==='touch'?ev.touches[0]:ev;
    let newW=start.w + (pt.clientX-start.x);
    let newH=start.h + (pt.clientY-start.y);
    if(handle==='r') newH=start.h;
    if(handle==='b') newW=start.w;
    newW=Math.max(50,newW); newH=Math.max(30,newH);
    if(handle==='r'||handle==='br'){ st.width=Math.round(newW)+'px'; st.maxWidth='100%'; el.style.width=st.width; el.style.maxWidth='100%';}
    if(handle==='b'||handle==='br'){ st.minHeight=Math.round(newH)+'px'; el.style.minHeight=st.minHeight;}
    autosave(); status('Resized live. Publish when ready.');
  };
  const up=()=>{const d=frameDoc();d.removeEventListener(inputType==='touch'?'touchmove':'mousemove',move);d.removeEventListener(inputType==='touch'?'touchend':'mouseup',up)};
  frameDoc().addEventListener(inputType==='touch'?'touchmove':'mousemove',move,{passive:false});
  frameDoc().addEventListener(inputType==='touch'?'touchend':'mouseup',up);
}

function imageControl(field){
  if(field==='heroImage')return data.imageControls.heroImage;
  if(field==='aboutImage')return data.imageControls.aboutImage;
  const m=field.match(/^results\.(\d+)\.image$/);
  if(m)return data.imageControls.results[String(m[1])] || (data.imageControls.results[String(m[1])]={x:50,y:50,zoom:100});
  return {x:50,y:50,zoom:100};
}
function applyImage(field){
  const c=imageControl(field), doc=frameDoc(); if(!doc)return;
  if(field==='heroImage'){doc.documentElement.style.setProperty('--hero-img-x',c.x+'%');doc.documentElement.style.setProperty('--hero-img-y',c.y+'%');doc.documentElement.style.setProperty('--hero-img-zoom',c.zoom+'%');}
  else if(field==='aboutImage'){doc.documentElement.style.setProperty('--about-img-x',c.x+'%');doc.documentElement.style.setProperty('--about-img-y',c.y+'%');doc.documentElement.style.setProperty('--about-img-zoom',c.zoom+'%');}
  else {const m=field.match(/^results\.(\d+)\.image$/); if(m){const el=doc.querySelectorAll('.result')[Number(m[1])]; if(el){el.style.backgroundPosition=`${c.x}% ${c.y}%`; el.style.backgroundSize=`${c.zoom}% auto`;}}}
}
function bindImageMove(el,id){
  // No mouse-wheel zoom here. iPad touchpad friendly.
  el.ondblclick=e=>{e.preventDefault(); const c=imageControl(id); c.x=50;c.y=50;c.zoom=100; applyImage(id); autosave(); toast('Image crop reset')};
}

function editText(){
  if(!selected || selected.type!=='text')return;
  $('textModalTitle').textContent='Edit '+nice(selected.id);
  $('textEditor').value=get(selected.id)||'';
  $('textModal').classList.remove('hidden');
}
function applyText(){
  if(!selected || selected.type!=='text')return;
  pushHistory(); set(selected.id,$('textEditor').value); selected.el.textContent=$('textEditor').value; $('textModal').classList.add('hidden'); status('Text edited. Publish when ready.');
}
function scaleText(amount){
  if(!selected || selected.type!=='text')return;
  pushHistory(); data.textStyles[selected.id]=data.textStyles[selected.id]||{scale:100};
  data.textStyles[selected.id].scale=Math.max(40,Math.min(260,(data.textStyles[selected.id].scale||100)+amount));
  selected.el.style.fontSize=`calc(1em * ${data.textStyles[selected.id].scale/100})`; autosave();
}
function zoomImage(amount){
  if(!selected || selected.type!=='image')return;
  pushHistory(); const c=imageControl(selected.id); c.zoom=Math.max(50,Math.min(300,c.zoom+amount)); applyImage(selected.id); autosave(); status('Image resized. Publish when ready.');
}
async function replaceImage(file){
  if(!file || !selected || selected.type!=='image')return;
  status('Uploading image...');
  const b64=await fileToBase64(file);
  const res=await api('/api/upload',{method:'POST',body:JSON.stringify({name:file.name,data:b64.split(',')[1]})});
  pushHistory(); set(selected.id,res.path);
  const doc=frameDoc();
  if(selected.id==='heroImage')doc.documentElement.style.setProperty('--hero',`url("${res.path}")`);
  else if(selected.id==='aboutImage')doc.documentElement.style.setProperty('--about',`url("${res.path}")`);
  else selected.el.style.backgroundImage=`url("${res.path}")`;
  status('Image replaced. Publish when ready.');
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

function deleteSelected(){
  if(!selected)return;
  pushHistory();
  data.deletedElements=data.deletedElements||[];
  if(!data.deletedElements.includes(selected.id)) data.deletedElements.push(selected.id);
  selected.el.style.display='none';
  $('canvasToolbar').classList.add('hidden');
  autosave(); status('Deleted visually. Publish when ready.');
}
function zChange(amount){
  if(!selected)return;
  pushHistory();
  const st=elementStyle(selected.id);
  st.position=st.position||'relative';
  st.zIndex=Number(st.zIndex||2)+amount;
  selected.el.style.position=st.position; selected.el.style.zIndex=st.zIndex;
  autosave();
}
function resetSelected(){
  if(!selected)return;
  pushHistory();
  delete data.elementStyles[selected.id];
  if(selected.type==='text'){delete data.textStyles[selected.id]; selected.el.style.fontSize='';}
  if(selected.type==='image'){const c=imageControl(selected.id); c.x=50;c.y=50;c.zoom=100; applyImage(selected.id);}
  reloadFrame(); autosave();
}

function renderSections(){
  const hidden=data._builder.hiddenSections||[];
  $('sectionList').innerHTML=data._builder.sectionOrder.map(key=>`
    <div class="section-item ${hidden.includes(key)?'hidden-section':''}" draggable="true" data-key="${key}">
      <strong>☰ ${sectionLabels[key]||key}</strong>
      <button class="small" data-hide="${key}">${hidden.includes(key)?'Show':'Hide'}</button>
    </div>`).join('');
  document.querySelectorAll('[data-hide]').forEach(b=>b.onclick=e=>{e.stopPropagation();pushHistory();toggleHide(b.dataset.hide)});
  let dragged=null;
  document.querySelectorAll('.section-item').forEach(item=>{
    item.ondragstart=()=>{dragged=item.dataset.key;item.classList.add('dragging')};
    item.ondragend=()=>item.classList.remove('dragging');
    item.ondragover=e=>e.preventDefault();
    item.ondrop=e=>{e.preventDefault();const target=item.dataset.key;if(!dragged||dragged===target)return;pushHistory();const arr=data._builder.sectionOrder;arr.splice(arr.indexOf(dragged),1);arr.splice(arr.indexOf(target),0,dragged);renderSections();reloadFrame();autosave();};
  });
}
function toggleHide(key){
  const h=data._builder.hiddenSections; const i=h.indexOf(key);
  if(i>=0)h.splice(i,1); else h.push(key);
  renderSections(); reloadFrame(); autosave();
}

function undo(){if(!history.length)return;redoStack.push(clone(data));data=history.pop();initData();renderSections();reloadFrame();status('Undo')}
function redoIt(){if(!redoStack.length)return;history.push(clone(data));data=redoStack.pop();initData();renderSections();reloadFrame();status('Redo')}
async function publish(){
  try{status('Publishing...');await api('/api/content',{method:'POST',body:JSON.stringify(data,null,2)});localStorage.removeItem('jackal_freeform_draft');toast('Published. Give Cloudflare 30-60 seconds.');status('Published.');}
  catch(e){status('Publish failed: '+e.message)}
}
function clearSelected(){
  const doc=frameDoc();if(doc){doc.querySelectorAll('.jackal-selected').forEach(el=>el.classList.remove('jackal-selected'));doc.querySelectorAll('.jackal-handle').forEach(el=>el.remove());}
  selected=null;
}

$('loginBtn').onclick=login;
$('publishBtn').onclick=publish;
$('sectionsBtn').onclick=()=>$('sectionsPanel').classList.toggle('hidden');
$('undoBtn').onclick=undo;
$('redoBtn').onclick=redoIt;
$('editTextBtn').onclick=editText;
$('applyTextBtn').onclick=applyText;
$('cancelTextBtn').onclick=()=>$('textModal').classList.add('hidden');
$('biggerTextBtn').onclick=()=>scaleText(8);
$('smallerTextBtn').onclick=()=>scaleText(-8);
$('imageUpBtn').onclick=()=>zoomImage(10);
$('imageDownBtn').onclick=()=>zoomImage(-10);
$('replaceImageBtn').onclick=()=>$('imageUpload').click();
$('imageUpload').onchange=e=>replaceImage(e.target.files[0]);
$('bringFrontBtn').onclick=()=>zChange(1);
$('sendBackBtn').onclick=()=>zChange(-1);
$('deleteBtn').onclick=deleteSelected;
$('resetSelectedBtn').onclick=resetSelected;
$('doneBtn').onclick=()=>{$('canvasToolbar').classList.add('hidden');clearSelected();};
$('phoneBtn').onclick=()=>{$('stage').className='stage phone';$('phoneBtn').classList.add('active');$('desktopBtn').classList.remove('active')};
$('desktopBtn').onclick=()=>{$('stage').className='stage desktop';$('desktopBtn').classList.add('active');$('phoneBtn').classList.remove('active')};
autoLogin();

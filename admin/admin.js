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
function pushHistory(){history.push(clone(data)); if(history.length>60) history.shift(); redoStack=[];}
function status(msg){$('status').textContent=msg}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2400)}
function get(path){return path.split('.').reduce((o,k)=>o?o[k]:undefined,data)}
function set(path,val){const parts=path.split('.');let obj=data;while(parts.length>1){let k=parts.shift();obj[k]=obj[k]||{};obj=obj[k]}obj[parts[0]]=val;autosave();}
function autosave(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{localStorage.setItem('jackal_canvas_draft',JSON.stringify(data));status('Draft saved locally. Publish when ready.')},300)}
function api(path, opts={}){return fetch(path,{...opts,headers:{'Content-Type':'application/json','X-Admin-Password':password,...(opts.headers||{})}}).then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()})}
function nice(s){return String(s).replace(/([A-Z])/g,' $1').replace(/[._-]/g,' ').replace(/^./,x=>x.toUpperCase())}

async function login(){
  try{
    password = $('password').value.trim();
    const r = await api('/api/content');
    data = r.data || r;
    const draft = localStorage.getItem('jackal_canvas_draft');
    if(draft && confirm('Load your local draft?')) data = JSON.parse(draft);
    initData();
    localStorage.setItem('fiaz_admin_password',password);
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    renderSections();
    bindFrame();
    status('Loaded. Click the website.');
  }catch(e){$('loginMsg').textContent='Login failed. Check password.'}
}
async function autoLogin(){
  if(!password)return;
  try{
    const r=await api('/api/content'); data=r.data||r;
    const draft=localStorage.getItem('jackal_canvas_draft');
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
}

function frameDoc(){return $('siteFrame').contentDocument}
function reloadFrame(){ $('siteFrame').src='/?canvasbuilder=1&cache='+Date.now(); setTimeout(bindFrame,900); }
function bindFrame(){ const f=$('siteFrame'); f.onload=()=>setTimeout(injectCanvas,350); setTimeout(injectCanvas,850); }

function injectCanvas(){
  const doc=frameDoc(); if(!doc)return;
  if(!doc.getElementById('jackal-canvas-style')){
    const st=doc.createElement('style'); st.id='jackal-canvas-style';
    st.textContent=`
      [data-builder-field],[data-builder-id],.hero,.photo,.result{outline:2px solid transparent;outline-offset:4px;transition:outline .12s;box-sizing:border-box}
      [data-builder-field]:hover,[data-builder-id]:hover,.hero:hover,.photo:hover,.result:hover{outline-color:#4aa3ff!important;cursor:pointer}
      .jackal-selected{outline:3px solid #f4d77e!important;outline-offset:5px!important;position:relative!important}
      .jackal-handle{position:absolute;width:16px;height:16px;background:#f4d77e;border:2px solid #050505;border-radius:50%;z-index:999999}
      .jackal-handle.br{right:-12px;bottom:-12px;cursor:nwse-resize}
      .jackal-handle.r{right:-12px;top:50%;transform:translateY(-50%);cursor:ew-resize}
      .jackal-handle.b{left:50%;bottom:-12px;transform:translateX(-50%);cursor:ns-resize}
      body.jackal-grabbing *{cursor:grabbing!important;user-select:none!important}
    `;
    doc.head.appendChild(st);
  }

  doc.querySelectorAll('[data-builder-field]').forEach(el=>{
    el.onclick=e=>{e.preventDefault();e.stopPropagation();selectText(el.dataset.builderField,el)};
  });

  doc.querySelectorAll('[data-builder-id]').forEach(el=>{
    el.onclick=e=>{
      if(e.target.closest('[data-builder-field],a,button')) return;
      e.preventDefault();e.stopPropagation();selectElement(el.dataset.builderId,el);
    };
  });

  const hero=doc.querySelector('.hero');
  if(hero){hero.dataset.builderId='home'; hero.onclick=e=>{if(e.target.closest('[data-builder-field],a,button'))return;e.preventDefault();selectImage('heroImage',hero)}; bindImageDrag(hero,'heroImage');}
  const about=doc.querySelector('.photo');
  if(about){about.dataset.builderId='aboutPhoto'; about.onclick=e=>{e.preventDefault();e.stopPropagation();selectImage('aboutImage',about)}; bindImageDrag(about,'aboutImage');}
  doc.querySelectorAll('.result').forEach((el,i)=>{const field=`results.${i}.image`; el.onclick=e=>{e.preventDefault();e.stopPropagation();selectImage(field,el)}; bindImageDrag(el,field);});
}

function clearSelected(){
  const doc=frameDoc(); if(!doc)return;
  doc.querySelectorAll('.jackal-selected').forEach(el=>el.classList.remove('jackal-selected'));
  doc.querySelectorAll('.jackal-handle').forEach(el=>el.remove());
}

function selectText(field,el){
  clearSelected(); el.classList.add('jackal-selected');
  selected={type:'text',field,id:field,el};
  addHandles(el, field, 'text');
  showToolbar('text');
}
function selectImage(field,el){
  clearSelected(); el.classList.add('jackal-selected');
  selected={type:'image',field,id:field,el};
  addHandles(el, field, 'image');
  showToolbar('image');
}
function selectElement(id,el){
  clearSelected(); el.classList.add('jackal-selected');
  selected={type:'element',id,field:id,el};
  addHandles(el,id,'element');
  showToolbar('element');
}
function showToolbar(type){
  $('canvasToolbar').classList.remove('hidden');
  $('editTextBtn').style.display=type==='text'?'inline-flex':'none';
  $('biggerTextBtn').style.display=type==='text'?'inline-flex':'none';
  $('smallerTextBtn').style.display=type==='text'?'inline-flex':'none';
  $('imageUpBtn').style.display=type==='image'?'inline-flex':'none';
  $('imageDownBtn').style.display=type==='image'?'inline-flex':'none';
  $('replaceImageBtn').style.display=type==='image'?'inline-flex':'none';
  $('duplicateBtn').style.display=['element','image'].includes(type)?'inline-flex':'none';
}

function addHandles(el,id,type){
  if(!['element','image','text'].includes(type))return;
  ['br','r','b'].forEach(cls=>{
    const h=frameDoc().createElement('div');
    h.className='jackal-handle '+cls;
    h.onmousedown=e=>startResize(e, el, id, cls, type);
    el.appendChild(h);
  });
}

function styleFor(id){
  data.elementStyles[id]=data.elementStyles[id]||{};
  return data.elementStyles[id];
}
function startResize(e,el,id,handle,type){
  e.preventDefault();e.stopPropagation();pushHistory();
  const rect=el.getBoundingClientRect();
  const start={x:e.clientX,y:e.clientY,w:rect.width,h:rect.height};
  const currentStyle=styleFor(id);
  frameDoc().body.classList.add('jackal-grabbing');
  const move=ev=>{
    let newW=start.w + (ev.clientX-start.x);
    let newH=start.h + (ev.clientY-start.y);
    if(handle==='r') newH=start.h;
    if(handle==='b') newW=start.w;
    newW=Math.max(80,newW); newH=Math.max(40,newH);
    if(handle==='r'||handle==='br'){ currentStyle.width=Math.round(newW)+'px'; currentStyle.maxWidth='100%'; el.style.width=currentStyle.width; el.style.maxWidth='100%';}
    if(handle==='b'||handle==='br'){ currentStyle.minHeight=Math.round(newH)+'px'; el.style.minHeight=currentStyle.minHeight;}
    autosave(); status('Resized live. Publish when ready.');
  };
  const up=()=>{frameDoc().removeEventListener('mousemove',move);frameDoc().removeEventListener('mouseup',up);frameDoc().body.classList.remove('jackal-grabbing')};
  frameDoc().addEventListener('mousemove',move);
  frameDoc().addEventListener('mouseup',up);
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
function bindImageDrag(el,field){
  el.onmousedown=e=>{
    if(e.target.classList.contains('jackal-handle') || e.target.closest('[data-builder-field],a,button')) return;
    e.preventDefault();e.stopPropagation();selectImage(field,el);pushHistory();
    const c=imageControl(field), rect=el.getBoundingClientRect(), start={x:e.clientX,y:e.clientY,cx:c.x,cy:c.y};
    frameDoc().body.classList.add('jackal-grabbing');
    const move=ev=>{
      c.x=Math.max(0,Math.min(100,start.cx+((ev.clientX-start.x)/rect.width)*100));
      c.y=Math.max(0,Math.min(100,start.cy+((ev.clientY-start.y)/rect.height)*100));
      applyImage(field);autosave();status('Image moved live. Publish when ready.');
    };
    const up=()=>{frameDoc().removeEventListener('mousemove',move);frameDoc().removeEventListener('mouseup',up);frameDoc().body.classList.remove('jackal-grabbing')};
    frameDoc().addEventListener('mousemove',move);
    frameDoc().addEventListener('mouseup',up);
  };
  el.onwheel=e=>{
    e.preventDefault();selectImage(field,el);
    const c=imageControl(field); c.zoom=Math.max(50,Math.min(280,c.zoom+(e.deltaY<0?8:-8)));
    applyImage(field);autosave();status('Image zoomed live. Publish when ready.');
  };
  el.ondblclick=e=>{e.preventDefault();const c=imageControl(field);c.x=50;c.y=50;c.zoom=100;applyImage(field);autosave();toast('Image reset')};
}

function editText(){
  if(!selected || selected.type!=='text')return;
  $('textModalTitle').textContent='Edit '+nice(selected.field);
  $('textEditor').value=get(selected.field)||'';
  $('textModal').classList.remove('hidden');
}
function applyText(){
  if(!selected || selected.type!=='text')return;
  pushHistory(); set(selected.field,$('textEditor').value); selected.el.textContent=$('textEditor').value; $('textModal').classList.add('hidden'); status('Text edited live. Publish when ready.');
}
function scaleText(amount){
  if(!selected || selected.type!=='text')return;
  pushHistory(); data.textStyles[selected.field]=data.textStyles[selected.field]||{scale:100};
  data.textStyles[selected.field].scale=Math.max(40,Math.min(240,(data.textStyles[selected.field].scale||100)+amount));
  selected.el.style.fontSize=`calc(1em * ${data.textStyles[selected.field].scale/100})`; autosave();
}
function zoomImage(amount){
  if(!selected || selected.type!=='image')return;
  pushHistory(); const c=imageControl(selected.field); c.zoom=Math.max(50,Math.min(280,c.zoom+amount)); applyImage(selected.field); autosave();
}
async function replaceImage(file){
  if(!file || !selected || selected.type!=='image')return;
  status('Uploading image...');
  const b64=await fileToBase64(file);
  const res=await api('/api/upload',{method:'POST',body:JSON.stringify({name:file.name,data:b64.split(',')[1]})});
  pushHistory(); set(selected.field,res.path);
  const doc=frameDoc();
  if(selected.field==='heroImage')doc.documentElement.style.setProperty('--hero',`url("${res.path}")`);
  else if(selected.field==='aboutImage')doc.documentElement.style.setProperty('--about',`url("${res.path}")`);
  else selected.el.style.backgroundImage=`url("${res.path}")`;
  status('Image replaced live. Publish when ready.');
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

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

function duplicateSelected(){
  if(!selected)return;
  pushHistory();
  if(selected.id?.startsWith('service-card-') && Array.isArray(data.services)){
    const i=Number(selected.id.split('-').pop()); data.services.splice(i+1,0,clone(data.services[i]));
  } else if(selected.id?.startsWith('result-card-') && Array.isArray(data.results)){
    const i=Number(selected.id.split('-').pop()); data.results.splice(i+1,0,clone(data.results[i]));
  } else if(selected.id?.startsWith('price-card-') && Array.isArray(data.packages)){
    const i=Number(selected.id.split('-').pop()); data.packages.splice(i+1,0,clone(data.packages[i]));
  }
  initData(); reloadFrame(); autosave(); toast('Duplicated');
}

function resetSelected(){
  if(!selected)return; pushHistory();
  if(selected.type==='image'){const c=imageControl(selected.field);c.x=50;c.y=50;c.zoom=100;applyImage(selected.field);}
  if(selected.type==='text'){data.textStyles[selected.field]={scale:100};selected.el.style.fontSize='';}
  if(selected.id && data.elementStyles[selected.id]){delete data.elementStyles[selected.id]; reloadFrame();}
  autosave();
}

function undo(){if(!history.length)return;redoStack.push(clone(data));data=history.pop();initData();renderSections();reloadFrame();status('Undo')}
function redoIt(){if(!redoStack.length)return;history.push(clone(data));data=redoStack.pop();initData();renderSections();reloadFrame();status('Redo')}
async function publish(){
  try{status('Publishing...');await api('/api/content',{method:'POST',body:JSON.stringify(data,null,2)});localStorage.removeItem('jackal_canvas_draft');toast('Published. Give Cloudflare 30-60 seconds.');status('Published.');}
  catch(e){status('Publish failed: '+e.message)}
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
$('duplicateBtn').onclick=duplicateSelected;
$('resetSelectedBtn').onclick=resetSelected;
$('doneBtn').onclick=()=>{$('canvasToolbar').classList.add('hidden');clearSelected();};
$('phoneBtn').onclick=()=>{$('stage').className='stage phone';$('phoneBtn').classList.add('active');$('desktopBtn').classList.remove('active')};
$('desktopBtn').onclick=()=>{$('stage').className='stage desktop';$('desktopBtn').classList.add('active');$('phoneBtn').classList.remove('active')};
autoLogin();

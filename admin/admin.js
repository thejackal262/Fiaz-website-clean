let data = null;
let selected = null;
let password = localStorage.getItem('fiaz_admin_password') || '';
let history = [];
let redoStack = [];
let draftTimer = null;
const $ = id => document.getElementById(id);

function clone(x){return JSON.parse(JSON.stringify(x))}
function pushHistory(){history.push(clone(data)); if(history.length>100) history.shift(); redoStack=[]}
function status(msg){$('status').textContent=msg}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2400)}
function api(path,opts={}){return fetch(path,{...opts,headers:{'Content-Type':'application/json','X-Admin-Password':password,...(opts.headers||{})}}).then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()})}
function autosave(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{localStorage.setItem('jackal_black_draft',JSON.stringify(data));status('Draft saved locally. Publish when ready.')},250)}
function kebab(k){return k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}
function cssText(styles={}){return Object.entries(styles).map(([k,v])=>`${kebab(k)}:${v}`).join(';')}
function imageCss(l){const c=l.crop||{x:50,y:50,zoom:100};const size=l.mode==='contain'?'contain':`${c.zoom||100}% auto`;return `background-image:url('${l.src||''}');background-position:${c.x??50}% ${c.y??50}%;background-size:${size};`}

async function login(){
  try{
    password = $('password').value.trim();
    const res = await fetch('/content/layers.json?cache='+Date.now());
    data = await res.json();
    const draft=localStorage.getItem('jackal_black_draft');
    if(draft && confirm('Load local draft?')) data=JSON.parse(draft);
    localStorage.setItem('fiaz_admin_password',password);
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    render(); status('Loaded. Black Edition ready.');
  }catch(e){$('loginMsg').textContent='Login failed or layers.json missing.'}
}
async function autoLogin(){
  if(!password) return;
  try{
    const res=await fetch('/content/layers.json?cache='+Date.now());
    data=await res.json();
    const draft=localStorage.getItem('jackal_black_draft');
    if(draft && confirm('Load local draft?')) data=JSON.parse(draft);
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    render();
  }catch(e){}
}

function render(){
  const canvas=$('canvas');
  canvas.style.minHeight=(data.canvas?.desktop?.height||6200)+'px';
  canvas.innerHTML='';
  (data.sections||[]).forEach(sec=>{
    if(sec.hidden) return;
    const el=document.createElement('section');
    el.className='section-layer';
    el.dataset.sectionId=sec.id;
    el.style.cssText=`top:${sec.y}px;height:${sec.h}px;z-index:${sec.z||1};background:${sec.background||'transparent'};`;
    canvas.appendChild(el);
  });
  (data.layers||[]).forEach(l=>{
    if(l.hidden) return;
    const sec=(data.sections||[]).find(s=>s.id===l.section);
    const parent=canvas.querySelector(`[data-section-id="${l.section}"]`)||canvas;
    const el=document.createElement(l.type==='button'?'a':'div');
    el.className='layer '+l.type;
    el.dataset.id=l.id;
    if(l.type==='button') el.href=l.href||'#';
    let st=`left:${l.x}px;top:${l.y-(sec?.y||0)}px;width:${l.w}px;height:${l.h}px;z-index:${l.z||1};${cssText(l.styles||{})}`;
    if(l.type==='image') st+=imageCss(l);
    el.style.cssText=st;
    if(l.type!=='image' && l.type!=='card') el.textContent=l.content||'';
    el.onclick=e=>{e.preventDefault();e.stopPropagation();selectLayer(l.id)};
    bindMove(el,l.id);
    parent.appendChild(el);
  });
  renderLayersPanel();
}

function getLayer(id){return data.layers.find(l=>l.id===id)}
function getEl(id){return document.querySelector(`.layer[data-id="${CSS.escape(id)}"]`)}

function selectLayer(id){
  clearSelection();
  const l=getLayer(id), el=getEl(id);
  if(!l||!el) return;
  selected=id;
  el.classList.add('selected');
  addHandles(el,id);
  showToolbox(l);
  updateInspector(l);
}
function clearSelection(){
  document.querySelectorAll('.layer.selected').forEach(el=>el.classList.remove('selected'));
  document.querySelectorAll('.handle').forEach(h=>h.remove());
  selected=null;
}
function showToolbox(l){
  $('toolbox').classList.remove('hidden');
  $('editTextBtn').style.display=['text','button'].includes(l.type)?'inline-flex':'none';
  $('biggerBtn').style.display=['text','button','image'].includes(l.type)?'inline-flex':'none';
  $('smallerBtn').style.display=['text','button','image'].includes(l.type)?'inline-flex':'none';
  $('replaceBtn').style.display=l.type==='image'?'inline-flex':'none';
}
function addHandles(el,id){
  ['br','r','b'].forEach(cls=>{
    const h=document.createElement('div');
    h.className='handle '+cls;
    h.onmousedown=e=>startResize(e,id,cls);
    el.appendChild(h);
  });
}

function bindMove(el,id){
  el.onmousedown=e=>{
    if(e.target.classList.contains('handle')) return;
    e.preventDefault(); selectLayer(id);
    const l=getLayer(id);
    if(l.locked){toast('Layer is locked');return;}
    pushHistory();
    const sec=(data.sections||[]).find(s=>s.id===l.section);
    const start={x:e.clientX,y:e.clientY,lx:l.x,ly:l.y};
    const move=ev=>{
      l.x=Math.round(start.lx+ev.clientX-start.x);
      l.y=Math.round(start.ly+ev.clientY-start.y);
      el.style.left=l.x+'px';
      el.style.top=(l.y-(sec?.y||0))+'px';
      updateInspector(l);
      autosave(); status('Moved. Publish when ready.');
    };
    const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',up);
  };
}
function startResize(e,id,handle){
  e.preventDefault();e.stopPropagation();
  const l=getLayer(id); if(l.locked){toast('Layer is locked');return;}
  pushHistory();
  const el=getEl(id);
  const start={x:e.clientX,y:e.clientY,w:l.w,h:l.h};
  const move=ev=>{
    let w=start.w+ev.clientX-start.x, h=start.h+ev.clientY-start.y;
    if(handle==='r') h=start.h;
    if(handle==='b') w=start.w;
    l.w=Math.max(20,Math.round(w)); l.h=Math.max(20,Math.round(h));
    el.style.width=l.w+'px'; el.style.height=l.h+'px';
    updateInspector(l);
    autosave(); status('Resized. Publish when ready.');
  };
  const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up)};
  document.addEventListener('mousemove',move);
  document.addEventListener('mouseup',up);
}

function editText(){
  const l=getLayer(selected); if(!l)return;
  $('textEditor').value=l.content||'';
  $('textModal').classList.remove('hidden');
}
function applyText(){
  const l=getLayer(selected); if(!l)return;
  pushHistory(); l.content=$('textEditor').value; $('textModal').classList.add('hidden'); render(); selectLayer(l.id); autosave();
}
function scaleText(amount){
  const l=getLayer(selected); if(!l)return;
  pushHistory();
  const current=parseInt(l.styles.fontSize||'20',10);
  l.styles.fontSize=Math.max(8,current+amount)+'px';
  render(); selectLayer(l.id); autosave();
}
function imageZoom(amount){
  const l=getLayer(selected); if(!l || l.type!=='image') return;
  pushHistory();
  l.crop=l.crop||{x:50,y:50,zoom:100};
  l.crop.zoom=Math.max(20,Math.min(320,(l.crop.zoom||100)+amount));
  render(); selectLayer(l.id); autosave();
}
async function replaceImage(file){
  const l=getLayer(selected); if(!file||!l||l.type!=='image')return;
  status('Uploading...');
  const b64=await fileToBase64(file);
  const res=await api('/api/upload',{method:'POST',body:JSON.stringify({name:file.name,data:b64.split(',')[1]})});
  pushHistory(); l.src=res.path; render(); selectLayer(l.id); autosave(); status('Image replaced. Publish when ready.');
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
function z(amount){const l=getLayer(selected); if(!l)return; pushHistory(); l.z=(l.z||1)+amount; render(); selectLayer(l.id); autosave();}
function lock(){const l=getLayer(selected); if(!l)return; pushHistory(); l.locked=!l.locked; autosave(); toast(l.locked?'Locked':'Unlocked')}
function hide(){const l=getLayer(selected); if(!l)return; pushHistory(); l.hidden=true; $('toolbox').classList.add('hidden'); render(); autosave();}
function duplicate(){
  const l=getLayer(selected); if(!l)return; pushHistory();
  const n=clone(l); n.id=l.id+'-copy-'+Date.now(); n.x+=35; n.y+=35; n.z=(l.z||1)+1;
  data.layers.push(n); render(); selectLayer(n.id); autosave();
}
function del(){const l=getLayer(selected); if(!l)return; pushHistory(); data.layers=data.layers.filter(x=>x.id!==l.id); $('toolbox').classList.add('hidden'); render(); autosave();}
function addLayer(type){
  pushHistory();
  const id=type+'-'+Date.now();
  const base={id,type,section:'hero',x:140,y:160,w:300,h:90,z:200,locked:false,hidden:false,styles:{}};
  if(type==='text'){base.content='New premium text';base.styles={fontSize:'42px',fontWeight:'1000',color:'#ffffff',textTransform:'uppercase'}}
  if(type==='button'){base.content='Button';base.href='#';base.styles={background:'linear-gradient(135deg,#fff5c5,#d8a331 42%,#815505)',color:'#050505',fontWeight:'1000',borderRadius:'16px'}}
  if(type==='card'){base.styles={background:'linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.025))',border:'1px solid rgba(244,215,126,.25)',borderRadius:'28px'}}
  data.layers.push(base); render(); selectLayer(id); autosave();
}
function renderLayersPanel(){
  $('layersList').innerHTML=[...data.layers].sort((a,b)=>(b.z||0)-(a.z||0)).map(l=>`
    <div class="layer-row" data-row="${l.id}">
      <span>${l.hidden?'👁️‍🗨️':'☰'} ${l.id}</span><small>${l.type}</small>
    </div>`).join('');
  document.querySelectorAll('[data-row]').forEach(r=>r.onclick=()=>selectLayer(r.dataset.row));
}
function updateInspector(l){
  if(!l) return;
  $('inspectorName').textContent = l.id + ' / ' + l.type;
  $('propX').value=l.x; $('propY').value=l.y; $('propW').value=l.w; $('propH').value=l.h; $('propZ').value=l.z||1;
  $('propOpacity').value=l.styles?.opacity ?? '';
  $('propColor').value=l.styles?.color ?? '';
  $('propBg').value=l.styles?.background ?? '';
  $('propRadius').value=l.styles?.borderRadius ?? '';
}
function applyInspector(){
  const l=getLayer(selected); if(!l)return;
  pushHistory();
  l.x=Number($('propX').value||l.x); l.y=Number($('propY').value||l.y); l.w=Number($('propW').value||l.w); l.h=Number($('propH').value||l.h); l.z=Number($('propZ').value||l.z);
  l.styles=l.styles||{};
  if($('propOpacity').value!=='') l.styles.opacity=$('propOpacity').value;
  if($('propColor').value!=='') l.styles.color=$('propColor').value;
  if($('propBg').value!=='') l.styles.background=$('propBg').value;
  if($('propRadius').value!=='') l.styles.borderRadius=$('propRadius').value;
  render(); selectLayer(l.id); autosave();
}
function undo(){if(!history.length)return;redoStack.push(clone(data));data=history.pop();render();status('Undo')}
function redo(){if(!redoStack.length)return;history.push(clone(data));data=redoStack.pop();render();status('Redo')}
async function publish(){
  try{
    status('Publishing...');
    await api('/api/layers',{method:'POST',body:JSON.stringify(data,null,2)});
    localStorage.removeItem('jackal_black_draft');
    toast('Published. Give Cloudflare 30-60 seconds.');
    status('Published.');
  }catch(e){status('Publish failed: '+e.message)}
}

$('loginBtn').onclick=login;
$('publishBtn').onclick=publish;
$('editTextBtn').onclick=editText;
$('applyTextBtn').onclick=applyText;
$('cancelTextBtn').onclick=()=>$('textModal').classList.add('hidden');
$('biggerBtn').onclick=()=>{const l=getLayer(selected); if(!l)return; l.type==='image'?imageZoom(10):scaleText(6)};
$('smallerBtn').onclick=()=>{const l=getLayer(selected); if(!l)return; l.type==='image'?imageZoom(-10):scaleText(-6)};
$('replaceBtn').onclick=()=>$('imageUpload').click();
$('imageUpload').onchange=e=>replaceImage(e.target.files[0]);
$('frontBtn').onclick=()=>z(1);
$('backBtn').onclick=()=>z(-1);
$('lockBtn').onclick=lock;
$('hideBtn').onclick=hide;
$('duplicateBtn').onclick=duplicate;
$('deleteBtn').onclick=del;
$('doneBtn').onclick=()=>{$('toolbox').classList.add('hidden');document.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));selected=null};
$('addTextBtn').onclick=()=>addLayer('text');
$('addButtonBtn').onclick=()=>addLayer('button');
$('addBoxBtn').onclick=()=>addLayer('card');
$('layersBtn').onclick=()=>$('layersPanel').classList.toggle('hidden');
$('inspectorBtn').onclick=()=>$('inspector').classList.toggle('hidden');
$('applyInspectorBtn').onclick=applyInspector;
$('undoBtn').onclick=undo;
$('redoBtn').onclick=redo;
autoLogin();

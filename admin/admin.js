let data = {};
let password = localStorage.getItem('fiaz_admin_password') || '';
let currentField = null;
let currentImageField = null;
let currentImagePath = null;
let dragState = null;
const $ = id => document.getElementById(id);

const editableFields = [
  'brandName','heroBadge','heroLine1','heroLine2','heroLine3','heroText',
  'primaryButtonText','secondaryButtonText','aboutKicker','aboutTitle','aboutText',
  'servicesKicker','servicesTitle','servicesText','bannerText',
  'resultsKicker','resultsTitle','resultsText','pricingKicker','pricingTitle','pricingText',
  'testimonialKicker','testimonialTitle','testimonialText','testimonialName',
  'faqKicker','faqTitle','finalKicker','finalTitle','finalText','emailButtonText','footerText'
];

const sectionLabels = {
  about:'About',
  services:'Services',
  results:'Transformations / Results',
  pricing:'Packages / Pricing',
  testimonial:'Testimonial',
  faq:'FAQ',
  contact:'Contact'
};

const layoutControls = [
  ['layout.maxWidth','Website max width',900,1500,10],
  ['layout.sectionPadding','Section spacing desktop',50,180,5],
  ['layout.mobileSectionPadding','Section spacing mobile',40,120,5],
  ['layout.heroHeight','Hero height',60,120,1],
  ['layout.heroOverlayStrength','Hero dark overlay',30,95,1],
  ['layout.heroImageFocusX','Hero image left/right',0,100,1],
  ['layout.heroImageFocusY','Hero image up/down',0,100,1],
  ['layout.aboutImageWidth','About image width %',30,70,1],
  ['layout.aboutTextWidth','About text width %',30,70,1],
  ['layout.aboutGap','About gap',10,100,1],
  ['layout.aboutImageHeight','About image height',300,800,10],
  ['layout.servicesColumns','Services cards per row',1,4,1],
  ['layout.servicesCardPadding','Services card padding',16,60,1],
  ['layout.servicesCardRadius','Services card roundness',0,50,1],
  ['layout.resultsColumns','Results cards per row',1,4,1],
  ['layout.resultsCardHeight','Results card height',250,700,10],
  ['layout.pricingColumns','Pricing cards per row',1,4,1],
  ['layout.pricingCardPadding','Pricing card padding',16,60,1],
  ['layout.pricingCardRadius','Pricing card roundness',0,50,1],
  ['layout.buttonRadius','Button roundness',0,40,1],
  ['layout.buttonHeight','Button height',44,80,1]
];

function nice(s){return s.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase())}
function get(path){return path.split('.').reduce((o,k)=>o?o[k]:undefined,data)}
function set(path,val){const parts=path.split('.');let obj=data;while(parts.length>1){let k=parts.shift();obj[k]=obj[k]||{};obj=obj[k]}obj[parts[0]]=val}
function esc(v){return String(v ?? '').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function status(msg, ok=true){const el=$('status');el.textContent=msg;el.className=ok?'status-ok':'status-bad'}
function getPassword(){return password || $('password').value.trim()}

async function api(path, opts={}){
  const res = await fetch(path,{...opts,headers:{'Content-Type':'application/json','X-Admin-Password':getPassword(),...(opts.headers||{})}});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function login(){
  try{
    password = $('password').value.trim();
    const r = await api('/api/content');
    data = r.data || r;
    localStorage.setItem('fiaz_admin_password', password);
    $('login').classList.add('hidden');
    $('builder').classList.remove('hidden');
    initialiseData();
    renderAll();
    setTimeout(injectPreviewEditor, 900);
    status('Loaded. Edit the site.');
  }catch(e){
    $('loginMsg').textContent = 'Login failed. Check password.';
  }
}

async function autoLogin(){
  if(!password) return;
  try{
    const r = await api('/api/content');
    data = r.data || r;
    $('login').classList.add('hidden');
    $('builder').classList.remove('hidden');
    initialiseData();
    renderAll();
    setTimeout(injectPreviewEditor, 900);
  }catch(e){ localStorage.removeItem('fiaz_admin_password'); }
}

function initialiseData(){
  data._builder = data._builder || {};
  data._builder.sectionOrder = data._builder.sectionOrder || ['about','services','results','pricing','testimonial','faq','contact'];
  data.layout = data.layout || {};
  data.imageControls = data.imageControls || {};
  data.imageControls.heroImage = data.imageControls.heroImage || {x:72,y:50,zoom:100};
  data.imageControls.aboutImage = data.imageControls.aboutImage || {x:50,y:50,zoom:100};
  data.imageControls.results = data.imageControls.results || {};
  if(Array.isArray(data.results)){
    data.results.forEach((_,i)=>data.imageControls.results[String(i)] = data.imageControls.results[String(i)] || {x:50,y:50,zoom:100});
  }
}

function renderAll(){
  renderQuickFields();
  renderSections();
  renderLayout();
  renderContent();
}

function renderQuickFields(){
  $('quickFields').innerHTML = editableFields.map(f=>`<button class="quick-btn" type="button" data-edit-field="${f}"><span>${nice(f)}</span><span>✏️</span></button>`).join('');
  document.querySelectorAll('[data-edit-field]').forEach(btn=>btn.onclick=()=>openEditor(btn.dataset.editField));
}

function renderSections(){
  $('sectionList').innerHTML = data._builder.sectionOrder.map(key=>`
    <div class="section-item" draggable="true" data-section-key="${key}">
      <strong>☰ ${sectionLabels[key] || nice(key)}</strong>
      <div class="section-actions">
        <button class="small-btn" data-up="${key}">↑</button>
        <button class="small-btn" data-down="${key}">↓</button>
      </div>
    </div>`).join('');

  document.querySelectorAll('[data-up]').forEach(b=>b.onclick=e=>{e.stopPropagation(); moveSection(b.dataset.up,-1)});
  document.querySelectorAll('[data-down]').forEach(b=>b.onclick=e=>{e.stopPropagation(); moveSection(b.dataset.down,1)});

  let dragged = null;
  document.querySelectorAll('.section-item').forEach(item=>{
    item.addEventListener('dragstart',()=>{dragged=item.dataset.sectionKey;item.classList.add('dragging')});
    item.addEventListener('dragend',()=>item.classList.remove('dragging'));
    item.addEventListener('dragover',e=>e.preventDefault());
    item.addEventListener('drop',e=>{
      e.preventDefault();
      const target = item.dataset.sectionKey;
      if(!dragged || dragged===target) return;
      const arr = data._builder.sectionOrder;
      arr.splice(arr.indexOf(dragged),1);
      arr.splice(arr.indexOf(target),0,dragged);
      renderSections();
      reloadPreview();
      status('Section order changed. Save when ready.');
    });
  });
}

function moveSection(key, dir){
  const arr = data._builder.sectionOrder;
  const i = arr.indexOf(key), j = i + dir;
  if(i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  renderSections();
  reloadPreview();
  status('Section order changed. Save when ready.');
}

function renderLayout(){
  const html = [
    `<div class="field"><label>Hero text alignment</label><select data-path="layout.heroTextAlign"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></div>`,
    `<div class="field"><label>About image position</label><select data-path="layout.aboutImagePosition"><option value="left">Left</option><option value="right">Right</option></select></div>`,
    ...layoutControls.map(([path,label,min,max,step])=>{
      const val = get(path) ?? min;
      return `<div class="field"><label>${label}</label><div class="range-row"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-range="${path}"><input type="number" value="${val}" data-number="${path}"></div></div>`;
    })
  ].join('');
  $('layoutFields').innerHTML = html;
  document.querySelectorAll('[data-path]').forEach(el=>{el.value=get(el.dataset.path)||el.value; el.onchange=()=>{set(el.dataset.path,el.value);reloadPreview();status('Layout changed. Save when ready.')}});
  document.querySelectorAll('[data-range]').forEach(el=>el.oninput=()=>{set(el.dataset.range,Number(el.value));document.querySelector(`[data-number="${el.dataset.range}"]`).value=el.value;reloadPreviewSoft();});
  document.querySelectorAll('[data-number]').forEach(el=>el.oninput=()=>{set(el.dataset.number,Number(el.value));document.querySelector(`[data-range="${el.dataset.number}"]`).value=el.value;reloadPreviewSoft();});
}

let softTimer = null;
function reloadPreviewSoft(){ clearTimeout(softTimer); softTimer=setTimeout(()=>{reloadPreview();status('Layout changed. Save when ready.')},350); }
function reloadPreview(){ $('preview').src='/?preview=builder&cache='+Date.now(); setTimeout(injectPreviewEditor,1000); }

function input(path,label,type='text'){
  return `<div class="field"><label>${label}</label><input data-input="${path}" type="${type}" value="${esc(get(path))}"></div>`;
}
function area(path,label){
  return `<div class="field"><label>${label}</label><textarea data-input="${path}">${esc(Array.isArray(get(path))?get(path).join('\\n'):get(path))}</textarea></div>`;
}
function image(path,label){
  return `<div class="field"><label>${label}</label><input data-input="${path}" value="${esc(get(path))}"><input type="file" accept="image/*" data-upload="${path}">${get(path)?`<img class="preview-img" src="${esc(get(path))}">`:''}</div>`;
}

function listEditor(name, fields){
  const arr = Array.isArray(data[name]) ? data[name] : [];
  return `<div>${arr.map((item,i)=>`
    <div class="list-card">
      <h3>${nice(name)} ${i+1}</h3>
      <div class="row">${fields.map(f=>{
        const path = `${name}.${i}.${f}`;
        if(f==='text' || f==='answer' || f==='items') return area(path,nice(f));
        if(f==='image') return image(path,nice(f));
        return input(path,nice(f));
      }).join('')}</div>
      <button class="danger" data-remove="${name}.${i}" type="button">Remove</button>
    </div>`).join('')}<button class="add" data-add="${name}" type="button">Add ${nice(name)}</button></div>`;
}

function renderContent(){
  $('contentFields').innerHTML = `
    <div class="field"><label>SEO</label>${input('seoTitle','Browser title')}${area('seoDescription','Google description')}</div>
    ${image('logo','Logo')}
    ${image('heroImage','Hero image')}
    ${image('aboutImage','About image')}
    ${area('aboutPoints','About bullet points')}
    <h3>Services</h3>${listEditor('services',['small','title','text'])}
    <h3>Results / Transformations</h3>${listEditor('results',['image','label'])}
    <h3>Packages</h3>${listEditor('packages',['name','price','button','items','featured'])}
    <h3>FAQs</h3>${listEditor('faqs',['question','answer'])}
    ${input('email','Email')}
    ${input('instagram','Instagram')}
    ${input('tiktok','TikTok')}
    ${input('youtube','YouTube')}
  `;
  bindContentInputs();
}

function bindContentInputs(){
  document.querySelectorAll('[data-input]').forEach(el=>{
    el.oninput=()=>{
      let val = el.value;
      if(el.dataset.input.endsWith('items') || el.dataset.input==='aboutPoints') val = el.value.split('\\n').filter(Boolean);
      if(el.dataset.input.endsWith('featured')) val = ['true','yes','1'].includes(el.value.toLowerCase());
      set(el.dataset.input,val);
      status('Content changed. Save when ready.');
    };
  });
  document.querySelectorAll('[data-add]').forEach(btn=>btn.onclick=()=>{
    const n=btn.dataset.add;
    data[n]=Array.isArray(data[n])?data[n]:[];
    const templates={services:{small:'',title:'',text:''},results:{image:'',label:''},packages:{name:'',price:'',button:'Enquire',items:[],featured:false},faqs:{question:'',answer:''}};
    data[n].push(templates[n]||{});
    renderContent();
  });
  document.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{
    const [name,i]=btn.dataset.remove.split('.');
    data[name].splice(Number(i),1);
    renderContent();
  });
  document.querySelectorAll('[data-upload]').forEach(inputEl=>{
    inputEl.onchange=async()=>{
      const file=inputEl.files[0]; if(!file) return;
      status('Uploading image...');
      const b64 = await fileToBase64(file);
      const res = await api('/api/upload',{method:'POST',body:JSON.stringify({name:file.name,data:b64.split(',')[1]})});
      set(inputEl.dataset.upload,res.path);
      renderContent();
      reloadPreview();
      status('Image uploaded. Save website to publish content change.');
    };
  });
}

function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}

function openEditor(field){
  currentField = field;
  $('modalTitle').textContent = 'Edit ' + nice(field);
  $('modalText').value = get(field) || '';
  $('modal').classList.remove('hidden');
}

function closeEditor(){ $('modal').classList.add('hidden'); currentField=null; }

function applyEdit(){
  if(!currentField) return;
  set(currentField,$('modalText').value);
  closeEditor();
  updatePreviewText(currentField,get(currentField));
  status('Text changed. Save when ready.');
}

function updatePreviewText(field,value){
  const doc = $('preview').contentDocument;
  if(!doc) return;
  doc.querySelectorAll(`[data-builder-field="${field}"]`).forEach(el=>el.textContent=value);
}

function injectPreviewEditor(){
  const doc = $('preview').contentDocument;
  if(!doc) return;
  if(!doc.getElementById('jackal-editor-style')){
    const st = doc.createElement('style');
    st.id='jackal-editor-style';
    st.textContent = `
      [data-builder-field]{outline:2px dashed rgba(73,163,255,0);outline-offset:5px;cursor:text;transition:.15s}
      [data-builder-field]:hover{outline-color:rgba(73,163,255,.95);background:rgba(73,163,255,.08)}
      [data-builder-field]:hover:after{content:"  ✏";color:#49a3ff;font-weight:900}
    `;
    doc.head.appendChild(st);
  }
  doc.querySelectorAll('[data-builder-field]').forEach(el=>{
    el.onclick=(e)=>{e.preventDefault();e.stopPropagation();openEditor(el.dataset.builderField)};
  });

  const hero = doc.querySelector('.hero');
  if(hero){
    hero.setAttribute('data-image-clickable','heroImage');
    hero.onclick = (e)=>{
      if(e.target.closest('[data-builder-field]')) return;
      e.preventDefault(); e.stopPropagation(); openImageEditor('heroImage');
    };
  }

  const about = doc.querySelector('.photo');
  if(about){
    about.setAttribute('data-image-clickable','aboutImage');
    about.onclick = (e)=>{e.preventDefault(); e.stopPropagation(); openImageEditor('aboutImage');};
  }

  doc.querySelectorAll('.result').forEach((el,i)=>{
    el.setAttribute('data-image-clickable',`results.${i}.image`);
    el.onclick = (e)=>{e.preventDefault(); e.stopPropagation(); openImageEditor(`results.${i}.image`);};
  });
}

async function saveSite(){
  try{
    status('Saving...');
    await api('/api/content',{method:'POST',body:JSON.stringify(data,null,2)});
    status('Saved. Cloudflare will redeploy shortly.');
  }catch(e){
    status('Save failed. '+e.message,false);
  }
}


function controlForImageField(field){
  data.imageControls = data.imageControls || {};
  if(field === 'heroImage'){
    data.imageControls.heroImage = data.imageControls.heroImage || {x:72,y:50,zoom:100};
    return data.imageControls.heroImage;
  }
  if(field === 'aboutImage'){
    data.imageControls.aboutImage = data.imageControls.aboutImage || {x:50,y:50,zoom:100};
    return data.imageControls.aboutImage;
  }
  const match = field.match(/^results\.(\d+)\.image$/);
  if(match){
    data.imageControls.results = data.imageControls.results || {};
    data.imageControls.results[match[1]] = data.imageControls.results[match[1]] || {x:50,y:50,zoom:100};
    return data.imageControls.results[match[1]];
  }
  return {x:50,y:50,zoom:100};
}

function openImageEditor(field){
  currentImageField = field;
  currentImagePath = get(field);
  const c = controlForImageField(field);
  $('imageModalTitle').textContent = 'Edit ' + nice(field.replace('.image',''));
  $('imageEditorImg').src = currentImagePath || '';
  $('imageX').value = c.x ?? 50;
  $('imageY').value = c.y ?? 50;
  $('imageZoom').value = c.zoom ?? 100;
  $('imageZoomNum').value = c.zoom ?? 100;
  $('imageModal').classList.remove('hidden');
  setTimeout(updateImageEditorPreview, 50);
}

function closeImageEditor(){
  $('imageModal').classList.add('hidden');
  currentImageField = null;
  currentImagePath = null;
  dragState = null;
  $('replaceImageFile').value = '';
}

function updateImageEditorPreview(){
  const img = $('imageEditorImg');
  const crop = document.querySelector('.image-crop-box');
  const x = Number($('imageX').value || 50);
  const y = Number($('imageY').value || 50);
  const zoom = Number($('imageZoom').value || 100) / 100;
  img.style.left = x + '%';
  img.style.top = y + '%';
  img.style.width = (100 * zoom) + '%';
  img.style.height = 'auto';
  img.style.transform = 'translate(-50%,-50%)';
}

function syncImageInputs(){
  $('imageZoomNum').value = $('imageZoom').value;
  updateImageEditorPreview();
}

function applyImageEdit(){
  if(!currentImageField) return;
  const c = controlForImageField(currentImageField);
  c.x = Number($('imageX').value || 50);
  c.y = Number($('imageY').value || 50);
  c.zoom = Number($('imageZoom').value || 100);
  if(currentImagePath) set(currentImageField, currentImagePath);
  closeImageEditor();
  reloadPreview();
  renderContent();
  status('Image position/crop changed. Save when ready.');
}

async function replaceCurrentImage(file){
  if(!file || !currentImageField) return;
  status('Uploading replacement image...');
  const b64 = await fileToBase64(file);
  const res = await api('/api/upload',{method:'POST',body:JSON.stringify({name:file.name,data:b64.split(',')[1]})});
  currentImagePath = res.path;
  $('imageEditorImg').src = currentImagePath;
  updateImageEditorPreview();
  status('Image uploaded. Apply image, then save.');
}

function bindImageDrag(){
  const crop = document.querySelector('.image-crop-box');
  if(!crop) return;
  crop.addEventListener('mousedown', e=>{
    dragState = {
      startX:e.clientX,startY:e.clientY,
      x:Number($('imageX').value || 50),
      y:Number($('imageY').value || 50),
      rect:crop.getBoundingClientRect()
    };
  });
  window.addEventListener('mousemove', e=>{
    if(!dragState) return;
    const dx = ((e.clientX - dragState.startX) / dragState.rect.width) * 100;
    const dy = ((e.clientY - dragState.startY) / dragState.rect.height) * 100;
    $('imageX').value = Math.max(0,Math.min(100,dragState.x + dx));
    $('imageY').value = Math.max(0,Math.min(100,dragState.y + dy));
    updateImageEditorPreview();
  });
  window.addEventListener('mouseup', ()=>dragState=null);

  crop.addEventListener('touchstart', e=>{
    const t=e.touches[0];
    dragState = {
      startX:t.clientX,startY:t.clientY,
      x:Number($('imageX').value || 50),
      y:Number($('imageY').value || 50),
      rect:crop.getBoundingClientRect()
    };
  }, {passive:true});
  window.addEventListener('touchmove', e=>{
    if(!dragState) return;
    const t=e.touches[0];
    const dx = ((t.clientX - dragState.startX) / dragState.rect.width) * 100;
    const dy = ((t.clientY - dragState.startY) / dragState.rect.height) * 100;
    $('imageX').value = Math.max(0,Math.min(100,dragState.x + dx));
    $('imageY').value = Math.max(0,Math.min(100,dragState.y + dy));
    updateImageEditorPreview();
  }, {passive:true});
  window.addEventListener('touchend', ()=>dragState=null);
}

document.getElementById('loginBtn').onclick = login;
document.getElementById('saveBtn').onclick = saveSite;
document.getElementById('refreshBtn').onclick = reloadPreview;
document.getElementById('applyEdit').onclick = applyEdit;
document.getElementById('cancelEdit').onclick = closeEditor;
document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+btn.dataset.mode).classList.add('active');
});
autoLogin();


document.getElementById('applyImageEdit').onclick = applyImageEdit;
document.getElementById('cancelImageEdit').onclick = closeImageEditor;
document.getElementById('imageZoom').oninput = syncImageInputs;
document.getElementById('imageZoomNum').oninput = () => {$('imageZoom').value = $('imageZoomNum').value; updateImageEditorPreview();};
document.getElementById('imageX').oninput = updateImageEditorPreview;
document.getElementById('imageY').oninput = updateImageEditorPreview;
document.getElementById('replaceImageFile').onchange = e => replaceCurrentImage(e.target.files[0]);
bindImageDrag();

function esc(s){return String(s ?? '').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function cssText(styles={}){
  return Object.entries(styles).map(([k,v])=>`${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}:${v}`).join(';')
}
function imageStyle(layer){
  const crop = layer.crop || {x:50,y:50,zoom:100};
  const size = layer.mode === 'contain' ? 'contain' : `${crop.zoom || 100}% auto`;
  return `background-image:url('${layer.src || ''}');background-position:${crop.x ?? 50}% ${crop.y ?? 50}%;background-size:${size};`
}
async function render(){
  const res = await fetch('/content/layers.json?cache=' + Date.now());
  const data = await res.json();
  const site = document.getElementById('site');
  site.style.minHeight = (data.canvas?.desktop?.height || 5200) + 'px';
  site.style.background = data.canvas?.background || '#050505';
  site.innerHTML = '';

  (data.sections || []).forEach(sec=>{
    if(sec.hidden) return;
    const el = document.createElement('section');
    el.className = 'section-layer';
    el.dataset.layerId = sec.id;
    el.style.cssText = `top:${sec.y}px;height:${sec.h}px;z-index:${sec.z || 1};background:${sec.background || 'transparent'};`;
    site.appendChild(el);
  });

  (data.layers || []).forEach(layer=>{
    if(layer.hidden) return;
    const parent = site.querySelector(`[data-layer-id="${layer.section}"]`) || site;
    const el = document.createElement(layer.type === 'button' ? 'a' : 'div');
    el.className = 'item-layer';
    el.dataset.layerItemId = layer.id;
    el.dataset.type = layer.type;
    if(layer.type === 'button') el.href = layer.href || '#';
    let styles = `left:${layer.x}px;top:${layer.y - ((data.sections || []).find(s=>s.id===layer.section)?.y || 0)}px;width:${layer.w}px;height:${layer.h}px;z-index:${layer.z || 1};${cssText(layer.styles || {})}`;
    if(layer.type === 'image') styles += imageStyle(layer);
    el.style.cssText = styles;
    if(layer.type !== 'image' && layer.type !== 'card') el.textContent = layer.content || '';
    parent.appendChild(el);
  });
}
render();

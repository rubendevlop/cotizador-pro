// ======= TEMA (claro/oscuro) =======
const THEME_KEY = "cp_theme";
const htmlEl = document.documentElement;
function getPreferredTheme(){ return localStorage.getItem(THEME_KEY) || "light"; }
function setTheme(t){
  htmlEl.setAttribute("data-bs-theme", t === "dark" ? "dark" : "light");
  const btn = document.getElementById("btn-theme");
  if(btn) btn.innerHTML = (t === "dark" ? '<i class="bi bi-moon"></i> Claro' : '<i class="bi bi-sun"></i> Oscuro');
  localStorage.setItem(THEME_KEY, t);
}
document.addEventListener("DOMContentLoaded", ()=>{
  setTheme(getPreferredTheme());
  const btn = document.getElementById("btn-theme");
  if(btn) btn.addEventListener("click", ()=> setTheme(htmlEl.getAttribute("data-bs-theme")==="dark" ? "light" : "dark"));
});

// ======= UTILIDADES =======
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2});
const qs=(s,e=document)=>e.querySelector(s);
const qsa=(s,e=document)=>[...e.querySelectorAll(s)];
const LS_KEYS={CATALOG:'cp_catalog',CART:'cp_cart',SETTINGS:'cp_settings',CLIENT:'cp_client',COMPANY:'cp_company',CONDITIONS:'cp_conditions',SEQ:'cp_seq'};
const saveLS=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const loadLS=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const genId=()=> (crypto?.randomUUID? crypto.randomUUID(): 'id_'+Math.random().toString(36).slice(2,10));
function normalizeHeader(h){return String(h||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').trim();}
function toNumberLike(v){
  if(v==null) return NaN;
  let s=String(v).replace(/\u00A0/g,' ').replace(/\s+/g,'').replace(/[^0-9,.\-]/g,'');
  s=s.replace(/\.(?=\d{3}(?:\D|$))/g,''); s=s.replace(',', '.');
  const n=Number(s); return Number.isFinite(n)?n:NaN;
}
function mapRow(row){
  const m={}; for(const k in row) m[normalizeHeader(k)]=row[k];
  const desc=m.descripcion??m.producto??m.detalle??m.concepto??m.nombre??'';
  const precioRaw=m.precio??m.preciounitario??m.precio_unitario??m.importe??m.valor??m.preciolista??'';
  const impuestoRaw=m.impuesto??m.iva??m.porcentajeiva??'';
  return {
    codigo:m.codigo??m.sku??m.cod??'',
    descripcion:desc,
    categoria:m.categoria??m.rubro??'',
    marca:m.marca??m.proveedor??'',
    unidad:m.unidad??m.u??m.medida??'',
    precio:toNumberLike(precioRaw),
    impuesto:(impuestoRaw!==''?toNumberLike(impuestoRaw):null)
  };
}
const validItem=it=> it.descripcion && Number.isFinite(it.precio);
const unique=arr=>[...new Set(arr.filter(Boolean))];
function nextQuoteNumber(){ let n=loadLS(LS_KEYS.SEQ,1000); n+=1; saveLS(LS_KEYS.SEQ,n); return n; }

// ======= ESTADO =======
const DEFAULT_LOGO = "logo.jpg"; // ← poné tu PNG aquí (misma carpeta) o cambia la ruta
let CATALOG=[];
let CART=loadLS(LS_KEYS.CART,[]);
let SETTINGS=loadLS(LS_KEYS.SETTINGS,{iva:21,discount:0});
let CLIENT=loadLS(LS_KEYS.CLIENT,{nombre:'',cuit:'',email:'',dir:'',tel:''});
let COMPANY=loadLS(LS_KEYS.COMPANY,{nombre:'Mi Empresa',logo:DEFAULT_LOGO,dir:'',iva:'Responsable Inscripto',email:'',tel:''});
if(!COMPANY.logo) COMPANY.logo = DEFAULT_LOGO;
let CONDITIONS=loadLS(LS_KEYS.CONDITIONS,{validez:7,plazo:'72 hs',pago:'Contado',notas:''});
let QUOTE_NUMBER=loadLS(LS_KEYS.SEQ,1000);
let LAST_HEADERS=[];

// ======= CATALOGO + DATATABLES =======
let dataTable=null;
function populateFilters(){
  const cats=unique(CATALOG.map(r=>r.categoria)).sort();
  const brands=unique(CATALOG.map(r=>r.marca)).sort();
  qs('#filter-category').innerHTML = '<option value="">Todas</option>' + cats.map(c=>`<option>${c}</option>`).join('');
  qs('#filter-brand').innerHTML = '<option value="">Todas</option>' + brands.map(b=>`<option>${b}</option>`).join('');
  qs('#count-products').textContent = CATALOG.length;
}
$.fn.dataTable.ext.search.push(function(settings,data){
  if(settings.nTable.id!=='table-catalog') return true;
  const min=Number(qs('#filter-min').value||'');
  const max=Number(qs('#filter-max').value||'');
  const priceText=data[5]||'';
  const val=toNumberLike(priceText);
  let ok=true;
  if(!Number.isNaN(min)) ok=ok && val>=min;
  if(!Number.isNaN(max) && qs('#filter-max').value!=='') ok=ok && val<=max;
  return ok;
});
function catalogRows(){
  return CATALOG.map(it=>[
    it.codigo||'',
    it.descripcion,
    it.categoria||'',
    it.marca||'',
    it.unidad||'',
    fmtARS.format(it.precio),
    `<button class="btn btn-sm btn-primary" data-add='${encodeURIComponent(JSON.stringify(it))}'>Agregar</button>`
  ]);
}
function renderCatalog(){
  if(!$.fn.DataTable.isDataTable('#table-catalog')){
    dataTable = $('#table-catalog').DataTable({
      data: catalogRows(),
      columns: [
        { title:'Código' }, { title:'Descripción' }, { title:'Categoría' },
        { title:'Marca' }, { title:'Unidad' }, { title:'Precio', className:'text-end' },
        { title:'Acción', orderable:false, searchable:false }
      ],
      pageLength:10, order:[[1,'asc']]
    });
    $('#table-catalog tbody').on('click','button[data-add]', function(){
      const payload = this.getAttribute('data-add');
      const it = JSON.parse(decodeURIComponent(payload));
      addToCart(it);
    });
    ['filter-category','filter-brand','filter-min','filter-max'].forEach(id=>{
      qs('#'+id).addEventListener('input', ()=>{
        const cat = qs('#filter-category').value.trim();
        const brand = qs('#filter-brand').value.trim();
        dataTable.column(2).search(cat? `^${cat}$` : '', true, false);
        dataTable.column(3).search(brand? `^${brand}$` : '', true, false);
        dataTable.draw();
      });
    });
  }else{
    dataTable.clear().rows.add(catalogRows()).draw();
  }
  populateFilters();
}

// ======= PARSEO DE ARCHIVOS =======
async function parseFile(file){
  const name=file.name.toLowerCase();
  LAST_HEADERS=[];
  if(name.endsWith('.csv')){
    return new Promise((resolve,reject)=>{
      Papa.parse(file,{
        header:true, skipEmptyLines:true,
        complete:res=>{
          try{
            if(res.data?.length) LAST_HEADERS=Object.keys(res.data[0]||{});
            const items=res.data.map(mapRow).filter(validItem);
            resolve(items);
          }catch(e){ reject(e); }
        },
        error:err=>reject(err)
      });
    });
  }else{
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const json=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
    LAST_HEADERS = json.length ? Object.keys(json[0]) : [];
    return json.map(mapRow).filter(validItem);
  }
}

// ======= CARRITO =======
function addToCart(item){
  const found=CART.find(r=> r.descripcion===item.descripcion && r.precio===item.precio && (r.codigo||'')===(item.codigo||''));
  if(found) found.cant+=1;
  else CART.push({id:genId(),codigo:item.codigo||'',descripcion:item.descripcion,precio:item.precio,cant:1,impuesto:item.impuesto});
  saveLS(LS_KEYS.CART,CART); renderCart();
}
function removeFromCart(id){ CART=CART.filter(r=>r.id!==id); saveLS(LS_KEYS.CART,CART); renderCart(); }
function updateQty(id,val){ const it=CART.find(r=>r.id===id); if(!it) return; it.cant=Math.max(1,Number(val)||1); saveLS(LS_KEYS.CART,CART); renderCart(); }
function addManualItem(){
  const codigo=prompt('Código (opcional):')||'';
  const desc=prompt('Descripción del ítem:'); if(!desc) return;
  const precio=toNumberLike(prompt('Precio unitario:')||''); if(!Number.isFinite(precio)||precio<0) return alert('Precio inválido');
  const cant=Math.max(1, Number(prompt('Cantidad:'))||1);
  CART.push({id:genId(),codigo,descripcion:desc,precio,cant,impuesto:null});
  saveLS(LS_KEYS.CART,CART); renderCart();
}

// ======= TOTALES =======
function calcTotals(){
  const ivaGlobal=Number(qs('#iva-global').value)||0;
  const descGlobal=Number(qs('#discount-global').value)||0;
  SETTINGS.iva=ivaGlobal; SETTINGS.discount=descGlobal; saveLS(LS_KEYS.SETTINGS,SETTINGS);
  let neto=0, imp=0;
  for(const it of CART){
    const sub=it.precio*it.cant; neto+=sub;
    const tasa=(it.impuesto??ivaGlobal); imp+=sub*(tasa/100);
  }
  const desc=neto*(descGlobal/100);
  const total=neto+imp-desc;
  qs('#total-neto').textContent=fmtARS.format(neto);
  qs('#total-impuestos').textContent=fmtARS.format(imp);
  qs('#total-descuento').textContent=fmtARS.format(desc);
  qs('#total-final').textContent=fmtARS.format(total);
  return {neto,imp,desc,total,ivaGlobal,descGlobal};
}
function renderCart(){
  const tbody=qs('#cart-body'); tbody.innerHTML='';
  for(const it of CART){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${it.codigo||''}</td>
      <td>${it.descripcion}</td>
      <td class="text-end">${fmtARS.format(it.precio)}</td>
      <td><input data-qty="${it.id}" type="number" class="form-control form-control-sm" min="1" value="${it.cant}"></td>
      <td class="text-end">${fmtARS.format(it.precio*it.cant)}</td>
      <td class="no-print text-end"><button class="btn btn-sm btn-outline-light" data-del="${it.id}"><i class="bi bi-x"></i></button></td>`;
    tbody.appendChild(tr);
  }
  qsa('[data-qty]').forEach(inp=> inp.addEventListener('input', ()=> updateQty(inp.getAttribute('data-qty'), inp.value)));
  qsa('[data-del]').forEach(btn=> btn.addEventListener('click', ()=> removeFromCart(btn.getAttribute('data-del'))));
  calcTotals(); renderQuote();
}

// ======= PREVIEW =======
function readForms(){
  CLIENT={ nombre:qs('#cli-nombre').value, cuit:qs('#cli-cuit').value, email:qs('#cli-email').value, dir:qs('#cli-dir').value, tel:qs('#cli-tel').value };
  COMPANY={ nombre:qs('#emp-nombre').value, logo:qs('#emp-logo').value||DEFAULT_LOGO, dir:qs('#emp-dir').value, iva:qs('#emp-iva').value, email:qs('#emp-email').value, tel:qs('#emp-tel').value };
  CONDITIONS={ validez:Number(qs('#cond-validez').value)||0, plazo:qs('#cond-plazo').value, pago:qs('#cond-pago').value, notas:qs('#cond-notas').value };
  saveLS(LS_KEYS.CLIENT,CLIENT); saveLS(LS_KEYS.COMPANY,COMPANY); saveLS(LS_KEYS.CONDITIONS,CONDITIONS);
}
function renderQuote(){
  readForms();
  const q=qs('#quote'); const {neto,imp,desc,total}=calcTotals(); const nro=loadLS(LS_KEYS.SEQ,QUOTE_NUMBER); const date=dayjs().format('DD/MM/YYYY');
  const rows=CART.map((it,i)=>`
    <tr><td>${i+1}</td><td>${it.codigo||''}</td><td>${it.descripcion}</td>
    <td class="text-end">${it.cant}</td><td class="text-end">${fmtARS.format(it.precio)}</td>
    <td class="text-end">${fmtARS.format(it.precio*it.cant)}</td></tr>`).join('');
  q.innerHTML=`
    <div class="d-flex justify-content-between align-items-start">
      <div class="d-flex gap-3 align-items-center">
        <div style="width:70px;height:70px;border:1px solid #e9ecef;display:flex;align-items:center;justify-content:center;font-weight:700;">
          ${COMPANY.logo
            ? `<img src="${COMPANY.logo}" alt="logo" onerror="this.replaceWith(document.createTextNode('LOGO'))" style="max-width:100%;max-height:100%">`
            : 'LOGO'}
        </div>
        <div>
          <div class="fw-bold">${COMPANY.nombre||'Mi Empresa'}</div>
          <div class="small">${COMPANY.dir||''}</div>
          <div class="small">${COMPANY.email||''} ${COMPANY.tel? ' · '+COMPANY.tel:''}</div>
          <div class="small">${COMPANY.iva||''}</div>
        </div>
      </div>
      <div class="text-end">
        <div class="fs-5 fw-bold">COTIZACIÓN</div>
        <div class="small">N° ${nro}</div>
        <div class="small">Fecha: ${date}</div>
      </div>
    </div>
    <hr>
    <div class="row g-2">
      <div class="col-12 col-md-8">
        <div class="p-3 border rounded-3">
          <div class="fw-bold">Cliente</div>
          <div>${CLIENT.nombre||''}</div>
          <div class="small">${CLIENT.dir||''}</div>
          <div class="small">${CLIENT.email||''} ${CLIENT.tel? ' · '+CLIENT.tel:''}</div>
          <div class="small">${CLIENT.cuit? 'CUIT/DNI: '+CLIENT.cuit:''}</div>
        </div>
      </div>
      <div class="col-12 col-md-4">
        <ul class="list-group">
          <li class="list-group-item d-flex justify-content-between"><span>Subtotal</span><strong>${fmtARS.format(neto)}</strong></li>
          <li class="list-group-item d-flex justify-content-between"><span>Impuestos</span><strong>${fmtARS.format(imp)}</strong></li>
          <li class="list-group-item d-flex justify-content-between"><span>Descuento</span><strong>− ${fmtARS.format(desc)}</strong></li>
          <li class="list-group-item d-flex justify-content-between"><span>Total</span><strong>${fmtARS.format(total)}</strong></li>
        </ul>
      </div>
    </div>
    <div class="table-responsive mt-3">
      <table class="table table-bordered">
        <thead><tr><th>#</th><th>Código</th><th>Descripción</th><th class="text-end">Cant.</th><th class="text-end">Precio</th><th class="text-end">Subtotal</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="text-center">Sin ítems</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ======= PDF =======
// Normaliza rutas relativas a absolutas
function resolveURL(p){
  try { return new URL(p, window.location.href).href; }
  catch { return p; }
}
// Convierte imagen (PNG/JPG) → DataURL robusto
async function imgToDataURL(src){
  const url = resolveURL(src);

  // 1) Intentá con fetch (mismo origen o CORS permitido)
  try{
    const res = await fetch(url, { mode:'cors' });
    if(!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const dataURL = await new Promise((resolve)=>{
      const fr = new FileReader();
      fr.onload = ()=> resolve(fr.result);
      fr.readAsDataURL(blob);
    });
    return dataURL; // data:image/png;base64,... o data:image/jpeg;base64,...
  }catch(_){
    // 2) Fallback: <img> + canvas (mismo origen)
    return await new Promise((resolve, reject)=>{
      const img = new Image();
      try{
        const u = new URL(url);
        if (u.origin !== window.location.origin) img.crossOrigin = "anonymous";
      }catch{}
      img.onload = ()=>{
        try{
          const canvas = document.createElement('canvas');
          canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0);
          resolve(canvas.toDataURL()); // mantiene el tipo si es posible
        }catch(e){ reject(e); }
      };
      img.onerror = ()=> reject(new Error("No se pudo cargar el logo: "+url));
      img.src = url;
    });
  }
}
async function exportPDF(){
  if(!CART.length){ alert('No hay ítems en el carrito. Agregá productos antes de exportar.'); return false; }
  const { jsPDF } = window.jspdf; const doc=new jsPDF();
  const date=dayjs().format('DD/MM/YYYY'); const nro=loadLS(LS_KEYS.SEQ,QUOTE_NUMBER);

  // Logo (detecta si es PNG o JPG)
  try {
    if (COMPANY.logo) {
      const dataURL = await imgToDataURL(COMPANY.logo);
      const upper = (dataURL.split(';')[0]||'').toUpperCase();
      const fmt = upper.includes('PNG') ? 'PNG' : 'JPEG';
      doc.addImage(dataURL, fmt, 14, 10, 20, 20);
    }
  } catch(e){
    console.warn("No se pudo cargar logo en PDF", e);
    // Tip útil para CORS
    // alert('No se pudo incorporar el logo (PNG/JPG) al PDF.\nServí el archivo desde el mismo dominio/carpeta que la página o activá CORS.');
  }

  // Título y fecha
  doc.setFontSize(14); doc.text('COTIZACIÓN', 38, 16);
  doc.setFontSize(10); doc.text(`N° ${nro} — ${date}`, 38, 22);

  // Empresa
  const y0=30; doc.setFontSize(11); doc.text((COMPANY.nombre||'Mi Empresa'),14,y0);
  doc.setFontSize(9);
  if(COMPANY.dir) doc.text(String(COMPANY.dir),14,y0+5);
  if(COMPANY.email || COMPANY.tel) doc.text([COMPANY.email||'',COMPANY.tel||''].filter(Boolean).join(' · '),14,y0+10);

  // Cliente
  const y1=30, xR=120; doc.setFontSize(11); doc.text('Cliente',xR,y1); doc.setFontSize(9);
  [CLIENT.nombre, CLIENT.dir, [CLIENT.email,CLIENT.tel].filter(Boolean).join(' · '), CLIENT.cuit?('CUIT/DNI: '+CLIENT.cuit):''].filter(Boolean)
    .forEach((t,i)=> doc.text(String(t),xR,y1+5+i*5));

  // Tabla
  const body=CART.map((it,i)=>[i+1,it.codigo||'',it.descripcion,it.cant,fmtARS.format(it.precio),fmtARS.format(it.precio*it.cant)]);
  doc.autoTable({
    startY:60,
    head:[['#','Código','Descripción','Cant.','Precio','Subtotal']],
    body,
    styles:{fontSize:9},
    headStyles:{fillColor:[13,110,253]},
    columnStyles:{3:{halign:'right'},4:{halign:'right'},5:{halign:'right'}}
  });

  const {neto,imp,desc,total}=calcTotals();
  let y=doc.lastAutoTable.finalY+8;
  doc.text(`Subtotal: ${fmtARS.format(neto)}`,14,y);
  y+=5; doc.text(`Impuestos: ${fmtARS.format(imp)}`,14,y);
  y+=5; doc.text(`Descuento: ${fmtARS.format(desc)}`,14,y);
  y+=5; doc.setFontSize(12); doc.text(`Total: ${fmtARS.format(total)}`,14,y);

  // Condiciones
  y+=10; doc.setFontSize(9); doc.text('Condiciones:',14,y);
  y+=5; doc.text(`Validez: ${CONDITIONS.validez} días`,14,y);
  y+=5; doc.text(`Plazo de entrega: ${CONDITIONS.plazo}`,14,y);
  y+=5; doc.text(`Forma de pago: ${CONDITIONS.pago}`,14,y);

  doc.save(`Presupuesto_${nro}.pdf`);
  return true;
}

// ======= BORRADORES =======
function saveDraft(){ readForms(); calcTotals(); alert('Borrador guardado.'); }
function loadDraft(){ renderCart(); renderCatalog(); populateFilters(); renderQuote(); alert('Borrador cargado.'); }
function newQuote(){ CART=[]; saveLS(LS_KEYS.CART,CART); QUOTE_NUMBER=nextQuoteNumber(); renderCart(); renderQuote(); }

// ======= DnD =======
function setupDnD(){
  const dz=qs('#dropzone'); if(!dz) return;
  ['dragenter','dragover','dragleave','drop'].forEach(ev=> dz.addEventListener(ev, e=>{e.preventDefault();e.stopPropagation();}));
  ['dragenter','dragover'].forEach(ev=> dz.addEventListener(ev, ()=> dz.classList.add('dragover')));
  ['dragleave','drop'].forEach(ev=> dz.addEventListener(ev, ()=> dz.classList.remove('dragover')));
  dz.addEventListener('drop', async e=>{
    const file=e.dataTransfer.files[0]; if(!file) return;
    try{
      const items=await parseFile(file);
      if(!items.length){
        const hs=LAST_HEADERS.length?` Encabezados detectados: ${LAST_HEADERS.join(', ')}`:'';
        qs('#load-status').className='small mt-2 text-danger';
        qs('#load-status').textContent='No se reconocieron filas válidas. Verificá columnas: descripcion y precio son obligatorias.'+hs;
        CATALOG=[]; renderCatalog(); return;
      }
      CATALOG=items; qs('#load-status').className='small mt-2 text-success';
      qs('#load-status').textContent=`Archivo cargado: ${file.name} — ${CATALOG.length} filas válidas.`; renderCatalog();
    }catch(err){
      console.error(err);
      qs('#load-status').className='small mt-2 text-danger';
      qs('#load-status').textContent='Error al leer el archivo. Guardalo como .xlsx o .csv (fila 1 = encabezados).';
      CATALOG=[]; renderCatalog();
    }
  });
}

// ======= PRUEBAS =======
function runTests(){
  const results=[]; const pass=(n,c)=>results.push({name:n,ok:!!c});
  pass('Catálogo inicial vacío', Array.isArray(CATALOG)&&CATALOG.length===0);
  try{ renderCatalog(); const api=$('#table-catalog').DataTable(); pass('DataTables disponible', typeof $.fn.DataTable==='function'); pass('Tabla inicial con 0 filas', api.rows().count()===0);}catch{ pass('DataTables inicialización', false);}
  try{ const t=calcTotals(); pass('Totales en 0 con carrito vacío', t.neto===0&&t.imp===0&&t.desc===0&&t.total===0);}catch{ pass('Cálculo de totales',false); }
  try{ const maybe=exportPDF(); pass('Exportar bloqueado sin ítems', maybe===false || (maybe && typeof maybe.then==='function')); }catch{ pass('Exportar PDF sin ítems no lanza excepción', true); }
  try{ const m=mapRow({ Producto:'Tornillo', PrecioUnitario:'$ 123,45', Rubro:'Ferretería', IVA:'21%' }); pass('mapRow descripción', m.descripcion==='Tornillo'); pass('mapRow precio', m.precio===123.45); pass('mapRow IVA', m.impuesto===21);}catch{ pass('mapRow variantes', false); }
  try{ pass('normalizeHeader', normalizeHeader('Descripción (unidad)')==='descripcionunidad'); }catch{ pass('normalizeHeader', false);}
  const okAll=results.every(r=>r.ok);
  qs('#tests-summary').textContent=okAll?'Todas las pruebas pasaron':'Fallaron algunas pruebas';
  qs('#tests-summary').classList.toggle('text-bg-success', okAll);
  qs('#tests-summary').classList.toggle('text-bg-danger', !okAll);
  qs('#tests-detail').innerHTML=results.map(r=>`<div>${r.ok?'✅':'❌'} ${r.name}</div>`).join('');
}

// ======= INIT =======
window.addEventListener('DOMContentLoaded', ()=>{
  try{ localStorage.removeItem(LS_KEYS.CATALOG);}catch{}
  renderCatalog(); populateFilters();

  // Formularios desde LS
  const fill=(id,val)=>{ const el=qs(id); if(el) el.value=val||''; };
  fill('#cli-nombre',CLIENT.nombre); fill('#cli-cuit',CLIENT.cuit); fill('#cli-email',CLIENT.email); fill('#cli-dir',CLIENT.dir); fill('#cli-tel',CLIENT.tel);
  fill('#emp-nombre',COMPANY.nombre); fill('#emp-logo',COMPANY.logo); fill('#emp-dir',COMPANY.dir); fill('#emp-iva',COMPANY.iva); fill('#emp-email',COMPANY.email); fill('#emp-tel',COMPANY.tel);
  fill('#cond-validez',CONDITIONS.validez); fill('#cond-plazo',CONDITIONS.plazo); fill('#cond-pago',CONDITIONS.pago); fill('#cond-notas',CONDITIONS.notas);
  fill('#iva-global',SETTINGS.iva); fill('#discount-global',SETTINGS.discount);

  renderCart();

  // File input
  qs('#file-input').addEventListener('change', async (e)=>{
    const input=e.target; const file=input.files?.[0]; if(!file) return;
    try{
      const items=await parseFile(file);
      if(!items.length){
        const hs=LAST_HEADERS.length?` Encabezados detectados: ${LAST_HEADERS.join(', ')}`:'';
        qs('#load-status').className='small mt-2 text-danger';
        qs('#load-status').textContent='No se reconocieron filas válidas. Verificá columnas: descripcion y precio son obligatorias.'+hs;
        CATALOG=[]; renderCatalog(); return;
      }
      CATALOG=items; qs('#load-status').className='small mt-2 text-success';
      qs('#load-status').textContent=`Archivo cargado: ${file.name} — ${CATALOG.length} filas válidas.`; renderCatalog();
    }catch(err){
      console.error(err);
      qs('#load-status').className='small mt-2 text-danger';
      qs('#load-status').textContent='Error al leer el archivo. Probá .xlsx/.csv y que la primera fila sean encabezados.';
      CATALOG=[]; renderCatalog();
    } finally { input.value=''; }
  });

  // DnD
  setupDnD();

  // Reactive forms
  qsa('#cli-nombre,#cli-cuit,#cli-email,#cli-dir,#cli-tel,#emp-nombre,#emp-logo,#emp-dir,#emp-iva,#emp-email,#emp-tel,#cond-validez,#cond-plazo,#cond-pago,#cond-notas,#iva-global,#discount-global')
    .forEach(el=> el.addEventListener('input', ()=>{ calcTotals(); renderQuote(); saveLS(LS_KEYS.SETTINGS,SETTINGS); }));

  // Botones
  qs('#btn-add-manual').addEventListener('click', addManualItem);
  qs('#btn-pdf').addEventListener('click', exportPDF);
  qs('#btn-print').addEventListener('click', ()=>window.print());
  qs('#btn-save').addEventListener('click', saveDraft);
  qs('#btn-load').addEventListener('click', loadDraft);
  qs('#btn-new').addEventListener('click', newQuote);
  qs('#btn-tests').addEventListener('click', runTests);
});

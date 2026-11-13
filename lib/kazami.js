// Kazami のブラウザ側の処理（地図・1時間ごとの風・作戦メモなど）
// FC: サーバーで Supabase から組み立てた予報データ（lib/forecast.ts）
// OBS: 長崎空港の最新の観測
import DEMF from "./dem-fine.json";
import DEMC from "./dem-bay.json";

let started = false;
export function initKazami(FC, OBS) {
if (started) return; started = true;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NS="http://www.w3.org/2000/svg";
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const DIRS=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const norm=d=>((d%360)+360)%360;
const compass=d=>DIRS[Math.round(norm(d)/22.5)%16];
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- forecast: Open-Meteo snapshot ---------- */
const HOURS=[];for(let h=6;h<=18;h++)HOURS.push(h);
const R=Math.PI/180;
const ad=(a,b)=>((a-b)%360+540)%360-180;          // a−b を −180〜180 に
const cmean=arr=>{let x=0,y=0;arr.forEach(a=>{x+=Math.cos(a*R);y+=Math.sin(a*R)});return norm(Math.atan2(y,x)/R)};
const unwrap=arr=>{const o=[];arr.forEach((v,i)=>o.push(i?o[i-1]+ad(v,o[i-1]):v));return o};
const JP16=["北","北北東","北東","東北東","東","東南東","南東","南南東","南","南南西","南西","西南西","西","西北西","北西","北北西"];
const jpDir=d=>JP16[Math.round(norm(d)/22.5)%16];
const WD="日月火水木金土";
const dayLabel=k=>{const t=new Date(k+"T00:00:00Z"),rel=k===FC.today?"今日":(Date.parse(k)-Date.parse(FC.today)===864e5?"明日":"");
  return `${t.getUTCMonth()+1}/${t.getUTCDate()}（${WD[t.getUTCDay()]}）${rel}`};
const MODEL_META={
  msm:{name:"MSM 琴海寄り",short:"MSM西",col:"--msm"},
  msm_e:{name:"MSM 湾中央寄り",short:"MSM東",col:"--msm",dash:"5 4"},
  ecmwf:{name:"ECMWF 9km",short:"ECMWF",col:"--ecmwf"},
  icon:{name:"ICON",short:"ICON",col:"--icon"}
};
const K=["msm","msm_e","ecmwf","icon"];
let MODELS={},BEST={dir:[],spd:[]},BASE=0,WX=[],DAY=null;
function loadDay(k){
  DAY=k;const D=FC.days[k];WX=D.wx;
  MODELS={};K.forEach(m=>MODELS[m]=Object.assign({},MODEL_META[m],{dir:D[m].dir,spd:D[m].spd,gust:D[m].gust}));
  // 練習エリアの代表値：MSM 2点（琴海寄り・湾中央寄り）の平均
  BEST.dir=unwrap(HOURS.map((h,i)=>cmean([D.msm.dir[i],D.msm_e.dir[i]])));
  BEST.spd=HOURS.map((h,i)=>(D.msm.spd[i]+D.msm_e.spd[i])/2);
  BASE=cmean([BEST.dir[4],BEST.dir[5]]); // 10–11時の平均
}
const avgDir=i=>BEST.dir[i];
const avgSpd=i=>BEST.spd[i];
const spread=i=>{const v=[BEST.dir[i],MODELS.ecmwf.dir[i],MODELS.icon.dir[i]];let m=0;for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)m=Math.max(m,Math.abs(ad(v[a],v[b])));return m};
const shiftOf=i=>ad(BEST.dir[i],BASE);
const shiftM=(k,i)=>ad(MODELS[k].dir[i],cmean([MODELS[k].dir[4],MODELS[k].dir[5]]));
const gustAt=i=>MODELS.ecmwf.gust[i];
const isRain=c=>c>=51;

/* ---------- chart helper ---------- */
function chart(svg,o){
  svg.innerHTML="";
  const W=svg.clientWidth||600,H=+svg.getAttribute("height");
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  const m={l:40,r:12,t:10,b:24};
  const x=v=>m.l+(v-o.x[0])/(o.x[1]-o.x[0])*(W-m.l-m.r);
  const y=v=>H-m.b-(v-o.y[0])/(o.y[1]-o.y[0])*(H-m.t-m.b);
  const g=el("g",{},svg);
  o.yt.forEach(t=>{el("line",{x1:m.l,x2:W-m.r,y1:y(t),y2:y(t),stroke:css("--line")},g);
    el("text",{x:m.l-6,y:y(t)+4,"text-anchor":"end"},g).textContent=o.yf?o.yf(t):t});
  o.xt.forEach(t=>{el("text",{x:x(t),y:H-6,"text-anchor":"middle"},g).textContent=o.xf?o.xf(t):t});
  if(o.shade)o.shade.forEach(s=>el("rect",{x:x(s[0]),y:m.t,width:x(s[1])-x(s[0]),height:H-m.t-m.b,fill:css("--accent"),opacity:.06},g));
  if(o.band){const b=o.band;const d=b.map((p,i)=>(i?"L":"M")+x(p[0])+","+y(p[2])).join("")+b.slice().reverse().map(p=>"L"+x(p[0])+","+y(p[1])).join("")+"Z";
    el("path",{d,fill:css("--accent"),opacity:.14},g)}
  o.series.forEach(s=>{const d=s.pts.map((p,i)=>(i?"L":"M")+x(p[0]).toFixed(1)+","+y(p[1]).toFixed(1)).join("");
    el("path",{d,fill:"none",stroke:s.color,"stroke-width":s.w||2,"stroke-dasharray":s.dash||"",opacity:s.op??1,"stroke-linejoin":"round","stroke-linecap":"round"},g);
    if(s.end){const p=s.pts[s.pts.length-1];el("circle",{cx:x(p[0]),cy:y(p[1]),r:3.5,fill:s.color},g)}});
  if(o.after)o.after(g,x,y);
}
const hf=h=>(h|0)+":00";
const degf=t=>norm(t)+"°";

/* ---------- live wind map: real Omura Bay terrain, pan & zoom ---------- */
const AREA={s:32.850,n:32.917,w:129.8106,e:129.8512};
const CC={lat:(32.850+32.917)/2+0.004,lon:(129.8106+129.8512)/2+0.004};
const BAY={s:32.835,n:33.11,w:129.715,e:129.99};
const KX=Math.cos(32.95*Math.PI/180);
const FAC_DEFAULT={lat:32.857,lon:129.822};
let FAC=FAC_DEFAULT,facCustom=false,placing=false;
try{const v=JSON.parse(localStorage.getItem("kazami-fac")||"null");if(v&&typeof v.lat==="number"){FAC=v;facCustom=true}}catch(e){}
const cv=$("#map"),ctx=cv.getContext("2d"),MW=$("#mapwrap");
let mw=0,mh=0,parts=[],curHour=10,baseCv=null,hiTimer=null,viewReady=false;
const view={lat:32.88,lon:129.833,ppd:1};
function demOf(D,lat,lon){const fx=(lon-D.W)/D.step,fy=(lat-D.S)/D.step;if(fx<0||fy<0||fx>D.nx-1||fy>D.ny-1)return null;
  const x0=Math.min(D.nx-2,Math.floor(fx)),y0=Math.min(D.ny-2,Math.floor(fy)),tx=fx-x0,ty=fy-y0,g=(i,j)=>D.el[j*D.nx+i];
  return (g(x0,y0)*(1-tx)+g(x0+1,y0)*tx)*(1-ty)+(g(x0,y0+1)*(1-tx)+g(x0+1,y0+1)*tx)*ty}
function dem(lat,lon){const f=demOf(DEMF,lat,lon);if(f!==null)return f;const c=demOf(DEMC,lat,lon);return c===null?50:c}
const isSeaGeo=(lat,lon)=>dem(lat,lon)<=0.5;
const CY=()=>(mh-60)/2+6;
const sx=lon=>mw/2+(lon-view.lon)*view.ppd*KX, sy=lat=>CY()-(lat-view.lat)*view.ppd;
const glon=x=>view.lon+(x-mw/2)/(view.ppd*KX), glat=y=>view.lat-(y-CY())/view.ppd;
const inLand=(x,y)=>!isSeaGeo(glat(y),glon(x));
const hex=v=>{const n=parseInt(css(v).slice(1),16);return [n>>16&255,n>>8&255,n&255]};
function limits(){const h=Math.max(100,mh-70);return {min:Math.min(h/(BAY.n-BAY.s),mw/((BAY.e-BAY.w)*KX)),max:Math.min(h,mw)/(0.42/111)}}
function clampView(){const L=limits();view.ppd=Math.max(L.min,Math.min(L.max,view.ppd));
  view.lat=Math.max(BAY.s,Math.min(BAY.n,view.lat));view.lon=Math.max(BAY.w,Math.min(BAY.e,view.lon))}
function fitArea(){view.lat=(AREA.n+AREA.s)/2-0.003;view.lon=(AREA.w+AREA.e)/2+0.004;view.ppd=Math.min((mh-70)/0.078,mw/(0.1*KX));clampView()}
function fitBay(){view.lat=(BAY.n+BAY.s)/2;view.lon=(BAY.w+BAY.e)/2;view.ppd=0;clampView()}
function renderBase(scale){
  if(!mw)return;const w=Math.max(1,Math.round(mw*scale)),h=Math.max(1,Math.round(mh*scale));
  baseCv=document.createElement("canvas");baseCv.width=w;baseCv.height=h;
  const bx=baseCv.getContext("2d"),img=bx.createImageData(w,h),d=img.data;
  const sea=hex("--sea-1"),lo=hex("--land"),hi=hex("--land-line");
  const E2=new Float32Array(w*h);
  for(let y=0;y<h;y++){const la=glat(y/scale);for(let x=0;x<w;x++)E2[y*w+x]=dem(la,glon(x/scale))}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,e=E2[i];let c;
    if(e<=0.5){c=sea}else{const t=Math.floor(Math.min(1,e/400)*4)/4*.7;c=[0,1,2].map(k=>lo[k]+(hi[k]-lo[k])*t)}
    if(x>0&&y>0&&((e<=0.5)!==(E2[i-1]<=0.5)||(e<=0.5)!==(E2[i-w]<=0.5)))c=hi;
    d[i*4]=c[0];d[i*4+1]=c[1];d[i*4+2]=c[2];d[i*4+3]=255}
  bx.putImageData(img,0,0);
}
function viewChanged(){renderBase(1);clearTimeout(hiTimer);hiTimer=setTimeout(()=>{renderBase(Math.min(2,window.devicePixelRatio||1));if(reduce)frame()},180);if(reduce)frame()}
function resize(){
  const r=MW.getBoundingClientRect();if(!r.width)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);mw=r.width;mh=r.height;
  cv.width=Math.round(mw*dpr);cv.height=Math.round(mh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  if(!viewReady){fitArea();viewReady=true}else clampView();
  renderBase(dpr);initParts();
}
function zoomAt(px,py,f){const la=glat(py),lo=glon(px);view.ppd*=f;const L=limits();view.ppd=Math.max(L.min,Math.min(L.max,view.ppd));
  view.lon=lo-(px-mw/2)/(view.ppd*KX);view.lat=la+(py-CY())/view.ppd;clampView();viewChanged()}
/* pointer: drag to pan, pinch / wheel to zoom (low sensitivity) */
const PTR=new Map();let pinch=null,moved=false;
const local=e=>{const r=MW.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
const isUI=e=>e.target.closest("button,select,input,.mapctl,.maptag,.coursesel,.zoomctl,.facbtn");
MW.addEventListener("pointerdown",e=>{if(isUI(e))return;MW.setPointerCapture(e.pointerId);PTR.set(e.pointerId,local(e));moved=false;
  if(PTR.size===2){const [a,b]=[...PTR.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),ppd:view.ppd}}});
MW.addEventListener("pointermove",e=>{if(!PTR.has(e.pointerId))return;const p=local(e),q=PTR.get(e.pointerId);
  if(PTR.size===1){const dx=(p[0]-q[0])*0.85,dy=(p[1]-q[1])*0.85;if(Math.abs(dx)+Math.abs(dy)>0.5){view.lon-=dx/(view.ppd*KX);view.lat+=dy/view.ppd;clampView();moved=true;viewChanged()}}
  PTR.set(e.pointerId,p);
  if(PTR.size===2&&pinch){const [a,b]=[...PTR.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);
    const target=pinch.ppd*Math.pow(d/pinch.d,0.6);moved=true;zoomAt((a[0]+b[0])/2,(a[1]+b[1])/2,target/view.ppd)}});
const up=e=>{if(!PTR.has(e.pointerId))return;const p=PTR.get(e.pointerId);PTR.delete(e.pointerId);if(PTR.size<2)pinch=null;
  if(!moved&&placing&&e.type==="pointerup"){FAC={lat:+glat(p[1]).toFixed(5),lon:+glon(p[0]).toFixed(5)};facCustom=true;placing=false;
    try{localStorage.setItem("kazami-fac",JSON.stringify(FAC))}catch(err){}setPlacing(false);if(reduce)frame()}};
MW.addEventListener("pointerup",up);MW.addEventListener("pointercancel",up);
MW.addEventListener("wheel",e=>{e.preventDefault();const [x,y]=local(e);const f=Math.max(0.88,Math.min(1.14,Math.exp(-e.deltaY*0.0012)));zoomAt(x,y,f)},{passive:false});
$("#zin").onclick=()=>zoomAt(mw/2,CY(),1.4);
$("#zout").onclick=()=>zoomAt(mw/2,CY(),1/1.4);
$("#zarea").onclick=()=>{fitArea();viewChanged()};
$("#zcourse").onclick=()=>{view.lat=CC.lat;view.lon=CC.lon;view.ppd=Math.min((mh-70)/(legKm*2.4/111),mw/(legKm*2.4/111*KX));clampView();viewChanged()};
$("#zbay").onclick=()=>{fitBay();viewChanged()};
function setPlacing(on){placing=on;const b=$("#facbtn");b.setAttribute("aria-pressed",on);b.textContent=on?"地図をタップして研修所の位置を決める":(facCustom?"研修所の位置を直す":"研修所の位置を直す（今は仮の位置）");MW.style.cursor=on?"crosshair":""}
$("#facbtn").onclick=()=>setPlacing(!placing);
function localWind(x,y){
  const i=curHour-6;let d=avgDir(i),s=avgSpd(i);
  const la=glat(y),lo=glon(x),r=d*Math.PI/180;
  // 風上側 0.5–1.5km に陸があれば、風が弱く左へ振れる（地形の影響の目安）
  let lee=0;[0.5,1,1.5].forEach(k=>{if(!isSeaGeo(la+Math.cos(r)*k/111,lo+Math.sin(r)*k/(111*KX)))lee++});
  if(lee){s*=1-0.12*lee;d-=3*lee}
  return [d,s];
}
function spawn(p){let n=0;do{p.x=Math.random()*mw;p.y=Math.random()*mh;n++}while(inLand(p.x,p.y)&&n<50);p.age=0;p.life=60+Math.random()*90}
function initParts(){parts=[];for(let i=0;i<110;i++){const p={};spawn(p);p.age=Math.random()*p.life;parts.push(p)}}
function labelXY(t,x,y,o={}){ctx.font=(o.w||600)+" "+(o.size||12)+'px "Noto Sans JP",sans-serif';ctx.textAlign=o.align||"left";
  ctx.lineWidth=3;ctx.strokeStyle=css("--surface");ctx.strokeText(t,x,y);ctx.fillStyle=o.col||css("--ink-2");ctx.fillText(t,x,y);ctx.textAlign="left"}
const label=(t,lat,lon,dx,dy,o)=>labelXY(t,sx(lon)+dx,sy(lat)+dy,o);
function drawBase(){
  if(baseCv)ctx.drawImage(baseCv,0,0,mw,mh);
  const pin=css("--left");
  ctx.save();ctx.setLineDash([7,5]);ctx.strokeStyle=pin;ctx.lineWidth=2;
  ctx.strokeRect(sx(AREA.w),sy(AREA.n),sx(AREA.e)-sx(AREA.w),sy(AREA.s)-sy(AREA.n));ctx.restore();
  labelXY("練習エリア",sx(AREA.w)+6,Math.max(sy(AREA.n)-7,104),{col:pin,w:700});
  drawCourse(avgDir(curHour-6));
  label("琴海",32.9034,129.8037,-4,4,{align:"right"});
  label("崎野",32.8579,129.8538,8,4);
  label("堂崎ノ鼻",32.8861,129.8814,8,4);
  label("二島",32.8976,129.8576,6,-4,{size:11});
  label("大 村 湾",32.975,129.86,0,0,{size:14,col:css("--ink-3"),align:"center"});
  ctx.strokeStyle=css("--ink");ctx.lineWidth=2;const ax=sx(129.9136),ay=sy(32.9169);
  ctx.beginPath();ctx.moveTo(ax-6,ay);ctx.lineTo(ax+6,ay);ctx.moveTo(ax,ay-6);ctx.lineTo(ax,ay+6);ctx.stroke();
  label("長崎空港",32.9169,129.9136,9,4);
  // 臨海研修所
  const fx=sx(FAC.lon),fy=sy(FAC.lat);
  ctx.fillStyle=css("--ink");ctx.beginPath();ctx.moveTo(fx,fy-9);ctx.lineTo(fx+8,fy-2);ctx.lineTo(fx+8,fy+7);ctx.lineTo(fx-8,fy+7);ctx.lineTo(fx-8,fy-2);ctx.closePath();ctx.fill();
  ctx.strokeStyle=css("--surface");ctx.lineWidth=1.5;ctx.stroke();
  labelXY(facCustom?"臨海研修所":"臨海研修所（仮）",fx,fy+22,{align:"center",w:700,col:css("--ink")});
  // 北・縮尺
  const nx=mw-26,ny=mh-140;ctx.fillStyle=css("--ink-2");ctx.strokeStyle=css("--ink-2");ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(nx,ny+26);ctx.lineTo(nx,ny);ctx.stroke();ctx.beginPath();ctx.moveTo(nx,ny-6);ctx.lineTo(nx-5,ny+4);ctx.lineTo(nx+5,ny+4);ctx.fill();
  ctx.font='700 11px "JetBrains Mono",monospace';ctx.textAlign="center";ctx.fillText("N",nx,ny-10);
  const pxPerM=view.ppd/111000,nice=[50,100,200,500,1000,2000,5000].filter(m=>m*pxPerM<=110).pop()||50;
  const bl=nice*pxPerM,bx0=mw-20-bl,by=mh-70;ctx.fillRect(bx0,by,bl,3);ctx.fillText(nice>=1000?nice/1000+" km":nice+" m",bx0+bl/2,by-5);ctx.textAlign="left";
}
function frame(){
  if(!mw){if(!reduce)requestAnimationFrame(frame);return}
  drawBase();
  const sc=mw/400;ctx.strokeStyle=css("--streak");ctx.lineCap="round";
  parts.forEach(p=>{
    const [d,s]=localWind(p.x,p.y),a=(d+90)*Math.PI/180;
    const vx=Math.cos(a)*s*0.26*sc,vy=Math.sin(a)*s*0.26*sc;
    const fade=Math.min(1,p.age/15,(p.life-p.age)/15);
    ctx.globalAlpha=.45*Math.max(0,fade);ctx.lineWidth=1.3;
    ctx.beginPath();ctx.moveTo(p.x-vx*6,p.y-vy*6);ctx.lineTo(p.x,p.y);ctx.stroke();
    if(!reduce){p.x+=vx;p.y+=vy;p.age++}
    if(p.age>p.life||inLand(p.x,p.y)||p.x<-10||p.x>mw+10||p.y<-10||p.y>mh+10)spawn(p);
  });
  ctx.globalAlpha=1;
  if(!reduce)requestAnimationFrame(frame);
}

/* ---------- course ---------- */
let course="wl",legKm=0.2;
const CC_UNUSED={lat:(AREA.n+AREA.s)/2+0.004,lon:(AREA.w+AREA.e)/2+0.004};
const COURSES={
  // 1.8km の上りレグを基準にした形。u: 風上を向いて右が＋, v: 風上方向（km）。スタートラインの中央が原点
  wl:{marks:{"1":[0,1.8],"4s":[-0.1,0.3],"4p":[0.1,0.3]},route:["S","1","4","1","4"]},
  outer:{marks:{"1":[0,1.8],"2":[-0.95,1.25],"3s":[-1.05,0.3],"3p":[-0.85,0.3]},route:["S","1","2","3","2","3"]},
  inner:{marks:{"1":[0,1.8],"2":[-0.95,1.25],"3s":[-1.05,0.3],"3p":[-0.85,0.3],"4s":[-0.1,0.3],"4p":[0.1,0.3]},route:["S","1","4","1","2","3"]}
};
function drawCourse(d){
  const C=COURSES[course],r=d*Math.PI/180,col=css("--icon"),k=legKm/1.5; // 上り（スタート〜1）の長さ ≈ legKm
  const cl=CC.lat,cn=CC.lon;
  const P=(u,v)=>{u*=k;v=v*k-legKm*0.6;const la=cl+(v*Math.cos(r)-u*Math.sin(r))/111,lo=cn+(v*Math.sin(r)+u*Math.cos(r))/(111*KX);return [sx(lo),sy(la)]};
  const M=C.marks,pt=key=>{if(key==="S")return P(0,0);if(M[key])return P(...M[key]);const a=M[key+"s"],b=M[key+"p"];return P((a[0]+b[0])/2,(a[1]+b[1])/2)};
  const [x0,y0]=P(0,0),[x1,y1]=P(0,1.8);
  if(Math.hypot(x1-x0,y1-y0)<22){ctx.fillStyle=col;ctx.beginPath();ctx.arc((x0+x1)/2,(y0+y1)/2,5,0,7);ctx.fill();
    labelXY("コース（拡大で表示）",(x0+x1)/2+8,(y0+y1)/2+4,{size:11,col});return}
  ctx.save();ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.globalAlpha=.85;const seen=new Set();
  for(let i=1;i<C.route.length;i++){const a=C.route[i-1],b=C.route[i],key=[a,b].sort().join();if(seen.has(key))continue;seen.add(key);
    const [ax,ay]=pt(a),[bx,by]=pt(b);ctx.setLineDash(b==="1"?[2,4]:[7,4]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke()}
  ctx.restore();
  const [s1x,s1y]=P(-0.25,0),[s2x,s2y]=P(0.25,0);
  ctx.strokeStyle=css("--ink");ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s1x,s1y);ctx.lineTo(s2x,s2y);ctx.stroke();
  ctx.fillStyle=css("--ink");ctx.fillRect(s2x-4,s2y-4,8,8);
  labelXY("スタート",s2x+8,s2y+16,{size:11});
  Object.values(M).forEach(([u,v])=>{const [x,y]=P(u,v);ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,5.5,0,7);ctx.fill();ctx.strokeStyle=css("--surface");ctx.lineWidth=1.5;ctx.stroke()});
  ["1","2","3","4"].forEach(key=>{if(!M[key]&&!M[key+"s"])return;const [x,y]=pt(key),ox=key==="1"?10:(key==="2"||key==="3")?-20:14,oy=key==="1"?4:(key==="2"?4:-6);
    ctx.font='700 12px "JetBrains Mono",monospace';ctx.lineWidth=3;ctx.strokeStyle=css("--surface");ctx.strokeText(key,x+ox,y+oy);ctx.fillStyle=col;ctx.fillText(key,x+ox,y+oy)});
}
$("#leg").onchange=e=>{legKm=+e.target.value;if(reduce)frame()};
setPlacing(false);

/* ---------- summary (generated from the forecast) ---------- */
const PR=[10,11,12,13,14,15];
function summarize(){
  const I=PR.map(h=>h-6);
  const mean=cmean(I.map(avgDir)),sp=I.map(avgSpd),smin=Math.min(...sp),smax=Math.max(...sp);
  const gmax=Math.max(...I.map(gustAt).filter(v=>v!=null));
  // 振れ：10–16時で最大の振れと、10°を超える最初の時刻
  let peak=0,peakH=null,startH=null;for(let h=11;h<=16;h++){const s=shiftOf(h-6);if(Math.abs(s)>Math.abs(peak)){peak=s;peakH=h}if(startH===null&&Math.abs(s)>=10)startH=h}
  const big=Math.abs(peak)>=10,side=peak>0?"右":"左";
  const others=big?["ecmwf","icon"].filter(k=>{const s=shiftM(k,peakH-6);return Math.sign(s)===Math.sign(peak)&&Math.abs(s)>=Math.max(8,Math.abs(peak)*0.5)}):[];
  const maxSp=Math.max(...I.map(spread));
  const rainH=PR.filter(h=>isRain(WX[h-6]));
  const westDiff=I.reduce((a,i)=>a+MODELS.msm_e.spd[i]-MODELS.msm.spd[i],0)/I.length;
  const r=v=>Math.round(v);
  const agree=maxSp<25?["good","3モデルがほぼ一致"]:maxSp<50?["warn","モデルで少し差がある"]:["bad","モデルで予報が分かれる"];
  return {mean,smin,smax,gmax,peak,startH,big,side,others,maxSp,agree,rainH,westDiff,r};
}
function renderSummary(){
  const S=summarize(),r=S.r,label=dayLabel(DAY);
  const pills=[`<span class="pill ${S.agree[0]==="bad"?"warn":S.agree[0]}">${S.agree[1]}</span>`];
  pills.push(S.big?`<span class="pill warn">${S.startH}時ごろ ${S.side}へ振れる</span>`:`<span class="pill info">大きな振れなし</span>`);
  if(S.rainH.length)pills.push(`<span class="pill info">${S.rainH[0]}時ごろから雨</span>`);
  $("#pills").innerHTML=pills.join("");
  $("#eyebrow").textContent=`${label} · 大村湾 南西部（琴海〜崎野沖）· 練習 10–15時`;
  const sp=S.smax-S.smin<1.5?`${S.smin.toFixed(1)}–${S.smax.toFixed(1)} m/s`:`${r(S.smin)}–${r(S.smax)} m/s`;
  $("#headline").innerHTML=`${jpDir(S.mean)}の風 ${sp}。`+(S.big?`${S.startH}時ごろから<em style="color:var(${S.peak>0?"--right":"--left"})">${S.side}へ約${Math.round(Math.abs(S.peak)/5)*5}°</em>振れる予報`:"時間による大きな振れはない予報");
  const lead=[`練習時間は ${r(S.mean)}° 前後、${sp}（突風 最大 ${S.gmax.toFixed(1)} m/s）。`];
  if(S.big)lead.push(S.others.length?`${S.others.map(k=>MODELS[k].short).join("・")}も同じ向きの振れを予報しています。`:`この振れを予報しているのは MSM だけで、ECMWF・ICON はほぼ同じ風向のまま。外れる可能性も考えておきたい。`);
  if(S.agree[0]!=="good")lead.push(`3モデルの風向は最大 ${r(S.maxSp)}° 違います。`);
  if(S.rainH.length)lead.push(`${S.rainH[0]}時ごろから雨の予報。`);
  $("#lead").textContent=lead.join("");
  // 作戦メモ
  const items=[];
  const setTitle=S.smax<3?"微風。軽さ重視のセッティングで":S.smax<6.5?"軽風〜中風。基本のセッティングで":"風が強め。ハイクアウト前提で";
  items.push(["風",setTitle,`練習時間の風速は ${sp}、突風は最大 ${S.gmax.toFixed(1)} m/s（ECMWF）。`]);
  if(S.big)items.push([S.startH+"h",`${S.startH}時ごろからは${S.side}海面へ`,`風が${S.side}へ${Math.round(Math.abs(S.peak))}°ほど振れていく予報。${S.side}へ振れるなら${S.side}海面に早めに伸ばした艇が得をする。${S.others.length?"":"ただしMSMだけの予報なので、実際の風を見て判断を。"}`]);
  else items.push(["→","大きな振れはない予報","時間による変化は小さい。目の前の小さな振れとブローを拾うことに集中。"]);
  const wd=S.westDiff;
  if(Math.abs(wd)>=0.3)items.push(["!",wd>0?"琴海側（西）は風が弱い":"琴海側（西）の方が風が強い",`MSMの予報では、琴海寄りの升目は湾中央寄りより平均 ${Math.abs(wd).toFixed(1)} m/s ${wd>0?"弱い":"強い"}。${wd>0?"風の強い湾中央寄りを使いたい。":""}`]);
  if(S.rainH.length)items.push(["雨",`${S.rainH[0]}時ごろから雨`,"雨の中は風が不安定になりやすい。雨雲の前後で風向・風速が急に変わることがある。"]);
  else if(S.agree[0]!=="good")items.push(["?","モデルで予報が分かれている",`3モデルの風向が最大 ${r(S.maxSp)}° 違う。予報を信じすぎず、出艇後に実際の風向を確かめたい。`]);
  $("#plan").innerHTML=items.map(([ic,b,t])=>`<li><div class="ic">${ic}</div><div><b>${b}</b><span>${t}</span></div></li>`).join("");
  $("#planTitle").textContent=`${label.replace(/（.）.*/,m=>m.slice(0,3))}の作戦メモ`;
}

/* ---------- selected hour UI ---------- */
function setHour(h){
  curHour=h;const i=h-6,d=avgDir(i),s=avgSpd(i),sh=shiftOf(i),g=gustAt(i);
  $("#hour").value=h;$("#hourLbl").textContent=h+":00";
  $("#tagDir").innerHTML=Math.round(norm(d))+"°<small>"+compass(d)+"</small>";
  $("#tagSpd").textContent=s.toFixed(1)+" m/s"+(g!=null&&g>s+0.5?" · 突風 "+g.toFixed(1):"");
  $("#needle").style.left=(50+Math.max(-30,Math.min(30,sh))/30*50)+"%";
  $("#mTime").textContent=h+":00 の風は";
  const a=Math.round(Math.abs(sh));
  $("#mText").textContent=a<3?"10–11時の平均とほぼ同じ":(sh>0?`10–11時より 右へ ${a}°`:`10–11時より 左へ ${a}°`);
  $("#mText").style.color=a<3?"":(sh>0?css("--right"):css("--left"));
  $$(".hour").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.h===h));
  if(reduce)frame();
}

function drawStrip(){
  const S=$("#strip");S.innerHTML="";
  for(let h=8;h<=17;h++){const i=h-6,d=avgDir(i),s=avgSpd(i),sh=shiftOf(i),sp=spread(i);
    const b=document.createElement("button");b.type="button";b.className="hour";b.dataset.h=h;
    const c=Math.abs(sh)<5?css("--ink-3"):(sh>0?css("--right"):css("--left"));
    const conf=sp<20?"●●●":sp<45?"●●○":"●○○";
    b.innerHTML=`<span class="racebg">${h>=10&&h<=15?"練習":""}</span><span class="t">${h}:00</span>
      <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="${css("--line")}"/><g transform="rotate(${d+180} 20 20)"><path d="M20 6 L26 18 L21.5 16 L21.5 32 L18.5 32 L18.5 16 L14 18Z" fill="${c}"/></g></svg>
      <span class="d">${Math.round(norm(d))}° <small style="font-weight:400;color:var(--ink-3)">${compass(d)}</small></span><span class="s">${s.toFixed(1)} m/s${isRain(WX[i])?' · <b style="color:var(--accent)">雨</b>':""}</span>
      <span class="sh" style="color:${c}">${Math.abs(sh)<5?"変化なし":(sh>0?"右 +":"左 −")+Math.round(Math.abs(sh))+"°"}</span>
      <span class="conf" title="3モデルの一致度">${conf}</span>
      <span class="bar" style="background:${c};opacity:${Math.abs(sh)<5?.25:.8}"></span>`;
    b.onclick=()=>{stop();setHour(h)};S.appendChild(b)}
}
function setDay(k){loadDay(k);renderSummary();drawStrip();setHour(curHour);if($("#more").open)drawDetails();$("#date").value=k}

let timer=null;
function stop(){if(timer){clearInterval(timer);timer=null;$("#playIcon").innerHTML='<path d="M3 1.5 L12 7 L3 12.5Z" fill="currentColor"/>'}}
$("#play").onclick=()=>{if(timer){stop();return}
  $("#playIcon").innerHTML='<rect x="2.5" y="2" width="3" height="10" fill="currentColor"/><rect x="8.5" y="2" width="3" height="10" fill="currentColor"/>';
  let h=+$("#hour").value;timer=setInterval(()=>{h=h>=17?8:h+1;setHour(h)},1100)};
document.querySelectorAll(".coursesel button").forEach(b=>b.onclick=()=>{course=b.dataset.c;document.querySelectorAll(".coursesel button").forEach(x=>x.setAttribute("aria-pressed",x===b));if(reduce)frame()});
$("#hour").oninput=e=>{stop();setHour(+e.target.value)};

/* ---------- details ---------- */
function drawDetails(){
  const ref=cmean(BEST.dir.slice(2,12));
  const U={};K.forEach(k=>U[k]=MODELS[k].dir.map(v=>ref+ad(v,ref)));
  const all=[].concat(...K.map(k=>U[k]));const lo=Math.floor((Math.min(...all)-10)/20)*20,hi=Math.ceil((Math.max(...all)+10)/20)*20;
  const yt=[];for(let v=lo;v<=hi;v+=hi-lo>120?40:20)yt.push(v);
  const S=summarize();
  chart($("#c-dir"),{x:[6,18],y:[lo,hi],xt:[6,8,10,12,14,16,18],yt,xf:hf,yf:degf,shade:[[10,15]],
    series:K.map(k=>({pts:HOURS.map((h,i)=>[h,U[k][i]]),color:css(MODELS[k].col),w:2.2,dash:MODELS[k].dash||""})),
    after:(g,x,y)=>{if(!S.big)return;el("line",{x1:x(S.startH),x2:x(S.startH),y1:y(hi),y2:y(lo),stroke:css("--warn"),"stroke-dasharray":"3 3"},g);
      el("text",{x:x(S.startH)+5,y:y(lo)-6,style:"fill:"+css("--warn")},g).textContent=S.side+"振れ（MSM）"}});
  const gm=Math.max(...[].concat(...K.map(k=>MODELS[k].gust.filter(v=>v!=null))),...[].concat(...K.map(k=>MODELS[k].spd)));
  const top=Math.max(6,Math.ceil((gm+1)/2)*2),st=top>10?4:2,yt2=[];for(let v=0;v<=top;v+=st)yt2.push(v);
  chart($("#c-spd"),{x:[6,18],y:[0,top],xt:[6,8,10,12,14,16,18],yt:yt2,xf:hf,shade:[[10,15]],
    series:[].concat(...K.map(k=>{const M=MODELS[k],s=[{pts:HOURS.map((h,i)=>[h,M.spd[i]]),color:css(M.col),w:2.2,dash:M.dash||""}];
      if(M.gust.every(v=>v!=null))s.push({pts:HOURS.map((h,i)=>[h,M.gust[i]]),color:css(M.col),w:1.1,dash:"2 3",op:.7});return s}))});
  let html=`<thead><tr><th>時刻</th>${K.map(k=>`<th>${MODELS[k].short}</th>`).join("")}<th>風速 m/s</th><th>モデルの差</th><th>天気</th></tr></thead><tbody>`;
  HOURS.forEach((h,i)=>{if(h<8||h>17)return;const sp=spread(i),cls=sp<20?"lo":sp<45?"mid":"hi";
    const s=K.map(k=>MODELS[k].spd[i]);
    html+=`<tr><td class="num">${h}:00</td>${K.map(k=>`<td class="num">${Math.round(norm(MODELS[k].dir[i]))}°</td>`).join("")}<td class="num">${Math.min(...s).toFixed(1)}–${Math.max(...s).toFixed(1)}</td><td><span class="tag ${cls} num">${Math.round(sp)}°</span></td><td>${isRain(WX[i])?"雨":WX[i]<=1?"晴れ":"くもり"}</td></tr>`});
  $("#tbl").innerHTML=html+"</tbody>";
}
$("#more").addEventListener("toggle",()=>{if($("#more").open)drawDetails()});

/* ---------- analogs ---------- */
const ANALOG=[["2025/11/09","冬型 · 晴",94],["2025/10/26","冬型 · 晴時々曇",91],["2024/11/17","冬型 · 晴",89],["2025/11/03","移動性高気圧 · 晴",86],["2024/12/01","冬型 · 曇",84],["2025/10/21","冬型 · 晴",81],["2024/11/24","冬型 · 晴",79],["2023/11/12","冬型 · 晴",77]];
const MISS=new Set([3,5]);
const TT=[];for(let t=10;t<=16.001;t+=3/60)TT.push(+t.toFixed(3));
ANALOG.forEach((a,k)=>{seed=31+k*97;const miss=MISS.has(k),shift=miss?-3:12+rnd()*6,on=12.4+rnd()*1.2,per=(7+rnd()*5)/60,ph=rnd()*6,amp=3.5+rnd()*3,off=-6+rnd()*10;
  a.pts=TT.map(t=>[t,333+off+shift/(1+Math.exp(-(t-on)*3))+(miss&&t>14.3?8:0)+amp*Math.sin(2*Math.PI*t/per+ph)+(rnd()-.5)*3])});
const MEDIAN=TT.map((t,j)=>{const v=ANALOG.map(a=>a.pts[j][1]).sort((p,q)=>p-q);return [t,(v[3]+v[4])/2]}).map((p,j,A)=>{const w=A.slice(Math.max(0,j-4),j+5);return [p[0],w.reduce((s,q)=>s+q[1],0)/w.length]});
let picked=-1;
function drawAnalog(){
  $("#dots").innerHTML=ANALOG.map((a,k)=>`<i style="background:${MISS.has(k)?css("--left"):css("--right")}">${MISS.has(k)?"×":"右"}</i>`).join("");
  const series=ANALOG.map((a,k)=>({pts:a.pts,color:k===picked?css("--obs"):css("--ink-3"),w:k===picked?2:1,op:picked<0?.28:(k===picked?1:.15)}));
  series.push({pts:MEDIAN,color:css("--accent"),w:3.5});
    chart($("#c-analog"),{x:[10,16],y:[310,370],xt:[10,11,12,13,14,15,16],yt:[310,330,350,370],xf:hf,yf:degf,series});
  const L=$("#alist");L.innerHTML="";
  ANALOG.forEach((a,k)=>{const b=document.createElement("button");b.type="button";b.className="arow";b.setAttribute("aria-pressed",k===picked);
    const miss=MISS.has(k);
    b.innerHTML=`<div class="score">${a[2]}<small>%似</small></div><div><div class="d num">${a[0]}</div><div class="m">${a[1]} · ${miss?'<span style="color:var(--left)">北西の風が入らず</span>':'<span style="color:var(--right)">右振れ +'+Math.round(12+k%3*2)+'°</span>'}</div></div>`;
    const sv=document.createElementNS(NS,"svg");sv.setAttribute("viewBox","0 0 120 34");
    const d=a.pts.map((p,j)=>(j?"L":"M")+((p[0]-10)/6*118+1).toFixed(1)+","+(34-(p[1]-310)/60*34).toFixed(1)).join("");
    el("path",{d,fill:"none",stroke:miss?css("--left"):css("--accent"),"stroke-width":1.4},sv);b.appendChild(sv);
    b.onclick=()=>{picked=picked===k?-1:k;drawAnalog()};L.appendChild(b)});
}

/* ---------- step 2 ---------- */
function bars(id,rows,max,unit){$(id).innerHTML=rows.map(([n,v,c])=>`<div class="bar"><span>${n}</span><div class="track"><div class="fill" style="width:${v/max*100}%;background:var(${c})"></div></div><span class="num">${v}${unit}</span></div>`).join("")}
function drawOsc(){
  seed=5;const pts=[];for(let t=10;t<=15;t+=1/60)pts.push([t,9*Math.sin(2*Math.PI*t/(9.5/60))+4*Math.sin(2*Math.PI*t/(23/60))+(rnd()-.5)*4]);
  chart($("#c-osc"),{x:[10,15],y:[-20,20],xt:[10,11,12,13,14,15],yt:[-20,-10,0,10,20],xf:hf,yf:t=>(t>0?"+":"")+t+"°",series:[],
    after:(g,x,y)=>{pts.forEach((p,j)=>{if(!j)return;const q=pts[j-1];el("line",{x1:x(q[0]),y1:y(q[1]),x2:x(p[0]),y2:y(p[1]),stroke:p[1]>=0?css("--right"):css("--left"),"stroke-width":1.8},g)});
      el("line",{x1:x(10),x2:x(15),y1:y(0),y2:y(0),stroke:css("--ink-3")},g)}});
}
$$(".qb").forEach(b=>b.onclick=()=>{const n=new Date(),t=String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");
  const li=document.createElement("li");li.innerHTML=`<span class="num">${t}</span>${b.dataset.k} · 記録しました`;$("#log").prepend(li)});

/* ---------- step 3 ---------- */
function drawTrack(){
  const s=$("#track");s.innerHTML="";
  el("rect",{width:400,height:320,fill:css("--sea-1")},s);
  for(let i=0;i<400;i+=40)el("line",{x1:i,y1:0,x2:i,y2:320,stroke:css("--sea-2")},s);
  for(let i=0;i<320;i+=40)el("line",{x1:0,y1:i,x2:400,y2:i,stroke:css("--sea-2")},s);
  const legs=[[200,300,140,250,1],[140,250,175,215,0],[175,215,110,170,1],[110,170,150,128,1],[150,128,205,100,0],[205,100,250,70,1],[250,70,225,48,1],[225,48,205,28,1]];
  const circ="①②③④⑤⑥⑦";
  legs.forEach(([x1,y1,x2,y2,lift],k)=>{el("line",{x1,y1,x2,y2,stroke:lift?css("--right"):css("--left"),"stroke-width":4,"stroke-linecap":"round"},s);
    if(k){el("circle",{cx:x1,cy:y1,r:9,fill:css("--surface"),stroke:css("--ink"),"stroke-width":1.5},s);
      el("text",{x:x1,y:y1+4,"text-anchor":"middle","font-size":11,"font-weight":700,fill:css("--ink")},s).textContent=circ[k-1]}});
  el("circle",{cx:205,cy:22,r:7,fill:css("--icon")},s);
  el("text",{x:216,y:26,"font-size":11,fill:css("--ink-2")},s).textContent="風上マーク";
  el("line",{x1:170,y1:305,x2:240,y2:305,stroke:css("--ink-2"),"stroke-width":2},s);
  el("text",{x:248,y:309,"font-size":11,fill:css("--ink-2")},s).textContent="スタート";
  el("path",{d:"M360,30 L360,80 M352,70 L360,82 L368,70",stroke:css("--accent"),"stroke-width":2.5,fill:"none"},s);
  el("text",{x:360,y:22,"text-anchor":"middle","font-size":11,fill:css("--accent"),"font-weight":700},s).textContent="風 340°";
}

/* ---------- tabs ---------- */
const views={today:()=>{drawStrip();setHour(curHour);if($("#more").open)drawDetails()},analog:drawAnalog,obs:drawOsc,tactics:drawTrack};
$$(".tab").forEach(b=>b.onclick=()=>{
  $$(".tab").forEach(x=>x.setAttribute("aria-selected",x===b));
  $$(".view").forEach(v=>v.hidden=v.id!=="view-"+b.dataset.view);
  if(b.dataset.view!=="today")stop();
  views[b.dataset.view]();
  if(b.dataset.view==="today"){resize();if(reduce)frame()}
  try{localStorage.setItem("kazami-tab",b.dataset.view)}catch(e){}
});
$$("#filters .chip").forEach(c=>c.onclick=()=>c.setAttribute("aria-pressed",c.getAttribute("aria-pressed")!=="true"));

bars("#barsDir",[["MSM",11.2,"--msm"],["ECMWF",8.6,"--ecmwf"],["ICON",9.9,"--icon"]],15,"°");
bars("#barsSpd",[["MSM",1.1,"--msm"],["ECMWF",1.4,"--ecmwf"],["ICON",1.3,"--icon"]],2,"m/s");
$("#date").innerHTML=Object.keys(FC.days).map(k=>`<option value="${k}">${dayLabel(k)}</option>`).join("");
$("#date").onchange=e=>setDay(e.target.value);
$("#updated").textContent=`予報 ${FC.fetched} 更新`+(OBS?` · 長崎空港 ${OBS.time} ${OBS.dir==null?"風向不定":jpDir(OBS.dir)} ${OBS.speed.toFixed(1)} m/s`:"");
const DEFAULT_DAY=Object.keys(FC.days).find(k=>k>FC.today)||FC.today;
resize();curHour=10;setDay(DEFAULT_DAY);frame();
let saved=null;try{saved=localStorage.getItem("kazami-tab")}catch(e){}
if(saved&&saved!=="today"){const b=document.querySelector(`.tab[data-view="${saved}"]`);if(b)b.click()}
const redraw=()=>{const v=document.querySelector(".tab[aria-selected=true]").dataset.view;resize();views[v]();if(reduce)frame()};
let rt;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(redraw,150)});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",redraw);
new MutationObserver(redraw).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});

}

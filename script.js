/* =========================================================
   محاكاة p5: جزيئات في مستطيل — نحسب "إنتروبي تقريبي"
   - الفكرة: نقسم الساحة إلى خانات (grid)، نحسب توزيع الجسيمات،
     ونستخدم صيغة Shannon-like: S = -Σ p_i ln p_i (نحو مقياس نسبي).
   - التحكم: temp (تؤثر على سرعة الجزيئات)، npart, noise
   ========================================================= */
let sketch = (p) => {
  let particles = [];
  let npart = 220;
  let gridN = 20; // دقة شبكة الإنتروبي
  let widthW = 840, heightH = 520;
  p.setup = function(){
    let cnv = p.createCanvas(widthW, heightH);
    cnv.parent('p5-holder');
    initParticles();
  };
  function initParticles(){
    particles = [];
    for(let i=0;i<npart;i++){
      particles.push({
        x: p.random(40, widthW-40),
        y: p.random(40, heightH-40),
        vx: p.random(-0.5,0.5),
        vy: p.random(-0.5,0.5),
        mass: 1
      });
    }
  }

  p.draw = function(){
    p.clear();
    // خلفية مرئية
    p.push();
    p.noStroke();
    let g = p.drawingContext.createLinearGradient(0,0,0,heightH);
    g.addColorStop(0, '#0b2a3b');
    g.addColorStop(1, '#081826');
    p.drawingContext.fillStyle = g;
    p.rect(0,0,widthW,heightH);
    p.pop();

    // تحديث وفقا للحرارة
    let T = Number(document.getElementById('temp').value);
    let noiseFactor = Number(document.getElementById('noise').value);
    let speedScale = Math.sqrt(T/300); // تقريبياً: سرعة ~ sqrt(T)
    // حركة الجسيمات
    for(let pt of particles){
      // عشوائية بناء على noise ودرجة الحرارة
      pt.vx += p.randomGaussian() * 0.12 * noiseFactor * speedScale;
      pt.vy += p.randomGaussian() * 0.12 * noiseFactor * speedScale;
      // حدود
      pt.x += pt.vx * speedScale;
      pt.y += pt.vy * speedScale;
      if(pt.x < 10){ pt.x = 10; pt.vx *= -0.7; }
      if(pt.x > widthW-10){ pt.x = widthW-10; pt.vx *= -0.7; }
      if(pt.y < 10){ pt.y = 10; pt.vy *= -0.7; }
      if(pt.y > heightH-10){ pt.y = heightH-10; pt.vy *= -0.7; }
    }

    // رسم الخانات (نصف شفافية) لمعاينة توزيع الإنتروبي
    let cols = gridN, rows = Math.floor(gridN * (heightH/widthW));
    let bin = new Array(cols*rows).fill(0);
    let cellW = widthW/cols, cellH = heightH/rows;
    for(let pt of particles){
      let cx = Math.floor(pt.x / cellW); if(cx>=cols) cx = cols-1;
      let cy = Math.floor(pt.y / cellH); if(cy>=rows) cy = rows-1;
      bin[cx + cy*cols] += 1;
    }

    // حساب إنتروبي (Shannon-like)
    let S = 0;
    let N = particles.length;
    for(let b of bin){
      if(b>0){
        let pprob = b / N;
        S += - pprob * Math.log(pprob);
      }
    }
    // نعرض قيمة S بعد تحويلها لمقياس سهل القراءة (normalize)
    // مقياس أقصى = ln(#خانات) تقريباً
    let maxS = Math.log(cols*rows);
    let relS = S / maxS;
    document.getElementById('entropy-val').innerText = relS.toFixed(3);

    // رسم الخانات مظللة بلون حسب الكثافة
    p.noFill();
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        let idx = x + y*cols;
        let c = bin[idx];
        // لونية: من ازرق (قليل) إلى أحمر (كثير)
        let t = Math.min(1, c / (N/cols)); // تقريب
        let col = p.color(
          p.lerp(30, 255, t), // r
          p.lerp(60, 120, 1-t), // g
          p.lerp(100, 30, 1-t) // b
        );
        p.fill(p.red(col), p.green(col), p.blue(col), 40);
        p.noStroke();
        p.rect(x*cellW, y*cellH, cellW, cellH);
      }
    }

    // رسم الجزيئات (بحجم مرتبط بالسرعة)
    for(let pt of particles){
      let sp = Math.min(3 + Math.hypot(pt.vx,pt.vy)*2, 8);
      let speed = Math.hypot(pt.vx,pt.vy);
      // لون حسب الطاقة الحركية
      let t = Math.min(1, speed*2 * speedScale);
      let r = Math.floor(200*t + 30*(1-t));
      let g = Math.floor(80*(1-t));
      let b = Math.floor(220*(1-t));
      p.fill(r,g,b);
      p.noStroke();
      p.ellipse(pt.x, pt.y, sp, sp);
    }

    // عرض قيمة temp
    document.getElementById('temp-val').innerText = T;

    // أرسل قيمة النسبة لمخطط T-S لحسابه
    window.__thermoState = { T: T, Srel: relS, N: N };
    // نحدّث مخطط Plotly بفاصل زمني محدود لعدم التكليف الزائد
    if(!window.__lastPlotUpdate || Date.now() - window.__lastPlotUpdate > 300){
      updateTSPlot(window.__thermoState);
      window.__lastPlotUpdate = Date.now();
    }
  };

  // استماع لضبط عدد الجزيئات
  p.mousePressed = function(){}
  document.getElementById('npart').addEventListener('input', function(){
    let v = Number(this.value);
    npart = v;
    // نعيد تهيئة الجسيمات لتتماشى
    initParticles();
  });
};

// تشغيل sketch
new p5(sketch);

/* ============================
   Plotly: مخطط T-S بسيط
   - نرسم مسار تقريبي (T, S) ونعرض نقطة النظام الحالية
   - نحسب كفاءة كارنو التقريبية
   ============================ */
let tsLayout = {
  paper_bgcolor:'rgba(0,0,0,0)',
  plot_bgcolor:'rgba(0,0,0,0)',
  margin:{l:50,r:10,t:20,b:45},
  xaxis:{title:'Entropy (relative)', color:'#cfd8e3'},
  yaxis:{title:'Temperature (K)', color:'#cfd8e3'}
};
let tsData = [{
  x: [0.05,0.15,0.25,0.35,0.5,0.7,0.9],
  y: [150,200,300,450,700,1000,1500],
  mode:'lines',
  line:{color:'#6be6ff'},
  name:'Mock T–S curve'
},{
  x:[0.25],
  y:[300],
  mode:'markers',
  marker:{size:12, color:'#ff6b6b'},
  name:'النقطة الحالية'
}];

Plotly.newPlot('plot', tsData, tsLayout, {displayModeBar:false});

function updateTSPlot(state){
  if(!state) return;
  // نضع نقطة جديدة
  let x = state.Srel;
  let y = state.T;
  // تحديث النقطة
  Plotly.animate('plot', {
    data:[{x:[x], y:[y]}],
  },{
    transition:{duration:200, easing:'cubic-in-out'},
    frame:{duration:200}
  });

  // تحديث ΔT مقابل مرجع (300K)
  let dT = Math.max(0, y - 300);
  document.getElementById('deltat').innerText = Math.round(dT);
  // كفاءة كارنو التقريبة: 1 - Tc/Th (نختار Tc ثابت 290K كمثال)
  let Tc = 290;
  let eta = 0;
  if(y> Tc) eta = (1 - (Tc / y)) * 100;
  document.getElementById('eta').innerText = eta.toFixed(1) + '%';
}

/* ===========================
   Timeline: أحداث تاريخية مختارة
   =========================== */
const events = [
  {year:1824, title:'السيرس كارنو', desc:'سوغ كارنو مفهوم دورة كارنو وأكّد حدود الكفاءة المثلى للمحركات الحرارية.'},
  {year:1850, title:'رودولف كلاوسيوس', desc:'مفهوم الإنتروبي وربط الحرارة بالشغل؛ صاغ قانونين أساسيين للديناميكا الحرارية.'},
  {year:1873, title:'لاديسلاو بولتزمان', desc:'ربط الإنتروبي بالإحصاء: S = k ln W، بداية الميكانيكا الإحصائية.'},
  {year:1905, title:'توسيع المفاهيم الحرارية', desc:'تطبيقات على الديناميكا الحرارية في المحركات والفيزياء الحديثة.'},
  {year:1950, title:'تطبيقات هندسية', desc:'استخدام مخططات T–S وخصائص البخار في التصميم الهندسي.'},
  {year:2000, title:'محاكيات تعليمية', desc:'ظهور أدوات تفاعلية متقدمة لشرح الإنتروبي والديناميكا الحرارية.'}
];

function buildTimeline(){
  let container = document.getElementById('timeline');
  for(let ev of events){
    let div = document.createElement('div');
    div.className = 'event';
    div.innerHTML = `<div class="year">${ev.year}</div><div class="title">${ev.title}</div><div class="desc">${ev.desc}</div>`;
    div.addEventListener('click', ()=> selectEvent(ev));
    container.appendChild(div);
  }
}
function selectEvent(ev){
  document.getElementById('selected-event').innerText = ev.year + ' — ' + ev.title;
  // عند النقر: نعرض نص قصير في overlay (بسيط)
  showOverlay(ev);
}
function showOverlay(ev){
  // بسيط: نافذة منبثقة تعليمية
  let w = window.open('','_blank','width=600,height=420');
  let html = `
    <html><head><meta charset="utf-8"><title>${ev.title}</title>
    <style>body{font-family:Inter,Arial;background:#071021;color:#eaf6ff;padding:18px} h2{color:#6be6ff} p{color:#cbd8e6}</style>
    </head><body>
    <h2>${ev.title} — ${ev.year}</h2>
    <p>${ev.desc}</p>
    <hr>
    <p style="color:#9fb7c9;font-size:13px">شرح إضافي: ${extraHistory(ev.year)}</p>
    </body></html>
  `;
  w.document.write(html);
  w.document.close();
}
function extraHistory(year){
  switch(year){
    case 1824: return 'كارنو قدّم فكرة دورة حرارية مثالية أدت لاحقاً لاشتقاق كفاءة حدية تعرف باسم كفاءة كارنو.';
    case 1850: return 'كلاوسيوس اخترع مصطلح "entropy" وشرح العلاقات الحرارية-الإحصائية بين الحرارة والشغل.';
    case 1873: return 'بولتزمان أوضح أن الإنتروبي يمكن تفسيره عددياً عبر عدد الحالات الدقيقة W.';
    case 1950: return 'استخدم المهندسون مخططات Ts وPv لتصميم محطات توليد البخار والتبريد.';
    default: return 'تطوّر فهمنا للديناميكا الحرارية واستُخدمت في الكثير من التطبيقات الحديثة.';
  }
}

// بناء الخط الزمني عند التحميل
buildTimeline();

/* ===========================
   تحكمات واجهة: ربط منزلق temp لتغيير السرعة
   =========================== */
document.getElementById('temp').addEventListener('input', function(){
  // تحديث يظهر تلقائي في p5 عبر قراءة العنصر
});
// نضبط قيمة الجسيمات عند التحميل
document.getElementById('npart').addEventListener('change', function(){
  // p5 يعيد تهيئة الجسيمات عندما يقرأ القيمة (راجع الكود أعلاه)
});

/* ===========================
   لمسات أخيرة: وضع حالة أولية للمخطط
   =========================== */
setTimeout(()=> {
  // تحديث أولي
  if(window.__thermoState) updateTSPlot(window.__thermoState);
}, 800);

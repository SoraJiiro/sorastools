// Minimal Chart Editor - modal metadata, audio load, vertical 5-lane highway
(function(){
  const modal = document.getElementById('metaModal');
  const openBtn = document.getElementById('openBtn');
  const audioInput = document.getElementById('audioFile');
  const audioEl = document.getElementById('audio');
  const metaDisplay = document.getElementById('metaDisplay');
  const highway = document.getElementById('highway');
  const noteTypeSel = document.getElementById('noteType');

  const ctx = highway.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let model = { song:{}, notes:[] }; // notes: {id, timeSec, lane(0-4), durationSec, mod}
  let audioURL = null;
  let viewTime = 0; // time at playhead (bottom)
  const pxPerSec = 120; // pixels per second
  const hitBarHeight = 24;
  const snapStep = 0.125; // seconds
  let isDraggingRight = false;
  let dragNote = null;

  function resize(){
    const r = highway.parentElement.getBoundingClientRect();
    highway.width = Math.floor(r.width * dpr);
    highway.height = Math.floor(r.height * dpr);
    highway.style.width = r.width + 'px';
    highway.style.height = r.height + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }

  function formatMeta(){ return `${model.song.name||'(untitled)'} — ${model.song.artist||'(unknown)'} ` }

  function draw(){
    const w = highway.width / dpr; const h = highway.height / dpr;
    ctx.clearRect(0,0,w,h);
    // background
    const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#06131d'); g.addColorStop(0.3,'#04151d'); g.addColorStop(1,'#021012'); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    // highway top and bottom accents
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0,0,w,42);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0,h-64,w,26);
    // lanes and separators
    const laneCount = 5; const laneW = w / laneCount;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for(let i=1;i<laneCount;i++){ const x=i*laneW - 2; ctx.fillRect(x, 0, 4, h); }
    ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=1;
    for(let i=0;i<=laneCount;i++){ const x=i*laneW+0.5; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    // playhead (hit bar) at bottom
    const playY = h - hitBarHeight;
    ctx.fillStyle = '#107495'; ctx.fillRect(0, playY, w, hitBarHeight);
    ctx.fillStyle = '#f3fbff'; ctx.font='bold 12px Inter'; ctx.fillText('HIT', 10, playY+16);
    const laneColors = ['#2ab24b', '#e03f32', '#f6e035', '#3a82f1', '#ff8b1d'];
    const openColor = '#9b5cff';
    // draw notes
    model.notes.forEach(n=>{
        const lane = Math.max(0,Math.min(4,n.lane||0));
      const cx = lane*laneW + laneW*0.5;
      const y = playY - ( (n.timeSec - viewTime) * pxPerSec );
      const radius = laneW*0.28;
      const durPx = Math.max((n.durationSec||0) * pxPerSec, 6);
      const noteColor = n.mod==='open' ? openColor : laneColors[lane];
      if(n.mod === 'open'){
        ctx.fillStyle = noteColor;
        roundRect(ctx, 4, y - durPx/2, w-8, durPx, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
        roundRect(ctx, 4, y - durPx/2, w-8, durPx, 10); ctx.stroke();
      } else {
        if(n.durationSec > 0){
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          roundRect(ctx, cx - radius*0.25, y - durPx, radius*0.5, durPx, 7);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(cx, y, radius, 0, Math.PI*2);
        ctx.fillStyle = noteColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
        ctx.stroke();
        if(n.mod === 'hopo' || n.mod === 'tap'){
          ctx.beginPath();
          ctx.arc(cx, y, radius*0.42, 0, Math.PI*2);
          ctx.fillStyle = n.mod==='hopo' ? '#ffffff' : '#000000';
          ctx.fill();
        }
      }
    });
  }

  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  function addNoteAt(evt){
    const rect = highway.getBoundingClientRect();
    const x = evt.clientX - rect.left; const y = evt.clientY - rect.top;
    const w = rect.width; const laneW = w/5; const lane = Math.floor(x / laneW);
    const playY = rect.height - hitBarHeight;
    let time = viewTime + (playY - y)/pxPerSec;
    if(time < 0) return;
    time = Math.round(time / snapStep) * snapStep;
    const mod = noteTypeSel.value;
    // prevent duplicates at same time + lane
    const exists = model.notes.some(n => n.lane === lane && Math.abs(n.timeSec - time) < 0.001);
    if(exists) return;
    const note = { id:Date.now()+Math.random(), timeSec: time, lane: lane, durationSec: 0, mod: mod };
    model.notes.push(note); model.notes.sort((a,b)=>a.timeSec-b.timeSec); draw();
  }

  function findNoteAt(evt){ const rect=highway.getBoundingClientRect(); const x=evt.clientX-rect.left,y=evt.clientY-rect.top; const w=rect.width,laneW=w/5,playY=rect.height-hitBarHeight; for(let i=0;i<model.notes.length;i++){const n=model.notes[i];const nx = n.mod==='open'?0: (n.lane*laneW + laneW*0.1); const nw = n.mod==='open'?w:laneW*0.8; const ny = playY - ((n.timeSec - viewTime) * pxPerSec); const nh = Math.max((n.durationSec||0)*pxPerSec, 6); if(y>=ny-nh && y<=ny+16 && x>=nx && x<=nx+nw) return n;} return null }

  // right-click drag to set sustain
  highway.addEventListener('contextmenu', e=>e.preventDefault());
  highway.addEventListener('pointerdown', e=>{
    if(e.button===2){ const n = findNoteAt(e); if(n){ isDraggingRight=true; dragNote=n; highway.setPointerCapture(e.pointerId); }}
    else if(e.button===0){ addNoteAt(e); }
  });
  highway.addEventListener('pointermove', e=>{
    if(isDraggingRight && dragNote){ const rect=highway.getBoundingClientRect(); const playY=rect.height-hitBarHeight; const y=e.clientY-rect.top; const endTime = viewTime + (playY - y)/pxPerSec; dragNote.durationSec = Math.max(0, endTime - dragNote.timeSec); draw(); }
  });
  highway.addEventListener('pointerup', e=>{ if(isDraggingRight){ isDraggingRight=false; dragNote=null; try{ highway.releasePointerCapture(e.pointerId) }catch(_){} } });

  // wheel to scroll viewTime (limit 0..audio.duration)
  highway.addEventListener('wheel', e=>{ e.preventDefault(); if(!audioEl.duration) return; viewTime += e.deltaY * 0.01; viewTime = Math.max(0, Math.min(audioEl.duration, viewTime)); draw(); }, {passive:false});

  // load audio and initialize
  openBtn.addEventListener('click', async ()=>{
    const f = audioInput.files[0]; if(!f) return alert('Choisissez un fichier audio');
    const name = document.getElementById('songName').value; const artist=document.getElementById('artist').value; const date=document.getElementById('date').value; const album=document.getElementById('album').value; const charter=document.getElementById('charter').value;
    model.song = { name, artist, date, album, charter };
    metaDisplay.textContent = formatMeta();
    // load audio
    if(audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(f); audioEl.src = audioURL;
    await new Promise(r=>audioEl.addEventListener('loadedmetadata', r, {once:true}));
    modal.style.display='none';
    // set viewTime to 0
    viewTime = 0;
    // resize canvas parent height to audio duration mapping (we keep fixed canvas height but user scrolls)
    resize();
  });

  window.addEventListener('resize', ()=>{ dpr = window.devicePixelRatio||1; resize(); });
  // initial
  setTimeout(resize,50);

  // simple export (not full .chart spec) - placeholder
  document.getElementById('saveBtn').addEventListener('click', ()=>{
    const out = { meta: model.song, notes: model.notes.map(n=>({t: n.timeSec, lane:n.lane, dur:n.durationSec, mod:n.mod})) };
    const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=(model.song.name||'song')+'.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

})();

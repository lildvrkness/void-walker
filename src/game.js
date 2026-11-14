(() => {
'use strict';

const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const spriteImages={};
const spriteNames=['region_bg_center','region_bg_oasis','region_bg_factory','region_bg_sanctum','hero_idle_01','hero_idle_02','hero_idle_03','hero_walk_01','hero_walk_02','hero_walk_03','hero_walk_04','hero_attack_01','hero_attack_02','hero_attack_03','hero_attack_04','hero_hurt_01','hero_hurt_02','amphibian_warden','amphibian_minion','nail_witch','void_demon_phase1','void_demon_phase2','black_eel','darkling_01','darkling_02','void_spiral_orb','void_crate','void_crate_broken','healing_potion','void_potion','void_crystal','portal_arch','weapon_sword','weapon_knife','weapon_mace','weapon_staff','armor_set_01','armor_set_02','armor_set_03','armor_set_04'];

spriteNames.forEach(name=>{
  const img=new Image();
  img.src='assets/sprites/'+name+'.png';
  spriteImages[name]=img;
});

// Sound system
const audioCtx=new (window.AudioContext||window.webkitAudioContext)();
let bgm=null;

function unlockAudio(){
  if(audioCtx.state==='suspended')audioCtx.resume();
  startBGM();
}

document.addEventListener('keydown',unlockAudio,{once:true});
document.addEventListener('pointerdown',unlockAudio,{once:true});

function playTone(freq,duration,type='square',vol=0.08){
  if(audioCtx.state!=='running')return;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  osc.type=type;
  osc.frequency.value=freq;
  gain.gain.setValueAtTime(vol,audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime+duration);
}

function sfxAttack(weaponId){
  switch(weaponId){
    case 0:playTone(280,0.14,'sawtooth',0.07);playTone(140,0.18,'square',0.04);break;
    case 1:playTone(420,0.08,'square',0.06);playTone(210,0.1,'sawtooth',0.03);break;
    case 2:playTone(90,0.2,'square',0.1);playTone(60,0.25,'triangle',0.06);break;
    case 3:playTone(320,0.16,'sine',0.05);playTone(480,0.22,'sine',0.04);playTone(160,0.3,'triangle',0.03);break;
    default:playTone(220,0.12,'sawtooth',0.07);
  }
}

function sfxHit(){playTone(80,0.15,'square',0.09)}
function sfxPickup(){playTone(523,0.08,'sine',0.05);playTone(784,0.12,'sine',0.04)}

function startBGM(){
  if(bgm)return;
  bgm=new Audio('https://files.catbox.moe/br2r9t.ogg');
  bgm.loop=true;
  bgm.volume=0.25;
  bgm.play().catch(()=>{});
}

function sfxWin(){
  playTone(392,0.18,'sine',0.06);
  setTimeout(()=>playTone(523,0.18,'sine',0.06),180);
  setTimeout(()=>playTone(659,0.28,'sine',0.07),360);
  setTimeout(()=>playTone(784,0.4,'sine',0.05),540);
}

const $=id=>document.getElementById(id);

let W=0,H=0,last=0,running=false,toastTimer=0,overlayOpen=false;

function resize(){
  const d=Math.min(devicePixelRatio||1,2);
  W=canvas.clientWidth;
  H=canvas.clientHeight;
  canvas.width=Math.floor(W*d);
  canvas.height=Math.floor(H*d);
  ctx.setTransform(d,0,0,d,0,0);
}

new ResizeObserver(resize).observe(canvas);
resize();

const keys={},touch={up:false,down:false,left:false,right:false};

const weapons=[
  {id:'sword',name:'Rusted Sword',damage:18,range:54,arc:1.15,speed:.34,desc:'A worn blade. Balanced reach and speed.'},
  {id:'knife',name:'Hollow Knife',damage:12,range:39,arc:1.65,speed:.19,desc:'Quick close-range strikes.'},
  {id:'mace',name:'Grave Mace',damage:29,range:48,arc:.9,speed:.58,desc:'Slow, crushing impact.'},
  {id:'stick',name:'Splintered Staff',damage:9,range:68,arc:.8,speed:.42,desc:'A fragile weapon with surprising reach.'}
];

const regions={
  center:{name:'THE CRACKLED VOID',sub:'A land that remembers the dark',bg:'#171020',floor:'#21182a',x:0,y:0},
  oasis:{name:'THE UNDERGROUND OASIS',sub:'Something moves beneath the violet water',bg:'#100d21',floor:'#211936',x:-1,y:0},
  factory:{name:'THE ABANDONED FACTORY',sub:'The machines still dream',bg:'#15101d',floor:'#211923',x:1,y:0},
  sanctum:{name:'THE VOID SANCTUM',sub:'The heart of the fracture',bg:'#100817',floor:'#1b1024',x:0,y:-1}
};

let state;

const MAX_PLAYER_HP=150;
const DASH_DURATION=0.18;
const DASH_COOLDOWN=2.1;
const DASH_PROTECTION=0.28;

function fresh(){
  const orbRegions=['center','oasis','factory'];

  return {
    player:{
      x:0,y:0,hp:100,maxHp:100,
      dir:0,moveDir:0,
      attack:0,attackCooldown:0,invuln:0,
      weapon:0,void:0,
      dashTime:0,dashCooldown:0,dashGrace:0,
      dashX:0,dashY:0
    },
    region:'center',
    inventory:[true,false,false,false],
    armor:[],
    weaponsUpgraded:false,
    damageBonus:0,
    orbTaken:false,
    orbSpawn:{
      region:orbRegions[Math.floor(Math.random()*orbRegions.length)],
      x:(Math.random()-.5)*420,
      y:(Math.random()-.5)*260
    },
    defeated:{eel:false,wraith:false,demon:false},
    crateLoot:0,
    elapsed:0,
    secretFound:false,
    enemies:[],
    crates:[],
    projectiles:[],
    particles:[],
    message:'',
    boss:null,
    difficulty:1,
    endless:false,
    score:0,
    startTime:Date.now()
  };
}

state=fresh();

const worldSeeds={center:12,oasis:24,factory:38,sanctum:52};

function rand(seed){
  let x=Math.sin(seed*127.1+311.7)*43758.5453;
  return x-Math.floor(x);
}

// --------------------------------------------------
// ENEMY SPAWNING AND DIFFICULTY SCALING
// --------------------------------------------------

function spawnRegion(){
  const r=state.region,seed=worldSeeds[r],diff=state.difficulty||1;

  state.enemies=[];
  state.crates=[];
  state.projectiles=[];
  state.boss=null;

  const add=(x,y,type,boss=false)=>{
    const baseHp=boss
      ?(type==='demon'?680:type==='wraith'?360:324)
      :type==='minion'?48:65;

    const hpScale=1+(diff-1)*(boss?0.45:0.35);
    const hp=Math.floor(baseHp*hpScale);

    state.enemies.push({
      x,y,type,boss,
      variant:Math.floor(rand(seed+x*0.13+y*0.07)*2),
      hp,maxHp:hp,
      attack:0,
      flash:0,
      phase:1,
      wind:0,
      special:0,
      specialCooldown:2.4,
      specialWind:0,
      specialDir:0,
      dead:false,
      dir:0,
      hitFlash:0,
      playerHitCooldown:0
    });
  };

  const minionMult=1+Math.floor((diff-1)*0.7);

  if(r==='center'){
    for(let i=0;i<7*minionMult;i++){
      let x=(rand(seed+i*3)-.5)*620;
      let y=(rand(seed+i*5)-.5)*420;
      if(Math.abs(x)<85&&Math.abs(y)<70)x+=150;
      add(x,y,'minion');
    }
  }

  if(r==='oasis'){
    if(!state.defeated.eel)add(0,-65,'eel',true);

    for(let i=0;i<3*minionMult;i++){
      add(-170+(i%3)*170,130+(Math.floor(i/3)*40),'minion');
    }
  }

  if(r==='factory'){
    if(!state.defeated.wraith)add(0,-80,'wraith',true);

    for(let i=0;i<2*minionMult;i++){
      add(-150+(i%2)*300,130+(Math.floor(i/2)*40),'minion');
    }
  }

  if(r==='sanctum'&&!state.defeated.demon){
    add(0,-75,'demon',true);
  }

  if(state.orbSpawn&&state.orbSpawn.region===r&&!state.orbTaken){
    state.orb={x:state.orbSpawn.x,y:state.orbSpawn.y,region:r};
  }else{
    state.orb=null;
  }

  const crateCount=r==='center'?8:(r==='sanctum'?0:4);

  for(let i=0;i<crateCount;i++){
    let x=(rand(seed+90+i*2)-.5)*650;
    let y=(rand(seed+120+i*3)-.5)*430;
    state.crates.push({
      x,y,hp:2,dead:false,
      glow:rand(i+seed)>.78,
      lastHit:0
    });
  }
}

spawnRegion();

const player=()=>state.player;

function drawSprite(name,x,y,w,h,alpha=1){
  const img=spriteImages[name];
  if(!img||!img.complete||!img.naturalWidth)return false;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.drawImage(img,x-w/2,y-h/2,w,h);
  ctx.restore();
  return true;
}

function toast(t){
  $('toast').textContent=t;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2100);
}

function switchWeapon(n){
  if(state.inventory[n]){
    player().weapon=n;
    updateHud();
    toast(weapons[n].name.toUpperCase());
  }
}

function updateBossHud(){
  const boss=state.enemies.find(e=>e.boss&&!e.dead);

  $('boss-panel').classList.toggle('hidden',!boss);

  if(boss){
    $('boss-name').textContent=
      boss.type==='eel'?'THE AMPHIBIAN WARDEN':
      boss.type==='wraith'?'THE VOID TEMPTRESS':
      'THE VOID DEMON';

    $('boss-fill').style.width=
      (Math.max(0,boss.hp)/boss.maxHp*100)+'%';

    $('boss-phase').textContent=
      'PHASE '+(boss.phase===1?'I':boss.phase===2?'II':'III');
  }
}

// --------------------------------------------------
// PLAYER DAMAGE UPGRADE LIMITS
// --------------------------------------------------

function getPlayerDamageBonus(){
  return Math.min(
    8,
    (state.weaponsUpgraded?6:0)+Math.min(4,state.damageBonus||0)
  );
}

function updateHud(){
  const p=player();

  $('hp-text').textContent=Math.ceil(p.hp)+' / '+p.maxHp;
  $('hp-fill').style.width=(p.hp/p.maxHp*100)+'%';

  $('xp-text').textContent=p.void;
  $('xp-fill').style.width=Math.min(100,p.void*10)+'%';

  $('weapon-name').textContent=weapons[p.weapon].name;

  $('weapon-level').textContent=
    'DAMAGE '+(weapons[p.weapon].damage+getPlayerDamageBonus()+(p.void>=8?1:0));

  $('armor-count').textContent='ARMOR '+state.armor.length+'/3';

  document.querySelectorAll('.slot').forEach((b,i)=>{
    b.classList.toggle('active',i===p.weapon);
    b.style.opacity=state.inventory[i]?1:.28;
  });

  $('region-title').textContent=regions[state.region].name;

  $('region-subtitle').textContent=
    regions[state.region].sub+(state.endless?' · DIFF '+state.difficulty:'');

  const best=localStorage.getItem('vwBest')||0;

  if($('score-display')){
    $('score-display').textContent=
      'SCORE '+Math.floor(state.score)+' · BEST '+best;
  }

  updateBossHud();
}

function panel(title,html){
  overlayOpen=true;
  $('panel-title').textContent=title;
  $('panel-content').innerHTML=html;
  $('overlay').classList.remove('hidden');
}

function closePanel(){
  overlayOpen=false;
  $('overlay').classList.add('hidden');
}

// --------------------------------------------------
// INVENTORY
// --------------------------------------------------

function inventoryPanel(){
  const weaponArt=[
    'weapon_sword',
    'weapon_knife',
    'weapon_mace',
    'weapon_staff'
  ];

  let w=weapons.map((v,i)=>
    `<div class="item ${player().weapon===i?'equipped':''}">
      <img class="item-art" src="assets/sprites/${weaponArt[i]}.png" alt="">
      <b>${v.name}</b>
      <p>${v.desc}<br>
      Damage: ${v.damage+getPlayerDamageBonus()+(player().void>=8?1:0)} · ${v.range} reach</p>
      ${state.inventory[i]
        ?`<button onclick="window.vwEquip(${i})">${player().weapon===i?'EQUIPPED':'EQUIP'}</button>`
        :'<small>NOT FOUND</small>'}
    </div>`
  ).join('');

  const armorNames=[
    'Abyssal Mantle',
    'Witchskin Cuirass',
    'Demonplate'
  ];

  let armor=state.armor.length
    ?state.armor.map(a=>{
      let i=armorNames.indexOf(a);

      return `<div class="item equipped">
        <img class="item-art armor-art" src="assets/sprites/armor_set_0${Math.max(1,i+1)}.png" alt="">
        <b>${a}</b>
        <p>Guardian armor · reduces incoming damage by 2</p>
        <small>RECOVERED</small>
      </div>`;
    }).join('')
    :'<p class="panel-note">No armor pieces recovered yet. Defeat the region guardians.</p>';

  panel('INVENTORY',
    `<div class="stats">
      VITALITY ${Math.ceil(player().hp)}/${player().maxHp} · DAMAGE BONUS +${getPlayerDamageBonus()}<br>
      ARMOR SETS: ${state.armor.length}/3 · VOID RESONANCE: ${player().void}/10
    </div>
    <h3 class="eyebrow">WEAPON RACK</h3>
    <div class="inventory-grid">${w}</div>
    <h3 class="eyebrow" style="margin-top:22px">ARMOR EQUIPMENT</h3>
    <div class="inventory-grid">${armor}</div>
    <p class="panel-note">
      Press 1–4 to switch weapons. Shift / Q / E performs a short dash.
      Armor pieces stack and reduce damage automatically.
      The Void Spiral awakens every weapon.
    </p>`
  );
}

window.vwEquip=switchWeapon;

// --------------------------------------------------
// REGION TRANSITIONS
// --------------------------------------------------

function moveRegion(dir){
  const p=player(),old=state.region;

  if(dir==='left'&&old==='center'){
    state.region='oasis';
    p.x=275;
  }
  else if(dir==='right'&&old==='center'){
    state.region='factory';
    p.x=-275;
  }
  else if(dir==='up'&&old==='center'){
    if(!state.defeated.eel||!state.defeated.wraith){
      toast('THE NORTH GATE IS SEALED — DEFEAT BOTH GUARDIANS');
      return;
    }
    state.region='sanctum';
    p.x=0;
    p.y=175;
  }
  else if(dir==='right'&&old==='oasis'){
    state.region='center';
    p.x=-275;
  }
  else if(dir==='left'&&old==='factory'){
    state.region='center';
    p.x=275;
  }
  else if(dir==='down'&&old==='sanctum'){
    state.region='center';
    p.y=-245;
  }
  else return;

  spawnRegion();
  updateHud();
  toast(state.region==='sanctum'?'THE VOID DEMON AWAKENS':regions[state.region].name);
}

// --------------------------------------------------
// PLAYER ATTACKS
// --------------------------------------------------

function attack(){
  const p=player(),w=weapons[p.weapon];

  if(p.attackCooldown>0||!running)return;

  sfxAttack(p.weapon);

  p.attack=.30;
  p.attackCooldown=w.speed;
  p.attackSerial=(p.attackSerial||0)+1;

  const damageBonus=getPlayerDamageBonus()+(p.void>=8?1:0);

  if(p.weapon===3){
    const speed=430;

    state.projectiles.push({
      x:p.x+Math.cos(p.dir)*22,
      y:p.y+Math.sin(p.dir)*22,
      vx:Math.cos(p.dir)*speed,
      vy:Math.sin(p.dir)*speed,
      life:.72,
      damage:w.damage+damageBonus
    });

    burst(
      p.x+Math.cos(p.dir)*25,
      p.y+Math.sin(p.dir)*25,
      '#c18aff',
      5
    );

    return;
  }

  let hit=false;

  state.enemies.forEach(e=>{
    if(e.dead)return;

    let dx=e.x-p.x;
    let dy=e.y-p.y;
    let dist=Math.hypot(dx,dy);
    let a=Math.atan2(dy,dx);
    let diff=Math.atan2(Math.sin(a-p.dir),Math.cos(a-p.dir));

    const reach=w.range+(p.weapon===2?26:p.weapon===1?34:34);
    const arc=w.arc+.34;

    if(dist<reach+(e.boss?28:16)&&Math.abs(diff)<arc){
      let dmg=w.damage+damageBonus+(p.void>=8?2:0);

      e.hp-=dmg;
      e.flash=.18;
      e.hitFlash=.18;
      hit=true;

      sfxHit();

      state.score+=Math.floor(dmg*0.4);

      burst(
        e.x,e.y,
        p.weapon===2?'#d8a5ff':'#bb7cff',
        p.weapon===2?15:10
      );

      if(e.hp<=0)killEnemy(e);
    }
  });

  state.crates.forEach(c=>{
    if(c.dead||c.lastHit===p.attackSerial)return;

    if(Math.hypot(c.x-p.x,c.y-p.y)<(p.weapon===2?94:84)){
      c.lastHit=p.attackSerial;
      c.hp--;
      burst(c.x,c.y,'#8d54b9',5);
      if(c.hp<=0)breakCrate(c);
    }
  });

  if(hit){
    p.void=Math.min(10,p.void+1);
    updateHud();
  }
}

function breakCrate(c){
  c.dead=true;
  sfxPickup();
  state.score+=25;
  burst(c.x,c.y,'#8d54b9',18);

  let r=Math.random();

  if(r<.38){
    let found=[0,1,2,3].filter(i=>!state.inventory[i]);

    if(found.length){
      let got=found[Math.floor(Math.random()*found.length)];
      state.inventory[got]=true;
      toast('CRATE LOOT: '+weapons[got].name.toUpperCase());
      updateHud();
    }else{
      potionDrop();
    }
  }
  else if(r<.72){
    potionDrop();
  }
  else{
    toast('THE CRATE WAS EMPTY');
  }
}

// --------------------------------------------------
// VITALITY AND HEALING
// --------------------------------------------------
function grantVitality(maxIncrease=6,heal=12,label='VITALITY SHARD'){
  const p=player(),oldMax=p.maxHp;
  p.maxHp=Math.min(MAX_PLAYER_HP,p.maxHp+maxIncrease);
  const gainedMax=p.maxHp-oldMax;
  const healed=Math.min(heal,Math.max(0,p.maxHp-p.hp));
  p.hp+=healed;

  if(gainedMax===0&&healed===0){
    state.score+=15;
    toast(label+' · FULL VITALITY · +15 SCORE');
  } else {
    toast(label+' · MAX HEALTH +'+gainedMax+' · HEALED +'+healed);
  }
  updateHud();
}

function potionDrop(){
  const p=player();
  const missing=p.maxHp-p.hp;

  if(missing<=0){
    state.score+=15;
    toast('HEALING POTION · FULL HEALTH · +15 SCORE');
    updateHud();
    return;
  }

  const healed=Math.min(12,missing);
  p.hp+=healed;
  toast('HEALING POTION · HEALED +'+healed);
  updateHud();
}

// --------------------------------------------------
// ENEMY DEATH AND REWARDS
// --------------------------------------------------

function killEnemy(e){
  e.dead=true;
  burst(e.x,e.y,'#9c5bda',20);
  state.score+=e.boss?400:80;

  if(e.boss){
    let armor=
      e.type==='eel'?'Abyssal Mantle':
      e.type==='wraith'?'Witchskin Cuirass':
      'Demonplate';

    if(e.type==='eel')state.defeated.eel=true;
    if(e.type==='wraith')state.defeated.wraith=true;
    if(e.type==='demon')state.defeated.demon=true;

    if(!state.armor.includes(armor)){
      state.armor.push(armor);
    }

    player().maxHp=Math.min(MAX_PLAYER_HP,player().maxHp+8);
    player().hp=Math.min(player().maxHp,player().hp+8);

    if(e.type==='demon'){
      sfxWin();

      const timeBonus=Math.max(
        0,
        3000-Math.floor((Date.now()-state.startTime)/100)
      );

      state.score+=timeBonus+state.difficulty*500;

      const best=parseInt(localStorage.getItem('vwBest')||0);

      if(state.score>best){
        localStorage.setItem('vwBest',state.score);
      }

      toast('THE VOID DEMON FALLS');

      panel(
        'THE FRACTURE QUIETS',
        `<p>The three guardians have fallen.</p>
        <p>Score: <b>${Math.floor(state.score)}</b> · Personal Best: <b>${Math.max(state.score,best)}</b></p>
        <p class="panel-note">Difficulty ${state.difficulty} cleared.</p>
        <button onclick="window.vwContinue()">CONTINUE INTO THE FRACTURE (DIFF ${state.difficulty+1})</button>
        <button onclick="window.vwRestart()">NEW RUN</button>`
      );

      running=false;

      state.enemies.forEach(other=>{
        if(other!==e)other.dead=true;
      });
    }
    else{
      toast(armor+' RECOVERED · NORTH GATE UNSEALED');
    }
  }
  else if(Math.random()<.42){
    let loot=['Vitality Shard','Void Dust','Old Coin'];
    let found=loot[Math.floor(Math.random()*loot.length)];

    if(found==='Vitality Shard'){
      grantVitality(6,12);
    }
    else if(found==='Void Dust'){
      player().void=Math.min(10,player().void+2);

      const before=state.damageBonus||0;
      state.damageBonus=Math.min(4,before+1);

      toast('VOID DUST · DAMAGE +'+(state.damageBonus-before));
    }
    else{
      toast('ENEMY DROP: '+found.toUpperCase());
    }

    updateHud();
  }

  updateHud();
}

// --------------------------------------------------
// NEW GAME+ PROGRESSION
// --------------------------------------------------

function continueEndless(){
  state.difficulty++;
  state.endless=true;

  state.defeated={
    eel:false,
    wraith:false,
    demon:false
  };

  state.region='center';

  state.player.x=0;
  state.player.y=0;

  // Carry health forward without granting a free full heal.
  state.player.hp=Math.min(
    state.player.maxHp,
    Math.max(60,Math.floor(state.player.maxHp*.70))
  );

  state.startTime=Date.now();

  closePanel();
  running=true;

  spawnRegion();
  updateHud();

  toast('DIFFICULTY '+state.difficulty+' · THE FRACTURE DEEPENS');
}

window.vwContinue=continueEndless;

// --------------------------------------------------
// DASH MECHANIC
// --------------------------------------------------

function dash(){
  const p=player();

  if(!running||overlayOpen||p.dashCooldown>0)return;

  let dx=
    (keys.ArrowRight||keys.d||touch.right?1:0)-
    (keys.ArrowLeft||keys.a||touch.left?1:0);

  let dy=
    (keys.ArrowDown||keys.s||touch.down?1:0)-
    (keys.ArrowUp||keys.w||touch.up?1:0);

  // If stationary, dash toward the facing direction.
  if(!dx&&!dy){
    dx=Math.cos(p.dir);
    dy=Math.sin(p.dir);
  }

  const len=Math.hypot(dx,dy)||1;

  p.dashX=dx/len;
  p.dashY=dy/len;

  p.dashTime=DASH_DURATION;
  p.dashGrace=DASH_PROTECTION;
  p.dashCooldown=DASH_COOLDOWN;

  p.invuln=Math.max(p.invuln,.46);

  p.moveDir=Math.atan2(p.dashY,p.dashX);

  burst(p.x,p.y,'#b56cff',10);
}

function burst(x,y,color,n){
  for(let i=0;i<n;i++){
    state.particles.push({
      x,y,
      vx:(Math.random()-.5)*180,
      vy:(Math.random()-.5)*180,
      life:.45+Math.random()*.35,
      color
    });
  }
}

// --------------------------------------------------
// PLAYER DAMAGE
// --------------------------------------------------

function damagePlayer(amount,knockbackX=0,knockbackY=0,source=null){
  const p=player();

  // Dash temporarily protects against all incoming damage.
  if(p.dashTime>0||p.dashGrace>0)return;

  // Each enemy has an independent hit cooldown.
  // This allows multiple enemies in a mob to hit separately.
  if(source){
    if(source.playerHitCooldown>0)return;

    source.playerHitCooldown=source.boss?0.85:1.0;
  }
  else if(p.invuln>0){
    return;
  }

  const difficultyDamage=
    1+Math.max(0,state.difficulty-1)*0.12;

  const finalDamage=Math.max(
    1,
    amount*difficultyDamage-state.armor.length*2
  );

  p.hp=Math.max(0,p.hp-finalDamage);

  // Short global visual/invulnerability window.
  // Does not block hits from other enemies.
  p.invuln=.22;

  p.x+=knockbackX;
  p.y+=knockbackY;

  burst(p.x,p.y,'#e45d9d',9);

  updateHud();

  if(p.hp<=0)gameOver();
}

// --------------------------------------------------
// MAIN GAME UPDATE
// --------------------------------------------------

function update(dt){
  if(!running||overlayOpen)return;

  const p=player();

  state.elapsed+=dt;

  p.attack=Math.max(0,p.attack-dt);
  p.attackCooldown=Math.max(0,p.attackCooldown-dt);
  p.invuln=Math.max(0,p.invuln-dt);

  p.dashTime=Math.max(0,p.dashTime-dt);
  p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  p.dashGrace=Math.max(0,p.dashGrace-dt);

  let dx=
    (keys.ArrowRight||keys.d||touch.right?1:0)-
    (keys.ArrowLeft||keys.a||touch.left?1:0);

  let dy=
    (keys.ArrowDown||keys.s||touch.down?1:0)-
    (keys.ArrowUp||keys.w||touch.up?1:0);

  // Dash movement.
  if(p.dashTime>0){
    p.x+=p.dashX*620*dt;
    p.y+=p.dashY*620*dt;
  }
  else if(dx||dy){
    let l=Math.hypot(dx,dy);

    dx/=l;
    dy/=l;

    p.x+=dx*165*dt;
    p.y+=dy*165*dt;

    p.moveDir=Math.atan2(dy,dx);
    p.facingUp=dy<-.35&&Math.abs(dy)>Math.abs(dx);
  }

  if(p.x<-330){
    p.x=-330;
    if(state.region==='center')moveRegion('left');
    else if(state.region==='factory')moveRegion('left');
  }

  if(p.x>330){
    p.x=330;
    if(state.region==='center')moveRegion('right');
    else if(state.region==='oasis')moveRegion('right');
  }

  if(p.y<-240){
    p.y=-240;
    if(state.region==='center')moveRegion('up');
  }

  if(p.y>240){
    p.y=240;
    if(state.region==='sanctum')moveRegion('down');
  }

  p.x=Math.max(-330,Math.min(330,p.x));
  p.y=Math.max(-240,Math.min(240,p.y));

  // Void Spiral pickup.
  if(
    state.orb&&
    !state.orbTaken&&
    Math.hypot(state.orb.x-p.x,state.orb.y-p.y)<30
  ){
    state.orbTaken=true;
    state.weaponsUpgraded=true;
    p.void=10;

    sfxPickup();
    state.score+=150;

    burst(state.orb.x,state.orb.y,'#d7a4ff',34);

    state.orb=null;

    toast('VOID SPIRAL CLAIMED · ALL WEAPONS AWAKENED');

    updateHud();
  }

  // Enemy AI and attacks.
  state.enemies.forEach(e=>{
    if(e.dead)return;

    e.flash=Math.max(0,e.flash-dt);
    e.hitFlash=Math.max(0,e.hitFlash-dt);
    e.attack=Math.max(0,e.attack-dt);

    e.playerHitCooldown=Math.max(
      0,
      (e.playerHitCooldown||0)-dt
    );

    const meleeImpact=e.wind>0&&e.wind<=dt;
    const specialImpact=e.specialWind>0&&e.specialWind<=dt;

    e.wind=Math.max(0,e.wind-dt);
    e.specialWind=Math.max(0,e.specialWind-dt);

    let vx=p.x-e.x;
    let vy=p.y-e.y;
    let d=Math.max(1,Math.hypot(vx,vy));
    let isBoss=e.boss;

    e.dir=Math.atan2(vy,vx);

    // Boss phase transitions.
    if(isBoss&&e.hp<e.maxHp*.62)e.phase=2;
    if(isBoss&&e.hp<e.maxHp*.28)e.phase=3;

    // Enemy movement scaling.
    const baseSpeed=isBoss
      ?(e.type==='demon'?34:42)+e.phase*7
      :(e.type==='eel'?62:52);

    const speed=baseSpeed*(
      1+Math.min(.30,Math.max(0,state.difficulty-1)*.035)
    );

    if(d>(isBoss?76:38)){
      e.x+=vx/d*speed*dt;
      e.y+=vy/d*speed*dt;
    }

    // Regular enemy melee attack.
    if(meleeImpact){
      if(Math.hypot(p.x-e.x,p.y-e.y)<(isBoss?78:58)){
        damagePlayer(
          isBoss?15+e.phase*2:8,
          e.dir?Math.cos(e.dir)*8:0,
          e.dir?Math.sin(e.dir)*8:0,
          e
        );
      }
    }

    if(d<(isBoss?78:48)&&e.attack<=0){
      e.attack=isBoss?1.15:1.45;
      e.wind=isBoss?.34:.25;
    }

    // Boss special attacks.
    if(isBoss){
      e.specialCooldown-=dt;

      if(specialImpact){
        let hit=false;

        if(e.type==='eel'){
          hit=d<175&&d>52;
        }
        else if(e.type==='wraith'){
          let a=Math.atan2(p.y-e.y,p.x-e.x);

          let diff=Math.atan2(
            Math.sin(a-e.specialDir),
            Math.cos(a-e.specialDir)
          );

          hit=d<235&&Math.abs(diff)<.34;
        }
        else{
          hit=d<190;
        }

        if(hit){
          damagePlayer(
            e.type==='demon'?26:
            e.type==='wraith'?21:18,
            Math.cos(e.dir)*12,
            Math.sin(e.dir)*12,
            e
          );
        }

        burst(
          e.x,e.y,
          e.type==='wraith'?'#e68bd5':'#c26aff',
          24
        );

        e.specialWind=0;
      }

      if(
        e.specialCooldown<=0&&
        d<(e.type==='wraith'?260:235)
      ){
        e.specialWind=e.type==='wraith'?.95:1.05;
        e.specialDir=e.dir;
        e.specialCooldown=e.phase===3?3.0:4.4;
        e.special=1;
      }
    }
  });

  // Staff projectiles.
  state.projectiles=state.projectiles.filter(b=>{
    b.x+=b.vx*dt;
    b.y+=b.vy*dt;
    b.life-=dt;

    let hit=false;

    for(const e of state.enemies){
      if(
        !e.dead&&
        Math.hypot(e.x-b.x,e.y-b.y)<(e.boss?38:24)
      ){
        e.hp-=b.damage;
        e.flash=.18;

        sfxHit();

        state.score+=Math.floor(b.damage*0.3);

        burst(e.x,e.y,'#c18aff',12);

        if(e.hp<=0)killEnemy(e);

        hit=true;
        break;
      }
    }

    if(hit){
      p.void=Math.min(10,p.void+1);
      updateHud();
    }

    if(hit||b.life<=0)return false;

    return true;
  });

  state.particles=state.particles.filter(q=>{
    q.x+=q.vx*dt;
    q.y+=q.vy*dt;
    q.life-=dt;
    return q.life>0;
  });

  updateBossHud();
}

// --------------------------------------------------
// RESTART AND GAME OVER
// --------------------------------------------------

function restartRun(){
  state=fresh();
  spawnRegion();
  closePanel();

  $('start-screen').classList.add('hidden');

  running=true;

  updateHud();
  toast('A NEW FRACTURE OPENS');
}

window.vwRestart=restartRun;

function gameOver(){
  running=false;

  const best=parseInt(localStorage.getItem('vwBest')||0);

  if(state.score>best){
    localStorage.setItem('vwBest',Math.floor(state.score));
  }

  panel(
    'THE VOID CLAIMS YOU',
    `<p>The fracture consumes the last of your light.</p>
    <p>Score: <b>${Math.floor(state.score)}</b><br>
    Personal Best: <b>${Math.max(Math.floor(state.score),best)}</b></p>
    <p class="panel-note">This journey has ended.</p>
    <button onclick="window.vwRestart()">RESTART RUN</button>`
  );
}

// --------------------------------------------------
// RENDERING
// --------------------------------------------------

function draw(){
  ctx.clearRect(0,0,W,H);

  let p=player();
  let camX=p.x,camY=p.y;
  let scale=Math.min(W/850,H/570,1.25);
  let cx=W/2,cy=H/2;

  ctx.save();
  ctx.translate(cx,cy);
  ctx.scale(scale,scale);
  ctx.translate(-camX,-camY);

  const reg=regions[state.region];

  ctx.fillStyle=reg.bg;
  ctx.fillRect(camX-900,camY-700,1800,1400);

  const bg=spriteImages['region_bg_'+state.region];

  if(bg&&bg.complete&&bg.naturalWidth){
    const bw=1200,bh=1112;
    ctx.save();
    ctx.globalAlpha=.94;
    ctx.drawImage(bg,-bw/2,-bh/2,bw,bh);
    ctx.restore();
  }

  ctx.save();
  ctx.lineWidth=5;
  ctx.strokeStyle='rgba(176,126,210,.38)';
  ctx.shadowBlur=12;
  ctx.shadowColor='rgba(145,74,190,.25)';

  const bx=350,by=255,gap=92;

  if(state.region==='center'||state.region==='factory'){
    ctx.beginPath();
    ctx.moveTo(-bx,-by);
    ctx.lineTo(-bx,-gap);
    ctx.moveTo(-bx,gap);
    ctx.lineTo(-bx,by);
    ctx.stroke();
  }else{
    ctx.beginPath();
    ctx.moveTo(-bx,-by);
    ctx.lineTo(-bx,by);
    ctx.stroke();
  }

  if(state.region==='center'||state.region==='oasis'){
    ctx.beginPath();
    ctx.moveTo(bx,-by);
    ctx.lineTo(bx,-gap);
    ctx.moveTo(bx,gap);
    ctx.lineTo(bx,by);
    ctx.stroke();
  }else{
    ctx.beginPath();
    ctx.moveTo(bx,-by);
    ctx.lineTo(bx,by);
    ctx.stroke();
  }

  if(state.region!=='sanctum'){
    ctx.beginPath();
    ctx.moveTo(-bx,-by);
    ctx.lineTo(-gap,-by);
    ctx.moveTo(gap,-by);
    ctx.lineTo(bx,-by);
    ctx.stroke();
  }

  if(state.region==='sanctum'){
    ctx.beginPath();
    ctx.moveTo(-bx,by);
    ctx.lineTo(-gap,by);
    ctx.moveTo(gap,by);
    ctx.lineTo(bx,by);
    ctx.stroke();
  }else{
    ctx.beginPath();
    ctx.moveTo(-bx,by);
    ctx.lineTo(bx,by);
    ctx.stroke();
  }

  const gate=(x,y,vertical,active,label)=>{
    ctx.save();
    ctx.translate(x,y);

    if(vertical)ctx.rotate(Math.PI/2);

    ctx.strokeStyle=active
      ?'rgba(205,151,255,.9)'
      :'rgba(112,83,130,.55)';

    ctx.fillStyle=active
      ?'rgba(119,56,159,.18)'
      :'rgba(35,24,45,.65)';

    ctx.lineWidth=3;
    ctx.shadowBlur=active?18:5;

    ctx.beginPath();
    ctx.moveTo(-34,28);
    ctx.lineTo(-34,-10);
    ctx.quadraticCurveTo(-34,-42,0,-42);
    ctx.quadraticCurveTo(34,-42,34,-10);
    ctx.lineTo(34,28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-20,24);
    ctx.lineTo(-20,-8);
    ctx.quadraticCurveTo(-20,-28,0,-28);
    ctx.quadraticCurveTo(20,-28,20,-8);
    ctx.lineTo(20,24);
    ctx.stroke();

    if(!active){
      ctx.strokeStyle='rgba(220,180,240,.75)';
      ctx.lineWidth=3;

      ctx.beginPath();
      ctx.moveTo(-9,-7);
      ctx.lineTo(9,11);
      ctx.moveTo(9,-7);
      ctx.lineTo(-9,11);
      ctx.stroke();
    }

    ctx.restore();
  };

  if(state.region==='center'){
    gate(-bx,0,true,true,'OASIS');
    gate(bx,0,true,true,'FACTORY');
    gate(0,-by,false,state.defeated.eel&&state.defeated.wraith,'SANCTUM');
  }

  if(state.region==='oasis')gate(bx,0,true,true,'CENTER');
  if(state.region==='factory')gate(-bx,0,true,true,'CENTER');
  if(state.region==='sanctum')gate(0,by,false,true,'CENTER');

  ctx.restore();

  if(state.region==='oasis'){
    ctx.save();
    ctx.globalAlpha=.2;

    for(let i=0;i<12;i++){
      let x=Math.sin(state.elapsed*.35+i*2.1)*210;
      let y=Math.cos(state.elapsed*.28+i*1.7)*100;

      ctx.strokeStyle='#a86cff';
      ctx.lineWidth=2;

      ctx.beginPath();
      ctx.ellipse(
        x,y,
        30+i%4*13,
        7+i%3*4,
        Math.sin(state.elapsed+i)*.2,
        0,
        Math.PI*2
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  if(state.region==='sanctum'){
    ctx.save();
    ctx.strokeStyle='rgba(171,91,218,.36)';
    ctx.lineWidth=4;

    ctx.beginPath();
    ctx.arc(0,-80,145,0,Math.PI*2);
    ctx.stroke();

    drawSprite('portal_arch',0,-80,170,155);
    ctx.restore();
  }

  if(state.region==='oasis'){
    [[-285,-150],[275,-135],[-300,175],[305,165]].forEach(([x,y])=>
      drawSprite('void_crystal',x,y,30,58,.72)
    );
  }

  if(state.region==='center'){
    [[-260,-170],[260,-165],[-285,185],[290,180]].forEach(([x,y])=>
      drawSprite('void_crystal',x,y,32,62,.8)
    );
  }

  if(state.region==='sanctum'){
    [[-240,-25],[240,-25],[-210,190],[210,190]].forEach(([x,y])=>
      drawSprite('void_crystal',x,y,22,52,.75)
    );
  }

  // Crates.
  state.crates.forEach(c=>{
    if(c.dead){
      drawSprite('void_crate_broken',c.x,c.y,52,30,.8);
      return;
    }

    ctx.save();
    ctx.translate(c.x,c.y);
    ctx.shadowBlur=c.glow?18:0;
    ctx.shadowColor='#a45dff';

    if(!drawSprite('void_crate',0,0,56,58)){
      ctx.fillStyle='#0a080f';
      ctx.fillRect(-13,-12,26,22);
      ctx.strokeStyle=c.glow?'#b77aff':'#594365';
      ctx.strokeRect(-13,-12,26,22);
    }

    if(c.glow){
      ctx.strokeStyle='rgba(208,166,255,'+(.45+Math.sin(state.elapsed*4)*.3)+')';
      ctx.lineWidth=2;
      ctx.strokeRect(-21,-23,42,46);
    }

    ctx.restore();
  });

  // Void Spiral.
  if(state.orb&&!state.orbTaken){
    ctx.save();
    ctx.translate(state.orb.x,state.orb.y);
    ctx.shadowBlur=28;
    ctx.shadowColor='#c27aff';
    ctx.globalAlpha=.78+Math.sin(state.elapsed*4)*.18;

    drawSprite('void_spiral_orb',0,0,42,48);

    ctx.strokeStyle='rgba(214,168,255,.8)';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(0,0,27+Math.sin(state.elapsed*3)*4,0,Math.PI*2);
    ctx.stroke();

    ctx.restore();
  }

  // Enemies and bosses.
  state.enemies.forEach(e=>{
    if(e.dead)return;

    ctx.save();

    const bob=Math.sin(
      state.elapsed*(e.boss?2.2:3.4)+e.x*.03
    )*(e.boss?3:2);

    ctx.translate(e.x,e.y+bob);

    ctx.shadowBlur=e.boss
      ?(e.type==='demon'&&e.phase>=2?38:24)
      :12;

    ctx.shadowColor=e.flash
      ?'#fff'
      :(e.type==='demon'&&e.phase>=2?'#d35cff':'#9b39d0');

    const spriteKey=
      e.type==='eel'?'amphibian_warden':
      e.type==='wraith'?'nail_witch':
      e.type==='demon'
        ?(e.phase>=2?'void_demon_phase2':'void_demon_phase1')
        :state.region==='oasis'
          ?(e.type==='minion'?(e.variant?'black_eel':'amphibian_minion'):'black_eel')
          :state.region==='factory'
            ?(e.variant?'darkling_02':'darkling_01')
            :state.region==='sanctum'
              ?'void_demon_phase1'
              :'darkling_01';

    const dims=
      e.type==='demon'?[280,224]:
      e.type==='wraith'?[142,158]:
      e.type==='eel'?[150,145]:
      state.region==='factory'?[82,112]:
      state.region==='oasis'?[82,92]:
      [72,78];

    if(!drawSprite(spriteKey,0,e.boss?-5:0,dims[0],dims[1])){
      ctx.fillStyle='#160d20';
      ctx.beginPath();
      ctx.arc(0,0,e.boss?28:13,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='#9b45d1';
      ctx.stroke();
    }

    if(e.flash){
      ctx.fillStyle='rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.arc(0,0,22,0,Math.PI*2);
      ctx.fill();
    }

    if(e.wind>0){
      ctx.strokeStyle='rgba(255,104,157,'+
        (.35+.45*(e.wind/(e.boss?.34:.25)))+')';

      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.ellipse(0,Math.max(12,e.boss?43:24),e.boss?44:22,7,0,0,Math.PI*2);
      ctx.stroke();
    }

    if(e.specialWind>0){
      ctx.strokeStyle=e.type==='wraith'
        ?'rgba(255,120,205,.9)'
        :'rgba(212,111,255,.8)';

      ctx.lineWidth=4;

      if(e.type==='wraith'){
        ctx.rotate(e.specialDir||e.dir);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(250,0);
        ctx.stroke();
      }
      else{
        ctx.beginPath();
        ctx.arc(0,0,190*(1-e.specialWind/1.05),0,Math.PI*2);
        ctx.stroke();
      }
    }

    if(e.boss){
      const bw=e.type==='demon'?112:76;

      ctx.fillStyle='#09050e';
      ctx.fillRect(-bw/2,-(e.type==='demon'?112:70),bw,7);

      ctx.fillStyle='#ce4eaa';

      ctx.fillRect(
        -bw/2,
        -(e.type==='demon'?112:70),
        bw*Math.max(0,e.hp/e.maxHp),
        7
      );
    }

    ctx.restore();
  });

  // Player.
  ctx.save();
  ctx.translate(p.x,p.y);

  ctx.fillStyle='rgba(0,0,0,.62)';
  ctx.beginPath();
  ctx.ellipse(0,16,19,8,0,0,Math.PI*2);
  ctx.fill();

  const moving=!!(
    keys.w||keys.a||keys.s||keys.d||
    keys.ArrowUp||keys.ArrowDown||
    keys.ArrowLeft||keys.ArrowRight||
    touch.up||touch.down||touch.left||touch.right
  );

  const heroFrame=
    p.attack>0
      ?['hero_attack_01','hero_attack_02','hero_attack_03','hero_attack_04'][
        Math.min(3,Math.floor((0.30-p.attack)/0.30*4))
      ]
      :p.invuln>0
        ?['hero_hurt_01','hero_hurt_02'][Math.floor(state.elapsed*14)%2]
        :p.facingUp
          ?'hero_idle_06'
          :moving
            ?['hero_walk_01','hero_walk_02','hero_walk_03','hero_walk_04'][Math.floor(state.elapsed*7)%4]
            :['hero_idle_01','hero_idle_02','hero_idle_03'][Math.floor(state.elapsed*2)%3];

  const heroImg=spriteImages[heroFrame]||spriteImages.hero_idle_01;

  if(heroImg&&heroImg.complete&&heroImg.naturalWidth){
    ctx.save();

    if(Math.cos(p.dir)<0)ctx.scale(-1,1);

    const attacking=p.attack>0;
    const dw=attacking?74:68;
    const dh=attacking?110:108;

    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(heroImg,-dw/2,-dh/2-3,dw,dh);

    ctx.restore();
  }
  else{
    ctx.fillStyle='#0a080f';
    ctx.beginPath();
    ctx.ellipse(0,3,12,17,0,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle='#25142f';
    ctx.beginPath();
    ctx.moveTo(-10,-3);
    ctx.lineTo(0,-19);
    ctx.lineTo(13,-2);
    ctx.lineTo(10,15);
    ctx.lineTo(-10,15);
    ctx.fill();

    ctx.strokeStyle='#80549e';
    ctx.lineWidth=1.5;
    ctx.stroke();

    ctx.fillStyle='#07060b';
    ctx.beginPath();
    ctx.ellipse(0,-15,12,15,0,0,Math.PI*2);
    ctx.fill();

    ctx.fillRect(-12,-17,-3,28);
    ctx.fillRect(9,-18,4,28);

    ctx.fillStyle='#d5b9d6';
    ctx.beginPath();
    ctx.ellipse(0,-17,6,7,0,0,Math.PI*2);
    ctx.fill();
  }

  // Equipped weapon.
  ctx.save();
  ctx.translate(0,-9);
  ctx.rotate(p.dir);

  const weaponSprite=[
    'weapon_sword',
    'weapon_knife',
    'weapon_mace',
    'weapon_staff'
  ][p.weapon];

  if(!drawSprite(
    weaponSprite,
    25,
    0,
    p.weapon===1?15:p.weapon===2?20:17,
    p.weapon===3?34:29
  )){
    ctx.strokeStyle=state.weaponsUpgraded?'#b983ff':'#b7a2c8';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(8,0);
    ctx.lineTo(27,0);
    ctx.stroke();
  }

  if(p.attack>0&&p.weapon!==3){
    ctx.strokeStyle=p.weapon===2?'#e1bdff':'#d9a4ff';
    ctx.shadowBlur=p.weapon===2?22:15;
    ctx.shadowColor='#b66aff';
    ctx.lineWidth=p.weapon===2?6:4;

    ctx.beginPath();
    ctx.arc(
      p.weapon===2?18:24,
      0,
      p.weapon===2?45:35,
      p.weapon===2?-.72:-.9,
      p.weapon===2?.72:.9
    );
    ctx.stroke();
  }

  ctx.restore();

  // Dash protection and cooldown indicator.
  if(p.invuln>0||p.dashTime>0||p.dashGrace>0){
    ctx.strokeStyle=
      p.dashTime>0||p.dashGrace>0
        ?'rgba(181,108,255,.95)'
        :'rgba(207,154,255,.7)';

    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(0,0,p.dashTime>0?31:24,0,Math.PI*2);
    ctx.stroke();
  }

  if(p.dashCooldown>0){
    ctx.strokeStyle='rgba(181,108,255,.4)';
    ctx.lineWidth=2;

    ctx.beginPath();
    ctx.arc(
      0,0,34,
      -Math.PI/2,
      -Math.PI/2+Math.PI*2*(1-p.dashCooldown/DASH_COOLDOWN)
    );

    ctx.stroke();
  }

  ctx.restore();

  // Projectiles.
  state.projectiles.forEach(b=>{
    ctx.save();
    ctx.shadowBlur=18;
    ctx.shadowColor='#c58aff';
    ctx.fillStyle='#e2c5ff';

    ctx.beginPath();
    ctx.arc(b.x,b.y,6,0,Math.PI*2);
    ctx.fill();

    ctx.strokeStyle='rgba(180,110,255,.7)';
    ctx.lineWidth=3;

    ctx.beginPath();
    ctx.moveTo(b.x-b.vx*.035,b.y-b.vy*.035);
    ctx.lineTo(b.x,b.y);
    ctx.stroke();

    ctx.restore();
  });

  // Particles.
  state.particles.forEach(q=>{
    ctx.globalAlpha=Math.max(0,q.life);
    ctx.fillStyle=q.color;
    ctx.fillRect(q.x,q.y,3,3);
    ctx.globalAlpha=1;
  });

  ctx.restore();

  // Vignette.
  let grad=ctx.createRadialGradient(
    W/2,H/2,
    Math.min(W,H)*.2,
    W/2,H/2,
    Math.max(W,H)*.7
  );

  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(1,'rgba(0,0,0,.58)');

  ctx.fillStyle=grad;
  ctx.fillRect(0,0,W,H);
}

// --------------------------------------------------
// GAME LOOP
// --------------------------------------------------

function loop(t){
  let dt=Math.min((t-last)/1000,.04);
  last=t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// --------------------------------------------------
// KEYBOARD CONTROLS
// --------------------------------------------------

document.addEventListener('keydown',e=>{
  keys[e.key]=true;

  if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();
  }

  if(e.repeat)return;

  if(e.key===' '||e.key.toLowerCase()==='j')attack();

  if(
    e.key==='Shift'||
    ['q','e'].includes(e.key.toLowerCase())
  ){
    dash();
  }

  if(e.key.toLowerCase()==='i'){
    overlayOpen?closePanel():inventoryPanel();
  }

  if(e.key==='Escape')closePanel();

  if(e.key.toLowerCase()==='r'&&!overlayOpen&&running){
    if(confirm('Restart this run from the beginning?')){
      restartRun();
    }
  }

  if('1234'.includes(e.key)){
    switchWeapon(+e.key-1);
  }
});

document.addEventListener('keyup',e=>{
  keys[e.key]=false;
});

function clearInputs(){
  Object.keys(keys).forEach(k=>keys[k]=false);
  Object.keys(touch).forEach(k=>touch[k]=false);
}

window.addEventListener('blur',clearInputs);

document.addEventListener('visibilitychange',()=>{
  if(document.hidden)clearInputs();
});

// --------------------------------------------------
// MOUSE AND TOUCH CONTROLS
// --------------------------------------------------

function aimFromPointer(e){
  const rect=canvas.getBoundingClientRect();
  const scale=Math.min(W/850,H/570,1.25);

  const dx=(e.clientX-rect.left-W/2)/scale;
  const dy=(e.clientY-rect.top-H/2)/scale;

  player().dir=Math.atan2(dy,dx);
}

canvas.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse')return;
  aimFromPointer(e);
});

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||overlayOpen||!running)return;

  e.preventDefault();
  aimFromPointer(e);
  attack();
});

document.querySelectorAll('[data-slot]').forEach(b=>{
  b.addEventListener('click',()=>switchWeapon(+b.dataset.slot));
});

$('close-panel').onclick=closePanel;

$('start-btn').onclick=()=>{
  $('start-screen').classList.add('hidden');
  running=true;
  toast('THE FRACTURE STIRS');
};

$('restart-run-btn').onclick=()=>{
  if(confirm('Restart this run from the beginning?')){
    restartRun();
  }
};

$('overlay').addEventListener('click',e=>{
  if(e.target===$('overlay'))closePanel();
});

document.querySelectorAll('[data-move]').forEach(b=>{
  let k=b.dataset.move;

  b.addEventListener('pointerdown',e=>{
    e.preventDefault();
    touch[k]=true;
  });

  ['pointerup','pointerleave','pointercancel'].forEach(ev=>{
    b.addEventListener(ev,()=>touch[k]=false);
  });
});

$('mobile-attack').addEventListener('pointerdown',e=>{
  e.preventDefault();
  attack();
});

$('mobile-inventory').onclick=inventoryPanel;

$('hint').textContent=
  'WASD / ARROWS MOVE · MOUSE AIM + CLICK ATTACK · SPACE / J ATTACK · SHIFT / Q / E DASH · I INVENTORY · 1–4 SWITCH WEAPON';

updateHud();

})();

(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const spriteImages = {};
const spriteNames = ['hero_fullbody','hero_idle_01','hero_idle_02','hero_idle_03','hero_walk_01','hero_walk_02','hero_walk_03','hero_walk_04','hero_attack_01','hero_attack_02','hero_attack_03','hero_attack_04','hero_hurt_01','hero_hurt_02','amphibian_warden','amphibian_minion','nail_witch','void_demon_phase1','void_demon_phase2','black_eel','voidling','darkling_01','darkling_02','void_spiral_orb','void_crate','void_crate_broken','healing_potion','void_potion','void_crystal','portal_arch','dead_tree','stone_pillar','ground_tile_01','ground_tile_02','ground_tile_03','ground_tile_04','weapon_sword','weapon_knife','weapon_mace','weapon_staff','armor_set_01','armor_set_02','armor_set_03','armor_set_04'];
spriteNames.forEach(name=>{const img=new Image();img.src='assets/sprites/'+name+'.png';spriteImages[name]=img;});

const $=id=>document.getElementById(id);
let W=0,H=0, last=0, running=false, toastTimer=0, overlayOpen=false;
function resize(){const d=Math.min(devicePixelRatio||1,2);W=canvas.clientWidth;H=canvas.clientHeight;canvas.width=Math.floor(W*d);canvas.height=Math.floor(H*d);ctx.setTransform(d,0,0,d,0,0)}
new ResizeObserver(resize).observe(canvas);resize();
const keys={}, touch={up:false,down:false,left:false,right:false};
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
function fresh(){const orbRegions=['center','oasis','factory'];return {player:{x:0,y:0,hp:100,maxHp:100,dir:0,attack:0,attackCooldown:0,invuln:0,weapon:0,void:0},region:'center',inventory:[true,false,false,false],armor:[],weaponsUpgraded:false,orbTaken:false,orbSpawn:{region:orbRegions[Math.floor(Math.random()*orbRegions.length)],x:(Math.random()-.5)*420,y:(Math.random()-.5)*260},defeated:{eel:false,wraith:false,demon:false},crateLoot:0,elapsed:0,secretFound:false,enemies:[],crates:[],projectiles:[],particles:[],message:'',boss:null}}
state=fresh();
const worldSeeds={center:12,oasis:24,factory:38,sanctum:52};
function rand(seed){let x=Math.sin(seed*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function spawnRegion(){
 const r=state.region,seed=worldSeeds[r];state.enemies=[];state.crates=[];state.projectiles=[];state.boss=null;
 const add=(x,y,type,boss=false)=>state.enemies.push({x,y,type,boss,variant:Math.floor(rand(seed+x*0.13+y*0.07)*2),hp:boss?(type==='demon'?560:type==='wraith'?300:270):type==='minion'?48:65,maxHp:boss?(type==='demon'?560:type==='wraith'?300:270):type==='minion'?48:65,attack:0,flash:0,phase:1,wind:0,special:0,specialCooldown:2.4,specialWind:0,specialDir:0,dead:false,dir:0,hitFlash:0});
 for(let i=0;i<7;i++){let x=(rand(seed+i*3)-.5)*620,y=(rand(seed+i*5)-.5)*420;if(Math.abs(x)<85&&Math.abs(y)<70){x+=150}add(x,y,'minion')}
 if(r==='oasis'){if(!state.defeated.eel)add(0,-65,'eel',true);for(let i=0;i<3;i++)add(-170+i*150,130,'minion')}
 if(r==='factory'){if(!state.defeated.wraith)add(0,-80,'wraith',true);for(let i=0;i<2;i++)add(-150+i*300,130,'minion')}
 if(r==='sanctum'&&!state.defeated.demon)add(0,-95,'demon',true);
 if(r==='center'&&!state.secretFound){/* the hidden spiral is a collectible, not an enemy */}
 if(state.orbSpawn&&state.orbSpawn.region===r&&!state.orbTaken)state.orb={x:state.orbSpawn.x,y:state.orbSpawn.y,region:r};else state.orb=null;
 for(let i=0;i<8;i++){let x=(rand(seed+90+i*2)-.5)*650,y=(rand(seed+120+i*3)-.5)*430;state.crates.push({x,y,hp:2,dead:false,glow:rand(i+seed)>.78,lastHit:0})}
}
spawnRegion();
const player=()=>state.player;
function drawSprite(name,x,y,w,h,alpha=1){const img=spriteImages[name];if(!img||!img.complete||!img.naturalWidth)return false;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,x-w/2,y-h/2,w,h);ctx.restore();return true}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2100)}
function switchWeapon(n){if(state.inventory[n]){player().weapon=n;updateHud();toast(weapons[n].name.toUpperCase())}}
function updateBossHud(){
 const boss=state.enemies.find(e=>e.boss&&!e.dead);$('boss-panel').classList.toggle('hidden',!boss);
 if(boss){$('boss-name').textContent=boss.type==='eel'?'THE AMPHIBIAN WARDEN':boss.type==='wraith'?'THE NAIL-WITCH':'THE VOID DEMON';$('boss-fill').style.width=(Math.max(0,boss.hp)/boss.maxHp*100)+'%';$('boss-phase').textContent='PHASE '+(boss.phase===1?'I':boss.phase===2?'II':'III')}
}
function updateHud(){
 const p=player();$('hp-text').textContent=Math.ceil(p.hp)+' / '+p.maxHp;$('hp-fill').style.width=(p.hp/p.maxHp*100)+'%';$('xp-text').textContent=p.void;$('xp-fill').style.width=Math.min(100,p.void*10)+'%';
 $('weapon-name').textContent=weapons[p.weapon].name;$('weapon-level').textContent='DAMAGE '+(weapons[p.weapon].damage+(state.weaponsUpgraded?14:0));
 $('armor-count').textContent='ARMOR '+state.armor.length+'/3';document.querySelectorAll('.slot').forEach((b,i)=>{b.classList.toggle('active',i===p.weapon);b.style.opacity=state.inventory[i]?1:.28});
 $('region-title').textContent=regions[state.region].name;$('region-subtitle').textContent=regions[state.region].sub;
 updateBossHud();
}
function panel(title,html){overlayOpen=true;$('panel-title').textContent=title;$('panel-content').innerHTML=html;$('overlay').classList.remove('hidden')}
function closePanel(){overlayOpen=false;$('overlay').classList.add('hidden')}
function inventoryPanel(){
 const weaponArt=['weapon_sword','weapon_knife','weapon_mace','weapon_staff'];
 let w=weapons.map((v,i)=>`<div class="item ${player().weapon===i?'equipped':''}"><img class="item-art" src="assets/sprites/${weaponArt[i]}.png" alt=""><b>${v.name}</b><p>${v.desc}<br>Damage: ${v.damage+(state.weaponsUpgraded?14:0)} · ${v.range} reach</p>${state.inventory[i]?`<button onclick="window.vwEquip(${i})">${player().weapon===i?'EQUIPPED':'EQUIP'}</button>`:'<small>NOT FOUND</small>'}</div>`).join('');
 const armorNames=['Abyssal Mantle','Witchskin Cuirass','Demonplate'];
 let armor=state.armor.length?state.armor.map(a=>{let i=armorNames.indexOf(a);return `<div class="item equipped"><img class="item-art armor-art" src="assets/sprites/armor_set_0${Math.max(1,i+1)}.png" alt=""><b>${a}</b><p>Guardian armor · reduces incoming damage by 2</p><small>RECOVERED</small></div>`}).join(''):'<p class="panel-note">No armor pieces recovered yet. Defeat the region guardians.</p>';
 panel('INVENTORY',`<div class="stats">VITALITY ${Math.ceil(player().hp)}/${player().maxHp} · DAMAGE BONUS ${state.weaponsUpgraded?'+14':''}<br>ARMOR SETS: ${state.armor.length}/3 · VOID RESONANCE: ${player().void}/10</div><h3 class="eyebrow">WEAPON RACK</h3><div class="inventory-grid">${w}</div><h3 class="eyebrow" style="margin-top:22px">ARMOR EQUIPMENT</h3><div class="inventory-grid">${armor}</div><p class="panel-note">Press 1–4 to switch weapons. Armor pieces stack and reduce damage automatically. The Void Spiral awakens every weapon.</p>`);
}
window.vwEquip=switchWeapon;
function moveRegion(dir){
 const p=player(),old=state.region;
 if(dir==='left'&&old==='center'){state.region='oasis';p.x=275}
 else if(dir==='right'&&old==='center'){state.region='factory';p.x=-275}
 else if(dir==='up'&&old==='center'){if(!state.defeated.eel||!state.defeated.wraith){toast('THE NORTH GATE IS SEALED — DEFEAT BOTH GUARDIANS');return}state.region='sanctum';p.y=245}
 else if(dir==='right'&&old==='oasis'){state.region='center';p.x=-275}
 else if(dir==='left'&&old==='factory'){state.region='center';p.x=275}
 else if(dir==='down'&&old==='sanctum'){state.region='center';p.y=-245}
 else return;
 spawnRegion();updateHud();toast(regions[state.region].name);
}
function attack(){
 const p=player(),w=weapons[p.weapon];if(p.attackCooldown>0||!running)return;p.attack=.30;p.attackCooldown=w.speed;p.attackSerial=(p.attackSerial||0)+1;
 if(p.weapon===3){const speed=430;state.projectiles.push({x:p.x+Math.cos(p.dir)*22,y:p.y+Math.sin(p.dir)*22,vx:Math.cos(p.dir)*speed,vy:Math.sin(p.dir)*speed,life:.72,damage:w.damage+(state.weaponsUpgraded?14:0)});burst(p.x+Math.cos(p.dir)*25,p.y+Math.sin(p.dir)*25,'#c18aff',5);return;}
 let hit=false;
 state.enemies.forEach(e=>{if(e.dead)return;let dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy),a=Math.atan2(dy,dx),diff=Math.atan2(Math.sin(a-p.dir),Math.cos(a-p.dir));const reach=w.range+(p.weapon===2?12:24),arc=w.arc+(p.weapon===2?.28:0);if(dist<reach&&Math.abs(diff)<arc){let dmg=w.damage+(state.weaponsUpgraded?14:0)+(p.void>=8?2:0);e.hp-=dmg;e.flash=.18;e.hitFlash=.18;hit=true;burst(e.x,e.y,p.weapon===2?'#d8a5ff':'#bb7cff',p.weapon===2?15:10);if(e.hp<=0)killEnemy(e)}});
 state.crates.forEach(c=>{if(c.dead||c.lastHit===p.attackSerial)return;if(Math.hypot(c.x-p.x,c.y-p.y)<(p.weapon===2?46:34)){c.lastHit=p.attackSerial;c.hp--;burst(c.x,c.y,'#8d54b9',5);if(c.hp<=0)breakCrate(c)}});
 if(hit){p.void=Math.min(10,p.void+1);updateHud()}
}
function breakCrate(c){c.dead=true;burst(c.x,c.y,'#8d54b9',18);let r=Math.random();if(r<.38){let found=[0,1,2,3].filter(i=>!state.inventory[i]);if(found.length){let got=found[Math.floor(Math.random()*found.length)];state.inventory[got]=true;toast('CRATE LOOT: '+weapons[got].name.toUpperCase());updateHud()}else{potionDrop(c.x,c.y)}}else if(r<.72){potionDrop(c.x,c.y)}else{toast('THE CRATE WAS EMPTY')}}
function potionDrop(){let p=player();p.hp=Math.min(p.maxHp,p.hp+20);toast('VITALITY SHARD · +20 VITALITY');updateHud()}
function killEnemy(e){
 e.dead=true;burst(e.x,e.y,'#9c5bda',20);
 if(e.boss){
  let armor=e.type==='eel'?'Abyssal Mantle':e.type==='wraith'?'Witchskin Cuirass':'Demonplate';
  if(e.type==='eel')state.defeated.eel=true;if(e.type==='wraith')state.defeated.wraith=true;if(e.type==='demon')state.defeated.demon=true;
  if(!state.armor.includes(armor))state.armor.push(armor);player().maxHp+=12;player().hp=Math.min(player().maxHp,player().hp+30);
  if(e.type==='demon'){toast('THE VOID DEMON FALLS — THE FRACTURE QUIETS');running=false;state.enemies.forEach(other=>{if(other!==e)other.dead=true});panel('THE FRACTURE QUIETS',`<p>The three guardians have fallen. The void releases its hold.</p><p class="panel-note">You have completed Void Walker.</p><button onclick="window.vwRestart()">PLAY AGAIN</button>`)}
  else toast(armor+' RECOVERED · NORTH GATE UNSEALED');
 }
 else if(Math.random()<.42){let loot=['Vitality Shard','Void Dust','Old Coin'][Math.floor(Math.random()*3)];if(loot==='Vitality Shard')player().hp=Math.min(player().maxHp,player().hp+12);else if(loot==='Void Dust')player().void=Math.min(10,player().void+2);toast('ENEMY DROP: '+loot.toUpperCase())}
 updateHud();
}
function burst(x,y,color,n){for(let i=0;i<n;i++)state.particles.push({x,y,vx:(Math.random()-.5)*180,vy:(Math.random()-.5)*180,life:.45+Math.random()*.35,color})}
function damagePlayer(amount,knockbackX=0,knockbackY=0){const p=player();if(p.invuln>0)return;p.hp=Math.max(0,p.hp-Math.max(1,amount-state.armor.length*2));p.invuln=.72;p.x+=knockbackX;p.y+=knockbackY;burst(p.x,p.y,'#e45d9d',9);updateHud();if(p.hp<=0)gameOver()}
function update(dt){
 if(!running||overlayOpen)return;const p=player();state.elapsed+=dt;
 p.attack=Math.max(0,p.attack-dt);p.attackCooldown=Math.max(0,p.attackCooldown-dt);p.invuln=Math.max(0,p.invuln-dt);
 let dx=(keys.ArrowRight||keys.d||touch.right?1:0)-(keys.ArrowLeft||keys.a||touch.left?1:0),dy=(keys.ArrowDown||keys.s||touch.down?1:0)-(keys.ArrowUp||keys.w||touch.up?1:0);
 if(dx||dy){let l=Math.hypot(dx,dy);dx/=l;dy/=l;p.x+=dx*165*dt;p.y+=dy*165*dt;p.dir=Math.atan2(dy,dx)}
 if(p.x<-330){p.x=-330;if(state.region==='center')moveRegion('left');else if(state.region==='factory')moveRegion('left')}
 if(p.x>330){p.x=330;if(state.region==='center')moveRegion('right');else if(state.region==='oasis')moveRegion('right')}
 if(p.y<-240){p.y=-240;if(state.region==='center')moveRegion('up')}
 if(p.y>240){p.y=240;if(state.region==='sanctum')moveRegion('down')}
 // Keep every region bounded; only the designed exits connect the map.
 p.x=Math.max(-330,Math.min(330,p.x));p.y=Math.max(-240,Math.min(240,p.y));
 if(state.orb&&!state.orbTaken&&Math.hypot(state.orb.x-p.x,state.orb.y-p.y)<30){state.orbTaken=true;state.weaponsUpgraded=true;p.void=10;burst(state.orb.x,state.orb.y,'#d7a4ff',34);state.orb=null;toast('VOID SPIRAL CLAIMED · ALL WEAPONS AWAKENED');updateHud()}
 state.enemies.forEach(e=>{if(e.dead)return;e.flash=Math.max(0,e.flash-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);e.attack=Math.max(0,e.attack-dt);const meleeImpact=e.wind>0&&e.wind<=dt;const specialImpact=e.specialWind>0&&e.specialWind<=dt;e.wind=Math.max(0,e.wind-dt);e.specialWind=Math.max(0,e.specialWind-dt);let vx=p.x-e.x,vy=p.y-e.y,d=Math.max(1,Math.hypot(vx,vy)),isBoss=e.boss;e.dir=Math.atan2(vy,vx);
 if(isBoss&&e.hp<e.maxHp*.62)e.phase=2;if(isBoss&&e.hp<e.maxHp*.28)e.phase=3;
 const speed=isBoss?(e.type==='demon'?34:42)+e.phase*7:(e.type==='eel'?62:52);if(d> (isBoss?76:38)){e.x+=vx/d*speed*dt;e.y+=vy/d*speed*dt}
 if(meleeImpact){if(Math.hypot(p.x-e.x,p.y-e.y)<(isBoss?78:58))damagePlayer(isBoss?15+e.phase*2:8,e.dir?Math.cos(e.dir)*8:0,e.dir?Math.sin(e.dir)*8:0)}
 if(d<(isBoss?78:48)&&e.attack<=0){e.attack=isBoss?1.15:1.45;e.wind=isBoss?.34:.25}
 if(isBoss){e.specialCooldown-=dt;if(specialImpact){let hit=false;if(e.type==='eel'){hit=d<175&&d>52}else if(e.type==='wraith'){let a=Math.atan2(p.y-e.y,p.x-e.x),diff=Math.atan2(Math.sin(a-e.specialDir),Math.cos(a-e.specialDir));hit=d<235&&Math.abs(diff)<.34}else{hit=d<190}if(hit)damagePlayer(e.type==='demon'?26:e.type==='wraith'?21:18,Math.cos(e.dir)*12,Math.sin(e.dir)*12);burst(e.x,e.y,e.type==='wraith'?'#e68bd5':'#c26aff',24);e.specialWind=0}
 if(e.specialCooldown<=0&&d<(e.type==='wraith'?260:235)){e.specialWind=e.type==='wraith'?.95:1.05;e.specialDir=e.dir;e.specialCooldown=e.phase===3?3.0:4.4;e.special=1;}}
 });
 state.projectiles=state.projectiles.filter(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let hit=false;for(const e of state.enemies){if(!e.dead&&Math.hypot(e.x-b.x,e.y-b.y)<(e.boss?38:24)){e.hp-=b.damage;e.flash=.18;burst(e.x,e.y,'#c18aff',12);if(e.hp<=0)killEnemy(e);hit=true;break}}if(hit){p.void=Math.min(10,p.void+1);updateHud()}if(hit||b.life<=0)return false;return true});
 state.particles=state.particles.filter(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;return q.life>0});
 updateBossHud();
}
function restartRun(){state=fresh();spawnRegion();closePanel();$('start-screen').classList.add('hidden');running=true;updateHud();toast('A NEW FRACTURE OPENS');}
window.vwRestart=restartRun;
function gameOver(){running=false;panel('THE VOID CLAIMS YOU',`<p>The fracture consumes the last of your light.</p><p class="panel-note">This journey has ended. Begin again from the first breach.</p><button onclick="window.vwRestart()">RESTART RUN</button>`)}
function draw(){
 ctx.clearRect(0,0,W,H);let p=player(),camX=p.x,camY=p.y,scale=Math.min(W/850,H/570,1.25),cx=W/2,cy=H/2;
 ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.translate(-camX,-camY);
 const reg=regions[state.region];ctx.fillStyle=reg.bg;ctx.fillRect(camX-700,camY-500,1400,1000);
 const floorTile=state.region==='oasis'?'ground_tile_02':state.region==='factory'?'ground_tile_03':state.region==='sanctum'?'ground_tile_04':'ground_tile_01';ctx.save();ctx.globalAlpha=.18;for(let gx=-600;gx<=600;gx+=120)for(let gy=-480;gy<=480;gy+=120)drawSprite(floorTile,Math.floor((camX+gx)/120)*120+60,Math.floor((camY+gy)/120)*120+60,120,120,.18);ctx.restore();
 // cracked ground texture
 for(let i=0;i<95;i++){let x=camX+(rand(i+worldSeeds[state.region])*1300-650),y=camY+(rand(i*2+worldSeeds[state.region])*900-450);ctx.strokeStyle=i%4===0?'rgba(166,91,210,.24)':'rgba(100,66,125,.12)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand(i+8)*22-11,y+rand(i+18)*28);ctx.lineTo(x+rand(i+20)*18,y+rand(i+21)*22);ctx.stroke()}
 // distant black fissures
 for(let i=0;i<8;i++){let x=camX+(i-4)*145+Math.sin(i)*30,y=camY+Math.cos(i*4)*220;ctx.fillStyle='#08050d';ctx.beginPath();ctx.ellipse(x,y,38+rand(i)*25,18+rand(i+2)*14,rand(i)*2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(132,60,177,.45)';ctx.lineWidth=3;ctx.stroke()}
 // region landmarks
 if(state.region==='oasis'){ctx.fillStyle='#160d29';ctx.beginPath();ctx.ellipse(0,0,240,125,-.1,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9b57cb';ctx.lineWidth=4;ctx.stroke();for(let i=0;i<22;i++){ctx.strokeStyle='rgba(177,103,255,.24)';ctx.beginPath();ctx.arc((rand(i+5)-.5)*380,(rand(i+9)-.5)*190,8+rand(i)*22,0,Math.PI*2);ctx.stroke()}}
 if(state.region==='factory'){for(let i=0;i<5;i++){let x=-260+i*130;ctx.fillStyle='#100c14';ctx.fillRect(x,-190,68,130);ctx.strokeStyle='#684276';ctx.strokeRect(x,-190,68,130);ctx.fillStyle='#43294f';ctx.fillRect(x+10,-170,8,70)}}
 if(state.region==='sanctum'){ctx.strokeStyle='rgba(171,91,218,.5)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,-80,170,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#08050e';ctx.beginPath();ctx.ellipse(0,-80,120,75,0,0,Math.PI*2);ctx.fill();drawSprite('portal_arch',0,-205,76,154)}
 // Existing environment props add silhouette and scale to each region.
 if(state.region==='oasis'){[[-285,-150],[275,-135],[-300,175],[305,165]].forEach(([x,y])=>drawSprite('dead_tree',x,y,48,82,.9));}
 if(state.region==='factory'){[-285,-130,285,-130,-285,175,285,175].forEach((v,i,a)=>{if(i%2===0)drawSprite('stone_pillar',v,a[i+1],38,76,.85)});}
 if(state.region==='center'){[[-260,-170],[260,-165],[-285,185],[290,180]].forEach(([x,y])=>drawSprite('void_crystal',x,y,20,48,.85));}
 if(state.region==='sanctum'){[[-240,-25],[240,-25],[-210,190],[210,190]].forEach(([x,y])=>drawSprite('void_crystal',x,y,22,52,.8));}
 // Region-specific environmental atmosphere.
 if(state.region==='oasis'){ctx.save();ctx.globalAlpha=.22;for(let i=0;i<16;i++){let x=Math.sin(state.elapsed*.35+i*2.1)*210,y=Math.cos(state.elapsed*.28+i*1.7)*100;ctx.strokeStyle='#a86cff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,30+i%4*13,7+i%3*4,Math.sin(state.elapsed+i)*.2,0,Math.PI*2);ctx.stroke()}ctx.restore()}
 if(state.region==='factory'){ctx.save();for(let i=0;i<6;i++){let x=-300+i*120;ctx.fillStyle='rgba(5,4,8,.5)';ctx.fillRect(x,-220,72,22);ctx.fillStyle='rgba(165,82,190,.35)';ctx.fillRect(x+8,-215,5,12);ctx.fillRect(x+20,-215,5,12)}ctx.strokeStyle='rgba(162,75,190,.28)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-330,40);ctx.lineTo(-130,10);ctx.lineTo(15,75);ctx.lineTo(330,35);ctx.stroke();ctx.restore()}
 if(state.region==='center'){ctx.save();ctx.strokeStyle='rgba(160,82,210,.22)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-340,210);ctx.lineTo(-120,110);ctx.lineTo(20,155);ctx.lineTo(190,35);ctx.lineTo(340,70);ctx.stroke();ctx.restore()}
 // crates
 state.crates.forEach(c=>{if(c.dead){drawSprite('void_crate_broken',c.x,c.y,34,34,.8);return}ctx.save();ctx.translate(c.x,c.y);ctx.shadowBlur=c.glow?18:0;ctx.shadowColor='#a45dff';if(!drawSprite('void_crate',0,0,38,42)){ctx.fillStyle='#0a080f';ctx.fillRect(-13,-12,26,22);ctx.strokeStyle=c.glow?'#b77aff':'#594365';ctx.strokeRect(-13,-12,26,22)}if(c.glow){ctx.strokeStyle='rgba(208,166,255,'+(.45+Math.sin(state.elapsed*4)*.3)+')';ctx.lineWidth=2;ctx.strokeRect(-21, -23,42,46)}ctx.restore()});
 // The rare spiral orb is a world pickup, placed once per run in one region.
 if(state.orb&&!state.orbTaken){ctx.save();ctx.translate(state.orb.x,state.orb.y);ctx.shadowBlur=28;ctx.shadowColor='#c27aff';ctx.globalAlpha=.78+Math.sin(state.elapsed*4)*.18;drawSprite('void_spiral_orb',0,0,42,48);ctx.strokeStyle='rgba(214,168,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,27+Math.sin(state.elapsed*3)*4,0,Math.PI*2);ctx.stroke();ctx.restore()}
 // Enemies use their matching existing illustrated sprite crops.
 state.enemies.forEach(e=>{if(e.dead)return;ctx.save();const bob=Math.sin(state.elapsed*(e.boss?2.2:3.4)+e.x*.03)* (e.boss?3:2);ctx.translate(e.x,e.y+bob);ctx.shadowBlur=e.boss?24:12;ctx.shadowColor=e.flash?'#fff':'#9b39d0';
 const spriteKey=e.type==='eel'?'amphibian_warden':e.type==='wraith'?'nail_witch':e.type==='demon'?(e.phase>=2?'void_demon_phase2':'void_demon_phase1'):state.region==='oasis'?(e.type==='minion'?(e.variant?'black_eel':'amphibian_minion'):'black_eel'):state.region==='factory'?(e.variant?'darkling_02':'darkling_01'):'voidling';
 const dims=e.type==='demon'?[156,154]:e.type==='wraith'?[96,128]:e.type==='eel'?[104,104]:state.region==='factory'?[54,72]:state.region==='oasis'?[48,58]:[48,42];
 if(!drawSprite(spriteKey,0,e.boss?-5:0,dims[0],dims[1])){ctx.fillStyle='#160d20';ctx.beginPath();ctx.arc(0,0,e.boss?28:13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9b45d1';ctx.stroke()}
 if(e.flash){ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill()}
 if(e.wind>0){ctx.strokeStyle='rgba(255,104,157,'+(.35+.45*(e.wind/(e.boss?.34:.25)))+')';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,Math.max(12,e.boss?43:24),e.boss?44:22,7,0,0,Math.PI*2);ctx.stroke()}
 if(e.specialWind>0){ctx.strokeStyle=e.type==='wraith'?'rgba(255,120,205,.9)':'rgba(212,111,255,.8)';ctx.lineWidth=4;if(e.type==='wraith'){ctx.rotate(e.specialDir||e.dir);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(250,0);ctx.stroke()}else{ctx.beginPath();ctx.arc(0,0,190*(1-e.specialWind/1.05),0,Math.PI*2);ctx.stroke()}} if(e.boss){ctx.fillStyle='#09050e';ctx.fillRect(-30,-56,60,5);ctx.fillStyle='#ce4eaa';ctx.fillRect(-30,-56,60*e.hp/e.maxHp,5)}
 ctx.restore()});
 // player shadow and angled body
 ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.ellipse(0,13,18,8,0,0,Math.PI*2);ctx.fill();
 ctx.rotate(p.dir);if(p.attack>0&&p.weapon!==3){ctx.strokeStyle=p.weapon===2?'#e1bdff':'#d9a4ff';ctx.shadowBlur=p.weapon===2?28:20;ctx.shadowColor='#b66aff';ctx.lineWidth=p.weapon===2?8:5;ctx.beginPath();if(p.weapon===1){ctx.moveTo(8,-8);ctx.lineTo(46,0);ctx.lineTo(8,8)}else{ctx.arc(p.weapon===2?18:24,0,p.weapon===2?45:35,p.weapon===2?-.72:-.9,p.weapon===2?.72:.9)}ctx.stroke();ctx.strokeStyle='#fff0ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(24,0,p.weapon===2?45:35,-.75,.75);ctx.stroke()}
 // Illustrated heroine sprite extracted from the approved concept atlas.
 const moving=!!(keys.w||keys.a||keys.s||keys.d||keys.ArrowUp||keys.ArrowDown||keys.ArrowLeft||keys.ArrowRight||touch.up||touch.down||touch.left||touch.right);
 const heroFrame=p.invuln>0?['hero_hurt_01','hero_hurt_02'][Math.floor(state.elapsed*14)%2]:p.attack>0?(p.weapon===0?'hero_attack_01':p.weapon===1?'hero_attack_02':p.weapon===2?'hero_attack_03':'hero_attack_04'):moving?['hero_walk_01','hero_walk_02','hero_walk_03','hero_walk_04'][Math.floor(state.elapsed*9)%4]:['hero_idle_01','hero_idle_02','hero_idle_03'][Math.floor(state.elapsed*2)%3];
 const heroImg=spriteImages[heroFrame]||spriteImages.hero_fullbody;
 if(heroImg&&heroImg.complete&&heroImg.naturalWidth){ctx.save();ctx.rotate(-p.dir+Math.PI/2);const attacking=p.attack>0;const dw=attacking?66:54,dh=attacking?74:88;ctx.drawImage(heroImg,-dw/2,-dh/2-3,dw,dh);ctx.restore();}
 else {
  ctx.fillStyle='#0a080f';ctx.beginPath();ctx.ellipse(0,3,12,17,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#25142f';ctx.beginPath();ctx.moveTo(-10,-3);ctx.lineTo(0,-19);ctx.lineTo(13,-2);ctx.lineTo(10,15);ctx.lineTo(-10,15);ctx.fill();ctx.strokeStyle='#80549e';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='#07060b';ctx.beginPath();ctx.ellipse(0,-15,12,15,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-12,-17,-3,28);ctx.fillRect(9,-18,4,28);ctx.fillStyle='#d5b9d6';ctx.beginPath();ctx.ellipse(0,-17,6,7,0,0,Math.PI*2);ctx.fill();
 }
 // Equipped weapon uses its existing illustrated asset.
 const weaponSprite=['weapon_sword','weapon_knife','weapon_mace','weapon_staff'][p.weapon];
 if(!drawSprite(weaponSprite,25,0,p.weapon===1?15:p.weapon===2?20:17,p.weapon===3?34:29)){
  ctx.strokeStyle=state.weaponsUpgraded?'#b983ff':'#b7a2c8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(27,0);ctx.stroke();
 }
 if(p.invuln>0){ctx.strokeStyle='rgba(207,154,255,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke()}ctx.restore();
 state.projectiles.forEach(b=>{ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#c58aff';ctx.fillStyle='#e2c5ff';ctx.beginPath();ctx.arc(b.x,b.y,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(180,110,255,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-b.vx*.035,b.y-b.vy*.035);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()});
 state.particles.forEach(q=>{ctx.globalAlpha=Math.max(0,q.life);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,3,3);ctx.globalAlpha=1});
 ctx.restore();
 // vignette
 let grad=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.7);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,.58)');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
}
function loop(t){let dt=Math.min((t-last)/1000,.04);last=t;update(dt);draw();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
document.addEventListener('keydown',e=>{keys[e.key]=true;if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();if(e.repeat)return;if(e.key===' '||e.key==='j')attack();if(e.key.toLowerCase()==='i'){overlayOpen?closePanel():inventoryPanel()}if(e.key==='Escape')closePanel();if(e.key.toLowerCase()==='r'&&!overlayOpen&&running){if(confirm('Restart this run from the beginning?'))restartRun()}if('1234'.includes(e.key))switchWeapon(+e.key-1);});
document.addEventListener('keyup',e=>keys[e.key]=false);
function clearInputs(){Object.keys(keys).forEach(k=>keys[k]=false);Object.keys(touch).forEach(k=>touch[k]=false)}
window.addEventListener('blur',clearInputs);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs()});
canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const rect=canvas.getBoundingClientRect(),scale=Math.min(W/850,H/570,1.25);const wx=(e.clientX-rect.left-W/2)/scale+player().x,wy=(e.clientY-rect.top-H/2)/scale+player().y;player().dir=Math.atan2(wy-player().y,wx-player().x)});

document.querySelectorAll('[data-slot]').forEach(b=>b.addEventListener('click',()=>switchWeapon(+b.dataset.slot)));
$('close-panel').onclick=closePanel;$('start-btn').onclick=()=>{$('start-screen').classList.add('hidden');running=true;toast('THE FRACTURE STIRS')};$('restart-run-btn').onclick=()=>{if(confirm('Restart this run from the beginning?'))restartRun()};
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closePanel()});
document.querySelectorAll('[data-move]').forEach(b=>{let k=b.dataset.move;b.addEventListener('pointerdown',e=>{e.preventDefault();touch[k]=true});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>touch[k]=false))});
$('mobile-attack').addEventListener('pointerdown',e=>{e.preventDefault();attack()});$('mobile-inventory').onclick=inventoryPanel;
$('hint').textContent='WASD / ARROWS MOVE · MOUSE AIM · SPACE / J ATTACK · I INVENTORY · 1–4 SWITCH WEAPON';
updateHud();
})();
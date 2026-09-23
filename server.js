const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const PORT=Number(process.env.PORT||3000);
const TICK=50, DT=TICK/1000, MAX_HUMANS=2, BOT_COUNT=24;
const WORLD=260, ZONE_START=220, ZONE_MIN=35;
const rooms=new Map();
const staticBuildings=[
  {x:-95,z:-75,w:28,d:20,h:9},{x:-20,z:-105,w:34,d:18,h:8},{x:80,z:-75,w:22,d:28,h:10},
  {x:125,z:-5,w:30,d:20,h:9},{x:70,z:95,w:36,d:22,h:10},{x:-45,z:105,w:26,d:26,h:8},
  {x:-125,z:45,w:24,d:34,h:9},{x:5,z:25,w:20,d:20,h:7}
];
const lootSpots=[];
for(let i=0;i<75;i++) lootSpots.push({x:rand(-220,220),z:rand(-220,220)});

function rand(a,b){return a+Math.random()*(b-a)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function id(){return crypto.randomBytes(4).toString('hex')}
function code(){return crypto.randomBytes(3).toString('hex').toUpperCase()}
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function terrain(x,z){return 1.2+Math.sin(x*.035)*1.2+Math.cos(z*.028)*.9+Math.sin((x+z)*.018)*.7}
function roomFor(c){if(!rooms.has(c)) rooms.set(c,new Room(c));return rooms.get(c)}

class Room{
 constructor(code){this.code=code;this.players=new Map();this.bots=[];this.loot=[];this.builds=[];this.zone={x:0,z:0,r:ZONE_START,stage:0,timer:25};this.phase='plane';this.time=0;this.started=false;this.winner=null;this.initLoot();this.initBots()}
 initLoot(){for(let i=0;i<lootSpots.length;i++){let s=lootSpots[i];this.loot.push({id:'l'+i,x:s.x,z:s.z,type:Math.random()<.2?'med':'ammo',active:true})}}
 initBots(){for(let i=0;i<BOT_COUNT;i++){let a=i*Math.PI*2/BOT_COUNT;let r=rand(45,190);this.bots.push({id:'b'+i,x:Math.cos(a)*r,z:Math.sin(a)*r,y:3,hp:100,alive:true,ammo:30,reserve:90,fire:rand(.2,1.2),target:null,buildCd:rand(2,6),dir:rand(0,6.28),jumped:false,landed:false})}}
 addPlayer(ws,name){if(this.players.size>=MAX_HUMANS)return null;let p={id:'p'+id(),name:(name||'Player').slice(0,18),x:0,z:0,y:85,hp:100,ammo:30,reserve:120,alive:true,jumping:false,landed:false,fire:0,buildCd:0,rot:0,input:{f:0,s:0},socket:ws};this.players.set(p.id,p);if(this.players.size===1)this.start();return p}
 start(){this.started=true;this.phase='plane';this.time=0}
 jump(p){if(this.phase!=='plane'||p.jumping)return;p.jumping=true;p.y=80;p.x=rand(-25,25);p.z=rand(-25,25)}
 tick(){if(!this.started)return;this.time+=DT;if(this.phase==='plane'){let all=[...this.players.values()];for(const p of all)if(p.alive&&!p.jumping)p.y=80;if(all.some(p=>p.jumping)||this.time>15){for(const p of all)if(!p.jumping&&p.alive)this.jump(p);this.phase='battle';for(const b of this.bots){b.jumped=true;b.landed=true;b.y=terrain(b.x,b.z)+2}}}else if(this.phase==='battle'){this.updatePlayers();this.updateBots();this.updateZone();this.checkEnd()}}
 updatePlayers(){for(const p of this.players.values()){if(!p.alive)continue;if(p.jumping){p.y-=20*DT;if(p.y<=terrain(p.x,p.z)+2){p.y=terrain(p.x,p.z)+2;p.landed=true;p.jumping=false}}else{let f=p.input.f,s=p.input.s;let l=Math.hypot(f,s)||1;f/=l;s/=l;p.x+=Math.sin(p.rot)*f*10*DT+Math.cos(p.rot)*s*10*DT;p.z+=Math.cos(p.rot)*f*10*DT-Math.sin(p.rot)*s*10*DT;p.x=clamp(p.x,-WORLD,WORLD);p.z=clamp(p.z,-WORLD,WORLD);p.y=terrain(p.x,p.z)+2}p.fire=Math.max(0,p.fire-DT);p.buildCd=Math.max(0,p.buildCd-DT)}}
 updateBots(){for(const b of this.bots)if(b.alive){b.fire=Math.max(0,b.fire-DT);b.buildCd=Math.max(0,b.buildCd-DT);let target=this.nearestEnemy(b);if(target){b.target=target.id;let dx=target.x-b.x,dz=target.z-b.z,d=Math.hypot(dx,dz),a=Math.atan2(dx,dz);if(d>24){b.x+=Math.sin(a)*b.speed*DT;b.z+=Math.cos(a)*b.speed*DT}else{b.dir+=rand(-1,1)*DT;if(b.fire<=0){b.fire=.55;this.botShoot(b,target)}}if(d<38&&b.buildCd<=0&&b.hp<65){this.botBuild(b,a);b.buildCd=rand(4,7)}}else{b.dir+=rand(-.5,.5)*DT;b.x+=Math.sin(b.dir)*3*DT;b.z+=Math.cos(b.dir)*3*DT}b.x=clamp(b.x,-WORLD,WORLD);b.z=clamp(b.z,-WORLD,WORLD);b.y=terrain(b.x,b.z)+2;if(Math.hypot(b.x-this.zone.x,b.z-this.zone.z)>this.zone.r)this.damage(b,DT*4,'zone')}}
 nearestEnemy(b){let best=null,bd=1e9;for(const p of this.players.values())if(p.alive){let d=dist(b,p);if(d<bd)bd=d,best=p}for(const q of this.bots)if(q!==b&&q.alive){let d=dist(b,q);if(d<bd)bd=d,best=q}return bd<85?best:null}
 botShoot(b,t){if(b.ammo<=0){b.ammo=30;return}b.ammo--;if(Math.random()<.72&&dist(b,t)<65)this.damage(t,rand(7,13),b.id)}
 botBuild(b,a){let x=b.x+Math.sin(a)*2.2,z=b.z+Math.cos(a)*2.2;this.placeBuild({id:b.id,x:b.x,z:b.z},'wall',x,z,a,true)}
 shoot(p,dx,dz){if(!p.alive||p.fire>0||p.ammo<=0)return;if(this.phase==='plane')return;p.fire=.12;p.ammo--;let len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;let best=null,bd=100;const candidates=[...this.players.values(),...this.bots];for(const q of candidates){if(q===p||!q.alive)continue;let vx=q.x-p.x,vz=q.z-p.z,t=vx*dx+vz*dz;if(t<0||t>100)continue;let px=p.x+dx*t,pz=p.z+dz*t;if(Math.hypot(q.x-px,q.z-pz)<1.7&&t<bd){best=q;bd=t}}if(best)this.damage(best,28,p.id)}
 damage(t,n,attacker){if(!t.alive)return;t.hp-=n;if(t.hp<=0){t.hp=0;t.alive=false;if(t.ammo>0)this.loot.push({id:'drop'+id(),x:t.x,z:t.z,type:'ammo',active:true});}}
 loot(p,lid){if(!p.alive)return;let l=this.loot.find(x=>x.id===lid&&x.active);if(!l||dist(p,l)>3)return;l.active=false;if(l.type==='ammo')p.reserve=Math.min(240,p.reserve+45);else p.hp=Math.min(100,p.hp+35)}
 placeBuild(p,type,x,z,rot,isBot=false){if(!p.alive||(!isBot&&p.buildCd>0))return false;if(Math.hypot(x,z)>WORLD-5)return false;let w=type==='wall'?5:4,d=type==='wall'?.5:5;if(type==='wall'){/* wall is a thin rectangle */}for(const b of this.builds){if(Math.hypot(b.x-x,b.z-z)<3.2)return false}this.builds.push({id:'bld'+id(),owner:p.id,type,x,z,rot,ttl:120});if(!isBot)p.buildCd=1;return true}
 updateZone(){this.zone.timer-=DT;if(this.zone.timer<=0&&this.zone.r>ZONE_MIN){this.zone.stage++;this.zone.timer=35;this.zone.r=Math.max(ZONE_MIN,this.zone.r*.78)}for(const p of this.players.values())if(p.alive&&Math.hypot(p.x-this.zone.x,p.z-this.zone.z)>this.zone.r)this.damage(p,DT*5,'zone')}
 checkEnd(){let alive=[...this.players.values(),...this.bots].filter(x=>x.alive);if(alive.length<=1){this.phase='ended';this.winner=alive[0]?.name||'Niemand'}}
 state(){return {type:'state',room:this.code,phase:this.phase,time:this.time,winner:this.winner,zone:this.zone,players:[...this.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,z:p.z,rot:p.rot,hp:p.hp,ammo:p.ammo,reserve:p.reserve,alive:p.alive,jumping:p.jumping,buildCd:p.buildCd})),bots:this.bots.map(b=>({id:b.id,x:b.x,y:b.y,z:b.z,hp:b.hp,alive:b.alive})),loot:this.loot.filter(l=>l.active),builds:this.builds.map(b=>({id:b.id,type:b.type,x:b.x,z:b.z,rot:b.rot,owner:b.owner}))}}
}

const server=http.createServer((req,res)=>{let u=new URL(req.url,'http://localhost');let file=u.pathname==='/'?'/index.html':u.pathname;let fp=path.join(__dirname,file);fs.readFile(fp,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}let ext=path.extname(fp);let ct=ext==='.html'?'text/html':ext==='.js'?'text/javascript':'text/plain';res.writeHead(200,{'Content-Type':ct});res.end(d)})});
const sockets=new Set();
function wsSend(sock,obj){if(sock.destroyed)return;const payload=Buffer.from(JSON.stringify(obj));let head;if(payload.length<126)head=Buffer.from([0x81,payload.length]);else if(payload.length<65536){head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(payload.length,2)}else{head=Buffer.alloc(10);head[0]=0x81;head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2)}sock.write(Buffer.concat([head,payload]))}
function parseFrames(sock,buf){let off=0;while(off+2<=buf.length){let b1=buf[off],b2=buf[off+1],fin=!!(b1&128),opcode=b1&15,masked=!!(b2&128),len=b2&127,pos=off+2;if(len===126){if(buf.length<pos+2)return buf.subarray(off);len=buf.readUInt16BE(pos);pos+=2}else if(len===127){if(buf.length<pos+8)return buf.subarray(off);let n=buf.readBigUInt64BE(pos);if(n>BigInt(1e7))return Buffer.alloc(0);len=Number(n);pos+=8}let key;if(masked){if(buf.length<pos+4)return buf.subarray(off);key=buf.subarray(pos,pos+4);pos+=4}if(buf.length<pos+len)return buf.subarray(off);let data=Buffer.from(buf.subarray(pos,pos+len));if(masked)for(let i=0;i<data.length;i++)data[i]^=key[i%4];off=pos+len;if(opcode===8){sock.end();return buf.subarray(off)}if(opcode===9){let h=Buffer.from([0x8A,data.length]);sock.write(Buffer.concat([h,data]));continue}if(opcode===1&&fin)sock.emit('wsmessage',data.toString())}return buf.subarray(off)}
server.on('upgrade',(req,sock)=>{
  let key=req.headers['sec-websocket-key'];
  if(!key){sock.destroy();return}
  let accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  sockets.add(sock); sock.setNoDelay(true); sock.buf=Buffer.alloc(0);
  sock.on('data',d=>{sock.buf=Buffer.concat([sock.buf,d]);sock.buf=parseFrames(sock,sock.buf)});
  sock.on('close',()=>sockets.delete(sock)); sock.on('error',()=>sockets.delete(sock));
  let u=new URL(req.url,'http://localhost');
  let c=(u.searchParams.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  if(!c)c=code();
  let room=roomFor(c);
  let p=room.addPlayer(sock,u.searchParams.get('name')||'Player');
  if(!p){wsSend(sock,{type:'error',message:'Raum ist voll (max. 2 Menschen).'});return sock.end()}
  wsSend(sock,{type:'welcome',id:p.id,room:c,players:room.players.size});
  sock.on('wsmessage',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
    if(m.type==='input'){p.input.f=clamp(Number(m.f)||0,-1,1);p.input.s=clamp(Number(m.s)||0,-1,1);p.rot=Number(m.rot)||0}
    else if(m.type==='jump')room.jump(p);
    else if(m.type==='shoot')room.shoot(p,Number(m.dx)||0,Number(m.dz)||0);
    else if(m.type==='reload'){let n=Math.min(30-p.ammo,p.reserve);p.ammo+=n;p.reserve-=n}
    else if(m.type==='loot')room.loot(p,String(m.id));
    else if(m.type==='build'){let type=m.buildType==='stair'?'stair':'wall';room.placeBuild(p,type,Number(m.x)||0,Number(m.z)||0,Number(m.rot)||0)}
  });
  sock.on('close',()=>room.players.delete(p.id));
});
setInterval(()=>{for(const r of rooms.values()){r.tick();for(const p of r.players.values())if(p.socket&&!p.socket.destroyed)wsSend(p.socket,r.state());if(r.players.size===0&&r.time>60)rooms.delete(r.code)}},TICK);
server.listen(PORT,()=>console.log(`Skyfall Royale server listening on http://0.0.0.0:${PORT}`));

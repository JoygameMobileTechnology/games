import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';
import { createGame, tickGame, applyAction, snapshotGame, endGame } from '../shared/game.js';
import { resultPresentationActive } from '../shared/presentation.js';
import { chooseAIAction } from './ai.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json; charset=utf-8'};
const cleanName=n=>(typeof n==='string'?n:'Commander').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,22)||'Commander';
const textField=(value,max=128)=>typeof value==='string'&&value.length<=max;
const send=(ws,payload)=>{if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify(payload));};
const fail=(ws,code,message,commandId)=>send(ws,{type:'error',code,message,...(commandId?{commandId}:{})});

export async function createServer({port=0,host='127.0.0.1',gameConfig={},reconnectGraceMs=10000,tickMs=1000/30}={}) {
  const rooms=new Map();let closed=false, boundPort=port;
  const addresses=()=>{
    const found=new Set();
    for(const entries of Object.values(networkInterfaces())) for(const info of entries||[]) if(info.family==='IPv4'&&!info.internal) found.add(`http://${info.address}:${boundPort}`);
    return [...found];
  };
  const publicRoom=room=>({code:room.code,mode:room.mode,players:room.players.map(p=>p?{name:p.name,connected:p.bot||!!p.ws,ready:p.ready}:{name:'Waiting for a commander',connected:false,ready:false}),rematch:room.rematch});
  function publish(room) {
    const state=room.game?snapshotGame(room.game):null;
    for(let side=0;side<2;side++) send(room.players[side]?.ws,{type:'state',you:side,room:publicRoom(room),state});
    room.lastPublish=performance.now();
  }
  function startMatch(room) {
    const now=performance.now();
    const previous=room.game?.state.lineup?.join(',');
    const previousFormation=room.game?.state.formation?.id;
    let attempts=0;
    do {
      room.game=createGame({id:randomBytes(8).toString('hex'),seed:randomBytes(4).readUInt32LE(),firstSide:room.firstSide,now,config:gameConfig,excludeFormationId:previousFormation});
    } while(previous&&room.game.state.lineup.join(',')===previous&&++attempts<12);
    room.rematch=[false,false];room.aiTurn=null;room.aiDue=0;room.lastActivity=now;
    for(const p of room.players) if(p){p.accepted.clear();p.ready=true;p.lastSequence=0;}
    publish(room);
  }
  function detach(ws,explicit=false) {
    const room=rooms.get(ws.roomCode);if(!room)return;
    const side=ws.side,p=room.players[side];
    if(!p||p.ws!==ws)return;
    p.ws=null;p.disconnectedAt=performance.now();p.ready=false;
    ws.roomCode=null;ws.side=null;
    if(explicit) {
      p.token=null;
      if(room.game&&!room.game.state.result) endGame(room.game,1-side,'Opponent left the match');
      room.players[side]=null;
    }
    publish(room);
    if(!room.players.some(p=>p&&!p.bot)) rooms.delete(room.code);
  }
  function assign(ws,room,side,p) {
    if(p.ws&&p.ws!==ws){const old=p.ws;old.roomCode=null;old.side=null;old.close(4001,'Session resumed elsewhere');}
    p.ws=ws;p.disconnectedAt=null;p.lastSequence=0;
    ws.roomCode=room.code;ws.side=side;room.lastActivity=performance.now();
    send(ws,{type:'joined',roomCode:room.code,side,resumeToken:p.token});publish(room);
  }
  function player(name,bot=false) {return {name:cleanName(name),bot,ready:bot,ws:null,token:bot?null:randomBytes(24).toString('hex'),disconnectedAt:null,lastSequence:0,accepted:new Map()};}
  function makeCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;do{code=Array.from(randomBytes(5),n=>alphabet[n%alphabet.length]).join('');}while(rooms.has(code));return code;}

  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-cache');
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':MIME['.json']});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
      if(url.pathname==='/api/host'){res.writeHead(200,{'Content-Type':MIME['.json']});res.end(JSON.stringify({urls:addresses(),port:boundPort}));return;}
      if(url.pathname==='/api/qr') {
        const code=String(url.searchParams.get('code')||'').toUpperCase();
        if(!rooms.has(code)){res.writeHead(404);res.end('Room not found');return;}
        const requested=url.searchParams.get('origin');const same=`http://${req.headers.host}`;
        const allowed=[...addresses(),same,`http://localhost:${boundPort}`,`http://127.0.0.1:${boundPort}`];
        const origin=allowed.includes(requested)?requested:(addresses()[0]||same);
        const svg=await QRCode.toString(`${origin}/?room=${code}`,{type:'svg',margin:1,color:{dark:'#173a43',light:'#ffffff'},errorCorrectionLevel:'M'});
        res.writeHead(200,{'Content-Type':MIME['.svg']});res.end(svg);return;
      }
      const pathname=decodeURIComponent(url.pathname);
      const isShared=pathname.startsWith('/shared/');
      const base=path.join(ROOT,isShared?'shared':'public');
      const rel=isShared?pathname.slice(8):pathname==='/'?'index.html':pathname.slice(1);
      const filename=path.resolve(base,rel);
      if(!filename.startsWith(base+path.sep)||!MIME[path.extname(filename)]){res.writeHead(404);res.end('Not found');return;}
      const body=await readFile(filename);
      res.writeHead(200,{'Content-Type':MIME[path.extname(filename)],'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
    }catch(e){res.writeHead(e.code==='ENOENT'?404:400);res.end(e.code==='ENOENT'?'Not found':'Bad request');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:16*1024,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    let url;try{url=new URL(req.url,'http://localhost');}catch{socket.destroy();return;}
    if(url.pathname!=='/ws'){socket.destroy();return;}
    if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host||!['http:','https:'].includes(origin.protocol))throw Error();}catch{socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  wss.on('connection',ws=>{
    ws.isAlive=true;ws.roomCode=null;ws.rateStart=performance.now();ws.rateCount=0;
    ws.on('pong',()=>{ws.isAlive=true;});
    ws.on('error',()=>{});
    ws.on('close',()=>detach(ws));
    ws.on('message',raw=>{
      const now=performance.now();
      if(now-ws.rateStart>10000){ws.rateStart=now;ws.rateCount=0;}
      if(++ws.rateCount>180){fail(ws,'RATE_LIMIT','Too many messages. Please slow down.');return;}
      let m;try{m=JSON.parse(raw.toString());if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.type!=='string')throw Error();}catch{fail(ws,'BAD_MESSAGE','That message could not be read.');return;}
      try {
      if(m.type==='ping'){send(ws,{type:'pong',sentAt:m.sentAt,serverNow:now});return;}
      if(m.type==='leave'){detach(ws,true);send(ws,{type:'left'});return;}
      if(m.type==='create') {
        if(!['ai','pvp'].includes(m.mode)){fail(ws,'BAD_MESSAGE','Choose AI or LAN duel.');return;}
        if(m.name!==undefined&&!textField(m.name)){fail(ws,'BAD_MESSAGE','The commander name must be text.');return;}
        if(rooms.size>=64){fail(ws,'SERVER_FULL','The host has too many rooms.');return;}
        detach(ws,true);
        const room={code:makeCode(),mode:m.mode,players:[player(m.name),m.mode==='ai'?player('Captain Cinder',true):null],game:null,firstSide:randomBytes(1)[0]%2,rematch:[false,false],lastPublish:0,lastActivity:now,aiTurn:null};
        rooms.set(room.code,room);assign(ws,room,0,room.players[0]);
        if(m.mode==='ai'){room.players[0].ready=true;startMatch(room);}
        return;
      }
      if(m.type==='join') {
        if(!textField(m.code,32)||(m.name!==undefined&&!textField(m.name))){fail(ws,'BAD_MESSAGE','The room code and commander name must be text.');return;}
        const code=m.code.trim().toUpperCase();const room=rooms.get(code);
        if(!room){fail(ws,'ROOM_NOT_FOUND','That room was not found. Check the code and host.');return;}
        if(room.mode!=='pvp'||room.players.every(Boolean)||room.game){fail(ws,'ROOM_FULL','This room already has its commanders.');return;}
        detach(ws,true);const side=room.players.findIndex(p=>!p);room.players[side]=player(m.name);assign(ws,room,side,room.players[side]);return;
      }
      if(m.type==='resume') {
        if(!textField(m.code,32)||!textField(m.token)){fail(ws,'BAD_MESSAGE','Invalid reconnect message.');return;}
        const room=rooms.get(m.code.toUpperCase());
        const side=room?.players.findIndex(p=>p&&!p.bot&&typeof m.token==='string'&&p.token===m.token)??-1;
        if(!room||side<0){fail(ws,'RESUME_FAILED','Your previous seat is no longer available.');return;}
        const p=room.players[side];
        if(!p.ws&&p.disconnectedAt!==null&&now-p.disconnectedAt>reconnectGraceMs){fail(ws,'RESUME_FAILED','The reconnect window has expired.');return;}
        if(ws.roomCode&&(ws.roomCode!==room.code||ws.side!==side))detach(ws,true);
        assign(ws,room,side,p);return;
      }
      const room=rooms.get(ws.roomCode),p=room?.players[ws.side];
      if(!room||!p||p.ws!==ws){fail(ws,'NOT_JOINED','Join a room first.',m.commandId);return;}
      room.lastActivity=now;
      if(m.type==='ready') {
        if(room.game){fail(ws,'MATCH_STARTED','The match has already started.');return;}
        p.ready=m.ready===true;
        if(room.players.every(q=>q&&q.ready&&(q.bot||q.ws)))startMatch(room);else publish(room);
        return;
      }
      if(m.type==='rematch') {
        if(!room.game?.state.result){fail(ws,'MATCH_ACTIVE','Finish this match first.');return;}
        if(resultPresentationActive(room.game.state.result,now)){fail(ws,'FINALE_ACTIVE','Watch the final destruction before starting a rematch.');return;}
        room.rematch[ws.side]=true;if(room.mode==='ai')room.rematch[1]=true;
        if(room.rematch.every(Boolean)&&room.players.every(q=>q&&(q.bot||q.ws))){room.firstSide=1-room.firstSide;startMatch(room);}else publish(room);
        return;
      }
      if(m.type==='action') {
        if(!room.game){fail(ws,'NOT_STARTED','The match has not started.',m.commandId);return;}
        if(m.protocolVersion!==1||!textField(m.commandId)||m.commandId.length<1||!textField(m.matchId)||m.matchId.length<1||!Number.isSafeInteger(m.turnId)||m.turnId<1||!Number.isSafeInteger(m.sequence)||m.sequence<1||!m.action||typeof m.action!=='object'||Array.isArray(m.action)||!textField(m.action.unitId)||!textField(m.action.weaponId)||!['fire','build'].includes(m.action.kind)||(m.action.targetId!==undefined&&!textField(m.action.targetId))) {fail(ws,'BAD_MESSAGE','Invalid action message.',m.commandId);return;}
        const key=`${m.matchId}:${m.commandId}`;
        if(p.accepted.has(key)){send(ws,p.accepted.get(key));return;}
        tickGame(room.game,now);
        if(m.matchId!==room.game.state.matchId){fail(ws,'WRONG_MATCH','That action belongs to an earlier match.',m.commandId);return;}
        if(m.turnId!==room.game.state.turnId){fail(ws,'STALE_TURN','That turn has ended.',m.commandId);publish(room);return;}
        if(m.sequence<=p.lastSequence){fail(ws,'STALE_SEQUENCE','That input has already been superseded.',m.commandId);return;}
        p.lastSequence=m.sequence;
        try {
          const result=applyAction(room.game,ws.side,m.action,now);
          if(!result.ok){fail(ws,'ACTION_REJECTED',result.reason||'That action is not available.',m.commandId);publish(room);return;}
          const ack={type:'ack',commandId:m.commandId};p.accepted.set(key,ack);
          if(p.accepted.size>128)p.accepted.delete(p.accepted.keys().next().value);
          send(ws,ack);publish(room);
        }catch(e){console.error('Action validation failed:',e.message);fail(ws,'ACTION_REJECTED','The host could not apply that action.',m.commandId);}
        return;
      }
      fail(ws,'BAD_MESSAGE','Unknown message type.',m.commandId);
      } catch {
        fail(ws,'BAD_MESSAGE','That message could not be processed.',typeof m.commandId==='string'?m.commandId:undefined);
      }
    });
  });

  const loop=setInterval(()=>{
    if(closed)return;const now=performance.now();
    for(const room of rooms.values()) {
      const game=room.game;
      if(game) {
        const before=`${game.state.phase}:${game.state.turnId}:${game.state.result?.reason}`;
        try {
          tickGame(game,now);
          if(!game.state.result) {
            const absent=room.players.map(p=>!p||(!p.bot&&!p.ws));
            const expired=room.players.map(p=>!p||(!p.bot&&!p.ws&&p.disconnectedAt!==null&&now-p.disconnectedAt>=reconnectGraceMs));
            if(absent.every(Boolean)&&expired.every(Boolean))endGame(game,null,'Both commanders disconnected',true);
            else if(expired[0]&&!absent[1])endGame(game,1,'Opponent disconnected');
            else if(expired[1]&&!absent[0])endGame(game,0,'Opponent disconnected');
          }
          if(room.mode==='ai'&&game.state.phase==='aim'&&game.state.activeSide===1&&!game.state.result) {
            if(room.aiTurn!==game.state.turnId){room.aiTurn=game.state.turnId;room.aiDue=now+Math.min(1000,Math.max(20,(game.state.turnDeadline-now)*.12));}
            if(now>=room.aiDue){room.aiDue=Infinity;const action=chooseAIAction(snapshotGame(game));if(action)applyAction(game,1,action,now);}
          }
        }catch(e){console.error('Simulation fault:',e.stack);endGame(game,null,'The host could not finish the simulation',true);}
        const after=`${game.state.phase}:${game.state.turnId}:${game.state.result?.reason}`;
        if(before!==after||now-room.lastPublish>=100)publish(room);
      }
      if(!game) {
        for(let side=0;side<2;side++) {const p=room.players[side];if(p&&!p.bot&&!p.ws&&p.disconnectedAt!==null&&now-p.disconnectedAt>reconnectGraceMs){room.players[side]=null;publish(room);}}
      }
      if(!room.players.some(p=>p&&!p.bot&&p.ws)&&now-room.lastActivity>300000)rooms.delete(room.code);
    }
  },tickMs);
  loop.unref();
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},5000);heartbeat.unref();

  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  boundPort=server.address().port;
  return {server,wss,rooms,port:boundPort,urls:addresses(),close:async()=>{
    if(closed)return;closed=true;clearInterval(loop);clearInterval(heartbeat);
    for(const ws of wss.clients)ws.terminate();
    await new Promise(resolve=>wss.close(resolve));
    await new Promise(resolve=>server.close(resolve));
  }};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0';
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('PORT must be a valid TCP port');
  createServer({port,host}).then(app=>{
    console.log(`\n  CASTLE WARS\n  Local: http://localhost:${app.port}`);
    for(const url of app.urls)console.log(`  Join from your phone: ${url}`);
    console.log('  Keep this process running. Both phones use the same Wi-Fi.\n');
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
  }).catch(e=>{console.error(`Could not start Castle Wars: ${e.message}`);process.exitCode=1;});
}

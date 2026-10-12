import * as THREE from 'three';
import { bridgeHeight } from './layout.js';

export const GHOST_WARNING_TIME=3.2;
export const GHOST_SPAWN_HEIGHT=20;
export const GHOST_SPAWN_AHEAD=40;
const HIT_RADIUS=.65;

/** One committed swoop at a time; the target locks before launch so it is dodgeable. */
export function createGhostFlight(bridge,homes){
  const states=homes.map(home=>({home:home.clone(),position:home.clone(),target:home.clone(),phase:'idle',age:0,cooldown:0,hit:false}));
  let gap=0,serial=0;
  const notify=(player,message)=>{player.ghostEvent={id:++serial,message};};
  const onBridge=player=>{
    if(!player?.enabled)return false;
    const dx=player.position.x-bridge.pa.x,dz=player.position.z-bridge.pa.z;
    const length=Math.hypot(bridge.pb.x-bridge.pa.x,bridge.pb.z-bridge.pa.z);
    const along=dx*bridge.dir.x+dz*bridge.dir.z;
    const across=Math.abs(dx*-bridge.dir.z+dz*bridge.dir.x);
    return along>0&&along<length&&across<bridge.halfWidth&&Math.abs(player.position.y-bridgeHeight(bridge,along/length))<4;
  };
  return {states,update(dt,player){
    if(!player?.enabled)return; // Pause with menus/editor.
    if(!onBridge(player)){
      for(const s of states){s.phase='idle';s.position.copy(s.home);s.cooldown=0;}
      gap=1;return;
    }
    dt=Math.min(Math.max(dt,0),.05);gap=Math.max(0,gap-dt);
    for(const s of states)s.cooldown=Math.max(0,s.cooldown-dt);
    if(!states.some(s=>s.phase!=='idle')&&gap===0){
      const s=states.filter(s=>s.cooldown===0&&s.home.distanceTo(player.position)<18).sort((a,b)=>a.home.distanceToSquared(player.position)-b.home.distanceToSquared(player.position))[0];
      if(s){
        s.phase='warning';s.age=0;s.hit=false;
        const forward=Math.sin(player.heading||0)*bridge.dir.x+Math.cos(player.heading||0)*bridge.dir.z;
        // Stage ahead of the player, rather than sweeping the entire deck
        // sideways, so stepping into the other lane always offers an escape.
        const length=Math.hypot(bridge.pb.x-bridge.pa.x,bridge.pb.z-bridge.pa.z);
        const along=player.position.clone().sub(bridge.pa).dot(bridge.dir);
        const ahead=THREE.MathUtils.clamp(along+(forward<0?-1:1)*GHOST_SPAWN_AHEAD,.5,length-.5);
        s.launch=bridge.pa.clone().addScaledVector(bridge.dir,ahead);
        s.launch.y=bridgeHeight(bridge,ahead/length);
        // Stay in the player's bridge lane, with the spawn vertically above it.
        const side=new THREE.Vector3(-bridge.dir.z,0,bridge.dir.x);
        const lane=player.position.clone().sub(bridge.pa).dot(side);
        s.launch.addScaledVector(side,THREE.MathUtils.clamp(lane,-bridge.halfWidth+.5,bridge.halfWidth-.5));
        s.spawn=s.launch.clone().add(new THREE.Vector3(0,GHOST_SPAWN_HEIGHT,0));
        s.position.copy(s.spawn);s.target.copy(player.position);
        notify(player,'Ghost incoming — move sideways to dodge the red marker!');
      }
    }
    for(const s of states){
      if(s.phase==='idle')continue;
      s.age+=dt;
      if(s.phase==='warning'){
        s.position.lerpVectors(s.spawn,s.launch,THREE.MathUtils.smoothstep(s.age/GHOST_WARNING_TIME,0,1));
        // Track only during the early wind-up; leave 0.65 seconds of fixed warning.
        if(s.age<GHOST_WARNING_TIME-.65){s.target.copy(player.position);}
        if(s.age>=GHOST_WARNING_TIME){
          s.start=s.position.clone();
          const direction=s.target.clone().sub(s.start).normalize();
          s.end=s.target.clone().addScaledVector(direction,4);
          s.duration=s.start.distanceTo(s.end)/15;s.phase='swoop';s.age=0;
        }
      }else if(s.phase==='swoop'){
        const previous=s.position.clone();
        s.position.lerpVectors(s.start,s.end,Math.min(1,s.age/s.duration));
        const closest=new THREE.Line3(previous,s.position).closestPointToPoint(player.position,true,new THREE.Vector3());
        if(!s.hit&&Math.hypot(closest.x-player.position.x,closest.z-player.position.z)<HIT_RADIUS&&Math.abs(closest.y-player.position.y)<1.1){
          s.hit=true;player.ghostSlowdown=1.2;notify(player,'Ghost hit — briefly slowed. Keep moving!');
        }
        if(s.age>=s.duration){if(!s.hit)notify(player,'Dodged!');s.phase='return';s.age=0;s.start=s.position.clone();}
      }else if(s.phase==='return'){
        s.position.lerpVectors(s.start,s.spawn,Math.min(1,s.age/.9));
        if(s.age>=.9){s.phase='idle';s.cooldown=12;gap=3;}
      }
    }
  }};
}

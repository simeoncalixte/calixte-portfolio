import * as THREE from 'three';

const world = bone => bone.getWorldPosition(new THREE.Vector3());
function pointBone(bone, end, target) {
  const origin=world(bone), from=world(end).sub(origin).normalize(), to=target.clone().sub(origin).normalize();
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false,true);
}
function setWorldPosition(bone, target) {
  bone.position.copy(bone.parent.worldToLocal(target.clone()));
  bone.updateWorldMatrix(false,true);
}

/** Additive kneeling pose with a hand target attached to the dog's animated head. */
export class PettingPose {
  constructor(model) {
    this.model=model;
    this.saved=[];
    model.traverse(bone=>{if(bone.isBone)this.saved.push({bone,p:bone.position.clone(),q:bone.quaternion.clone()});});
    this.offset=model.position.clone();
  }
  restore() {
    for(const {bone,p,q} of this.saved){bone.position.copy(p);bone.quaternion.copy(q);}
    this.model.position.copy(this.offset);
  }
  apply(weight,target,root,meditating=false) {
    const model=this.model;
    const mixamo=!!model.getObjectByName('mixamorigHips');
    const aliases={UpperLeg:'UpLeg',LowerLeg:'Leg',Foot:'Foot',UpperArm:'Arm',LowerArm:'ForeArm',Shoulder:'Shoulder',Middle1:'HandMiddle1'};
    const get=name=>{
      if(!mixamo)return model.getObjectByName(name.replaceAll('.',''));
      const [part,side]=name.replace('_end','').split('.');
      return model.getObjectByName('mixamorig'+(side==='L'?'Left':'Right')+(name.includes('_end')?'Foot':aliases[part]));
    };
    for(const entry of this.saved){entry.p.copy(entry.bone.position);entry.q.copy(entry.bone.quaternion);}
    this.offset.copy(model.position);
    model.updateWorldMatrix(true,true);
    const feet=['L','R'].map(side=>world(get(`Foot.${side}`)));
    model.position.y-=(meditating?.67:.48)*weight;
    model.updateWorldMatrix(true,true);
    for(const [i,side] of ['L','R'].entries()){
      const upper=get(`UpperLeg.${side}`),lower=get(`LowerLeg.${side}`),end=get(`LowerLeg.${side}_end`);
      const hip=world(upper), knee=world(lower), ankle=world(end);
      const a=hip.distanceTo(knee), b=knee.distanceTo(ankle);
      const local=meditating?new THREE.Vector3(side==='L'?-.17:.17,.12,.28):new THREE.Vector3(side==='L'?.16:-.16,.08,side==='L'?.35:-.38);
      const goal=root.localToWorld(local).lerp(ankle,1-weight);
      const axis=goal.clone().sub(hip), d=THREE.MathUtils.clamp(axis.length(),.001,a+b-.001);axis.normalize();
      const pole=new THREE.Vector3(meditating?(side==='L'?1:-1):0,0,1).transformDirection(root.matrixWorld);
      pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const along=(a*a-b*b+d*d)/(2*d), height=Math.sqrt(Math.max(0,a*a-along*along));
      pointBone(upper,lower,hip.clone().addScaledVector(axis,along).addScaledVector(pole,height));
      pointBone(lower,end,goal);
      const foot=get(`Foot.${side}`);
      // This rig's feet are separate from its leg chains.
      if(!mixamo)setWorldPosition(foot,feet[i].clone().lerp(goal,weight));
      else {
        // EMA's foot belongs to the leg chain: preserve its length and level the sole.
        const facing=root.getWorldQuaternion(new THREE.Quaternion());
        const forward=new THREE.Vector3(0,0,1).applyQuaternion(facing);
        const toe=model.getObjectByName('mixamorig'+(side==='L'?'Left':'Right')+'ToeBase');
        const goalToe=world(foot).add(forward.multiplyScalar(world(foot).distanceTo(world(toe))));
        pointBone(foot,toe,goalToe);
      }
    }
    if(meditating){
      for(const side of ['L','R']){
        const hand=get(`Middle1.${side}`);
        const goal=world(hand).lerp(root.localToWorld(new THREE.Vector3(side==='L'?.34:-.34,.34,.28)),weight);
        for(let i=0;i<12;i++)for(const name of [`LowerArm.${side}`,`UpperArm.${side}`,`Shoulder.${side}`])pointBone(get(name),hand,goal);
      }
      return;
    }
    const hand=get('Middle1.R');
    const goal=world(hand).lerp(target,weight);
    for(let i=0;i<12;i++)for(const name of ['LowerArm.R','UpperArm.R','Shoulder.R'])pointBone(get(name),hand,goal);
    this.contactError=world(hand).distanceTo(target);
  }
}

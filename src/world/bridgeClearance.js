/** Keep a full-width approach seven metres into both islands, including prop extents. */
export function overlapsBridgeRoute(bounds, bridges, approach = 7, margin = 1) {
  if(bounds.isEmpty())return false;
  const x=(bounds.min.x+bounds.max.x)/2,z=(bounds.min.z+bounds.max.z)/2;
  const hx=(bounds.max.x-bounds.min.x)/2,hz=(bounds.max.z-bounds.min.z)/2;
  return bridges.some(br=>{
    const length=Math.hypot(br.pb.x-br.pa.x,br.pb.z-br.pa.z);
    const ux=(br.pb.x-br.pa.x)/length,uz=(br.pb.z-br.pa.z)/length;
    const dx=x-br.pa.x,dz=z-br.pa.z;
    const along=dx*ux+dz*uz,across=-dx*uz+dz*ux;
    const alongRadius=Math.abs(ux)*hx+Math.abs(uz)*hz;
    const acrossRadius=Math.abs(uz)*hx+Math.abs(ux)*hz;
    return along+alongRadius>=-approach && along-alongRadius<=length+approach && Math.abs(across)<=br.halfWidth+margin+acrossRadius;
  });
}

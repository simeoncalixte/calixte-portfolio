"""Rebuild the original bridge wraith in Blender, including its two flight clips."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'public/assets/character/ghost')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.85
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
cloth=mat('Ivory_Gauze',(.72,.74,.69),.18);edge=mat('Gauze_Outer',(.86,.86,.80),.2)
void=mat('Face_Void',(.0001,.0001,.0001));bone=mat('Aged_Bone',(.22,.24,.21))
void.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=0
iron=mat('Chain_Iron',(.035,.043,.042));brass=mat('Lantern_Brass',(.16,.105,.035));flame=mat('Lantern_Flame',(1,.24,.018),3)
objects=[]
def coord(p): return (p[0],-p[2],p[1])
def mesh(name,verts,faces,material,joint='Spine'):
 me=bpy.data.meshes.new(name);me.from_pydata([coord(v) for v in verts],[],faces);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 objects.append((ob,joint));return ob
def oval(name,pos,scale,material,joint='Spine'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=coord(pos));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 objects.append((o,joint));return o
def tube(name,points,radii,material,joint='Spine'):
 verts=[];faces=[];n=10
 for i,p in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)]);tangent.normalize();u=tangent.cross(Vector((0,0,1))).normalized();v=tangent.cross(u)
  for k in range(n):verts.append(Vector(p)+radii[i]*(u*math.cos(k*math.tau/n)+v*math.sin(k*math.tau/n)))
 for i in range(len(points)-1):
  for k in range(n):a=i*n+k;b=i*n+(k+1)%n;faces.append((a,b,b+n,a+n))
 faces.extend([tuple(reversed(range(n))),tuple((len(points)-1)*n+k for k in range(n))]);return mesh(name,verts,faces,material,joint)
# Layered cloth, with fine wrinkles and uneven hanging strips.
verts=[];faces=[];N=96;ROWS=28
for row in range(ROWS):
 t=row/(ROWS-1);y=.22+t*2.58
 r=.7-.24*t+.22*math.exp(-((t-.78)/.16)**2)
 for k in range(N):
  a=k*math.tau/N;fold=.038*math.sin(a*17+t*2)+.018*math.sin(a*31-t*4)
  yy=y+(1-t)**5*(.20*math.sin(a*7)+.10*math.sin(a*13))
  verts.append(((r+fold)*math.cos(a),yy,(r+fold)*.62*math.sin(a)))
for row in range(ROWS-1):
 for k in range(N):a=row*N+k;b=row*N+(k+1)%N;faces.append((a,b,b+N,a+N))
mesh('Wrinkled inner shroud',verts,faces,cloth)
# Narrow overlapping drapes leave an irregular, wispy silhouette.
for strip in range(18):
 a=strip*math.tau/18;verts=[];faces=[]
 for j in range(25):
  t=j/24;y=2.7-t*(2.4+.36*math.sin(strip*2.31))
  radius=.48+.19*t
  for k in range(7):
   u=k/6-.5;theta=a+u*.43*(1-.65*t**4)
   rr=radius+.035*math.sin(u*18+t*9+strip)+.025*math.sin(t*24+strip)
   verts.append((rr*math.cos(theta),y+.025*math.sin(t*37+u*8),rr*.68*math.sin(theta)))
 for j in range(24):
  for k in range(6):n=j*7+k;faces.append((n,n+1,n+8,n+7))
 mesh('Trailing gauze %02d'%strip,verts,faces,edge if strip%3 else cloth)
# Hood is an actual opening surrounded by thick draped cloth, with a black cavity.
oval('Hood backing',(0,3.04,-.12),(.53,.76,.37),cloth)
oval('Featureless black cavity',(0,3.02,.335),(.355,.465,.018),void)
verts=[];faces=[];N=80
for j in range(9):
 t=j/8
 for k in range(N):
  a=k*math.tau/N;w=.35+.21*t;h=.46+.30*t
  wrinkle=.013*math.sin(a*23+t*5)+.01*math.sin(a*37)
  x=(w+wrinkle)*math.cos(a);y=3.02+(h+wrinkle)*math.sin(a)
  y+=t*.12*max(0,math.sin(a))**7
  z=.38-.37*t*t+.022*math.sin(a*11+t*4)
  verts.append((x,y,z))
for j in range(8):
 for k in range(N):n=j*N+k;m=j*N+(k+1)%N;faces.append((n,m,m+N,n+N))
mesh('Deep folded faceless hood',verts,faces,edge)
for side in [-1,1]:
 joint='ArmL' if side<0 else 'ArmR';handY=1.94 if side<0 else 1.60
 tube('Draped sleeve',[(side*.48,2.5,0),(side*.77,2.28,.08),(side*.91,handY+.13,.30)],[.29,.26,.13],cloth,joint)
 # Loose sheet hangs below each sleeve.
 verts=[];faces=[]
 for j in range(20):
  t=j/19
  for k in range(10):
   u=k/9;verts.append((side*(.57+u*.46+.04*math.sin(t*15+u*8)),2.35-t*(1.6+.18*math.sin(u*9))-.28*u,.02+.20*u+.035*math.sin(u*25+t*3)))
 for j in range(19):
  for k in range(9):n=j*10+k;faces.append((n,n+1,n+11,n+10))
 mesh('Hanging sleeve gauze',verts,faces,edge,joint)
 oval('Skeletal palm',(side*.93,handY,.38),(.11,.12,.045),bone,joint)
 for f in range(4):
  x=side*(.85+f*.052)
  tube('Articulated bony finger',[(x,handY,.41),(x+side*.025,handY-.13,.46),(x+side*.03,handY-.21,.55)],[.018,.014,.007],bone,joint)
  oval('Knuckle',(x+side*.025,handY-.13,.46),(.024,.024,.024),bone,joint)
 tube('Skeletal thumb',[(side*.84,handY+.03,.4),(side*.76,handY-.04,.49),(side*.78,handY-.12,.54)],[.025,.021,.009],bone,joint)
# A drooping chain and warm lantern echo the reference silhouette.
for i in range(29):
 t=i/28;x=-.93+1.86*t;y=1.94-.34*t-.62*math.sin(math.pi*t)
 bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=6,location=coord((x,y,.51)),major_radius=.043,minor_radius=.009)
 ob=bpy.context.object;ob.name='Hanging chain link';ob.scale=(1.4,1,1);ob.rotation_euler=(math.pi/2,0,(i%2)*math.pi/2);ob.data.materials.append(iron);objects.append((ob,'Spine'))
# Lantern hangs at the lower hand, with an open metal cage and emissive core.
for y,r in [(1.04,.17),(.60,.18)]:oval('Lantern metal cap',(.98,y,.50),(r,.055,r),brass,'ArmR')
oval('Warm lantern light',(.98,.80,.50),(.06,.15,.06),flame,'ArmR')
for dx,dz in [(-.12,-.09),(.12,-.09),(-.12,.09),(.12,.09)]:
 tube('Lantern cage',[(.98+dx,.63,.50+dz),(.98+dx,.99,.50+dz)],[.013,.013],iron,'ArmR')
tube('Lantern handle',[(.86,1.03,.50),(.86,1.28,.50),(.98,1.37,.50),(1.10,1.28,.50),(1.10,1.03,.50)],[.012]*5,iron,'ArmR')
# Skeleton: all pieces are skinned, with independent arm motion.
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='BridgeWraith'
bpy.ops.object.mode_set(mode='EDIT');bones=rig.data.edit_bones;bones.remove(bones[0])
for name,head,tail,parent in [('Spine',(0,1,0),(0,2.3,0),None),('ArmL',(-.5,2.35,0),(-1.3,1.9,.3),'Spine'),('ArmR',(.5,2.35,0),(1.3,1.9,.3),'Spine')]:
 b=bones.new(name);b.head=coord(head);b.tail=coord(tail)
 if parent:b.parent=bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for ob,joint in objects:
 vg=ob.vertex_groups.new(name=joint);vg.add(list(range(len(ob.data.vertices))),1,'REPLACE');mod=ob.modifiers.new('Spectral rig','ARMATURE');mod.object=rig;ob.parent=rig
for title,amplitude in [('Flying_Idle',.035),('Fast_Flying',.075)]:
 rig.animation_data_create();action=bpy.data.actions.new('Ghost|'+title);rig.animation_data.action=action
 for frame,phase in [(1,0),(16,math.pi/2),(31,math.pi),(46,math.pi*1.5),(61,math.tau)]:
  for name in ['Spine','ArmL','ArmR']:
   b=rig.pose.bones[name];b.rotation_mode='XYZ';sgn=-1 if name=='ArmL' else 1
   b.rotation_euler=(.04*math.sin(phase) if name=='Spine' else amplitude*math.sin(phase)*sgn,0,0)
   b.keyframe_insert(data_path='rotation_euler',frame=frame)
 track=rig.animation_data.nla_tracks.new();track.name='Ghost|'+title;track.strips.new(action.name,1,action);rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
bpy.context.scene.frame_set(1)
for b in rig.pose.bones:b.rotation_euler=(0,0,0)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for ob,_ in objects:ob.select_set(True)
# Export tracks together; equal track names are the public animation contract.
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'ghost.glb'),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS')
for track in rig.animation_data.nla_tracks:track.mute=True
# Studio preview saved with the editable source.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.025,.025,.025)
bpy.ops.object.camera_add(location=(3,-10,3.5));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.8))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4.8;scene.camera=camera
for location,power,size in [((2,-4,6),650,5),((-3,1,4),900,4)]:
 bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,2))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(OUT,'preview.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'scripts/art/bridge-wraith.blend'))
bpy.ops.render.render(write_still=True)

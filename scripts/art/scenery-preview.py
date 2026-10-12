import bpy
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath='/tmp/ai-shrine.glb')
for i,x,y in [(1,-5,2),(2,5,3),(3,-7,6),(4,8,6)]:
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=f'public/assets/trees/canopy-{i}.glb')
 objs=set(bpy.data.objects)-before
 corners=[o.matrix_world@Vector(c) for o in objs if o.type=='MESH' for c in o.bound_box]
 lo=min(c.z for c in corners);hi=max(c.z for c in corners)
 bpy.ops.object.empty_add();root=bpy.context.object
 for o in objs:
  if o.parent not in objs:o.parent=root
 root.scale=(7/(hi-lo),)*3;root.location=(x,y,-lo*root.scale.z)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08));ground=bpy.context.object
mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.09,.14,.10,1);ground.data.materials.append(mat)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(13,-20,13));camera=bpy.context.object;aim(camera,(0,1,2));camera.data.type='ORTHO';camera.data.ortho_scale=23;bpy.context.scene.camera=camera
for pos,e,size,col in [((2,-8,14),2300,8,(1,.8,.6)),((-8,-2,9),1800,8,(.6,.75,1))]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=e;o.data.size=size;o.data.color=col;aim(o,(0,0,2))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.world.color=(.2,.2,.2);s.render.resolution_x=1200;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.filepath='/tmp/scenery-preview.png';bpy.ops.render.render(write_still=True)

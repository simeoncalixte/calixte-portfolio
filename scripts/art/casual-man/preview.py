import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
import sys
pose=sys.argv[-1] if '--' in sys.argv else 'idle'
bpy.ops.import_scene.gltf(filepath='/tmp/casual-man-'+pose+'.glb')
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));plane=bpy.context.object
mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.12,.15,.18,1);plane.data.materials.append(mat)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.5,-4.7,2.2));camera=bpy.context.object;aim(camera,(0,0,.95));camera.data.type='ORTHO';camera.data.ortho_scale=2.2;bpy.context.scene.camera=camera
for pos,energy,size in [((3,-4,6),800,4),((-3,-2,3),500,3),((1,3,4),900,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.world.color=(.3,.3,.3);s.render.resolution_x=700;s.render.resolution_y=800;s.render.resolution_percentage=100
s.render.filepath='/tmp/casual-man-'+pose+'.png';bpy.ops.render.render(write_still=True)

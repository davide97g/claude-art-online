# Run the townsfolk builder in EXPORT mode -> public/assets/models/npc/*.glb
# Usage: python3 blender/blender_client.py exec blender/npc_export.py
MODE = 'export'
exec(open('/Users/davideghiotto/Desktop/projects/claude-art-online/blender/npc_build.py').read())

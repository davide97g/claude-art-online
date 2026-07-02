# Run the boss builder in EXPORT mode -> public/assets/models/boss_kobold.glb
# Usage: python3 blender/blender_client.py exec blender/boss_export.py
MODE = 'export'
exec(open('/Users/davideghiotto/Desktop/projects/claude-art-online/blender/boss_build.py').read())

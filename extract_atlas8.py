from PIL import Image
from pathlib import Path
import numpy as np
root=Path('/mnt/data/Void_Walker_Final_Repair/assets')
atlas=Image.open(root/'reference_atlases/reference_08_a_high_resolution_character_and_assets_sheet_in_da.png').convert('RGBA')
out=root/'sprites'
# Sprite boxes measured from the actual high-resolution sheet. These are isolated poses/props.
boxes={
'hero_idle_01':(414,30,470,118),'hero_idle_02':(486,30,542,118),'hero_idle_03':(548,32,602,116),
'hero_walk_01':(412,128,468,207),'hero_walk_02':(474,128,530,207),'hero_walk_03':(532,128,588,207),'hero_walk_04':(590,128,646,207),
'hero_attack_01':(410,215,490,310),'hero_attack_02':(490,215,565,310),'hero_attack_03':(560,215,640,310),'hero_attack_04':(635,215,720,310),
'hero_hurt_01':(412,415,480,500),'hero_hurt_02':(480,415,550,500),
'black_eel':(815,42,960,205),'amphibian_minion':(975,48,1118,180),'amphibian_warden':(1120,40,1290,205),
'darkling_01':(850,235,960,420),'darkling_02':(850,235,960,420),'nail_witch':(970,225,1195,430),
'void_demon_phase1':(1205,35,1535,440),'void_demon_phase2':(1205,35,1535,440),
'void_spiral_orb':(1130,415,1225,555),
'void_crate':(12,865,102,960),'void_crate_broken':(260,950,375,1020),
'healing_potion':(1260,895,1305,965),'void_potion':(1305,895,1350,965),
'armor_set_01':(1225,430,1305,565),'armor_set_02':(1300,430,1380,565),'armor_set_03':(1370,430,1450,565),'armor_set_04':(1440,430,1525,565),
'dead_tree':(725,855,840,1010),'stone_pillar':(635,855,690,1005),'void_crystal':(830,850,965,1015),
'ground_tile_01':(10,575,280,850),'ground_tile_02':(285,575,555,850),'ground_tile_03':(560,575,805,850),'ground_tile_04':(810,575,1080,850),
'portal_arch':(945,870,1105,1015),
}
for name,box in boxes.items():
 c=atlas.crop(box);a=np.array(c);alpha=a[:,:,3].astype(np.float32)
 # The sheet has a translucent purple backdrop; retain foreground and antialiasing, discard the haze.
 alpha=np.clip((alpha-24)*255/225,0,255);a[:,:,3]=alpha.astype('uint8');c=Image.fromarray(a,'RGBA')
 arr=np.array(c); yy,xx=np.where(arr[:,:,3]>12)
 if len(xx):
  pad=3;l=max(0,int(xx.min())-pad);r=min(c.width,int(xx.max())+pad+1);t=max(0,int(yy.min())-pad);b=min(c.height,int(yy.max())+pad+1);c=c.crop((l,t,r,b))
 c.save(out/f'{name}.png')
print('atlas 8 assets extracted')

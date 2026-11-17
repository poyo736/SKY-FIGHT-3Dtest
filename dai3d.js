// SKY FIGHT: optional 3D Dai renderer. The original 2D battle remains a fallback.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const arena = document.getElementById('arena');
const wrap = arena?.parentElement;
const button = document.createElement('button');
button.type = 'button';
button.className = 'dai-3d-toggle';
button.textContent = '🎮 ダイ3D: 読込中';
button.disabled = true;
button.title = 'ダイの3Dモデル表示を切り替えます';
wrap?.appendChild(button);

const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(1000,520,false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.className = 'dai-3d-layer';
renderer.domElement.setAttribute('aria-hidden','true');
wrap?.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-5,5,2.6,-2.6,.1,100);
camera.position.set(0,0,15); camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x8b9ac7,2.6));
const key = new THREE.DirectionalLight(0xffffff,2.4); key.position.set(-3,7,9); scene.add(key);
const fill = new THREE.DirectionalLight(0x9dbaff,1.2); fill.position.set(4,3,-4); scene.add(fill);
let model, mixer, active, currentClip = '', enabled = true;
const clips = {};
const names = {idle:'DAI_Idle',run:'DAI_RUN',jump:'DAI_Jump',punch:'DAI_Punch',kick:'DAI_Kick',hit:'DAI_Damage'};
function setClip(name){
  const next = clips[name] || clips.DAI_Idle;
  if(!next || currentClip === name)return;
  if(active)active.fadeOut(.10);
  const action = mixer.clipAction(next);
  action.reset().fadeIn(.10).play();
  if(['DAI_Punch','DAI_Kick','DAI_Damage','DAI_Jump'].includes(name)){
    action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
  }else{action.setLoop(THREE.LoopRepeat,Infinity);action.clampWhenFinished=false;}
  active=action;currentClip=name;
}
button.addEventListener('click',()=>{
 enabled=!enabled;
 button.textContent = enabled ? '🎮 ダイ3D: ON' : '🎮 ダイ3D: OFF';
 renderer.domElement.style.display = enabled ? '' : 'none';
});
new GLTFLoader().load('./assets/DAI_animated.glb', gltf=>{
  model = gltf.scene;
  // Normalize model height and center on its own ground plane.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y) || size.y <= 0)throw Error('Invalid model bounds');
  const center = box.getCenter(new THREE.Vector3());
  const scale = 1.8 / size.y;
  const pivot = new THREE.Group();
  model.position.set(-center.x, -box.min.y, -center.z);
  pivot.scale.setScalar(scale);
  pivot.add(model);
  scene.add(pivot);
  model.userData.pivot = pivot;
  mixer = new THREE.AnimationMixer(model);
  for(const clip of gltf.animations)clips[clip.name]=clip;
  if(!clips.DAI_Idle)throw Error('DAI_Idle not found');
  setClip('DAI_Idle');
  button.disabled=false;
  button.textContent='🎮 ダイ3D: ON';
  window.SkyDai3D = {
    isReady:()=>enabled && !!model,
    draw(match,dt){
      if(!enabled || !model || !match)return;
      const f = match.p?.f.id === 'dai' ? match.p : match.c?.f.id === 'dai' ? match.c : null;
      if(!f){renderer.clear();return;}
      const state = names[f.animState] || 'DAI_Idle';
      setClip(state);
      mixer.update(Math.min(dt||0,.05));
      const pivot=model.userData.pivot;
      pivot.position.set((f.x-500)/100,(432-f.y)/100-1.72,0);
      // Face right by default; turn towards opponent based on combat state.
      pivot.rotation.y = f.facing > 0 ? Math.PI/2 : -Math.PI/2;
      renderer.render(scene,camera);
    },
    hasDai(match){return !!match && (match.p?.f.id==='dai'||match.c?.f.id==='dai');}
  };
  console.info('SKY FIGHT Dai 3D loaded',Object.keys(clips));
}, undefined, err=>{
  button.textContent='ダイ3D: 読込失敗（2Dで継続）';
  button.title=String(err);
  renderer.domElement.style.display='none';
  console.error('Dai 3D failed; using 2D fallback',err);
});

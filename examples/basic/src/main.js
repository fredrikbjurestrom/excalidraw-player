import { defineExcalidrawPlayer } from 'excalidraw-player';

defineExcalidrawPlayer();

const player = document.querySelector('excalidraw-player');
player?.setAttribute('src', `${import.meta.env.BASE_URL}presentation.yaml`);
const params = new URLSearchParams(location.search);
if (params.get('menu') === 'hidden') player?.toggleMenu(true);
player?.addEventListener('playerready', () => {
  const scene = Number(params.get('scene') ?? 0);
  const step = Number(params.get('step') ?? 0);
  if (scene || step) void player.goTo(scene, step, false);
}, { once: true });

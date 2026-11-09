const path = require('path'); const fs = require('fs');
const audio = require('C:/Users/david/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools');
const PROJECT_ASSETS_SFX = 'C:/Users/david/DevCenter/SPECS/SourceCode/drone-hud/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });
function render() {
  const SR = audio.SAMPLE_RATE;
  // One soft chime: a single bell strike (G5) with a quiet octave-fifth shimmer partial, mono for spatial playback
  const main = audio.synth_voices.bell(79, 3, 70, 120);
  const shimmer = audio.synth_voices.bell(91, 2, 40, 120);
  const out = new Float32Array(Math.floor(1.8 * SR));
  audio.addInto(out, main, 0, 0.8);
  audio.addInto(out, shimmer, Math.floor(0.004 * SR), 0.18);
  audio.humanize.ampWobble(out, 0.4, 0.05);
  const soft = audio.mix_bus.applyFx(out, { hpf: 180, lpf: 6000, gain: 0.8 });
  audio.fadeOut(soft, 0.25);
  return soft;
}
const result = render();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'FlightChime.wav'));
console.log('ok', result.length || (result.left && result.left.length));

// C entry points the AudioWorklet calls. Built as a standalone .wasm with no JS glue:
// the worklet instantiates it directly and reads audio from the two output buffers.

#include <emscripten/emscripten.h>

#include "sdc/synth.h"

namespace
{
sdc::Synth synth;
float outLeft[sdc::Synth::maxBlock];
float outRight[sdc::Synth::maxBlock];
} // namespace

extern "C"
{
EMSCRIPTEN_KEEPALIVE void sdc_init(float sampleRate) { synth.setSampleRate(sampleRate); }

EMSCRIPTEN_KEEPALIVE void sdc_note_on(int note, float velocity) { synth.noteOn(note, velocity); }
EMSCRIPTEN_KEEPALIVE void sdc_note_off(int note) { synth.noteOff(note); }
EMSCRIPTEN_KEEPALIVE void sdc_all_notes_off() { synth.allNotesOff(); }

EMSCRIPTEN_KEEPALIVE void sdc_set_param(int id, float value) { synth.setParam((sdc::Param) id, value); }

EMSCRIPTEN_KEEPALIVE void sdc_set_wave_point(int osc, int index, float x, float y)
{
    synth.setWavePoint(osc, index, x, y);
}

/** Renders up to maxBlock frames into the buffers returned by sdc_left/sdc_right. */
EMSCRIPTEN_KEEPALIVE void sdc_process(int numFrames)
{
    if (numFrames > sdc::Synth::maxBlock)
        numFrames = sdc::Synth::maxBlock;
    synth.process(outLeft, outRight, numFrames);
}

EMSCRIPTEN_KEEPALIVE float* sdc_left() { return outLeft; }
EMSCRIPTEN_KEEPALIVE float* sdc_right() { return outRight; }
EMSCRIPTEN_KEEPALIVE int sdc_active_voices() { return synth.activeVoiceCount(); }
EMSCRIPTEN_KEEPALIVE int sdc_is_looping() { return synth.isLooping() ? 1 : 0; }
}

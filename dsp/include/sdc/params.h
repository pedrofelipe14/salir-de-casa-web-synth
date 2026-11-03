#pragma once

// Every parameter the engine understands. The web UI mirrors this list in
// web/src/engine/params.ts, so the order here must stay in sync with it.

namespace sdc
{
enum class Param : int
{
    osc1Wave, osc1Level, osc1Octave, osc1Semitone, osc1Fine,
    osc2Wave, osc2Level, osc2Octave, osc2Semitone, osc2Fine,
    attack, decay, sustain, release,
    cutoff, resonance, filterEnv,
    lfoShape, lfoTarget, lfoRate, lfoDepth,
    delayMix, delayTime, delayFeedback,
    volume,
    count
};

struct ParamInfo
{
    float min, max, defaultValue;
};

// Units: seconds for envelope times and delay, Hz for cutoff and LFO rate,
// semitones for filterEnv, cents for fine tuning, dB for volume, 0..1 otherwise.
inline constexpr ParamInfo paramInfo[(int) Param::count] = {
    { 0, 4, 1 },  { 0, 1, 1 },    { -3, 3, 0 }, { -12, 12, 0 }, { -50, 50, 0 },   // osc 1
    { 0, 4, 1 },  { 0, 1, 0 },    { -3, 3, 0 }, { -12, 12, 0 }, { -50, 50, 7 },   // osc 2
    { 0.001f, 5, 0.01f }, { 0.001f, 5, 0.1f }, { 0, 1, 0.8f }, { 0.001f, 5, 0.3f },
    { 20, 20000, 4000 }, { 0.1f, 10, 0.7f }, { -48, 48, 24 },
    { 0, 4, 0 }, { 0, 2, 0 }, { 0.05f, 20, 4 }, { 0, 1, 0 },
    { 0, 1, 0.2f }, { 0.02f, 1.5f, 0.35f }, { 0, 0.95f, 0.4f },
    { -48, 6, -6 },
};

inline float clampParam(Param p, float value)
{
    const auto& info = paramInfo[(int) p];
    return value < info.min ? info.min : (value > info.max ? info.max : value);
}
} // namespace sdc

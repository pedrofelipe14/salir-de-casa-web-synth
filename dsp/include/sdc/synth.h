#pragma once

#include <array>
#include <cmath>
#include <vector>

#include "glitch.h"
#include "params.h"
#include "voice.h"
#include "wet.h"

namespace sdc
{
/** The whole instrument, wired like the VST3's processBlock:
    8 voices → (wet first?) → micro-loop (when Auto-Glitch is on) → (wet last?) → volume → soft limiter.
    Not thread-safe: in the browser it lives entirely inside the AudioWorklet. */
class Synth
{
public:
    static constexpr int numVoices = 8;
    static constexpr int maxBlock = 512;

    Synth()
    {
        for (int p = 0; p < (int) Param::count; ++p)
            values[(size_t) p] = paramInfo[p].defaultValue;
        settings.customWave[0] = &customWaves[0];
        settings.customWave[1] = &customWaves[1];
        setSampleRate(48000.0);
        updateSettings();
    }

    void setSampleRate(double sr)
    {
        sampleRate = sr;
        for (auto& v : voices)
            v.setSampleRate(sr);
        wet.prepare(sr, maxBlock);
        glitch.prepare(sr);
        gainCoeff = (float) std::exp(-1.0 / (0.02 * sr)); // ~20 ms volume smoothing
    }

    float getParam(Param p) const { return values[(size_t) p]; }

    void setParam(Param p, float value)
    {
        if ((int) p < 0 || p >= Param::count || value != value) // ignore unknown ids and NaN
            return;
        values[(size_t) p] = clampParam(p, value);
        updateSettings();
    }

    void setWavePoint(int osc, int index, float x, float y)
    {
        if (osc == 0 || osc == 1)
            customWaves[osc].setPoint(index, { x, y });
    }

    const CustomWave& getWave(int osc) const { return customWaves[osc == 1 ? 1 : 0]; }

    void noteOn(int note, float velocity)
    {
        if (note < 0 || note > 127)
            return;

        // Same note again: reuse its voice rather than stacking a second copy.
        Voice* target = nullptr;
        for (auto& v : voices)
            if (v.isActive() && v.getNote() == note)
                target = &v;

        if (target == nullptr)
            for (auto& v : voices)
                if (!v.isActive())
                {
                    target = &v;
                    break;
                }

        // All busy: steal, preferring voices already releasing, then the oldest.
        if (target == nullptr)
        {
            for (auto& v : voices)
            {
                if (target == nullptr
                    || (v.isReleasing() && !target->isReleasing())
                    || (v.isReleasing() == target->isReleasing() && v.getStartOrder() < target->getStartOrder()))
                    target = &v;
            }
        }

        target->start(note, velocity < 0.0f ? 0.0f : (velocity > 1.0f ? 1.0f : velocity), ++startCounter);
    }

    void noteOff(int note)
    {
        for (auto& v : voices)
            if (v.isActive() && !v.isReleasing() && v.getNote() == note)
                v.release();
    }

    void allNotesOff()
    {
        for (auto& v : voices)
            v.release();
    }

    int activeVoiceCount() const
    {
        int n = 0;
        for (const auto& v : voices)
            n += v.isActive() ? 1 : 0;
        return n;
    }

    bool isLooping() const { return glitch.isLooping(); }

    /** Renders numSamples (split internally into blocks of maxBlock) into left and right. */
    void process(float* left, float* right, int numSamples)
    {
        while (numSamples > 0)
        {
            const int n = numSamples < maxBlock ? numSamples : maxBlock;
            processBlock(left, right, n);
            left += n;
            right += n;
            numSamples -= n;
        }
    }

private:
    void processBlock(float* left, float* right, int n)
    {
        for (int i = 0; i < n; ++i)
            left[i] = 0.0f;
        for (auto& v : voices)
            if (v.isActive())
                v.render(settings, left, n);
        for (int i = 0; i < n; ++i)
            right[i] = left[i];

        const bool wetFirst = values[(size_t) Param::routeOrder] > 0.5f;
        const bool autoGlitch = values[(size_t) Param::autoGlitch] > 0.5f;

        if (wetFirst)
            wet.process(left, right, n);
        if (autoGlitch)
            glitch.process(left, right, n);
        if (!wetFirst)
            wet.process(left, right, n);

        const float targetGain = std::pow(10.0f, values[(size_t) Param::volume] / 20.0f);
        for (int i = 0; i < n; ++i)
        {
            gain = targetGain + gainCoeff * (gain - targetGain);
            // Soft limiter: loud chords saturate gently instead of hard-clipping.
            left[i] = std::tanh(left[i] * gain);
            right[i] = std::tanh(right[i] * gain);
        }
    }

    void updateSettings()
    {
        const auto v = [this](Param p) { return values[(size_t) p]; };
        const auto index = [&](Param p) { return (int) std::lround(v(p)); };

        settings.wave[0] = (Wave) index(Param::osc1Wave);
        settings.wave[1] = (Wave) index(Param::osc2Wave);
        settings.level[0] = v(Param::osc1Level);
        settings.level[1] = v(Param::osc2Level);
        settings.pitchOffset[0] = 12.0f * (float) index(Param::osc1Octave) + (float) index(Param::osc1Semitone) + v(Param::osc1Fine) / 100.0f;
        settings.pitchOffset[1] = 12.0f * (float) index(Param::osc2Octave) + (float) index(Param::osc2Semitone) + v(Param::osc2Fine) / 100.0f;
        settings.cutoff = v(Param::cutoff);
        settings.resonance = v(Param::resonance);
        settings.filterEnv = v(Param::filterEnv);
        settings.lfoShape = (LfoShape) index(Param::lfoShape);
        settings.lfoTarget = (LfoTarget) index(Param::lfoTarget);
        settings.lfoRate = v(Param::lfoRate);
        settings.lfoDepth = v(Param::lfoDepth);

        for (auto& voice : voices)
            voice.getEnvelope().setParameters(v(Param::attack), v(Param::decay), v(Param::sustain), v(Param::release));

        WetEngine::Params w;
        w.mode = (WetEngine::Mode) index(Param::wetMode);
        w.mix = v(Param::wetMix);
        w.time = v(Param::wetTime);
        w.modify = v(Param::wetModify);
        wet.setParams(w);

        GlitchEngine::Params g;
        g.mix = v(Param::glitchMix);
        g.grainSizeMs = v(Param::glitchGrainSize);
        g.intervalSemitones = GlitchEngine::intervalChoices[(size_t) index(Param::loopInterval)];
        g.jumpChance = v(Param::loopJumps);
        g.holdAmount = v(Param::glitchHold);
        g.degrade = v(Param::glitchDegrade);
        g.chaos = v(Param::glitchChaos);
        g.reverseAmount = v(Param::glitchReverse);
        g.toneTilt = v(Param::glitchTilt);
        g.keepLooping = v(Param::loopKeep) > 0.5f;
        glitch.setParams(g);
    }

    double sampleRate = 48000.0;
    std::array<float, (size_t) Param::count> values {};
    VoiceSettings settings;
    std::array<CustomWave, 2> customWaves;
    std::array<Voice, numVoices> voices;
    uint32_t startCounter = 0;

    WetEngine wet;
    GlitchEngine glitch;
    float gain = 1.0f;
    float gainCoeff = 0.999f;
};
} // namespace sdc

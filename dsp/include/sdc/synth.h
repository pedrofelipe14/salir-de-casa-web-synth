#pragma once

#include <array>
#include <cmath>
#include <vector>

#include "params.h"
#include "voice.h"

namespace sdc
{
/** The whole instrument: 8 voices, a stereo ping-pong delay and a soft limiter.
    Not thread-safe: in the browser it lives entirely inside the AudioWorklet. */
class Synth
{
public:
    static constexpr int numVoices = 8;
    static constexpr int maxBlock = 512;
    static constexpr float maxDelaySeconds = 2.0f;

    Synth()
    {
        for (int p = 0; p < (int) Param::count; ++p)
            values[(size_t) p] = paramInfo[p].defaultValue;
        settings.customWave[0] = &customWaves[0];
        settings.customWave[1] = &customWaves[1];
        updateSettings();
        setSampleRate(48000.0);
    }

    void setSampleRate(double sr)
    {
        sampleRate = sr;
        for (auto& v : voices)
            v.setSampleRate(sr);
        const size_t delaySize = (size_t) (maxDelaySeconds * sr) + 4;
        delayL.assign(delaySize, 0.0f);
        delayR.assign(delaySize, 0.0f);
        writePos = 0;
        smoothCoeff = (float) std::exp(-1.0 / (0.02 * sr)); // ~20 ms for volume and delay time
        dampCoeff = (float) std::exp(-6.283185307179586 * 3500.0 / sr); // 3.5 kHz in the echoes
        smoothedDelaySamples = delaySamplesTarget();
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
            mono[(size_t) i] = 0.0f;
        for (auto& v : voices)
            if (v.isActive())
                v.render(settings, mono.data(), n);

        const float mix = values[(size_t) Param::delayMix];
        const float feedback = values[(size_t) Param::delayFeedback];
        const float targetDelay = delaySamplesTarget();
        const float targetGain = std::pow(10.0f, values[(size_t) Param::volume] / 20.0f);
        const size_t size = delayL.size();

        for (int i = 0; i < n; ++i)
        {
            smoothedDelaySamples = targetDelay + smoothCoeff * (smoothedDelaySamples - targetDelay);
            smoothedGain = targetGain + smoothCoeff * (smoothedGain - targetGain);

            // Fractional read so moving the delay time glides instead of clicking.
            float readPos = (float) writePos - smoothedDelaySamples;
            while (readPos < 0.0f)
                readPos += (float) size;
            const size_t i0 = (size_t) readPos % size;
            const size_t i1 = (i0 + 1) % size;
            const float frac = readPos - std::floor(readPos);
            const float echoL = delayL[i0] + frac * (delayL[i1] - delayL[i0]);
            const float echoR = delayR[i0] + frac * (delayR[i1] - delayR[i0]);

            dampL = echoL + dampCoeff * (dampL - echoL);
            dampR = echoR + dampCoeff * (dampR - echoR);

            const float dry = mono[(size_t) i];
            // Ping-pong: the dry signal enters on the left, each repeat crosses sides.
            delayL[writePos] = dry + feedback * dampR;
            delayR[writePos] = feedback * dampL;
            writePos = (writePos + 1) % size;

            // Soft limiter: loud chords saturate gently instead of hard-clipping.
            left[i] = std::tanh((dry + mix * echoL) * smoothedGain);
            right[i] = std::tanh((dry + mix * echoR) * smoothedGain);
        }
    }

    float delaySamplesTarget() const
    {
        return values[(size_t) Param::delayTime] * (float) sampleRate;
    }

    void updateSettings()
    {
        const auto v = [this](Param p) { return values[(size_t) p]; };

        settings.wave[0] = (Wave) (int) std::lround(v(Param::osc1Wave));
        settings.wave[1] = (Wave) (int) std::lround(v(Param::osc2Wave));
        settings.level[0] = v(Param::osc1Level);
        settings.level[1] = v(Param::osc2Level);
        settings.pitchOffset[0] = 12.0f * std::round(v(Param::osc1Octave)) + std::round(v(Param::osc1Semitone)) + v(Param::osc1Fine) / 100.0f;
        settings.pitchOffset[1] = 12.0f * std::round(v(Param::osc2Octave)) + std::round(v(Param::osc2Semitone)) + v(Param::osc2Fine) / 100.0f;
        settings.cutoff = v(Param::cutoff);
        settings.resonance = v(Param::resonance);
        settings.filterEnv = v(Param::filterEnv);
        settings.lfoShape = (LfoShape) (int) std::lround(v(Param::lfoShape));
        settings.lfoTarget = (LfoTarget) (int) std::lround(v(Param::lfoTarget));
        settings.lfoRate = v(Param::lfoRate);
        settings.lfoDepth = v(Param::lfoDepth);

        for (auto& voice : voices)
            voice.getEnvelope().setParameters(v(Param::attack), v(Param::decay), v(Param::sustain), v(Param::release));
    }

    double sampleRate = 48000.0;
    std::array<float, (size_t) Param::count> values {};
    VoiceSettings settings;
    std::array<CustomWave, 2> customWaves;
    std::array<Voice, numVoices> voices;
    std::array<float, maxBlock> mono {};
    uint32_t startCounter = 0;

    std::vector<float> delayL, delayR;
    size_t writePos = 0;
    float smoothedDelaySamples = 0.0f;
    float dampL = 0.0f, dampR = 0.0f, dampCoeff = 0.5f;
    float smoothedGain = 0.5f;
    float smoothCoeff = 0.999f;
};
} // namespace sdc

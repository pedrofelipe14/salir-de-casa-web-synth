#pragma once

#include <cmath>

namespace sdc
{
/** Topology-preserving-transform state-variable low-pass (Zavalishin / Simper).
    Stable under fast cutoff modulation, which the envelope and LFO rely on. */
class LowPassFilter
{
public:
    void setSampleRate(double sr) { sampleRate = sr; }
    void reset() { ic1 = ic2 = 0.0f; }

    float process(float input, float cutoffHz, float resonance)
    {
        const float nyquistSafe = 0.49f * (float) sampleRate;
        cutoffHz = cutoffHz < 20.0f ? 20.0f : (cutoffHz > nyquistSafe ? nyquistSafe : cutoffHz);

        const float g = std::tan(3.14159265358979f * cutoffHz / (float) sampleRate);
        const float k = 1.0f / (resonance < 0.1f ? 0.1f : resonance);
        const float a1 = 1.0f / (1.0f + g * (g + k));
        const float a2 = g * a1;
        const float a3 = g * a2;

        const float v3 = input - ic2;
        const float v1 = a1 * ic1 + a2 * v3;
        const float v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2.0f * v1 - ic1;
        ic2 = 2.0f * v2 - ic2;
        return v2;
    }

private:
    double sampleRate = 48000.0;
    float ic1 = 0.0f, ic2 = 0.0f;
};
} // namespace sdc

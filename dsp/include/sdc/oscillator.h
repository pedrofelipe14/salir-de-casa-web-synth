#pragma once

#include <cmath>

#include "custom_wave.h"

namespace sdc
{
enum class Wave : int { sine, saw, square, triangle, custom };

constexpr float twoPi = 6.28318530717958647692f;

/** PolyBLEP residual: rounds off saw/square edges so they don't alias. t is the phase, dt the increment. */
inline float polyBlep(float t, float dt)
{
    if (t < dt)
    {
        t /= dt;
        return t + t - t * t - 1.0f;
    }
    if (t > 1.0f - dt)
    {
        t = (t - 1.0f) / dt;
        return t * t + t + t + 1.0f;
    }
    return 0.0f;
}

/** The textbook shape, without anti-aliasing. phase in [0, 1). */
inline float naiveWave(Wave wave, float phase)
{
    switch (wave)
    {
        case Wave::sine:     return std::sin(phase * twoPi);
        case Wave::saw:      return 2.0f * phase - 1.0f;
        case Wave::square:   return phase < 0.5f ? 1.0f : -1.0f;
        case Wave::triangle: return 4.0f * std::fabs(phase - 0.5f) - 1.0f;
        case Wave::custom:   break;
    }
    return 0.0f;
}

/** One oscillator: a phase accumulator plus the anti-aliased shapes. */
struct Oscillator
{
    double phase = 0.0;

    void reset() { phase = 0.0; }

    /** Returns this sample and advances. increment is cycles per sample (frequency / sample rate). */
    float next(Wave wave, double increment, const CustomWave& custom)
    {
        const float p = (float) phase;
        const float dt = (float) increment;
        float out = 0.0f;

        switch (wave)
        {
            case Wave::saw:
                out = 2.0f * p - 1.0f - polyBlep(p, dt);
                break;
            case Wave::square:
            {
                float p2 = p + 0.5f;
                if (p2 >= 1.0f)
                    p2 -= 1.0f;
                out = (p < 0.5f ? 1.0f : -1.0f) + polyBlep(p, dt) - polyBlep(p2, dt);
                break;
            }
            case Wave::custom:
                out = custom.sampleAt(p);
                break;
            case Wave::sine:
            case Wave::triangle:
                out = naiveWave(wave, p);
                break;
        }

        phase += increment;
        if (phase >= 1.0)
            phase -= 1.0;
        return out;
    }
};
} // namespace sdc

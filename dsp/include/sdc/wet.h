#pragma once

#include <algorithm>
#include <cmath>
#include <vector>

#include "reverb.h"

namespace sdc
{
/** Linear ramp toward a target over a fixed time (like juce::SmoothedValue). */
class LinearSmoother
{
public:
    void reset(double sampleRate, double seconds) { steps = std::max(1, (int) (sampleRate * seconds)); countdown = 0; }
    void setCurrentAndTarget(float v) { current = target = v; countdown = 0; }
    void setTarget(float v)
    {
        if (v == target)
            return;
        target = v;
        countdown = steps;
        increment = (target - current) / (float) steps;
    }
    float getCurrent() const { return current; }
    float next()
    {
        if (countdown <= 0)
            return current = target;
        --countdown;
        current += increment;
        return current;
    }

private:
    float current = 0.0f, target = 0.0f, increment = 0.0f;
    int steps = 1, countdown = 0;
};

/** The "wet" channel from the VST3, with three modes:
    - Reverb: a lush stereo room/hall. Time = size, Modify = brightness.
    - Delay:  a tape-ish stereo echo. Time = delay time, Modify = feedback.
    - Slip:   a pitch-slipping delay whose repeats play backwards or at another
              octave. Time = slice length, Modify = speed (reverse / half speed /
              reverse octave-up / octave-up). */
class WetEngine
{
public:
    enum class Mode : int { reverb = 0, delay, slip };

    struct Params
    {
        Mode mode = Mode::reverb;
        float mix = 0.0f;    // 0 = dry, 1 = fully wet
        float time = 0.5f;   // 0..1, meaning depends on mode
        float modify = 0.5f; // 0..1, meaning depends on mode
    };

    static constexpr double maxDelaySeconds = 2.0;

    void prepare(double sr, int maxBlock)
    {
        sampleRate = sr;
        reverb.setSampleRate(sr);
        wetL.assign((size_t) maxBlock, 0.0f);
        wetR.assign((size_t) maxBlock, 0.0f);
        ringLength = (int) std::ceil(sr * maxDelaySeconds * 2.0) + 4;
        for (auto& r : ring)
            r.assign((size_t) ringLength, 0.0f);
        smoothedMix.reset(sr, 0.05);
        smoothedDelay.reset(sr, 0.25);
        reset();
    }

    void reset()
    {
        reverb.reset();
        for (auto& r : ring)
            std::fill(r.begin(), r.end(), 0.0f);
        writePos = 0;
        slipPhase = 0.0;
        feedbackLp[0] = feedbackLp[1] = 0.0f;
        lastWet[0] = lastWet[1] = 0.0f;
        smoothedMix.setCurrentAndTarget(params.mix);
    }

    void setParams(const Params& p) { params = p; }

    /** Processes left/right in place; numSamples must not exceed prepare()'s maxBlock. */
    void process(float* left, float* right, int numSamples)
    {
        float* io[2] = { left, right };

        if (params.mode != lastMode)
        {
            // Switching modes: start from a clean slate so old echoes don't bleed through.
            for (auto& r : ring)
                std::fill(r.begin(), r.end(), 0.0f);
            reverb.reset();
            lastWet[0] = lastWet[1] = 0.0f;
            lastMode = params.mode;
        }

        smoothedMix.setTarget(params.mix);

        if (params.mix <= 0.0001f && smoothedMix.getCurrent() <= 0.0001f)
        {
            // Keep the ring fed so turning the mix up later picks up live material.
            for (int i = 0; i < numSamples; ++i)
            {
                for (int ch = 0; ch < 2; ++ch)
                    ring[ch][(size_t) writePos] = io[ch][i];
                writePos = (writePos + 1) % ringLength;
            }
            return;
        }

        float* wet[2] = { wetL.data(), wetR.data() };
        for (int ch = 0; ch < 2; ++ch)
            std::copy(io[ch], io[ch] + numSamples, wet[ch]);

        if (params.mode == Mode::reverb)
        {
            reverb.setParameters(0.35f + 0.64f * params.time, 0.9f - 0.85f * params.modify);
            reverb.process(wet[0], wet[1], numSamples);
        }
        else
        {
            // Time knob: 20 ms .. maxDelaySeconds, exponential.
            const float delaySeconds = 0.02f * std::pow((float) maxDelaySeconds / 0.02f, params.time);
            smoothedDelay.setTarget(delaySeconds * (float) sampleRate);

            const double speed = slipSpeedFor(params.modify);
            const float feedback = std::min(0.95f, std::max(0.0f, params.modify * 0.95f));

            for (int i = 0; i < numSamples; ++i)
            {
                float delaySamples = smoothedDelay.next();
                // A slip head can reach up to 3 slices back (reverse octave-up), so keep it inside the ring.
                if (params.mode == Mode::slip)
                    delaySamples = std::min(delaySamples, (float) (ringLength - 8) / 3.0f);

                for (int ch = 0; ch < 2; ++ch)
                {
                    const float in = wet[ch][i];
                    wet[ch][i] = params.mode == Mode::delay ? delaySample(ch, in, delaySamples, feedback)
                                                            : slipSample(ch, in, delaySamples, speed);
                }
                writePos = (writePos + 1) % ringLength;

                if (params.mode == Mode::slip)
                {
                    slipPhase += 1.0 / std::max(1.0f, delaySamples);
                    if (slipPhase >= 1.0)
                        slipPhase -= 1.0;
                }
            }
        }

        // Equal-power dry/wet mix.
        constexpr float halfPi = 1.57079632679489662f;
        for (int i = 0; i < numSamples; ++i)
        {
            const float mix = smoothedMix.next();
            const float dryGain = std::cos(mix * halfPi);
            const float wetGain = std::sin(mix * halfPi);
            for (int ch = 0; ch < 2; ++ch)
                io[ch][i] = io[ch][i] * dryGain + wet[ch][i] * wetGain;
        }
    }

private:
    static double slipSpeedFor(float modify)
    {
        if (modify < 0.25f) return -1.0; // reverse
        if (modify < 0.5f)  return 0.5;  // half speed, one octave down
        if (modify < 0.75f) return -2.0; // reverse, one octave up
        return 2.0;                      // double speed, one octave up
    }

    float readRing(int ch, double delaySamples) const
    {
        double readPos = (double) writePos - delaySamples;
        while (readPos < 0.0)
            readPos += ringLength;
        const int i0 = (int) readPos % ringLength;
        const int i1 = (i0 + 1) % ringLength;
        const float frac = (float) (readPos - std::floor(readPos));
        return ring[ch][(size_t) i0] + frac * (ring[ch][(size_t) i1] - ring[ch][(size_t) i0]);
    }

    float delaySample(int ch, float input, float delaySamples, float feedback)
    {
        // Ping-pong-ish width: the right channel runs slightly late.
        const float delayed = readRing(ch, delaySamples * (ch == 1 ? 1.03f : 1.0f));
        // Darken the repeats a little each time, like tape.
        feedbackLp[ch] += 0.35f * (delayed - feedbackLp[ch]);
        ring[ch][(size_t) writePos] = input + std::tanh(feedbackLp[ch] * feedback);
        return delayed;
    }

    float slipSample(int ch, float input, float sliceSamples, double speed)
    {
        // Two overlapping read heads with sin^2 windows (they sum to exactly 1).
        // Each head's delay sweeps linearly so it reads at `speed` relative to real time.
        const double sweep = std::abs(1.0 - speed) * (double) sliceSamples;
        float out = 0.0f;
        for (int h = 0; h < 2; ++h)
        {
            double p = slipPhase + 0.5 * h;
            if (p >= 1.0)
                p -= 1.0;
            const double delay = (1.0 - speed) > 0.0 ? sweep * p : sweep * (1.0 - p);
            const float window = (float) std::pow(std::sin(3.14159265358979323846 * p), 2.0);
            out += window * readRing(ch, delay + 2.0);
        }
        ring[ch][(size_t) writePos] = input + 0.35f * lastWet[ch];
        lastWet[ch] = out;
        return out;
    }

    double sampleRate = 48000.0;
    Params params;
    Mode lastMode = Mode::reverb;
    Reverb reverb;
    std::vector<float> wetL, wetR;
    std::vector<float> ring[2];
    int ringLength = 1;
    int writePos = 0;
    float feedbackLp[2] = { 0.0f, 0.0f };
    float lastWet[2] = { 0.0f, 0.0f };
    double slipPhase = 0.0;
    LinearSmoother smoothedMix, smoothedDelay;
};
} // namespace sdc

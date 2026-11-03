#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

namespace sdc
{
/** Granular micro-looper / degrader, ported from the VST3's GlitchEngine.
    Continuously records live audio, periodically freezes a grain and loops it,
    pitch-shifts the loop by musical intervals only, progressively degrades it
    the longer it repeats, and lets a single "chaos" control introduce
    generative randomness (tape wow/flutter, random reverse flips).

    Every loop boundary is crossfaded between two playheads so nothing clicks,
    and the loop follows the input: when the input goes silent the loop fades
    out (unless keepLooping is on), and a new note immediately grabs a fresh
    grain of itself instead of replaying the previous note. */
class GlitchEngine
{
public:
    struct Params
    {
        float mix = 1.0f;            // 0 = dry, 1 = fully glitched
        float grainSizeMs = 250.0f;  // length of the captured loop/grain
        int intervalSemitones = 0;   // base transposition of the loop, in semitones
        float jumpChance = 0.0f;     // chance a new grain jumps to a random consonant interval
        float holdAmount = 0.0f;     // 0 = keep grabbing fresh grains, 1 = repeat the same grain
        float degrade = 0.0f;        // bit/rate crush + grit, intensified the longer a grain repeats
        float chaos = 0.0f;          // generative randomness: wow/flutter, random reverse flips
        float reverseAmount = 0.0f;  // base chance a freshly captured grain plays backwards
        float toneTilt = 0.5f;       // 0 = dark/lowpassed, 1 = bright/highpass-emphasised
        bool keepLooping = false;    // true = loop keeps sounding after the input goes silent
    };

    /** Intervals (in semitones) offered by the loop-interval parameter. */
    static constexpr std::array<int, 10> intervalChoices { -24, -12, -7, -5, 0, 5, 7, 12, 19, 24 };

    void prepare(double sr)
    {
        sampleRate = sr;
        liveRingLength = std::max(1, (int) std::round(sampleRate * 2.5));
        for (int ch = 0; ch < 2; ++ch)
        {
            liveRing[ch].assign((size_t) liveRingLength, 0.0f);
            // Both grain buffers at the maximum size, so the audio thread never allocates.
            for (auto& g : grains)
                g[ch].assign((size_t) liveRingLength, 0.0f);
        }
        liveWritePos = 0;
        reset();
    }

    void reset()
    {
        for (auto& h : heads)
            h = Head {};
        grainLengths = { 1, 1 };
        mainHead = 0;
        repeatCount = 0;
        currentSemitones = 0;
        inputEnvelope = 0.0f;
        gateGain = 0.0f;
        inputActive = false;
        samplesSinceOnset = 0;
        pendingCaptureCountdown = -1;
        heldSample[0] = heldSample[1] = 0.0f;
        holdCounter[0] = holdCounter[1] = 0;
        tiltLp[0] = tiltLp[1] = 0.0f;
        wowCurrent = wowTarget = 0.0f;
        wowCounter = 0;
    }

    void setParams(const Params& p) { params = p; }

    /** Processes left/right in place. */
    void process(float* left, float* right, int numSamples)
    {
        static constexpr std::array<int, 7> jumpIntervals { -12, -5, 0, 7, 12, 19, 24 }; // always "in key"
        constexpr float gateThreshold = 0.0005f; // ~ -66 dBFS
        float* io[2] = { left, right };

        const int grainLen = std::min(liveRingLength, std::max(1,
            (int) std::round(sampleRate * (double) std::max(10.0f, params.grainSizeMs) / 1000.0)));
        const float envRelease = (float) std::exp(-1.0 / (0.08 * sampleRate));
        const float gateUpStep = (float) (1.0 / (0.005 * sampleRate));
        const float gateDownStep = (float) (1.0 / (0.25 * sampleRate));

        for (int i = 0; i < numSamples; ++i)
        {
            // Record input and follow its envelope.
            float peak = 0.0f;
            for (int ch = 0; ch < 2; ++ch)
            {
                liveRing[ch][(size_t) liveWritePos] = io[ch][i];
                peak = std::max(peak, std::fabs(io[ch][i]));
            }
            liveWritePos = (liveWritePos + 1) % liveRingLength;

            inputEnvelope = std::max(peak, inputEnvelope * envRelease);
            const bool nowActive = inputEnvelope > gateThreshold;
            if (nowActive && !inputActive)
            {
                // New note: wait a moment so the grain we grab is the new note, not the last one.
                samplesSinceOnset = 0;
                pendingCaptureCountdown = std::min(grainLen, (int) (0.12 * sampleRate));
            }
            inputActive = nowActive;
            if (inputActive)
                ++samplesSinceOnset;

            if (pendingCaptureCountdown > 0 && --pendingCaptureCountdown == 0)
            {
                startGrain(true, std::min(grainLen, samplesSinceOnset), jumpIntervals.data(), (int) jumpIntervals.size());
                pendingCaptureCountdown = -1;
            }

            // Loop boundary: crossfade into the next grain (fresh capture or a repeat).
            {
                auto& h = heads[(size_t) mainHead];
                if (h.active && h.fadeDirection >= 0)
                {
                    const int len = grainLengths[(size_t) h.bufferIndex];
                    const double remaining = h.reversed ? h.pos : (double) (len - 1) - h.pos;
                    if (remaining <= (double) fadeLengthFor(h) * h.rate)
                    {
                        const bool fresh = inputActive && nextFloat() >= params.holdAmount;
                        startGrain(fresh, std::min(grainLen, std::max(1, samplesSinceOnset)),
                                   jumpIntervals.data(), (int) jumpIntervals.size());
                    }
                }
            }

            const bool anyHeadActive = heads[0].active || heads[1].active;
            const bool gateOpen = params.keepLooping ? anyHeadActive : (inputActive && pendingCaptureCountdown < 0);
            gateGain = gateOpen ? std::min(1.0f, gateGain + gateUpStep) : std::max(0.0f, gateGain - gateDownStep);
            const float effectiveMix = params.mix * gateGain;

            for (int ch = 0; ch < 2; ++ch)
            {
                float wet = 0.0f;
                for (const auto& h : heads)
                    if (h.active)
                        wet += h.gain * readHead(h, ch);
                wet = applyToneTilt(ch, applyDegrade(ch, wet));
                const float dry = io[ch][i];
                io[ch][i] = dry + effectiveMix * (wet - dry);
            }

            // Advance playheads and their crossfade gains.
            const double wow = 1.0 + (double) nextWowOffset();
            for (int hi = 0; hi < 2; ++hi)
            {
                auto& h = heads[(size_t) hi];
                if (!h.active)
                    continue;
                const int len = grainLengths[(size_t) h.bufferIndex];
                h.pos += (h.reversed ? -1.0 : 1.0) * h.rate * wow;
                if (h.pos < 0.0 || h.pos > (double) (len - 1))
                {
                    if (hi != mainHead || h.fadeDirection < 0)
                    {
                        h.active = false;
                        continue;
                    }
                    h.pos = h.reversed ? (double) (len - 1) : 0.0;
                }
                if (h.fadeDirection > 0)
                {
                    h.gain += h.fadeStep;
                    if (h.gain >= 1.0f) { h.gain = 1.0f; h.fadeDirection = 0; }
                }
                else if (h.fadeDirection < 0)
                {
                    h.gain -= h.fadeStep;
                    if (h.gain <= 0.0f) { h.gain = 0.0f; h.active = false; }
                }
            }
        }
    }

    /** True while a grain is sounding; for tests and meters. */
    bool isLooping() const { return heads[0].active || heads[1].active; }

private:
    struct Head
    {
        bool active = false;
        int bufferIndex = 0;
        double pos = 0.0;
        double rate = 1.0;
        bool reversed = false;
        float gain = 0.0f;
        float fadeStep = 0.01f;
        int fadeDirection = 0; // +1 fading in, -1 fading out, 0 steady
    };

    int fadeLengthFor(const Head& head) const
    {
        const int len = grainLengths[(size_t) head.bufferIndex];
        const double maxFade = sampleRate * 0.012;
        const double fitFade = (double) len / (3.0 * std::max(0.01, head.rate));
        return std::max(8, (int) std::min(maxFade, fitFade));
    }

    void startGrain(bool captureFresh, int captureLength, const int* jumps, int numJumps)
    {
        auto& oldHead = heads[(size_t) mainHead];
        const int newIndex = 1 - mainHead;
        auto& newHead = heads[(size_t) newIndex];
        int bufferIndex = 0;
        bool reversed = false;

        if (captureFresh || !oldHead.active)
        {
            bufferIndex = oldHead.active ? 1 - oldHead.bufferIndex : 0;
            const int minLen = std::max(1, (int) std::round(sampleRate * 0.01));
            const int len = std::min(liveRingLength, std::max(minLen, captureLength));
            for (int ch = 0; ch < 2; ++ch)
            {
                for (int i = 0; i < len; ++i)
                {
                    int src = (liveWritePos - len + i) % liveRingLength;
                    if (src < 0)
                        src += liveRingLength;
                    grains[bufferIndex][ch][(size_t) i] = liveRing[ch][(size_t) src];
                }
            }
            grainLengths[(size_t) bufferIndex] = len;
            reversed = nextFloat() < params.reverseAmount;
            repeatCount = 0;
            currentSemitones = params.intervalSemitones;
            if (nextFloat() < params.jumpChance)
                currentSemitones = jumps[nextInt(numJumps)];
        }
        else
        {
            bufferIndex = oldHead.bufferIndex;
            reversed = oldHead.reversed;
            if (params.chaos > 0.0f && nextFloat() < params.chaos * 0.5f)
                reversed = !reversed;
            ++repeatCount;
        }

        const int len = grainLengths[(size_t) bufferIndex];
        newHead.active = true;
        newHead.bufferIndex = bufferIndex;
        newHead.reversed = reversed;
        newHead.rate = std::pow(2.0, currentSemitones / 12.0);
        newHead.pos = reversed ? (double) (len - 1) : 0.0;
        newHead.gain = 0.0f;
        newHead.fadeDirection = 1;
        newHead.fadeStep = 1.0f / (float) fadeLengthFor(newHead);

        if (oldHead.active)
        {
            oldHead.fadeDirection = -1;
            oldHead.fadeStep = 1.0f / (float) fadeLengthFor(oldHead);
        }
        mainHead = newIndex;
    }

    float readHead(const Head& head, int ch) const
    {
        const auto& grain = grains[head.bufferIndex][ch];
        const int len = grainLengths[(size_t) head.bufferIndex];
        const int i0 = std::min(len - 1, std::max(0, (int) std::floor(head.pos)));
        const int i1 = std::min(i0 + 1, len - 1);
        const float frac = (float) (head.pos - std::floor(head.pos));
        return grain[(size_t) i0] + frac * (grain[(size_t) i1] - grain[(size_t) i0]);
    }

    float applyDegrade(int ch, float sample)
    {
        const float repeatFactor = std::min(1.0f, (float) repeatCount / 8.0f);
        const float intensity = std::min(1.0f, std::max(0.0f, params.degrade * 0.6f + params.degrade * repeatFactor * 0.4f));
        if (intensity <= 0.0f)
            return sample;

        const int divider = 1 + (int) std::round(intensity * 24.0f);
        if (holdCounter[ch] <= 0)
        {
            heldSample[ch] = sample;
            holdCounter[ch] = divider;
        }
        --holdCounter[ch];

        const float bits = 16.0f + intensity * (3.0f - 16.0f);
        const float levels = std::pow(2.0f, bits);
        float crushed = std::round(heldSample[ch] * levels) / levels;
        crushed += (nextFloat() * 2.0f - 1.0f) * intensity * 0.03f * std::fabs(heldSample[ch]);
        return crushed;
    }

    float applyToneTilt(int ch, float sample)
    {
        tiltLp[ch] += 0.15f * (sample - tiltLp[ch]);
        const float hp = sample - tiltLp[ch];
        const float tilt = std::min(1.0f, std::max(0.0f, params.toneTilt));
        return tiltLp[ch] + tilt * 2.0f * hp;
    }

    float nextWowOffset()
    {
        if (--wowCounter <= 0)
        {
            wowCounter = 1 + nextInt(std::max(1, (int) (sampleRate * 0.15)));
            // Kept within ~+-20 cents so the wobble sounds like tape, not out of tune.
            wowTarget = (nextFloat() * 2.0f - 1.0f) * 0.012f;
        }
        wowCurrent += 0.0005f * (wowTarget - wowCurrent);
        return wowCurrent * std::min(1.0f, std::max(0.0f, params.chaos));
    }

    // xorshift32: cheap and allocation-free.
    float nextFloat()
    {
        rng ^= rng << 13;
        rng ^= rng >> 17;
        rng ^= rng << 5;
        return (float) (rng >> 8) / 16777216.0f; // [0, 1)
    }
    int nextInt(int n) { return std::min(n - 1, (int) (nextFloat() * (float) n)); }

    double sampleRate = 48000.0;
    Params params;

    std::vector<float> liveRing[2];
    int liveRingLength = 1;
    int liveWritePos = 0;

    std::vector<float> grains[2][2]; // [buffer][channel]
    std::array<int, 2> grainLengths { 1, 1 };
    std::array<Head, 2> heads {};
    int mainHead = 0;
    int repeatCount = 0;
    int currentSemitones = 0;

    float inputEnvelope = 0.0f;
    float gateGain = 0.0f;
    bool inputActive = false;
    int samplesSinceOnset = 0;
    int pendingCaptureCountdown = -1;

    float heldSample[2] = { 0.0f, 0.0f };
    int holdCounter[2] = { 0, 0 };
    float tiltLp[2] = { 0.0f, 0.0f };

    float wowCurrent = 0.0f, wowTarget = 0.0f;
    int wowCounter = 0;
    uint32_t rng = 0x2545F491u;
};
} // namespace sdc

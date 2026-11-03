#pragma once

#include <cmath>
#include <cstdint>

#include "envelope.h"
#include "filter.h"
#include "oscillator.h"

namespace sdc
{
enum class LfoShape : int { sine, triangle, saw, square, random };
enum class LfoTarget : int { filter, pitch, volume };

/** Everything a voice reads while rendering; owned by the Synth and shared by all voices. */
struct VoiceSettings
{
    Wave wave[2] = { Wave::saw, Wave::saw };
    float level[2] = { 1.0f, 0.0f };
    float pitchOffset[2] = { 0.0f, 0.07f }; // semitones: octave + semitone + fine
    float cutoff = 4000.0f;
    float resonance = 0.7f;
    float filterEnv = 24.0f; // semitones at full envelope
    LfoShape lfoShape = LfoShape::sine;
    LfoTarget lfoTarget = LfoTarget::filter;
    float lfoRate = 4.0f;
    float lfoDepth = 0.0f;
    const CustomWave* customWave[2] = { nullptr, nullptr };
};

/** One note: two oscillators into a resonant low-pass, an ADSR on amplitude and
    cutoff, and an LFO that restarts with the note. */
class Voice
{
public:
    static constexpr float gain = 0.3f;              // headroom for chords across all voices
    static constexpr float lfoFilterRange = 36.0f;   // +-3 octaves of cutoff at full depth
    static constexpr float lfoPitchRange = 2.0f;     // vibrato up to +-a whole tone

    void setSampleRate(double sr)
    {
        sampleRate = sr;
        envelope.setSampleRate(sr);
        filter.setSampleRate(sr);
        dcCoeff = 1.0f - (float) (6.283185307179586 * 10.0 / sr);       // ~10 Hz high-pass
        lfoSmoothCoeff = (float) std::exp(-1.0 / (0.002 * sr));        // ~2 ms
        declickCoeff = (float) std::exp(-1.0 / (0.004 * sr));          // ~4 ms
    }

    Envelope& getEnvelope() { return envelope; }
    bool isActive() const { return envelope.isActive(); }
    bool isReleasing() const { return envelope.getStage() == Envelope::Stage::release; }
    int getNote() const { return note; }
    uint32_t getStartOrder() const { return startOrder; }

    void start(int midiNote, float velocity, uint32_t order)
    {
        note = midiNote;
        level = velocity;
        startOrder = order;
        for (auto& osc : oscillators)
            osc.reset();
        lfoPhase = 0.0;
        lfoHeld = nextRandom();
        lfoSmoothed = 0.0f;
        // If this voice was stolen mid-sound, fade out what it was playing instead of jumping.
        declick = lastOutput;
        dcIn = dcOut = 0.0f;
        filter.reset();
        envelope.noteOn();
    }

    void release() { envelope.noteOff(); }

    /** Adds this voice's output (mono) into out. */
    void render(const VoiceSettings& s, float* out, int numSamples)
    {
        const double noteHz = 440.0 * std::pow(2.0, (note - 69) / 12.0);
        double baseIncrement[2];
        for (int o = 0; o < 2; ++o)
            baseIncrement[o] = noteHz * std::pow(2.0, s.pitchOffset[o] / 12.0) / sampleRate;

        for (int i = 0; i < numSamples; ++i)
        {
            if (!envelope.isActive())
            {
                lastOutput = declick = 0.0f;
                return;
            }

            const float lfo = nextLfo(s);
            const float lfoAmount = lfo * s.lfoDepth;
            const float lfoCutoff = s.lfoTarget == LfoTarget::filter ? lfoAmount * lfoFilterRange : 0.0f;
            const float lfoPitch = s.lfoTarget == LfoTarget::pitch ? lfoAmount * lfoPitchRange : 0.0f;
            // Tremolo only dips below full level, so turning it up never makes notes louder.
            const float lfoGain = s.lfoTarget == LfoTarget::volume ? 1.0f - s.lfoDepth * 0.5f * (1.0f - lfo) : 1.0f;

            const float env = envelope.next();
            const float cutoff = s.cutoff * std::exp2((s.filterEnv * env + lfoCutoff) / 12.0f);
            const double pitchRatio = lfoPitch != 0.0f ? std::exp2((double) lfoPitch / 12.0) : 1.0;

            float mix = 0.0f;
            for (int o = 0; o < 2; ++o)
            {
                double inc = baseIncrement[o] * pitchRatio;
                inc = inc > 0.49 ? 0.49 : inc;
                const CustomWave& custom = s.customWave[o] != nullptr ? *s.customWave[o] : fallbackWave;
                mix += oscillators[o].next(s.wave[o], inc, custom) * s.level[o]; // always advance, phases stay in step
            }

            // Custom waves can sit off-centre; remove that offset before it thumps.
            const float dc = mix - dcIn + dcCoeff * dcOut;
            dcIn = mix;
            dcOut = dc;

            const float filtered = filter.process(dc, cutoff, s.resonance);
            declick *= declickCoeff;
            const float sample = filtered * level * env * lfoGain * gain + declick;
            lastOutput = sample;
            out[i] += sample;
        }
    }

private:
    float nextLfo(const VoiceSettings& s)
    {
        const float p = (float) lfoPhase;
        float raw = 0.0f;
        switch (s.lfoShape)
        {
            case LfoShape::sine:     raw = std::sin(p * twoPi); break;
            case LfoShape::triangle: raw = 1.0f - 4.0f * std::fabs(p - 0.5f); break;
            case LfoShape::saw:      raw = 2.0f * p - 1.0f; break;
            case LfoShape::square:   raw = p < 0.5f ? 1.0f : -1.0f; break;
            case LfoShape::random:   raw = lfoHeld; break; // sample & hold: a new level every cycle
        }

        lfoPhase += s.lfoRate / sampleRate;
        if (lfoPhase >= 1.0)
        {
            lfoPhase -= 1.0;
            lfoHeld = nextRandom();
        }

        lfoSmoothed = raw + lfoSmoothCoeff * (lfoSmoothed - raw); // square/random steps don't click
        return lfoSmoothed;
    }

    /** xorshift32 mapped to -1..1: cheap, allocation-free, deterministic per voice. */
    float nextRandom()
    {
        rng ^= rng << 13;
        rng ^= rng >> 17;
        rng ^= rng << 5;
        return (float) (rng & 0xffffff) / (float) 0x7fffff - 1.0f;
    }

    double sampleRate = 48000.0;
    int note = 60;
    float level = 0.0f;
    uint32_t startOrder = 0;

    Oscillator oscillators[2];
    Envelope envelope;
    LowPassFilter filter;
    CustomWave fallbackWave;

    double lfoPhase = 0.0;
    float lfoHeld = 0.0f;
    float lfoSmoothed = 0.0f;
    float lfoSmoothCoeff = 0.99f;
    uint32_t rng = 0x9e3779b9u;

    float dcCoeff = 0.999f, dcIn = 0.0f, dcOut = 0.0f;
    float lastOutput = 0.0f, declick = 0.0f, declickCoeff = 0.99f;
};
} // namespace sdc
